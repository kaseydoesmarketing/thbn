/**
 * ThumbnailBuilder V8 Worker - VIRAL THUMBNAIL PIPELINE
 *
 * BUILD-ENGINE-PRIME: Production-grade thumbnail generation with:
 * - V8 Smart Text Layout Engine (YouTube safe zones, WCAG contrast)
 * - Subject Positioning that ACTUALLY WORKS (9-position grid)
 * - Clothing/Outfit Controls (presets + custom)
 * - Subject-Background Separation (rim light, glow)
 * - Glassy Mode Premium Aesthetic (bloom, vignette, light streaks)
 * - Heuristics Checker (viral quality scoring)
 *
 * PIPELINE STAGES:
 * 1. Input validation and face image loading
 * 2. V8 Prompt generation with subject positioning & outfit
 * 3. Image generation via Gemini with Glassy enhancements
 * 4. Dimension enforcement (1920x1080)
 * 5. Smart text layout with safe zones and contrast
 * 6. Glassy mode post-processing (bloom, vignette)
 * 7. Heuristics check and scoring
 * 8. Storage and response with quality metadata
 *
 * VERSION: 8.0.0
 * @module thumbnailWorkerV8
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// =============================================================================
// DEPENDENCIES
// =============================================================================

const thumbnailQueue = require('../queues/thumbnailQueue');
const nanoClient = require('../services/nanoClient');
const storageService = require('../services/storageService');
const db = require('../db/connection');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// V8 Services - New Smart Pipeline
const { calculateTextLayout, selectOptimalTextColor } = require('../services/textLayoutEngineV8');
const { buildCinematicPromptV8, SUBJECT_POSITION_MAP, OUTFIT_PRESETS } = require('../services/promptEngineV8');
const { applyGlassyMode, getGlassyPromptEnhancement } = require('../services/glassyModeService');
const { runHeuristicsCheck } = require('../services/heuristicsChecker');

// V3 Services (for fallback and text rendering)
const textOverlayService = require('../services/textOverlayService');
const { prepareTextOverlay } = require('../services/textAutoFitService');

// V2 Services (legacy fallback)
const promptEngine = require('../services/promptEngine');

// =============================================================================
// CONSTANTS
// =============================================================================

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// YouTube Thumbnail Dimensions
const YOUTUBE_WIDTH = 1920;
const YOUTUBE_HEIGHT = 1080;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// V8 Feature Flags
const V8_FEATURES = {
    smartTextLayout: true,      // Use V8 text layout engine
    subjectPositioning: true,   // Use subject position from params
    outfitControls: true,       // Use outfit/clothing from params
    glassyMode: true,           // Enable glassy mode post-processing
    heuristicsCheck: true,      // Run quality heuristics
    subjectSeparation: true     // Include separation prompts
};

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

function createJobLogger(jobId) {
    const prefix = `[Worker V8][${jobId}]`;
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
        debug: (message, data) => {
            if (process.env.DEBUG_WORKER === 'true') {
                console.log(`${prefix} DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
            }
        },
        step: (stepNum, stepName) => {
            console.log(`${prefix} === STEP ${stepNum}: ${stepName} ===`);
        }
    };
}

// =============================================================================
// FACE IMAGE UTILITIES (inherited from V3)
// =============================================================================

async function loadFaceImages(userId, faceImageIds) {
    if (!faceImageIds || faceImageIds.length === 0) {
        return [];
    }

    const faceImages = [];
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

                faceImages.push({ data: base64Data, mimeType });
            }
        } catch (err) {
            console.error('[Worker V8] Error loading face image:', err.message);
        }
    }

    return faceImages;
}

// =============================================================================
// V8 PIPELINE FUNCTIONS
// =============================================================================

/**
 * Build V8 prompt with subject positioning, outfit, and glassy enhancements
 */
