const express = require('express');
const router = express.Router();
const nanoClient = require('../services/nanoClient');

// Mock DB (In-memory for prototype, replace with real DB calls in prod)
const db = {
    jobs: new Map(),
    variants: new Map()
};

// POST /api/generate
// Starts a thumbnail generation job
router.post('/generate', async (req, res) => {
    try {
        const { videoUrl, niche, style, brief, faceImages } = req.body;

        // 1. Create local job record
        const jobId = 'job_' + Date.now();
        const jobRecord = {
            id: jobId,
            status: 'processing',
            videoUrl,
            niche,
            style,
            brief,
            createdAt: new Date()
        };
        db.jobs.set(jobId, jobRecord);

        // 2. Call Nano Banana (Async)
        // In a real app, this would be offloaded to a queue (Bull/RabbitMQ)
        // Here we simulate the async call
        (async () => {
            try {
                // Simulate API call delay
                await new Promise(r => setTimeout(r, 2000));

                // Call actual client (will fail if no key, but logic is sound)
                // const nanoJob = await nanoClient.createThumbnailJob({ ... });

                // MOCK SUCCESS for Prototype
                const mockVariants = [
                    { id: 'v1', url: 'https://via.placeholder.com/1280x720/111/fff?text=Variant+1', label: 'v1' },
                    { id: 'v2', url: 'https://via.placeholder.com/1280x720/222/fff?text=Variant+2', label: 'v2' },
                    { id: 'v3', url: 'https://via.placeholder.com/1280x720/333/fff?text=Variant+3', label: 'v3' },
                    { id: 'v4', url: 'https://via.placeholder.com/1280x720/444/fff?text=Variant+4', label: 'v4' }
                ];

                jobRecord.status = 'completed';
                jobRecord.variants = mockVariants;
                db.jobs.set(jobId, jobRecord);

            } catch (err) {
                console.error('Job failed:', err);
                jobRecord.status = 'failed';
                jobRecord.error = err.message;
                db.jobs.set(jobId, jobRecord);
            }
        })();

        res.json({ success: true, jobId, status: 'processing' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/jobs/:id
// Poll job status
router.get('/jobs/:id', (req, res) => {
    const job = db.jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

module.exports = router;
