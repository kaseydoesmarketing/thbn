require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

var thumbnailQueue = require('../queues/thumbnailQueue');
var nanoClient = require('../services/nanoClient');
var faceSwapClient = require('../services/faceSwapClient');
var storageService = require('../services/storageService');
var db = require('../db/connection');
var fs = require('fs');
var path = require('path');

// Upload directory for face images
var UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

/**
 * Two-Step Thumbnail Generation Pipeline:
 *
 * Step 1: Gemini 2.5 Flash Image - Creative generation with placeholder person
 *         (Best for: composition, lighting, style, eye-catching design)
 *
 * Step 2: Easel Face Swap - Replace placeholder with user's actual face
 *         (Best for: photorealistic face likeness preservation)
 *
 * This gives the best of both worlds: creative thumbnails + exact face likeness
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

console.log('[Worker] Starting thumbnail worker...');

// Process jobs
thumbnailQueue.queue.process('generate', async function(job) {
    var data = job.data;
    var jobId = data.jobId;
    var userId = data.userId;

    console.log('[Worker] Processing job ' + jobId);

    // Check if face swap is available and needed
    var useFaceSwap = faceSwapClient.isAvailable() &&
                      data.faceImages &&
                      data.faceImages.length > 0;

    if (useFaceSwap) {
        console.log('[Worker] Two-step pipeline: Gemini + Face Swap');
    } else {
        console.log('[Worker] Single-step pipeline: Gemini only');
    }

    try {
        // Update status to processing
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );

        job.progress(5);

        // STEP 1: Prepare face image URL (if using face swap)
        var faceImageUrl = null;
        if (useFaceSwap) {
            console.log('[Worker] Step 1a: Preparing face image for swap...');
            var faceData = await getFaceImageUrl(userId, data.faceImages[0]);
            if (faceData && faceData.publicUrl) {
                faceImageUrl = faceData.publicUrl;
                console.log('[Worker] Face image URL ready: ' + faceImageUrl.substring(0, 60) + '...');
            } else {
                console.log('[Worker] Could not get public URL for face image, falling back to Gemini multimodal');
                useFaceSwap = false;
            }
        }

        job.progress(10);

        // Build prompt - include person description for face swap pipeline
        var prompt = data.brief;
        if (data.niche) {
            prompt = '[' + data.niche.toUpperCase() + ' NICHE] ' + prompt;
        }

        // For face swap pipeline: ensure prompt describes a person
        // Gemini will generate a placeholder person that we'll swap
        if (useFaceSwap && !prompt.toLowerCase().includes('person') &&
            !prompt.toLowerCase().includes('man') &&
            !prompt.toLowerCase().includes('woman') &&
            !prompt.toLowerCase().includes('creator') &&
            !prompt.toLowerCase().includes('youtuber')) {
            prompt += ' featuring an expressive person';
        }

        job.progress(15);

        // STEP 2: Generate with Gemini 2.5 Flash Image
        console.log('[Worker] Step 2: Generating with Gemini 2.5 Flash Image...');

        // For two-step pipeline: don't pass face images to Gemini (we'll swap later)
        // For single-step: pass face images for multimodal generation
        var faceImagesForGemini = [];
        if (!useFaceSwap && data.faceImages && data.faceImages.length > 0) {
            faceImagesForGemini = await loadFaceImages(userId, data.faceImages);
        }

        var result = await nanoClient.createThumbnailJob({
            prompt: prompt,
            style_preset: data.style || 'photorealistic',
            faceImages: faceImagesForGemini
        });

        console.log('[Worker] Gemini returned ' + (result.variants ? result.variants.length : 0) + ' variants');

        job.progress(40);

        // STEP 3: Upload generated thumbnails to get public URLs
        var variants = result.variants || [];
        var uploadedVariants = [];

        for (var i = 0; i < variants.length; i++) {
            var variant = variants[i];
            var variantLabel = variant.variant_label || ('v' + (i + 1));
            var storageUrl = null;

            var imageBuffer = Buffer.from(variant.image_data, 'base64');
            var contentType = variant.mime_type || 'image/png';

            if (storageService.isConfigured()) {
                try {
                    var uploaded = await storageService.uploadThumbnail(
                        imageBuffer,
                        userId,
                        jobId,
                        variantLabel + (useFaceSwap ? '-pre-swap' : ''),
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

            if (!storageUrl) {
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

            uploadedVariants.push({
                variant_label: variantLabel,
                image_data: variant.image_data,
                mime_type: contentType,
                publicUrl: storageUrl
            });

            job.progress(40 + Math.round((i + 1) / variants.length * 20));
        }

        // STEP 4: Face swap (if using two-step pipeline)
        var finalVariants = uploadedVariants;
        if (useFaceSwap && faceImageUrl) {
            console.log('[Worker] Step 4: Applying face swap with Easel AI...');

            try {
                finalVariants = await faceSwapClient.swapFacesForVariants(
                    uploadedVariants,
                    faceImageUrl,
                    data.gender || 'a man'
                );
                console.log('[Worker] Face swap completed for ' + finalVariants.length + ' variants');
            } catch (swapErr) {
                console.error('[Worker] Face swap failed:', swapErr.message);
                console.log('[Worker] Continuing with original Gemini outputs');
                // Keep original variants if face swap fails
            }

            job.progress(80);
        }

        // STEP 5: Store final variants
        var storedVariants = [];
        for (var j = 0; j < finalVariants.length; j++) {
            var finalVariant = finalVariants[j];
            var label = finalVariant.variant_label;
            var finalUrl = null;

            // If face was swapped, re-upload the swapped image
            if (finalVariant.face_swapped && finalVariant.image_data) {
                var swappedBuffer = Buffer.from(finalVariant.image_data, 'base64');
                var swappedType = finalVariant.mime_type || 'image/png';

                if (storageService.isConfigured()) {
                    try {
                        var swapUploaded = await storageService.uploadThumbnail(
                            swappedBuffer,
                            userId,
                            jobId,
                            label,
                            swappedType
                        );
                        if (swapUploaded) {
                            finalUrl = swapUploaded.url;
                            console.log('[Worker] Uploaded face-swapped variant ' + label);
                        }
                    } catch (swapUploadErr) {
                        console.error('[Worker] Failed to upload swapped variant:', swapUploadErr.message);
                    }
                }

                if (!finalUrl) {
                    var swapExt = swappedType.includes('jpeg') ? '.jpg' : '.png';
                    var swapDir = path.join(__dirname, '../../uploads', jobId);
                    if (!fs.existsSync(swapDir)) {
                        fs.mkdirSync(swapDir, { recursive: true });
                    }
                    var swapPath = path.join(swapDir, label + swapExt);
                    fs.writeFileSync(swapPath, swappedBuffer);
                    finalUrl = '/uploads/' + jobId + '/' + label + swapExt;
                }
            } else {
                finalUrl = finalVariant.publicUrl;
            }

            // Store in database
            await db.query(
                'INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label) VALUES ($1, $2, $3, $4)',
                [jobId, userId, finalUrl, label]
            );

            storedVariants.push({
                label: label,
                url: finalUrl,
                face_swapped: finalVariant.face_swapped || false
            });

            job.progress(80 + Math.round((j + 1) / finalVariants.length * 18));
        }

        // Mark job as completed
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);

        var pipelineUsed = useFaceSwap ? 'Gemini + Face Swap' : 'Gemini';
        console.log('[Worker] Job ' + jobId + ' completed with ' + storedVariants.length + ' variants (' + pipelineUsed + ')');

        return {
            success: true,
            variants: storedVariants,
            pipeline: pipelineUsed
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