function buildV8Prompt(options, log) {
    const {
        brief,
        niche,
        expression,
        hasFace,
        thumbnailText,
        subjectPosition,
        subjectScale,
        outfit,
        customOutfit,
        outfitColor,
        keepOriginalOutfit,
        glassyIntensity,
        additionalContext
    } = options;

    log.info('Building V8 prompt with params:', {
        subjectPosition,
        subjectScale,
        outfit,
        keepOriginalOutfit,
        glassyIntensity
    });

    // Build prompt using V8 engine
    const prompt = buildCinematicPromptV8({
        brief,
        niche: niche || 'reaction',
        expression: expression || 'excited',
        hasFace,
        thumbnailText,
        subjectPosition: subjectPosition || 'middle-left',
        subjectScale: subjectScale || 100,
        outfit: keepOriginalOutfit ? 'original' : outfit,
        customOutfit,
        outfitColor,
        glassyIntensity: glassyIntensity || 0,
        additionalContext,
        enableSeparation: V8_FEATURES.subjectSeparation
    });

    log.info(`V8 prompt built (${prompt.length} chars)`);
    return prompt;
}

/**
 * Apply V8 smart text layout with safe zones and contrast
 */
async function applyV8TextOverlay(imageBuffer, text, options, log) {
    const { niche, hasFace, textPosition, textColor } = options;

    if (!text || text.trim() === '') {
        log.debug('No text to overlay, skipping');
        return imageBuffer;
    }

    try {
        // Use V8 text layout engine to calculate optimal position
        const layoutResult = await calculateTextLayout({
            text,
            imageBuffer,
            position: textPosition || 'auto',
            hasFace,
            forceColor: textColor
        });

        log.info('V8 text layout calculated:', {
            position: { x: layoutResult.x, y: layoutResult.y },
            color: layoutResult.color,
            warnings: layoutResult.warnings
        });

        // Get niche-specific text style
        const creatorStyle = promptEngine.getCreatorStyleForNiche(niche || 'reaction');
        const creatorTextStyle = textOverlayService.getCreatorTextStyle(creatorStyle);

        // Apply text overlay with calculated layout
        const processedImage = await textOverlayService.addTextOverlay(imageBuffer, {
            text: layoutResult.textBounds.lines ? layoutResult.textBounds.lines.join('\n') : text,
            niche: niche || 'reaction',
            position: {
                x: layoutResult.x,
                y: layoutResult.y,
                anchor: 'start'
            },
            preset: niche || 'reaction',
            customStyle: {
                ...creatorTextStyle,
                fontSize: layoutResult.textBounds.fontSize || creatorTextStyle.fontSize,
                color: layoutResult.color
            }
        });

        log.info('V8 text overlay applied successfully');
        return processedImage;

    } catch (err) {
        log.error('V8 text overlay failed, using V3 fallback', err);

        // Fallback to V3 text overlay
        const position = textOverlayService.getSmartPosition(niche || 'reaction', text.length, hasFace);
        return textOverlayService.addTextOverlay(imageBuffer, {
            text,
            niche: niche || 'reaction',
            position,
            preset: niche || 'reaction'
        });
    }
}

/**
 * Apply Glassy Mode post-processing
 */
async function applyGlassyPostProcessing(imageBuffer, intensity, log) {
    if (!V8_FEATURES.glassyMode || intensity === 0) {
        log.debug('Glassy mode skipped (disabled or intensity 0)');
        return imageBuffer;
    }

    try {
        log.info(`Applying Glassy Mode with intensity: ${intensity}`);
        const processedBuffer = await applyGlassyMode(imageBuffer, {
            intensity,
            bloom: true,
            vignette: true,
            lightStreaks: intensity > 50,
            colorGrade: true
        });
        log.info('Glassy Mode applied successfully');
        return processedBuffer;
    } catch (err) {
        log.error('Glassy Mode failed, returning original', err);
        return imageBuffer;
    }
}

/**
 * Run heuristics check on generated thumbnail
 */
async function checkThumbnailQuality(imageBuffer, metadata, log) {
    if (!V8_FEATURES.heuristicsCheck) {
        return null;
    }

    try {
        log.info('Running V8 heuristics check...');
        const heuristicsResult = await runHeuristicsCheck(imageBuffer, metadata);

        log.info('Heuristics result:', {
            score: heuristicsResult.score,
            passed: `${heuristicsResult.passedCount}/${heuristicsResult.totalChecks}`,
            allPassed: heuristicsResult.allPassed
        });

        if (heuristicsResult.recommendations.length > 0) {
            log.info('Recommendations:', heuristicsResult.recommendations);
        }

        return heuristicsResult;
    } catch (err) {
        log.error('Heuristics check failed', err);
        return null;
    }
}

