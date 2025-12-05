require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

var thumbnailQueue = require('../queues/thumbnailQueue');
var fluxClient = require('../services/fluxClient');
var nanoClient = require('../services/nanoClient'); // Fallback
var promptEngine = require('../services/promptEngine');
var textOverlayService = require('../services/textOverlayService');
var storageService = require('../services/storageService');
var db = require('../db/connection');
var fs = require('fs');
var path = require('path');

// Upload directory for face images
var UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

/**
 * ThumbnailBuilder v2.0 - Professional Quality Pipeline
 *
 * NEW ARCHITECTURE:
 * 1. Flux PuLID - Face likeness baked into generation (no separate swap)
 * 2. PromptEngine - Professional prompts from STYLE_REFERENCE.md
 * 3. TextOverlay - Bold text with strokes, shadows, glow
 *
 * PIPELINE:
 * User Input → Prompt Engine → Flux + Face ID → Text Overlay → Final Image
 *
 * This produces professional-quality thumbnails matching inspiration examples.
 */

/**
 * Get a public URL for a face image (for face swap API)
 * Uploads to Supabase if not already there
 * @param {string} userId - User ID
 * @param {string|Object} faceRef - Face image ID, URL, or object
 * @returns {Object|null} {publicUrl, localPath, storageKey} or null
 */
async function getFaceImageUrl(userId, faceRef) {
    try {
        var storageKey = null;

        if (typeof faceRef === 'string') {
            if (faceRef.startsWith('/uploads/')) {
                storageKey = faceRef.replace('/uploads/', '');
            } else if (faceRef.startsWith('http')) {
                // Already a public URL
                return { publicUrl: faceRef, localPath: null, storageKey: null };
            } else if (faceRef.includes('_')) {
                storageKey = faceRef;
            } else {
                var imgResult = await db.query(
                    'SELECT storage_key FROM face_profile_images WHERE id = $1',
                    [faceRef]
                );
                if (imgResult.rows.length > 0) {
                    storageKey = imgResult.rows[0].storage_key;
                }
            }
        } else if (faceRef && faceRef.url) {
            if (faceRef.url.startsWith('http')) {
                return { publicUrl: faceRef.url, localPath: null, storageKey: null };
            }
            storageKey = faceRef.url.replace('/uploads/', '');
        }

        if (!storageKey) {
            console.log('[Worker] Could not resolve face image:', faceRef);
            return null;
        }

        var filePath = path.join(UPLOAD_DIR, storageKey);
        if (!fs.existsSync(filePath)) {
            console.log('[Worker] Face image file not found:', filePath);
            return null;
        }

        // Upload to Supabase to get a public URL
        if (storageService.isConfigured()) {
            var imageBuffer = fs.readFileSync(filePath);
            var ext = path.extname(storageKey).toLowerCase();
            var contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

            try {
                var uploaded = await storageService.uploadFaceImage(
                    imageBuffer,
                    userId,
                    'face-ref-' + Date.now(),
                    contentType
                );
                if (uploaded && uploaded.url) {
                    console.log('[Worker] Uploaded face image to Supabase for face swap');
                    return { publicUrl: uploaded.url, localPath: filePath, storageKey: storageKey };
                }
            } catch (uploadErr) {
                console.error('[Worker] Failed to upload face image:', uploadErr.message);
            }
        }

        // Fallback: return local path (face swap won't work without public URL)
        console.log('[Worker] WARNING: No public URL for face image - face swap may fail');
        return { publicUrl: null, localPath: filePath, storageKey: storageKey };

    } catch (err) {
        console.error('[Worker] Error getting face image URL:', err.message);
        return null;
    }
}

/**
 * Load face images from storage (legacy - for direct Gemini multimodal)
 * @param {string} userId - User ID
 * @param {Array} faceImageIds - Array of face image IDs or URLs
 * @returns {Array} Array of {data: base64, mimeType: string}
 */
