require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

var thumbnailQueue = require('../queues/thumbnailQueue');
var nanoClient = require('../services/nanoClient');
var storageService = require('../services/storageService');
var db = require('../db/connection');

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

        job.progress(20);

        // Call Gemini API (Nano Banana)
        console.log('[Worker] Calling Gemini API...');
        var result = await nanoClient.createThumbnailJob({
            prompt: prompt,
            style_preset: data.style || 'photorealistic'
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
