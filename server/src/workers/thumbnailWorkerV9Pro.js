/**
 * ThumbnailBuilder V9 PRO Worker - WORLD-CLASS THUMBNAIL PIPELINE
 *
 * This is the MASTER PIPELINE integrating ALL Tier 1 quality upgrades:
 *
 * 1. Multi-Model Selection - Routes to best AI model (Flux PuLID / Gemini)
 * 2. Multi-Pass Generation - Generates 4 variants, selects best 2
 * 3. AI Composition Analysis - Finds optimal text placement
 * 4. Professional Color Grading - Cinematic LUTs per creator style
 * 5. 3D Text Rendering - Professional extruded text effects
 *
 * Result: Every thumbnail is WORLD-CLASS quality.
 *
 * PIPELINE STAGES:
 * 1. Input validation and face image loading
 * 2. Model selection (best AI for this job)
 * 3. Multi-pass generation with quality scoring
 * 4. Professional color grading
 * 5. AI composition analysis
 * 6. 3D text rendering
 * 7. Final optimization and storage
 *
 * VERSION: 9.0.0 PRO
 * @module thumbnailWorkerV9Pro
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// =============================================================================
// DEPENDENCIES
// =============================================================================

const thumbnailQueue = require('../queues/thumbnailQueue');
const storageService = require('../services/storageService');
const db = require('../db/connection');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// V9 PRO Pipeline Services (Tier 1 Quality Upgrades)
const proPipelineService = require('../services/proPipelineService');
const colorGradingService = require('../services/colorGradingService');
const text3DRenderService = require('../services/text3DRenderService');
const compositionAnalysisService = require('../services/compositionAnalysisService');
const modelRouterService = require('../services/modelRouterService');
const qualityScoringService = require('../services/qualityScoringService');

// V8 Services (for fallback)
const { processJobV8 } = require('./thumbnailWorkerV8');

// Legacy services
const nanoClient = require('../services/nanoClient');
const promptEngine = require('../services/promptEngine');

// =============================================================================
// CONSTANTS
// =============================================================================

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// YouTube Thumbnail Dimensions
const YOUTUBE_WIDTH = 1920;
const YOUTUBE_HEIGHT = 1080;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// V9 PRO Feature Flags
const V9_PRO_FEATURES = {
    multiModelSelection: true,     // Use best AI model for each job
    multiPassGeneration: true,     // Generate 4, return best 2
    qualityScoring: true,          // AI-powered quality scoring
    colorGrading: true,            // Professional color LUTs
    compositionAnalysis: true,     // AI finds optimal text placement
    text3D: true,                  // Professional 3D text effects
    autoPosition: true             // AI chooses text position
};

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

function createJobLogger(jobId) {
    const prefix = `[Worker V9 PRO][${jobId}]`;
    return {
        info: (message, data) => {
            console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
        },
        warn: (message, data) => {
            console.warn(`${prefix} WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
        },
        error: (message, error) => {
            console.error(`${prefix} ERROR: ${message}`, error?.message || error);
            if (error?.stack) console.error(`${prefix} Stack:`, error.stack);
        },
        step: (stepNum, stepName) => {
            console.log(`${prefix} ========================================`);
            console.log(`${prefix} STEP ${stepNum}: ${stepName}`);
            console.log(`${prefix} ========================================`);
        }
    };
}

// =============================================================================
// FACE IMAGE UTILITIES
// =============================================================================

async function loadFaceImages(userId, faceImageIds) {
    if (!faceImageIds || faceImageIds.length === 0) {
        return { base64Images: [], urls: [] };
    }

    const base64Images = [];
    const urls = [];
    const maxImages = 3;

    for (let i = 0; i < Math.min(faceImageIds.length, maxImages); i++) {
        const faceRef = faceImageIds[i];

        try {
            let storageKey = null;

            if (typeof faceRef === 'string') {
                if (faceRef.startsWith('/uploads/')) {
                    storageKey = faceRef.replace('/uploads/', '');
                } else if (faceRef.includes('_')) {
                    storageKey = faceRef;
                } else {
                    const imgResult = await db.query(
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

            if (!storageKey) continue;

            const filePath = path.join(UPLOAD_DIR, storageKey);
            if (fs.existsSync(filePath)) {
                const imageBuffer = fs.readFileSync(filePath);
                const base64Data = imageBuffer.toString('base64');

                const ext = path.extname(storageKey).toLowerCase();
                let mimeType = 'image/jpeg';
                if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.webp') mimeType = 'image/webp';

                base64Images.push({ data: base64Data, mimeType });

                // Generate URL for Flux PuLID (if needed)
                if (process.env.PUBLIC_URL) {
                    urls.push(`${process.env.PUBLIC_URL}/uploads/${storageKey}`);
                }
            }
        } catch (err) {
            console.error('[Worker V9 PRO] Error loading face image:', err.message);
        }
    }

    return { base64Images, urls };
}

// =============================================================================
// V9 PRO JOB PROCESSOR
// =============================================================================

/**
 * Process a thumbnail generation job using V9 PRO pipeline
 * This is the WORLD-CLASS quality pipeline with all Tier 1 features
 */