async function loadFaceImages(userId, faceImageIds) {
    if (!faceImageIds || faceImageIds.length === 0) {
        return [];
    }

    var faceImages = [];
    var maxImages = 3;

    for (var i = 0; i < Math.min(faceImageIds.length, maxImages); i++) {
        var faceRef = faceImageIds[i];

        try {
            var storageKey = null;

            if (typeof faceRef === 'string') {
                if (faceRef.startsWith('/uploads/')) {
                    storageKey = faceRef.replace('/uploads/', '');
                } else if (faceRef.includes('_')) {
                    storageKey = faceRef;
                } else {
                    var imgResult = await db.query(
                        'SELECT storage_key FROM face_profile_images WHERE id = $1',
                        [faceRef]
                    );
                    if (imgResult.rows.length > 0) {
                        storageKey = imgResult.rows[0].storage_key;
                    }
                }
            } else if (faceRef && faceRef.url) {
                storageKey = faceRef.url.replace('/uploads/', '');
            }

            if (!storageKey) {
                console.log('[Worker] Could not resolve face image:', faceRef);
                continue;
            }

            var filePath = path.join(UPLOAD_DIR, storageKey);
            if (fs.existsSync(filePath)) {
                var imageBuffer = fs.readFileSync(filePath);
                var base64Data = imageBuffer.toString('base64');

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

console.log('[Worker] Starting thumbnail worker v2.0...');

// Process jobs
thumbnailQueue.queue.process('generate', async function(job) {
    var data = job.data;
    var jobId = data.jobId;
    var userId = data.userId;

    console.log('[Worker] Processing job ' + jobId);
    console.log('[Worker] Input:', JSON.stringify({
        brief: data.brief,
        niche: data.niche,
        expression: data.expression,
        thumbnailText: data.thumbnailText,
        hasFaceImages: !!(data.faceImages && data.faceImages.length > 0)
    }));

    // Determine pipeline: Flux (preferred) or Gemini (fallback)
    var useFlux = fluxClient.isAvailable() && data.faceImages && data.faceImages.length > 0;
    var pipelineName = useFlux ? 'Flux PuLID + Text' : 'Gemini + Text';

    console.log('[Worker] Using pipeline: ' + pipelineName);

    try {
        // Update status to processing
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );

        job.progress(5);

        // =====================================================================
        // STEP 1: Prepare Face Image URL
        // =====================================================================
        var faceImageUrl = null;
        if (data.faceImages && data.faceImages.length > 0) {
            console.log('[Worker] Step 1: Preparing face image...');
            var faceData = await getFaceImageUrl(userId, data.faceImages[0]);
            if (faceData && faceData.publicUrl) {
                faceImageUrl = faceData.publicUrl;
                console.log('[Worker] Face image ready: ' + faceImageUrl.substring(0, 60) + '...');
            } else {
                console.log('[Worker] WARNING: Could not get public URL for face image');
                useFlux = false;
                pipelineName = 'Gemini (no face URL)';
            }
        }

        job.progress(10);

        // =====================================================================
        // STEP 2: Build Professional Prompt
        // =====================================================================
        console.log('[Worker] Step 2: Building professional prompt...');

        var prompt = promptEngine.buildProfessionalPrompt({
            brief: data.brief,
            niche: data.niche || 'reaction',
            expression: data.expression || 'excited',
            hasFace: !!faceImageUrl,
            additionalContext: data.additionalContext
        });

        console.log('[Worker] Professional prompt built (' + prompt.length + ' chars)');
        job.progress(15);

        // =====================================================================
        // STEP 3: Generate Images
        // =====================================================================
        var result;

        if (useFlux && faceImageUrl) {
            // PRIMARY: Flux PuLID - face likeness baked in
            console.log('[Worker] Step 3: Generating with Flux PuLID (face preserved)...');

            result = await fluxClient.generateWithFace({
                faceImageUrl: faceImageUrl,
                prompt: prompt,
                numVariants: 2
            });

        } else if (fluxClient.isAvailable() && !faceImageUrl) {
            // Flux without face
            console.log('[Worker] Step 3: Generating with Flux (no face)...');

            result = await fluxClient.generateWithoutFace({
                prompt: prompt,
                numVariants: 2
            });

        } else {
            // FALLBACK: Gemini (legacy)
            console.log('[Worker] Step 3: Generating with Gemini (fallback)...');

            var faceImagesForGemini = [];
            if (data.faceImages && data.faceImages.length > 0) {
                faceImagesForGemini = await loadFaceImages(userId, data.faceImages);
            }

            result = await nanoClient.createThumbnailJob({
                prompt: prompt,
                style_preset: data.niche || 'photorealistic',
                faceImages: faceImagesForGemini
            });
        }

        console.log('[Worker] Generated ' + (result.variants ? result.variants.length : 0) + ' variants');
        job.progress(50);

        // =====================================================================
        // STEP 4: Apply Text Overlay (if thumbnailText provided)
        // =====================================================================
        var variants = result.variants || [];
        var processedVariants = [];

        for (var i = 0; i < variants.length; i++) {
            var variant = variants[i];
            var variantLabel = variant.variant_label || String.fromCharCode(65 + i);

            var imageBuffer = Buffer.from(variant.image_data, 'base64');

            // Apply text overlay if text provided
            if (data.thumbnailText && data.thumbnailText.trim()) {
                console.log('[Worker] Step 4: Adding text overlay to variant ' + variantLabel + '...');

                try {
                    var position = textOverlayService.getSmartPosition(
                        data.niche || 'reaction',
                        data.thumbnailText.length
                    );

                    imageBuffer = await textOverlayService.addTextOverlay(imageBuffer, {
                        text: data.thumbnailText,
                        niche: data.niche || 'reaction',
                        position: position
                    });

                    console.log('[Worker] Text overlay applied to variant ' + variantLabel);
                } catch (textErr) {
                    console.error('[Worker] Text overlay failed:', textErr.message);
                    // Continue with image without text
                }
            }

            processedVariants.push({
                variant_label: variantLabel,
                image_buffer: imageBuffer,
                mime_type: variant.mime_type || 'image/png'
            });

            job.progress(50 + Math.round((i + 1) / variants.length * 20));
        }

        // =====================================================================
        // STEP 5: Upload Final Images
        // =====================================================================
        console.log('[Worker] Step 5: Uploading final images...');

        var storedVariants = [];

        for (var j = 0; j < processedVariants.length; j++) {
            var processed = processedVariants[j];
            var label = processed.variant_label;
            var finalUrl = null;

            var contentType = processed.mime_type;
            var buffer = processed.image_buffer;

            if (storageService.isConfigured()) {
                try {
                    var uploaded = await storageService.uploadThumbnail(
                        buffer,
                        userId,
                        jobId,
                        label,
                        contentType
                    );
                    if (uploaded) {
                        finalUrl = uploaded.url;
                        console.log('[Worker] Uploaded variant ' + label + ' to Supabase');
                    }
                } catch (uploadErr) {
                    console.error('[Worker] Supabase upload failed:', uploadErr.message);
                }
            }

            // Fallback to local storage
            if (!finalUrl) {
                var ext = contentType.includes('jpeg') ? '.jpg' : '.png';
                var localDir = path.join(__dirname, '../../uploads', jobId);

                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }

                var localPath = path.join(localDir, label + ext);
                fs.writeFileSync(localPath, buffer);
                finalUrl = '/uploads/' + jobId + '/' + label + ext;
                console.log('[Worker] Saved variant ' + label + ' locally');
            }

            // Store in database
            await db.query(
                'INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label) VALUES ($1, $2, $3, $4)',
                [jobId, userId, finalUrl, label]
            );

            storedVariants.push({
                label: label,
                url: finalUrl
            });

            job.progress(70 + Math.round((j + 1) / processedVariants.length * 28));
        }

        // =====================================================================
        // COMPLETE
        // =====================================================================
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);

        console.log('[Worker] Job ' + jobId + ' completed with ' + storedVariants.length + ' variants (' + pipelineName + ')');

        return {
            success: true,
            variants: storedVariants,
            pipeline: pipelineName
        };

    } catch (error) {
        console.error('[Worker] Job ' + jobId + ' failed:', error);

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
