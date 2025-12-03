const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db/connection');

// Configure upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`[Faces] Created upload directory: ${UPLOAD_DIR}`);
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: userId_timestamp_originalname
        const userId = req.userId || 'anonymous';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, `${userId}_${timestamp}_${safeName}`);
    }
});

// File filter - only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, and GIF are allowed.`), false);
    }
};

// Multer upload configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max per file
        files: 10 // Max 10 files per upload
    }
});

// POST /api/faces
// Upload face reference images and create a face profile
router.post('/', upload.array('images', 10), async (req, res) => {
    try {
        const userId = req.userId || '00000000-0000-0000-0000-000000000001';
        const profileName = req.body.profileName || 'Default Profile';

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        console.log(`[Faces] Uploading ${req.files.length} images for user ${userId}`);

        // Create face profile in database
        const profileResult = await db.query(
            `INSERT INTO face_profiles (user_id, name, status)
             VALUES ($1, $2, 'active')
             RETURNING id, name, created_at`,
            [userId, profileName]
        );

        const profile = profileResult.rows[0];

        // Save each uploaded image reference
        const savedImages = [];
        for (const file of req.files) {
            const storageKey = file.filename;
            const qualityStatus = 'good'; // TODO: implement quality detection

            await db.query(
                `INSERT INTO face_profile_images (face_profile_id, storage_key, quality_status)
                 VALUES ($1, $2, $3)`,
                [profile.id, storageKey, qualityStatus]
            );

            savedImages.push({
                filename: storageKey,
                originalName: file.originalname,
                size: file.size,
                url: `/uploads/${storageKey}`
            });
        }

        console.log(`[Faces] Created profile ${profile.id} with ${savedImages.length} images`);

        res.json({
            success: true,
            profile: {
                id: profile.id,
                name: profile.name,
                createdAt: profile.created_at
            },
            images: savedImages
        });

    } catch (error) {
        console.error('[Faces] Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/faces
// Get all face profiles for user
router.get('/', async (req, res) => {
    try {
        const userId = req.userId || '00000000-0000-0000-0000-000000000001';

        const result = await db.query(
            `SELECT fp.id, fp.name, fp.status, fp.created_at,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', fpi.id,
                                'url', '/uploads/' || fpi.storage_key,
                                'quality', fpi.quality_status
                            )
                        ) FILTER (WHERE fpi.id IS NOT NULL), '[]'
                    ) as images
             FROM face_profiles fp
             LEFT JOIN face_profile_images fpi ON fpi.face_profile_id = fp.id
             WHERE fp.user_id = $1 AND fp.status = 'active'
             GROUP BY fp.id
             ORDER BY fp.created_at DESC`,
            [userId]
        );

        res.json({
            profiles: result.rows
        });

    } catch (error) {
        console.error('[Faces] List error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/faces/:id
// Get a specific face profile
router.get('/:id', async (req, res) => {
    try {
        const userId = req.userId || '00000000-0000-0000-0000-000000000001';
        const profileId = req.params.id;

        const result = await db.query(
            `SELECT fp.id, fp.name, fp.status, fp.created_at,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', fpi.id,
                                'url', '/uploads/' || fpi.storage_key,
                                'quality', fpi.quality_status
                            )
                        ) FILTER (WHERE fpi.id IS NOT NULL), '[]'
                    ) as images
             FROM face_profiles fp
             LEFT JOIN face_profile_images fpi ON fpi.face_profile_id = fp.id
             WHERE fp.id = $1 AND fp.user_id = $2
             GROUP BY fp.id`,
            [profileId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Face profile not found' });
        }

        res.json({ profile: result.rows[0] });

    } catch (error) {
        console.error('[Faces] Get profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/faces/:id
// Archive a face profile (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.userId || '00000000-0000-0000-0000-000000000001';
        const profileId = req.params.id;

        const result = await db.query(
            `UPDATE face_profiles
             SET status = 'archived', updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [profileId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Face profile not found' });
        }

        res.json({ success: true, message: 'Profile archived' });

    } catch (error) {
        console.error('[Faces] Delete profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handler for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
        }
        return res.status(400).json({ error: error.message });
    }
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    next();
});

module.exports = router;
