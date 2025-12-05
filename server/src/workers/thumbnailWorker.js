require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

var thumbnailQueue = require('../queues/thumbnailQueue');
var nanoClient = require('../services/nanoClient');
var storageService = require('../services/storageService');
var db = require('../db/connection');
var fs = require('fs');
var path = require('path');

// Upload directory for face images
var UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

/**
 * Load face images from storage
 * @param {string} userId - User ID
 * @param {Array} faceImageIds - Array of face image IDs or URLs
 * @returns {Array} Array of {data: base64, mimeType: string}
 */
async function loadFaceImages(userId, faceImageIds) {
    if (!faceImageIds || faceImageIds.length === 0) {
        return [];
    }

    var faceImages = [];
    var maxImages = 3; // Limit to avoid API issues

    for (var i = 0; i < Math.min(faceImageIds.length, maxImages); i++) {
        var faceRef = faceImageIds[i];

        try {
            // Handle different formats: ID, URL, or storage_key
            var storageKey = null;

            if (typeof faceRef === 'string') {
                if (faceRef.startsWith('/uploads/')) {
                    // URL format: /uploads/filename.jpg
                    storageKey = faceRef.replace('/uploads/', '');
                } else if (faceRef.includes('_')) {
                    // Already a storage key: userId_timestamp_filename.jpg
                    storageKey = faceRef;
                } else {
                    // Might be an ID - look up in database
                    var imgResult = await db.query(
                        'SELECT storage_key FROM face_profile_images WHERE id = $1',
                        [faceRef]
                    );
                    if (imgResult.rows.length > 0) {
                        storageKey = imgResult.rows[0].storage_key;
                    }
                }
            } else if (faceRef && faceRef.url) {
                // Object format: {id, url}
                storageKey = faceRef.url.replace('/uploads/', '');
            }

            if (!storageKey) {
                console.log('[Worker] Could not resolve face image:', faceRef);
                continue;
            }

            // Load from local uploads
            var filePath = path.join(UPLOAD_DIR, storageKey);
            if (fs.existsSync(filePath)) {
                var imageBuffer = fs.readFileSync(filePath);
                var base64Data = imageBuffer.toString('base64');

                // Determine MIME type
                var ext = path.extname(storageKey).toLowerCase();
                var mimeType = 'image/jpeg';
                if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.webp') mimeType = 'image/webp';
                else if (ext === '.gif') mimeType = 'image/gif';

                faceImages.push({
                    data: base64Data,
                    mimeType: mimeType
                });
                console.log('[Worker] Loaded face image: ' + storageKey);
            } else {
                console.log('[Worker] Face image not found: ' + filePath);
            }
        } catch (err) {
            console.error('[Worker] Error loading face image:', err.message);
        }
    }

    return faceImages;
}

console.log('[Worker] Starting thumbnail worker...');

// Process jobs
thumbnailQueue.queue.process('generate', async function(job) {
    var data = job.data;
    var jobId = data.jobId;
    var userId = data.userId;

    console.log('[Worker] Processing job ' + jobId);

    try {
        // Update status to processing
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );

        // Update progress
        job.progress(10);

        // Build prompt
        var prompt = data.brief;
        if (data.niche) {
            prompt = '[' + data.niche.toUpperCase() + ' NICHE] ' + prompt;
        }

        job.progress(15);

        // Load face images if provided
        var faceImages = [];
        if (data.faceImages && data.faceImages.length > 0) {
            console.log('[Worker] Loading ' + data.faceImages.length + ' face images...');
            faceImages = await loadFaceImages(userId, data.faceImages);
            console.log('[Worker] Loaded ' + faceImages.length + ' face images for generation');
        }

        job.progress(25);

        // Call Gemini API (Nano Banana)
        console.log('[Worker] Calling Gemini API' + (faceImages.length > 0 ? ' with ' + faceImages.length + ' face images' : '') + '...');
        var result = await nanoClient.createThumbnailJob({
            prompt: prompt,
            style_preset: data.style || 'photorealistic',
            faceImages: faceImages
        });

        console.log('[Worker] Gemini returned ' + (result.variants ? result.variants.length : 0) + ' variants');

        job.progress(50);

        // Store variants
        var variants = result.variants || [];
        var storedVariants = [];

        for (var i = 0; i < variants.length; i++) {
            var variant = variants[i];
            var variantLabel = variant.variant_label || ('v' + (i + 1));
            var storageUrl = null;

            // Convert base64 to buffer
            var imageBuffer = Buffer.from(variant.image_data, 'base64');
            var contentType = variant.mime_type || 'image/png';

            // Upload to Supabase if configured
            if (storageService.isConfigured()) {
                try {
                    var uploaded = await storageService.uploadThumbnail(
                        imageBuffer,
                        userId,
                        jobId,
                        variantLabel,
                        contentType
                    );
                    if (uploaded) {
                        storageUrl = uploaded.url;
                        console.log('[Worker] Uploaded variant ' + variantLabel + ' to Supabase');
                    }
                } catch (uploadErr) {
                    console.error('[Worker] Supabase upload failed:', uploadErr.message);
                }
            }

            // If no Supabase, save locally
            if (!storageUrl) {
                var fs = require('fs');
                var path = require('path');
                var ext = contentType.includes('jpeg') ? '.jpg' : '.png';
                var localDir = path.join(__dirname, '../../uploads', jobId);

                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }

                var localPath = path.join(localDir, variantLabel + ext);
                fs.writeFileSync(localPath, imageBuffer);
                storageUrl = '/uploads/' + jobId + '/' + variantLabel + ext;
                console.log('[Worker] Saved variant ' + variantLabel + ' locally');
            }

            // Store in database
            await db.query(
                'INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label) VALUES ($1, $2, $3, $4)',
                [jobId, userId, storageUrl, variantLabel]
            );

            storedVariants.push({
                label: variantLabel,
                url: storageUrl
            });

            job.progress(50 + Math.round((i + 1) / variants.length * 45));
        }

        // Mark job as completed
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);
        console.log('[Worker] Job ' + jobId + ' completed successfully with ' + storedVariants.length + ' variants');

        return {
            success: true,
            variants: storedVariants
        };

    } catch (error) {
        console.error('[Worker] Job ' + jobId + ' failed:', error);

        // Mark job as failed
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', error.message, jobId]
        );

        throw error;
    }
});

// Graceful shutdown
process.on('SIGTERM', async function() {
    console.log('[Worker] SIGTERM received, shutting down...');
    await thumbnailQueue.close();
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async function() {
    console.log('[Worker] SIGINT received, shutting down...');
    await thumbnailQueue.close();
    await db.close();
    process.exit(0);
});

console.log('[Worker] Thumbnail worker started and listening for jobs');