/**
 * Enforce YouTube dimensions with optimization
 */
async function enforceYouTubeDimensions(imageBuffer, log) {
    try {
        const metadata = await sharp(imageBuffer).metadata();
        let processedBuffer = imageBuffer;

        if (metadata.width !== YOUTUBE_WIDTH || metadata.height !== YOUTUBE_HEIGHT) {
            log.info(`Resizing from ${metadata.width}x${metadata.height} to ${YOUTUBE_WIDTH}x${YOUTUBE_HEIGHT}`);
            processedBuffer = await sharp(imageBuffer)
                .resize(YOUTUBE_WIDTH, YOUTUBE_HEIGHT, {
                    fit: 'cover',
                    position: 'center'
                })
                .png({ quality: 100 })
                .toBuffer();
        }

        // Optimize file size if needed
        if (processedBuffer.length > MAX_FILE_SIZE) {
            log.info(`Image too large (${Math.round(processedBuffer.length / 1024)}KB), optimizing...`);
            let quality = 95;
            while (processedBuffer.length > MAX_FILE_SIZE && quality > 60) {
                processedBuffer = await sharp(processedBuffer)
                    .jpeg({ quality, mozjpeg: true })
                    .toBuffer();
                quality -= 5;
            }
        }

        log.info(`Final image size: ${Math.round(processedBuffer.length / 1024)}KB`);
        return processedBuffer;
    } catch (err) {
        log.error('Dimension enforcement failed', err);
        return imageBuffer;
    }
}

// =============================================================================
// V8 JOB PROCESSOR
// =============================================================================

/**
 * Process a thumbnail generation job using V8 pipeline
 */
