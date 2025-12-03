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

        // Prepare face image URLs
        var faceImageUrls = (data.faceImages || []).map(function(img) {
            if (typeof img === 'string') return img;
            return img.url || img;
        }).filter(Boolean);

        // Build prompt
        var prompt = data.brief;
        if (data.niche) {
            prompt = '[' + data.niche.toUpperCase() + ' NICHE] ' + prompt;
        }
        if (data.style) {
            prompt = prompt + ' Style: ' + data.style;
        }

        job.progress(20);

        // Call Nano Banana API
        console.log('[Worker] Calling Nano Banana API...');
        var nanoJob = await nanoClient.createThumbnailJob({
            prompt: prompt,
            face_images: faceImageUrls,
            style_preset: data.style || 'default'
        });

        console.log('[Worker] Nano Banana job created: ' + nanoJob.job_id);

        // Update job with Nano job ID
        await db.query(
            'UPDATE thumbnail_jobs SET nano_job_id = $1 WHERE id = $2',
            [nanoJob.job_id, jobId]
        );

        job.progress(40);

        // Poll for completion
        console.log('[Worker] Polling for completion...');
        var result = await nanoClient.pollJob(nanoJob.job_id);

        console.log('[Worker] Nano Banana job completed with ' + (result.images ? result.images.length : 0) + ' variants');

        job.progress(70);

        // Store variants
        var variants = result.images || result.variants || [];
        var storedVariants = [];

        for (var i = 0; i < variants.length; i++) {
            var variant = variants[i];
            var variantLabel = 'v' + (i + 1);
            var storageUrl = variant.url;

            // Upload to Supabase if configured
            if (storageService.isConfigured()) {
                try {
                    var uploaded = await storageService.uploadThumbnailFromUrl(
                        variant.url,
                        userId,
                        jobId,
                        variantLabel
                    );
                    storageUrl = uploaded.url;
                    console.log('[Worker] Uploaded variant ' + variantLabel + ' to Supabase');
                } catch (uploadErr) {
                    console.error('[Worker] Supabase upload failed, using original URL:', uploadErr.message);
                }
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

            job.progress(70 + Math.round((i + 1) / variants.length * 25));
        }

        // Mark job as completed
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);
        console.log('[Worker] Job ' + jobId + ' completed successfully');

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
