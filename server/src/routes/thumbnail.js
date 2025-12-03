const express = require('express');
const router = express.Router();
const nanoClient = require('../services/nanoClient');
const db = require('../db/connection');

// POST /api/generate
// Starts a thumbnail generation job
router.post('/generate', async (req, res) => {
    try {
        const { videoUrl, videoTitle, niche, style, brief, faceImages } = req.body;

        // Validate required fields
        if (!brief) {
            return res.status(400).json({ error: 'Brief is required' });
        }

        // For MVP: use a placeholder user_id (will add auth in Phase 2)
        const userId = req.userId || '00000000-0000-0000-0000-000000000001';

        // 1. Create job record in database
        const jobResult = await db.query(
            `INSERT INTO thumbnail_jobs (user_id, video_url, video_title, niche, style_preset, brief_json, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'processing')
             RETURNING id, status, created_at`,
            [userId, videoUrl, videoTitle || null, niche, style, JSON.stringify({ text: brief })]
        );

        const job = jobResult.rows[0];
        const jobId = job.id;

        console.log(`[Thumbnail] Created job ${jobId} for user ${userId}`);

        // 2. Call Nano Banana API (synchronous for MVP, will be async queue in Phase 2)
        // Process in background but don't await to return immediately
        processJob(jobId, userId, { brief, faceImages, style, niche }).catch(err => {
            console.error(`[Thumbnail] Background job ${jobId} failed:`, err);
        });

        res.json({
            success: true,
            jobId,
            status: 'processing',
            message: 'Thumbnail generation started'
        });

    } catch (error) {
        console.error('[Thumbnail] Generate error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Background job processor
async function processJob(jobId, userId, { brief, faceImages, style, niche }) {
    try {
        console.log(`[Thumbnail] Processing job ${jobId}...`);

        // Prepare face image URLs (convert local paths to URLs if needed)
        const faceImageUrls = (faceImages || []).map(img => {
            if (typeof img === 'string') return img;
            return img.url || img;
        }).filter(Boolean);

        // Build the prompt for Nano Banana
        const prompt = buildPrompt(brief, niche, style);

        // Call Nano Banana API
        const nanoJob = await nanoClient.createThumbnailJob({
            prompt: prompt,
            face_images: faceImageUrls,
            style_preset: style || 'default'
        });

        console.log(`[Thumbnail] Nano Banana job created: ${nanoJob.job_id}`);

        // Update job with Nano job ID
        await db.query(
            `UPDATE thumbnail_jobs SET nano_job_id = $1 WHERE id = $2`,
            [nanoJob.job_id, jobId]
        );

        // Poll for completion
        const result = await nanoClient.pollJob(nanoJob.job_id);

        console.log(`[Thumbnail] Nano Banana job completed with ${result.images?.length || 0} variants`);

        // Store variants in database
        const variants = result.images || result.variants || [];
        for (let i = 0; i < variants.length; i++) {
            const variant = variants[i];
            const variantLabel = `v${i + 1}`;

            await db.query(
                `INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label)
                 VALUES ($1, $2, $3, $4)`,
                [jobId, userId, variant.url, variantLabel]
            );
        }

        // Mark job as completed
        await db.query(
            `UPDATE thumbnail_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`,
            [jobId]
        );

        console.log(`[Thumbnail] Job ${jobId} completed successfully`);

    } catch (error) {
        console.error(`[Thumbnail] Job ${jobId} failed:`, error);

        // Mark job as failed
        await db.query(
            `UPDATE thumbnail_jobs SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
            [error.message, jobId]
        );

        throw error;
    }
}

// Build a rich prompt from user inputs
function buildPrompt(brief, niche, style) {
    let prompt = brief;

    if (niche) {
        prompt = `[${niche.toUpperCase()} NICHE] ${prompt}`;
    }

    if (style) {
        prompt = `${prompt} Style: ${style}`;
    }

    return prompt;
}

// GET /api/jobs/:id
// Poll job status
router.get('/jobs/:id', async (req, res) => {
    try {
        const jobId = req.params.id;

        // Get job with variants
        const jobResult = await db.query(
            `SELECT id, status, video_url, video_title, niche, style_preset, error_message, created_at, updated_at
             FROM thumbnail_jobs WHERE id = $1`,
            [jobId]
        );

        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const job = jobResult.rows[0];

        // Get variants if job is completed
        let variants = [];
        if (job.status === 'completed') {
            const variantsResult = await db.query(
                `SELECT id, storage_key as url, variant_label as label, is_favorite
                 FROM thumbnail_variants WHERE thumbnail_job_id = $1 ORDER BY variant_label`,
                [jobId]
            );
            variants = variantsResult.rows;
        }

        res.json({
            id: job.id,
            status: job.status,
            videoUrl: job.video_url,
            videoTitle: job.video_title,
            niche: job.niche,
            style: job.style_preset,
            error: job.error_message,
            variants: variants,
            createdAt: job.created_at,
            updatedAt: job.updated_at
        });

    } catch (error) {
        console.error('[Thumbnail] Get job error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/library
// Get user's thumbnail library
router.get('/library', async (req, res) => {
    try {
        const userId = req.userId || '00000000-0000-0000-0000-000000000001';
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const result = await db.query(
            `SELECT j.id, j.status, j.video_title, j.style_preset, j.created_at,
                    COALESCE(
                        json_agg(
                            json_build_object('id', v.id, 'url', v.storage_key, 'label', v.variant_label, 'is_favorite', v.is_favorite)
                        ) FILTER (WHERE v.id IS NOT NULL), '[]'
                    ) as variants
             FROM thumbnail_jobs j
             LEFT JOIN thumbnail_variants v ON v.thumbnail_job_id = j.id
             WHERE j.user_id = $1 AND j.status = 'completed'
             GROUP BY j.id
             ORDER BY j.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        res.json({
            jobs: result.rows,
            pagination: { limit, offset }
        });

    } catch (error) {
        console.error('[Thumbnail] Library error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/variants/:id/favorite
// Toggle favorite status
router.post('/variants/:id/favorite', async (req, res) => {
    try {
        const variantId = req.params.id;
        const userId = req.userId || '00000000-0000-0000-0000-000000000001';

        const result = await db.query(
            `UPDATE thumbnail_variants
             SET is_favorite = NOT is_favorite
             WHERE id = $1 AND user_id = $2
             RETURNING id, is_favorite`,
            [variantId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Variant not found' });
        }

        res.json({ success: true, variant: result.rows[0] });

    } catch (error) {
        console.error('[Thumbnail] Favorite error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