async function processJobV9Pro(job) {
    const data = job.data;
    const jobId = data.jobId;
    const userId = data.userId;
    const log = createJobLogger(jobId);

    log.info('Starting V9 PRO WORLD-CLASS thumbnail pipeline');
    log.info('Input parameters', {
        brief: data.brief,
        niche: data.niche,
        expression: data.expression,
        thumbnailText: data.thumbnailText,
        creatorStyle: data.creatorStyle,
        qualityTier: data.qualityTier || 'pro',
        hasFaceImages: !!(data.faceImages && data.faceImages.length > 0)
    });

    const pipelineStart = Date.now();

    try {
        // Update status to processing
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );
        job.progress(5);

        // =========================================================================
        // STEP 1: Load Face Images
        // =========================================================================
        log.step(1, 'LOAD FACE IMAGES');

        const faceImages = await loadFaceImages(userId, data.faceImages);
        const hasFace = faceImages.base64Images.length > 0;
        log.info(`Loaded ${faceImages.base64Images.length} face images`);

        job.progress(10);

        // =========================================================================
        // STEP 2: Determine Creator Style and Quality Tier
        // =========================================================================
        log.step(2, 'DETERMINE STYLE AND QUALITY TIER');

        // Map niche to creator style if not specified
        const creatorStyle = data.creatorStyle ||
            promptEngine.getCreatorStyleForNiche(data.niche || 'reaction') ||
            'mrbeast';

        const qualityTier = data.qualityTier || 'pro';  // 'basic', 'pro', 'premium'
        const numVariants = data.variantCount || 2;

        log.info(`Creator style: ${creatorStyle}, Quality tier: ${qualityTier}`);

        job.progress(15);

        // =========================================================================
        // STEP 3: Build Prompt
        // =========================================================================
        log.step(3, 'BUILD WORLD-CLASS PROMPT');

        const prompt = promptEngine.buildUltimatePrompt({
            brief: data.brief,
            creatorStyle,
            niche: data.niche || 'reaction',
            expression: data.expression || 'excited',
            hasFace,
            thumbnailText: '',  // Text handled separately by 3D renderer
            additionalContext: data.additionalContext
        });

        log.info(`Prompt built (${prompt.length} chars)`);
        job.progress(20);

        // =========================================================================
        // STEP 4: Generate Thumbnails via PRO Pipeline
        // =========================================================================
        log.step(4, 'GENERATE VIA PRO PIPELINE (Multi-Model + Multi-Pass)');

        let pipelineResult;
        try {
            pipelineResult = await proPipelineService.generateProThumbnails({
                prompt,
                creatorStyle,
                niche: data.niche || 'reaction',
                thumbnailText: data.thumbnailText || '',
                faceImageUrl: faceImages.urls[0] || null,
                faceImageBase64: faceImages.base64Images[0]?.data || null,
                numVariants,
                textPosition: data.textPosition || null,
                enableColorGrading: V9_PRO_FEATURES.colorGrading,
                enable3DText: V9_PRO_FEATURES.text3D && !!(data.thumbnailText),
                qualityTier
            });

            log.info(`PRO Pipeline generated ${pipelineResult.variants.length} variants`);
            log.info('Pipeline metadata:', pipelineResult.metadata);

        } catch (genErr) {
            log.error('PRO Pipeline failed', genErr);
            throw new Error(`PRO Pipeline generation failed: ${genErr.message}`);
        }

        job.progress(70);

        // =========================================================================
        // STEP 5: Upload Final Images
        // =========================================================================
        log.step(5, 'UPLOAD WORLD-CLASS THUMBNAILS');

        const storedVariants = [];

        for (let i = 0; i < pipelineResult.variants.length; i++) {
            const variant = pipelineResult.variants[i];
            const label = variant.variantLabel || String.fromCharCode(65 + i);
            let finalUrl = null;

            const buffer = variant.imageBuffer;
            const contentType = 'image/png';

            // Try Supabase upload
            if (storageService.isConfigured()) {
                try {
                    const uploaded = await storageService.uploadThumbnail(
                        buffer, userId, jobId, label, contentType
                    );
                    if (uploaded) {
                        finalUrl = uploaded.url;
                        log.info(`Uploaded variant ${label} to Supabase`);
                    }
                } catch (uploadErr) {
                    log.error(`Supabase upload failed for ${label}`, uploadErr);
                }
            }

            // Fallback to local storage
            if (!finalUrl) {
                const localDir = path.join(__dirname, '../../uploads', jobId);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }

                const localPath = path.join(localDir, label + '.png');
                fs.writeFileSync(localPath, buffer);
                finalUrl = '/uploads/' + jobId + '/' + label + '.png';
                log.info(`Saved variant ${label} locally`);
            }

            // Store in database with quality metadata
            const metadata = {
                score: variant.score,
                recommendation: variant.recommendation,
                pipeline: 'V9_PRO',
                features: pipelineResult.metadata.features,
                ...variant.metadata
            };

            await db.query(
                `INSERT INTO thumbnail_variants
                 (thumbnail_job_id, user_id, storage_key, variant_label, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [jobId, userId, finalUrl, label, JSON.stringify(metadata)]
            );

            storedVariants.push({
                label,
                url: finalUrl,
                score: variant.score,
                recommendation: variant.recommendation
            });

            job.progress(70 + Math.round((i + 1) / pipelineResult.variants.length * 28));
        }

        // =========================================================================
        // COMPLETE
        // =========================================================================
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);

        const duration = Date.now() - pipelineStart;
        log.info('Job completed successfully', {
            variantCount: storedVariants.length,
            pipeline: 'V9_PRO',
            durationMs: duration,
            model: pipelineResult.metadata.model,
            features: pipelineResult.metadata.features
        });

        return {
            success: true,
            variants: storedVariants,
            pipeline: 'V9_PRO_WORLD_CLASS',
            version: 'V9',
            duration,
            metadata: pipelineResult.metadata
        };

    } catch (error) {
        log.error('V9 PRO pipeline failed', error);

        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', `V9_PRO: ${error.message}`, jobId]
        );

        throw error;
    }
}

// =============================================================================
// QUICK GENERATION (For Basic Tier)
// =============================================================================

/**
 * Quick generation without full Pro pipeline (for basic tier or speed priority)
 */
async function processJobQuick(job) {
    const data = job.data;
    const jobId = data.jobId;
    const userId = data.userId;
    const log = createJobLogger(jobId);

    log.info('Starting QUICK thumbnail generation (Basic tier)');

    const pipelineStart = Date.now();

    try {
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );
        job.progress(10);

        // Load face images
        const faceImages = await loadFaceImages(userId, data.faceImages);

        // Determine style
        const creatorStyle = data.creatorStyle ||
            promptEngine.getCreatorStyleForNiche(data.niche || 'reaction') ||
            'mrbeast';

        // Build prompt
        const prompt = promptEngine.buildUltimatePrompt({
            brief: data.brief,
            creatorStyle,
            niche: data.niche || 'reaction',
            expression: data.expression || 'excited',
            hasFace: faceImages.base64Images.length > 0,
            thumbnailText: ''
        });

        job.progress(20);

        // Generate using quick pipeline
        const result = await proPipelineService.generateQuickThumbnail({
            prompt,
            creatorStyle,
            thumbnailText: data.thumbnailText || '',
            faceImageBase64: faceImages.base64Images[0]?.data || null
        });

        job.progress(60);

        // Upload
        const storedVariants = [];
        for (let i = 0; i < result.variants.length; i++) {
            const variant = result.variants[i];
            const label = variant.variantLabel || 'A';
            let finalUrl = null;

            if (storageService.isConfigured()) {
                try {
                    const uploaded = await storageService.uploadThumbnail(
                        variant.imageBuffer, userId, jobId, label, 'image/png'
                    );
                    if (uploaded) finalUrl = uploaded.url;
                } catch (uploadErr) {
                    log.error(`Upload failed for ${label}`, uploadErr);
                }
            }

            if (!finalUrl) {
                const localDir = path.join(__dirname, '../../uploads', jobId);
                if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
                const localPath = path.join(localDir, label + '.png');
                fs.writeFileSync(localPath, variant.imageBuffer);
                finalUrl = '/uploads/' + jobId + '/' + label + '.png';
            }

            await db.query(
                'INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label) VALUES ($1, $2, $3, $4)',
                [jobId, userId, finalUrl, label]
            );

            storedVariants.push({ label, url: finalUrl });
        }

        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);

        const duration = Date.now() - pipelineStart;
        log.info(`Quick job completed in ${duration}ms`);

        return {
            success: true,
            variants: storedVariants,
            pipeline: 'V9_QUICK',
            version: 'V9',
            duration
        };

    } catch (error) {
        log.error('Quick pipeline failed', error);
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', `V9_QUICK: ${error.message}`, jobId]
        );
        throw error;
    }
}

// =============================================================================
// MAIN PROCESSOR WITH FALLBACK CHAIN
// =============================================================================

/**
 * Main job processor with V9 PRO primary, V8 fallback
 */
async function processJobWithFallback(job) {
    const data = job.data;
    const jobId = data.jobId;

    // Check pipeline version and quality tier
    const useV9Pro = data.useV9Pro !== false && process.env.DISABLE_V9_PRO_PIPELINE !== 'true';
    const qualityTier = data.qualityTier || 'pro';

    // Quick mode for basic tier
    if (qualityTier === 'basic' || data.priority === 'speed') {
        try {
            console.log(`[Worker] Using QUICK pipeline for job ${jobId} (${qualityTier} tier)`);
            return await processJobQuick(job);
        } catch (quickError) {
            console.error(`[Worker] Quick pipeline failed for job ${jobId}:`, quickError.message);
            // Fall through to V9 PRO
        }
    }

    // V9 PRO Pipeline (primary for pro/premium tiers)
    if (useV9Pro) {
        try {
            console.log(`[Worker] Using V9 PRO WORLD-CLASS pipeline for job ${jobId}`);
            return await processJobV9Pro(job);
        } catch (v9Error) {
            console.error(`[Worker] V9 PRO pipeline failed for job ${jobId}:`, v9Error.message);

            // Attempt V8 fallback
            try {
                console.log(`[Worker] Falling back to V8 VIRAL pipeline for job ${jobId}`);
                const result = await processJobV8(job);
                result.fallbackFromV9 = true;
                result.v9Error = v9Error.message;
                return result;
            } catch (v8Error) {
                console.error(`[Worker] V8 fallback failed for job ${jobId}:`, v8Error.message);
                throw v8Error;
            }
        }
    }

    // Direct V8 if V9 PRO disabled
    console.log(`[Worker] Using V8 pipeline for job ${jobId} (V9 PRO disabled)`);
    return await processJobV8(job);
}

// =============================================================================
// WORKER INITIALIZATION
// =============================================================================

if (require.main === module) {
    console.log('[Worker V9 PRO] Starting WORLD-CLASS thumbnail worker v9.0...');
    console.log('[Worker V9 PRO] ========================================');
    console.log('[Worker V9 PRO] TIER 1 QUALITY FEATURES:');
    console.log('[Worker V9 PRO]   Multi-Model Selection: ENABLED');
    console.log('[Worker V9 PRO]   Multi-Pass Generation: ENABLED');
    console.log('[Worker V9 PRO]   Quality Scoring: ENABLED');
    console.log('[Worker V9 PRO]   Professional Color Grading: ENABLED');
    console.log('[Worker V9 PRO]   AI Composition Analysis: ENABLED');
    console.log('[Worker V9 PRO]   3D Text Rendering: ENABLED');
    console.log('[Worker V9 PRO] ========================================');
    console.log('[Worker V9 PRO] V8 Fallback: ENABLED');
    console.log('[Worker V9 PRO] Features:', JSON.stringify(V9_PRO_FEATURES));

    // Register queue processor
    thumbnailQueue.queue.process('generate', processJobWithFallback);

    // Graceful shutdown
    process.on('SIGTERM', async function() {
        console.log('[Worker V9 PRO] SIGTERM received, shutting down...');
        await thumbnailQueue.close();
        await db.close();
        process.exit(0);
    });

    process.on('SIGINT', async function() {
        console.log('[Worker V9 PRO] SIGINT received, shutting down...');
        await thumbnailQueue.close();
        await db.close();
        process.exit(0);
    });

    console.log('[Worker V9 PRO] WORLD-CLASS thumbnail worker started and listening for jobs');
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // V9 PRO Pipeline (primary)
    processJobV9Pro,

    // Quick Pipeline (basic tier)
    processJobQuick,

    // Combined processor with fallback
    processJobWithFallback,

    // Feature flags
    V9_PRO_FEATURES,

    // Constants
    YOUTUBE_WIDTH,
    YOUTUBE_HEIGHT
};
