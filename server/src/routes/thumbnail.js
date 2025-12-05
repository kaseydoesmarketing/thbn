var express = require('express');
var router = express.Router();
var db = require('../db/connection');
var thumbnailQueue = require('../queues/thumbnailQueue');
var authMiddleware = require('../middleware/auth');
var { generationLimiter } = require('../middleware/rateLimit');

// Require authentication for all thumbnail routes
router.use(authMiddleware.requireAuth);

// POST /api/generate
// Starts a thumbnail generation job - rate limited (20 req/hour per user)
// v2.1: Added creatorStyle for Alex Hormozi / Iman Gadzhi / Magnates Media styles
router.post('/generate', generationLimiter, async function(req, res) {
    try {
        var niche = req.body.niche || 'reaction';
        var expression = req.body.expression || 'excited';
        var brief = req.body.brief;
        var thumbnailText = req.body.thumbnailText || '';
        var faceImages = req.body.faceImages;

        // NEW: Creator style selection (mrbeast, hormozi, gadzhi, magnates, or auto)
        var creatorStyle = req.body.creatorStyle || 'auto';

        // Validate creatorStyle
        var validCreatorStyles = ['auto', 'mrbeast', 'hormozi', 'gadzhi', 'magnates'];
        if (!validCreatorStyles.includes(creatorStyle)) {
            creatorStyle = 'auto';
        }

        // Legacy fields (kept for backward compatibility)
        var videoUrl = req.body.videoUrl;
        var videoTitle = req.body.videoTitle;
        var style = req.body.style;

        // Validate required fields
        if (!brief) {
            return res.status(400).json({ error: 'Brief is required' });
        }

        var userId = req.userId;

        // Store brief with new fields including creatorStyle
        var briefJson = JSON.stringify({
            text: brief,
            expression: expression,
            thumbnailText: thumbnailText,
            creatorStyle: creatorStyle
        });

        // 1. Create job record in database
        var jobResult = await db.query(
            'INSERT INTO thumbnail_jobs (user_id, video_url, video_title, niche, style_preset, brief_json, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, status, created_at',
            [userId, videoUrl || null, videoTitle || null, niche, style || niche, briefJson, 'queued']
        );

        var job = jobResult.rows[0];
        var jobId = job.id;

        console.log('[Thumbnail] Created job ' + jobId + ' for user ' + userId);
        console.log('[Thumbnail] Niche: ' + niche + ', Creator Style: ' + creatorStyle + ', Expression: ' + expression + ', Text: ' + (thumbnailText || 'none'));

        // 2. Add to queue for async processing
        await thumbnailQueue.addJob({
            jobId: jobId,
            userId: userId,
            niche: niche,
            expression: expression,
            brief: brief,
            thumbnailText: thumbnailText,
            faceImages: faceImages,
            creatorStyle: creatorStyle,  // NEW: Pass creator style to worker
            // Legacy fields
            videoUrl: videoUrl,
            videoTitle: videoTitle,
            style: style
        });

        // Determine pipeline name for response
        var pipelineStyle = creatorStyle === 'auto' ? 'Auto-selected' : creatorStyle.charAt(0).toUpperCase() + creatorStyle.slice(1);

        res.json({
            success: true,
            jobId: jobId,
            status: 'queued',
            message: 'Thumbnail generation queued',
            creatorStyle: creatorStyle,
            pipeline: pipelineStyle + ' + ' + (faceImages && faceImages.length > 0 ? 'Face' : 'No Face')
        });

    } catch (error) {
        console.error('[Thumbnail] Generate error:', error);
        res.status(500).json({ error: 'Failed to start thumbnail generation' });
    }
});