async function processJobV8(job) {
    const data = job.data;
    const jobId = data.jobId;
    const userId = data.userId;
    const log = createJobLogger(jobId);

    log.info('Starting V8 VIRAL THUMBNAIL pipeline');
    log.debug('Input data', {
        brief: data.brief,
        niche: data.niche,
        expression: data.expression,
        thumbnailText: data.thumbnailText,
        subjectPosition: data.subjectPosition,
        subjectScale: data.subjectScale,
        outfit: data.outfit,
        keepOriginalOutfit: data.keepOriginalOutfit,
        glassyIntensity: data.glassyIntensity,
        textPosition: data.textPosition,
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

        let faceImagesForGemini = [];
        let hasFace = false;

        if (data.faceImages && data.faceImages.length > 0) {
            faceImagesForGemini = await loadFaceImages(userId, data.faceImages);
            hasFace = faceImagesForGemini.length > 0;
            log.info(`Loaded ${faceImagesForGemini.length} face images`);
        }

        job.progress(10);

        // =========================================================================
        // STEP 2: Build V8 Prompt (with positioning, outfit, glassy)
        // =========================================================================
        log.step(2, 'BUILD V8 PROMPT');

        const prompt = buildV8Prompt({
            brief: data.brief,
            niche: data.niche || 'reaction',
            expression: data.expression || 'excited',
            hasFace,
            thumbnailText: data.thumbnailText,
            subjectPosition: data.subjectPosition || 'middle-left',
            subjectScale: data.subjectScale || 100,
            outfit: data.outfit,
            customOutfit: data.customOutfit,
            outfitColor: data.outfitColor,
            keepOriginalOutfit: data.keepOriginalOutfit,
            glassyIntensity: data.glassyIntensity || 0,
            additionalContext: data.additionalContext
        }, log);

        job.progress(20);

        // =========================================================================
        // STEP 3: Generate Images via Gemini
        // =========================================================================
        log.step(3, 'GENERATE IMAGES (Gemini)');

        let result;
        try {
            result = await nanoClient.createThumbnailJob({
                prompt,
                style_preset: data.niche || 'photorealistic',
                faceImages: faceImagesForGemini
            });
            log.info(`Generated ${result.variants ? result.variants.length : 0} variants`);
        } catch (genErr) {
            log.error('Generation failed', genErr);
            throw new Error(`Image generation failed: ${genErr.message}`);
        }

        job.progress(50);

        // =========================================================================
        // STEP 4-7: Process Each Variant
        // =========================================================================
        const variants = result.variants || [];
        const processedVariants = [];

        for (let i = 0; i < variants.length; i++) {
            const variant = variants[i];
            const variantLabel = variant.variant_label || String.fromCharCode(65 + i);

            log.step(`4-7.${i + 1}`, `PROCESS VARIANT ${variantLabel}`);

            let imageBuffer = Buffer.from(variant.image_data, 'base64');

            // Step 4: Enforce YouTube dimensions
            log.info(`[${variantLabel}] Enforcing YouTube dimensions...`);
            imageBuffer = await enforceYouTubeDimensions(imageBuffer, log);

            // Step 5: Apply V8 smart text layout
            if (data.thumbnailText && data.thumbnailText.trim()) {
                log.info(`[${variantLabel}] Applying V8 text overlay...`);
                imageBuffer = await applyV8TextOverlay(imageBuffer, data.thumbnailText, {
                    niche: data.niche,
                    hasFace,
                    textPosition: data.textPosition,
                    textColor: data.textColor
                }, log);
            }

            // Step 6: Apply Glassy Mode post-processing
            if (data.glassyIntensity && data.glassyIntensity > 0) {
                log.info(`[${variantLabel}] Applying Glassy Mode...`);
                imageBuffer = await applyGlassyPostProcessing(imageBuffer, data.glassyIntensity, log);
            }

            // Step 7: Run heuristics check
            const heuristics = await checkThumbnailQuality(imageBuffer, {
                hasText: !!(data.thumbnailText && data.thumbnailText.trim()),
                hasFace,
                niche: data.niche
            }, log);

            processedVariants.push({
                variant_label: variantLabel,
                image_buffer: imageBuffer,
                mime_type: variant.mime_type || 'image/png',
                heuristics
            });

            job.progress(50 + Math.round((i + 1) / variants.length * 20));
        }

        // =========================================================================
        // STEP 8: Upload Final Images
        // =========================================================================
        log.step(8, 'UPLOAD FINAL IMAGES');

        const storedVariants = [];

        for (let j = 0; j < processedVariants.length; j++) {
            const processed = processedVariants[j];
            const label = processed.variant_label;
            let finalUrl = null;

            const contentType = processed.mime_type;
            const buffer = processed.image_buffer;

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
                const ext = contentType.includes('jpeg') ? '.jpg' : '.png';
                const localDir = path.join(__dirname, '../../uploads', jobId);

                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }

                const localPath = path.join(localDir, label + ext);
                fs.writeFileSync(localPath, buffer);
                finalUrl = '/uploads/' + jobId + '/' + label + ext;
                log.info(`Saved variant ${label} locally`);
            }

            // Store in database with heuristics metadata
            await db.query(
                `INSERT INTO thumbnail_variants
                 (thumbnail_job_id, user_id, storage_key, variant_label, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    jobId,
                    userId,
                    finalUrl,
                    label,
                    processed.heuristics ? JSON.stringify({ heuristics: processed.heuristics }) : null
                ]
            );

            storedVariants.push({
                label,
                url: finalUrl,
                heuristics: processed.heuristics
            });

            job.progress(70 + Math.round((j + 1) / processedVariants.length * 28));
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
        log.info(`Job completed successfully`, {
            variantCount: storedVariants.length,
            pipeline: 'V8_VIRAL',
            durationMs: duration
        });

        return {
            success: true,
            variants: storedVariants,
            pipeline: 'V8_VIRAL',
            version: 'V8',
            duration,
            features: {
                smartTextLayout: V8_FEATURES.smartTextLayout,
                subjectPositioning: data.subjectPosition || 'middle-left',
                outfit: data.keepOriginalOutfit ? 'original' : (data.outfit || 'none'),
                glassyIntensity: data.glassyIntensity || 0,
                heuristicsEnabled: V8_FEATURES.heuristicsCheck
            }
        };

    } catch (error) {
        log.error('V8 pipeline failed', error);

        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', `V8: ${error.message}`, jobId]
        );

        throw error;
    }
}

// =============================================================================
// V3/V2 FALLBACK PROCESSORS (inline to avoid circular imports)
// =============================================================================

// Import V3 prompt and services directly (without side effects)
const { buildCinematicPrompt, mapNicheToArchetype } = require('../services/promptEngineV3');
const { prepareLogoOverlay } = require('../services/logoPositioningService');

// Niche to Archetype Mapping (duplicated from V3 to avoid import)
const NICHE_TO_ARCHETYPE = {
    reaction: 'reaction',
    gaming: 'gaming',
    tech: 'explainer',
    finance: 'finance',
    fitness: 'explainer',
    beauty: 'tutorial',
    cooking: 'tutorial',
    travel: 'documentary',
    tutorial: 'tutorial',
    podcast: 'documentary',
    documentary: 'documentary',
    business: 'finance',
    entertainment: 'reaction'
};

function detectArchetype(niche) {
    return NICHE_TO_ARCHETYPE[niche] || mapNicheToArchetype(niche) || 'reaction';
}

/**
 * V3 Cinematic Pipeline (fallback)
 */
async function processJobV3(job) {
    const data = job.data;
    const jobId = data.jobId;
    const userId = data.userId;
    const log = createJobLogger(jobId);

    log.info('Starting V3 CINEMATIC fallback pipeline');

    try {
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );
        job.progress(5);

        // Load face images
        let faceImagesForGemini = [];
        let hasFace = false;

        if (data.faceImages && data.faceImages.length > 0) {
            faceImagesForGemini = await loadFaceImages(userId, data.faceImages);
            hasFace = faceImagesForGemini.length > 0;
        }
        job.progress(10);

        const niche = data.niche || 'reaction';
        const archetype = detectArchetype(niche);

        // Build V3 prompt
        const prompt = buildCinematicPrompt({
            brief: data.brief,
            archetype,
            niche,
            expression: data.expression || 'excited',
            hasFace,
            thumbnailText: data.thumbnailText,
            additionalContext: data.additionalContext
        });
        job.progress(20);

        // Generate
        let result;
        try {
            result = await nanoClient.createThumbnailJob({
                prompt,
                style_preset: niche,
                faceImages: faceImagesForGemini
            });
        } catch (genErr) {
            throw new Error(`Image generation failed: ${genErr.message}`);
        }
        job.progress(50);

        // Process variants
        const variants = result.variants || [];
        const processedVariants = [];

        for (let i = 0; i < variants.length; i++) {
            const variant = variants[i];
            const variantLabel = variant.variant_label || String.fromCharCode(65 + i);

            let imageBuffer = Buffer.from(variant.image_data, 'base64');
            imageBuffer = await enforceYouTubeDimensions(imageBuffer, log);

            // Apply text overlay
            if (data.thumbnailText && data.thumbnailText.trim()) {
                const position = textOverlayService.getSmartPosition(niche, data.thumbnailText.length, hasFace);
                imageBuffer = await textOverlayService.addTextOverlay(imageBuffer, {
                    text: data.thumbnailText,
                    niche,
                    position,
                    preset: niche
                });
            }

            processedVariants.push({
                variant_label: variantLabel,
                image_buffer: imageBuffer,
                mime_type: variant.mime_type || 'image/png'
            });

            job.progress(50 + Math.round((i + 1) / variants.length * 20));
        }

        // Upload
        const storedVariants = [];
        for (let j = 0; j < processedVariants.length; j++) {
            const processed = processedVariants[j];
            const label = processed.variant_label;
            let finalUrl = null;

            if (storageService.isConfigured()) {
                try {
                    const uploaded = await storageService.uploadThumbnail(
                        processed.image_buffer, userId, jobId, label, processed.mime_type
                    );
                    if (uploaded) finalUrl = uploaded.url;
                } catch (uploadErr) {
                    log.error(`Upload failed for ${label}`, uploadErr);
                }
            }

            if (!finalUrl) {
                const ext = processed.mime_type.includes('jpeg') ? '.jpg' : '.png';
                const localDir = path.join(__dirname, '../../uploads', jobId);
                if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
                const localPath = path.join(localDir, label + ext);
                fs.writeFileSync(localPath, processed.image_buffer);
                finalUrl = '/uploads/' + jobId + '/' + label + ext;
            }

            await db.query(
                'INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label) VALUES ($1, $2, $3, $4)',
                [jobId, userId, finalUrl, label]
            );

            storedVariants.push({ label, url: finalUrl });
            job.progress(70 + Math.round((j + 1) / processedVariants.length * 28));
        }

        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);
        return { success: true, variants: storedVariants, pipeline: 'V3_CINEMATIC', version: 'V3' };

    } catch (error) {
        log.error('V3 pipeline failed', error);
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', `V3: ${error.message}`, jobId]
        );
        throw error;
    }
}

/**
 * V2 Legacy Pipeline (final fallback)
 */
async function processJobV2(job) {
    const data = job.data;
    const jobId = data.jobId;
    const userId = data.userId;

    console.log('[Worker V2] Processing job ' + jobId);

    try {
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );
        job.progress(5);

        let faceImagesForGemini = [];
        if (data.faceImages && data.faceImages.length > 0) {
            faceImagesForGemini = await loadFaceImages(userId, data.faceImages);
        }
        job.progress(10);

        const prompt = promptEngine.buildUltimatePrompt({
            brief: data.brief,
            creatorStyle: data.creatorStyle || promptEngine.getCreatorStyleForNiche(data.niche || 'reaction'),
            niche: data.niche || 'reaction',
            expression: data.expression || 'excited',
            hasFace: faceImagesForGemini.length > 0,
            thumbnailText: data.thumbnailText,
            additionalContext: data.additionalContext
        });
        job.progress(15);

        const result = await nanoClient.createThumbnailJob({
            prompt,
            style_preset: data.niche || 'photorealistic',
            faceImages: faceImagesForGemini
        });
        job.progress(50);

        const variants = result.variants || [];
        const processedVariants = [];

        for (let i = 0; i < variants.length; i++) {
            const variant = variants[i];
            const variantLabel = variant.variant_label || String.fromCharCode(65 + i);
            let imageBuffer = Buffer.from(variant.image_data, 'base64');

            try {
                const metadata = await sharp(imageBuffer).metadata();
                if (metadata.width !== YOUTUBE_WIDTH || metadata.height !== YOUTUBE_HEIGHT) {
                    imageBuffer = await sharp(imageBuffer)
                        .resize(YOUTUBE_WIDTH, YOUTUBE_HEIGHT, { fit: 'cover', position: 'center' })
                        .png({ quality: 100 })
                        .toBuffer();
                }
            } catch (resizeErr) {
                console.error('[Worker V2] Resize failed:', resizeErr.message);
            }

            if (data.thumbnailText && data.thumbnailText.trim()) {
                try {
                    const hasFace = faceImagesForGemini.length > 0;
                    const position = textOverlayService.getSmartPosition(
                        data.niche || 'reaction',
                        data.thumbnailText.length,
                        hasFace
                    );
                    imageBuffer = await textOverlayService.addTextOverlay(imageBuffer, {
                        text: data.thumbnailText,
                        niche: data.niche || 'reaction',
                        position,
                        preset: data.niche || 'reaction'
                    });
                } catch (textErr) {
                    console.error('[Worker V2] Text overlay failed:', textErr.message);
                }
            }

            processedVariants.push({
                variant_label: variantLabel,
                image_buffer: imageBuffer,
                mime_type: variant.mime_type || 'image/png'
            });

            job.progress(50 + Math.round((i + 1) / variants.length * 20));
        }

        const storedVariants = [];

        for (let j = 0; j < processedVariants.length; j++) {
            const processed = processedVariants[j];
            const label = processed.variant_label;
            let finalUrl = null;

            if (storageService.isConfigured()) {
                try {
                    const uploaded = await storageService.uploadThumbnail(
                        processed.image_buffer, userId, jobId, label, processed.mime_type
                    );
                    if (uploaded) finalUrl = uploaded.url;
                } catch (uploadErr) {
                    console.error('[Worker V2] Upload failed:', uploadErr.message);
                }
            }

            if (!finalUrl) {
                const ext = processed.mime_type.includes('jpeg') ? '.jpg' : '.png';
                const localDir = path.join(__dirname, '../../uploads', jobId);
                if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
                const localPath = path.join(localDir, label + ext);
                fs.writeFileSync(localPath, processed.image_buffer);
                finalUrl = '/uploads/' + jobId + '/' + label + ext;
            }

            await db.query(
                'INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label) VALUES ($1, $2, $3, $4)',
                [jobId, userId, finalUrl, label]
            );

            storedVariants.push({ label, url: finalUrl });
            job.progress(70 + Math.round((j + 1) / processedVariants.length * 28));
        }

        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['completed', jobId]
        );

        job.progress(100);
        console.log('[Worker V2] Job ' + jobId + ' completed with ' + storedVariants.length + ' variants');

        return { success: true, variants: storedVariants, pipeline: 'V2_LEGACY', version: 'V2' };

    } catch (error) {
        console.error('[Worker V2] Job ' + jobId + ' failed:', error);
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', error.message, jobId]
        );
        throw error;
    }
}

// =============================================================================
// QUEUE PROCESSOR WITH V8/V3/V2 FALLBACK
// =============================================================================

/**
 * Main job processor with V8 primary, V3 secondary, V2 final fallback
 */
async function processJobWithFallback(job) {
    const data = job.data;
    const jobId = data.jobId;

    // Check pipeline version preference
    const useV8 = data.useV8 !== false && process.env.DISABLE_V8_PIPELINE !== 'true';
    const useV3 = data.useV3 !== false && process.env.DISABLE_V3_PIPELINE !== 'true';

    // V8 Pipeline (primary)
    if (useV8) {
        try {
            console.log(`[Worker] Using V8 VIRAL pipeline for job ${jobId}`);
            return await processJobV8(job);
        } catch (v8Error) {
            console.error(`[Worker] V8 pipeline failed for job ${jobId}:`, v8Error.message);

            // Attempt V3 fallback
            if (useV3) {
                try {
                    console.log(`[Worker] Falling back to V3 CINEMATIC for job ${jobId}`);
                    const result = await processJobV3(job);
                    result.fallbackFromV8 = true;
                    result.v8Error = v8Error.message;
                    return result;
                } catch (v3Error) {
                    console.error(`[Worker] V3 fallback failed for job ${jobId}:`, v3Error.message);
                }
            }

            // Final V2 fallback
            try {
                console.log(`[Worker] Final fallback to V2 LEGACY for job ${jobId}`);
                const result = await processJobV2(job);
                result.fallbackFromV8 = true;
                result.v8Error = v8Error.message;
                return result;
            } catch (v2Error) {
                console.error(`[Worker] All pipelines failed for job ${jobId}`);
                throw v2Error;
            }
        }
    }

    // V3 Pipeline (if V8 disabled)
    if (useV3) {
        try {
            console.log(`[Worker] Using V3 CINEMATIC pipeline for job ${jobId}`);
            return await processJobV3(job);
        } catch (v3Error) {
            console.error(`[Worker] V3 pipeline failed for job ${jobId}, using V2 fallback...`);
            return await processJobV2(job);
        }
    }

    // V2 Pipeline (legacy)
    console.log(`[Worker] Using V2 LEGACY pipeline for job ${jobId}`);
    return await processJobV2(job);
}

// =============================================================================
// WORKER INITIALIZATION (only when run as main module)
// =============================================================================

// Only register queue processor when run directly (not imported)
if (require.main === module) {
    console.log('[Worker V8] Starting thumbnail worker v8.0...');
    console.log('[Worker V8] V8 Pipeline: ENABLED');
    console.log('[Worker V8] V3 Fallback: ENABLED');
    console.log('[Worker V8] V2 Fallback: ENABLED');
    console.log('[Worker V8] Features:', JSON.stringify(V8_FEATURES));

    // Register queue processor
    thumbnailQueue.queue.process('generate', processJobWithFallback);

    // Graceful shutdown
    process.on('SIGTERM', async function() {
        console.log('[Worker V8] SIGTERM received, shutting down...');
        await thumbnailQueue.close();
        await db.close();
        process.exit(0);
    });

    process.on('SIGINT', async function() {
        console.log('[Worker V8] SIGINT received, shutting down...');
        await thumbnailQueue.close();
        await db.close();
        process.exit(0);
    });

    console.log('[Worker V8] Thumbnail worker v8.0 started and listening for jobs');
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // V8 Pipeline (primary)
    processJobV8,

    // Combined processor with fallback
    processJobWithFallback,

    // V8 Utilities
    buildV8Prompt,
    applyV8TextOverlay,
    applyGlassyPostProcessing,
    checkThumbnailQuality,
    enforceYouTubeDimensions,
    loadFaceImages,

    // Constants
    V8_FEATURES,
    YOUTUBE_WIDTH,
    YOUTUBE_HEIGHT
};