// GET /api/jobs/:id
// Poll job status
router.get('/jobs/:id', async function(req, res) {
    try {
        var jobId = req.params.id;
        var userId = req.userId;

        // Get job with variants - MUST verify ownership
        var jobResult = await db.query(
            'SELECT id, status, video_url, video_title, niche, style_preset, error_message, created_at, updated_at FROM thumbnail_jobs WHERE id = $1 AND user_id = $2',
            [jobId, userId]
        );

        if (jobResult.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }

        var job = jobResult.rows[0];

        // Get queue job for progress
        var queueJob = await thumbnailQueue.getJob(jobId);
        var progress = queueJob ? queueJob.progress() : null;

        // Get variants if job is completed
        var variants = [];
        if (job.status === 'completed') {
            var variantsResult = await db.query(
                'SELECT id, storage_key as url, variant_label as label, is_favorite FROM thumbnail_variants WHERE thumbnail_job_id = $1 ORDER BY variant_label',
                [jobId]
            );
            variants = variantsResult.rows;
        }

        res.json({
            id: job.id,
            status: job.status,
            progress: progress,
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
        res.status(500).json({ error: 'Failed to retrieve job status' });
    }
});

// GET /api/library
// Get user's thumbnail library
router.get('/library', async function(req, res) {
    try {
        var userId = req.userId;
        var limit = parseInt(req.query.limit) || 20;
        var offset = parseInt(req.query.offset) || 0;

        var result = await db.query(
            "SELECT j.id, j.status, j.video_title, j.style_preset, j.created_at, COALESCE(json_agg(json_build_object('id', v.id, 'url', v.storage_key, 'label', v.variant_label, 'is_favorite', v.is_favorite)) FILTER (WHERE v.id IS NOT NULL), '[]') as variants FROM thumbnail_jobs j LEFT JOIN thumbnail_variants v ON v.thumbnail_job_id = j.id WHERE j.user_id = $1 AND j.status = 'completed' GROUP BY j.id ORDER BY j.created_at DESC LIMIT $2 OFFSET $3",
            [userId, limit, offset]
        );

        res.json({
            jobs: result.rows,
            pagination: { limit: limit, offset: offset }
        });

    } catch (error) {
        console.error('[Thumbnail] Library error:', error);
        res.status(500).json({ error: 'Failed to retrieve library' });
    }
});

// POST /api/variants/:id/favorite
// Toggle favorite status
router.post('/variants/:id/favorite', async function(req, res) {
    try {
        var variantId = req.params.id;
        var userId = req.userId;

        var result = await db.query(
            'UPDATE thumbnail_variants SET is_favorite = NOT is_favorite WHERE id = $1 AND user_id = $2 RETURNING id, is_favorite',
            [variantId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Variant not found' });
        }

        res.json({ success: true, variant: result.rows[0] });

    } catch (error) {
        console.error('[Thumbnail] Favorite error:', error);
        res.status(500).json({ error: 'Failed to update favorite status' });
    }
});

// GET /api/queue/stats
// Get queue statistics
router.get('/queue/stats', async function(req, res) {
    try {
        var stats = await thumbnailQueue.getStats();
        res.json(stats);
    } catch (error) {
        console.error('[Thumbnail] Queue stats error:', error);
        res.status(500).json({ error: 'Failed to retrieve queue stats' });
    }
});

// GET /api/creator-styles
// Get available creator styles for thumbnail generation
// v2.1: NEW endpoint for style selection UI
router.get('/creator-styles', function(req, res) {
    res.json({
        styles: [
            {
                key: 'auto',
                name: 'Auto (Niche-Based)',
                description: 'Automatically selects the best style based on your content niche'
            },
            {
                key: 'mrbeast',
                name: 'MrBeast Style',
                description: 'Maximum viral impact - MASSIVE text, bright yellow, extreme expressions, thick black stroke',
                textStyle: 'ALL CAPS, Impact font, yellow #FFFF00',
                bestFor: ['Gaming', 'Reaction', 'Entertainment', 'Cooking']
            },
            {
                key: 'hormozi',
                name: 'Alex Hormozi Style',
                description: 'Business authority - ALL CAPS, yellow #F7C204, confident, clean ONE-THING focus',
                textStyle: 'ALL CAPS, Montserrat Black, yellow #F7C204',
                bestFor: ['Finance', 'Business', 'Tech', 'Fitness', 'Tutorial']
            },
            {
                key: 'gadzhi',
                name: 'Iman Gadzhi Style',
                description: 'Luxury minimalist - lowercase white text ONLY, sophisticated premium feel',
                textStyle: 'lowercase, Montserrat Light, WHITE ONLY',
                bestFor: ['Beauty', 'Travel', 'Luxury', 'Lifestyle']
            },
            {
                key: 'magnates',
                name: 'Magnates Media Style',
                description: 'Documentary cinematic - ALL CAPS, Impact/Bebas Neue, red/black, story-driven',
                textStyle: 'ALL CAPS, Impact, red/white',
                bestFor: ['Documentary', 'Podcast', 'Investigation', 'Story']
            }
        ]
    });
});

module.exports = router;
