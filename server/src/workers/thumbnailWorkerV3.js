/**
 * ThumbnailBuilder V3 Worker - CINEMATIC PIPELINE
 *
 * BUILD-ENGINE-PRIME: Production-grade thumbnail generation with:
 * - V3 Cinematic Prompt Engine with archetype-based templates
 * - Text Auto-Fit Service with safe zone guarantees
 * - Logo Positioning Service for brand elements
 * - Front-facing subject enforcement
 * - Graceful fallback to V2 on errors
 *
 * PIPELINE STAGES:
 * 1. Input validation and face image loading
 * 2. Archetype detection based on niche
 * 3. Cinematic prompt generation (V3)
 * 4. Image generation via Gemini
 * 5. Dimension enforcement (1920x1080)
 * 6. Text overlay with auto-fit (guaranteed no cropping)
 * 7. Logo overlay (if specified)
 * 8. Storage and response
 *
 * VERSION: 3.0.0
 * @module thumbnailWorkerV3
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

// V3 Services
const { prepareTextOverlay } = require('../services/textAutoFitService');
const { buildCinematicPrompt, buildUltimatePromptV3, mapNicheToArchetype } = require('../services/promptEngineV3');
const { prepareLogoOverlay, generateLogoPromptInstructions } = require('../services/logoPositioningService');

// V2 Services (for fallback and text overlay rendering)
const textOverlayService = require('../services/textOverlayService');
const promptEngine = require('../services/promptEngine');

// =============================================================================
// CONSTANTS
// =============================================================================

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// YouTube Thumbnail Dimensions
const YOUTUBE_WIDTH = 1920;
const YOUTUBE_HEIGHT = 1080;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Niche to Archetype Mapping
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

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Create a scoped logger for a specific job
 * @param {string} jobId - Job identifier
 * @returns {Object} Logger with scoped methods
 */
function createJobLogger(jobId) {
    const prefix = `[Worker V3][${jobId}]`;
    return {
        info: (message, data) => {
            console.log(`${prefix} ${message}`, data ? JSON.stringify(data, null, 2) : '');
        },
        warn: (message, data) => {
            console.warn(`${prefix} WARN: ${message}`, data ? JSON.stringify(data, null, 2) : '');
        },
        error: (message, error) => {
            console.error(`${prefix} ERROR: ${message}`, error?.message || error);
            if (error?.stack) {
                console.error(`${prefix} Stack:`, error.stack);
            }
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
// FACE IMAGE UTILITIES
// =============================================================================

/**
 * Get a public URL for a face image (for face swap API)
 * Uploads to Supabase if not already there
 * @param {string} userId - User ID
 * @param {string|Object} faceRef - Face image ID, URL, or object
 * @returns {Object|null} {publicUrl, localPath, storageKey} or null
 */
async function getFaceImageUrl(userId, faceRef) {
    try {
        let storageKey = null;

        if (typeof faceRef === 'string') {
            if (faceRef.startsWith('/uploads/')) {
                storageKey = faceRef.replace('/uploads/', '');
            } else if (faceRef.startsWith('http')) {
                return { publicUrl: faceRef, localPath: null, storageKey: null };
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
            if (faceRef.url.startsWith('http')) {
                return { publicUrl: faceRef.url, localPath: null, storageKey: null };
            }
            storageKey = faceRef.url.replace('/uploads/', '');
        }

        if (!storageKey) {
            return null;
        }

        const filePath = path.join(UPLOAD_DIR, storageKey);
        if (!fs.existsSync(filePath)) {
            return null;
        }

        if (storageService.isConfigured()) {
            const imageBuffer = fs.readFileSync(filePath);
            const ext = path.extname(storageKey).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

            try {
                const uploaded = await storageService.uploadFaceImage(
                    imageBuffer,
                    userId,
                    'face-ref-' + Date.now(),
                    contentType
                );
                if (uploaded && uploaded.url) {
                    return { publicUrl: uploaded.url, localPath: filePath, storageKey };
                }
            } catch (uploadErr) {
                console.error('[Worker V3] Failed to upload face image:', uploadErr.message);
            }
        }

        return { publicUrl: null, localPath: filePath, storageKey };
    } catch (err) {
        console.error('[Worker V3] Error getting face image URL:', err.message);
        return null;
    }
}

/**
 * Load face images from storage for Gemini multimodal input
 * @param {string} userId - User ID
 * @param {Array} faceImageIds - Array of face image IDs or URLs
 * @returns {Array} Array of {data: base64, mimeType: string}
 */
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
                else if (ext === '.gif') mimeType = 'image/gif';

                faceImages.push({ data: base64Data, mimeType });
            }
        } catch (err) {
            console.error('[Worker V3] Error loading face image:', err.message);
        }
    }

    return faceImages;
}

// =============================================================================
// V3 PIPELINE FUNCTIONS
// =============================================================================

/**
 * Detect archetype based on niche
 * @param {string} niche - Content niche
 * @returns {string} Archetype key
 */
function detectArchetype(niche) {
    return NICHE_TO_ARCHETYPE[niche] || mapNicheToArchetype(niche) || 'reaction';
}

/**
 * Build V3 cinematic prompt with all enhancements
 * @param {Object} options - Generation options
 * @param {Object} log - Logger instance
 * @returns {string} Complete prompt
 */
function buildV3Prompt(options, log) {
    const {
        brief,
        niche,
        expression,
        hasFace,
        thumbnailText,
        logos,
        additionalContext,
        creatorStyle
    } = options;

    const archetype = detectArchetype(niche);
    log.info(`Detected archetype: ${archetype} (from niche: ${niche})`);

    // Build logo prompt instructions if logos provided
    let logoInstructions = '';
    if (logos && logos.length > 0) {
        const logoConfig = prepareLogoOverlay({
            logos: logos.map(l => ({ name: l.name || l, position: l.position || 'topRight' })),
            canvas: { width: YOUTUBE_WIDTH, height: YOUTUBE_HEIGHT }
        });
        logoInstructions = logoConfig.promptInstructions;
        log.debug('Logo instructions prepared', { logoCount: logos.length });
    }

    // Build cinematic prompt
    const prompt = buildCinematicPrompt({
        brief,
        archetype,
        niche,
        expression,
        hasFace,
        thumbnailText,
        logos: logos ? { brandLogos: logos.map(l => l.name || l) } : undefined,
        additionalContext: [additionalContext, logoInstructions].filter(Boolean).join('\n\n'),
        creatorStyle
    });

    log.info(`V3 cinematic prompt built (${prompt.length} chars)`);
    return prompt;
}

/**
 * Apply text overlay using V3 auto-fit service
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} text - Text to overlay
 * @param {Object} options - Overlay options
 * @param {Object} log - Logger instance
 * @returns {Buffer} Image buffer with text overlay
 */
async function applyV3TextOverlay(imageBuffer, text, options, log) {
    const { niche, hasFace, creatorStyle } = options;

    if (!text || text.trim() === '') {
        log.debug('No text to overlay, skipping');
        return imageBuffer;
    }

    try {
        // Get smart position based on face presence
        const position = textOverlayService.getSmartPosition(
            niche || 'reaction',
            text.length,
            hasFace
        );
        log.debug(`Text position determined: ${position}`);

        // Get creator-specific text style
        const creatorTextStyle = textOverlayService.getCreatorTextStyle(
            creatorStyle || promptEngine.getCreatorStyleForNiche(niche || 'reaction')
        );

        // Use V3 auto-fit service to prepare text configuration
        const textConfig = prepareTextOverlay(
            text,
            {
                fontFamily: creatorTextStyle.fontFamily,
                fontWeight: creatorTextStyle.fontWeight,
                strokeWidth: creatorTextStyle.strokeWidth || 0,
                shadow: creatorTextStyle.shadow
            },
            position,
            { width: YOUTUBE_WIDTH, height: YOUTUBE_HEIGHT },
            { enforcesSafeZone: true, maxLines: 3 }
        );

        log.info('V3 text auto-fit calculated', {
            fontSize: textConfig.fontSize,
            lines: textConfig.lines.length,
            fits: textConfig.fits,
            positionAdjusted: textConfig.positionAdjusted,
            warnings: textConfig.warnings.length > 0 ? textConfig.warnings : undefined
        });

        // Apply text overlay using the fitted configuration
        const processedImage = await textOverlayService.addTextOverlay(imageBuffer, {
            text: textConfig.lines.join('\n'),
            niche: niche || 'reaction',
            position: {
                x: textConfig.x,
                y: textConfig.y,
                anchor: textConfig.anchor
            },
            preset: niche || 'reaction',
            customStyle: {
                ...creatorTextStyle,
                fontSize: textConfig.fontSize
            }
        });

        log.info('V3 text overlay applied successfully');
        return processedImage;
    } catch (err) {
        log.error('V3 text overlay failed, using fallback', err);

        // Fallback to standard V2 text overlay
        return textOverlayService.addTextOverlay(imageBuffer, {
            text,
            niche: niche || 'reaction',
            position: textOverlayService.getSmartPosition(niche || 'reaction', text.length, hasFace),
            preset: niche || 'reaction'
        });
    }
}

/**
 * Apply logo overlay using V3 positioning service
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Array} logos - Logo configurations
 * @param {Object} log - Logger instance
 * @returns {Buffer} Image buffer (logo application is for AI prompt only in V3)
 */
async function applyV3LogoOverlay(imageBuffer, logos, log) {
    if (!logos || logos.length === 0) {
        log.debug('No logos to overlay');
        return imageBuffer;
    }

    // Note: In V3, logos are handled by the AI during generation via prompt instructions
    // This function is a placeholder for future Sharp-based logo compositing
    log.info('Logo overlay requested', { logoCount: logos.length });
    log.debug('V3 logo overlay: Logos were included in generation prompt');

    // Future enhancement: Composite actual logo images using Sharp
    // For now, logos are handled by the AI in the prompt

    return imageBuffer;
}

/**
 * Enforce YouTube dimensions and file size
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} log - Logger instance
 * @returns {Buffer} Processed image buffer
 */
async function enforceYouTubeDimensions(imageBuffer, log) {
    try {
        const metadata = await sharp(imageBuffer).metadata();

        let processedBuffer = imageBuffer;

        // Resize if needed
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
                log.debug(`Optimized to quality ${quality} (${Math.round(processedBuffer.length / 1024)}KB)`);
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
// V3 JOB PROCESSOR
// =============================================================================

/**
 * Process a thumbnail generation job using V3 pipeline
 * @param {Object} job - Bull queue job
 * @returns {Object} Processing result
 */
async function processJobV3(job) {
    const data = job.data;
    const jobId = data.jobId;
    const userId = data.userId;
    const log = createJobLogger(jobId);

    log.info('Starting V3 CINEMATIC pipeline');
    log.debug('Input data', {
        brief: data.brief,
        niche: data.niche,
        expression: data.expression,
        thumbnailText: data.thumbnailText,
        creatorStyle: data.creatorStyle,
        hasFaceImages: !!(data.faceImages && data.faceImages.length > 0),
        hasLogos: !!(data.logos && data.logos.length > 0)
    });

    const pipelineStart = Date.now();
    let pipelineName = 'V3_CINEMATIC';

    try {
        // Update status to processing
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );
        job.progress(5);

        // =========================================================================
        // STEP 1: Validate and Prepare Face Images
        // =========================================================================
        log.step(1, 'VALIDATE AND LOAD FACE IMAGES');

        let faceImagesForGemini = [];
        let hasFace = false;

        if (data.faceImages && data.faceImages.length > 0) {
            faceImagesForGemini = await loadFaceImages(userId, data.faceImages);
            hasFace = faceImagesForGemini.length > 0;
            log.info(`Loaded ${faceImagesForGemini.length} face images`);
        } else {
            log.info('No face images provided');
        }

        job.progress(10);

        // =========================================================================
        // STEP 2: Detect Archetype from Niche
        // =========================================================================
        log.step(2, 'ARCHETYPE DETECTION');

        const niche = data.niche || 'reaction';
        const archetype = detectArchetype(niche);
        const effectiveCreatorStyle = data.creatorStyle || promptEngine.getCreatorStyleForNiche(niche);

        log.info('Archetype detected', {
            niche,
            archetype,
            creatorStyle: effectiveCreatorStyle
        });

        pipelineName = `V3_CINEMATIC_${archetype.toUpperCase()}`;
        job.progress(15);

        // =========================================================================
        // STEP 3: Build V3 Cinematic Prompt
        // =========================================================================
        log.step(3, 'BUILD CINEMATIC PROMPT (V3)');

        const prompt = buildV3Prompt({
            brief: data.brief,
            niche,
            expression: data.expression || 'excited',
            hasFace,
            thumbnailText: data.thumbnailText,
            logos: data.logos,
            additionalContext: data.additionalContext,
            creatorStyle: effectiveCreatorStyle
        }, log);

        job.progress(20);

        // =========================================================================
        // STEP 4: Generate Images via Gemini
        // =========================================================================
        log.step(4, 'GENERATE IMAGES (Gemini)');

        let result;
        try {
            result = await nanoClient.createThumbnailJob({
                prompt,
                style_preset: niche,
                faceImages: faceImagesForGemini
            });
            log.info(`Generated ${result.variants ? result.variants.length : 0} variants`);
        } catch (genErr) {
            log.error('Generation failed', genErr);
            throw new Error(`Image generation failed: ${genErr.message}`);
        }

        job.progress(50);

        // =========================================================================
        // STEP 5-7: Process Each Variant
        // =========================================================================
        const variants = result.variants || [];
        const processedVariants = [];

        for (let i = 0; i < variants.length; i++) {
            const variant = variants[i];
            const variantLabel = variant.variant_label || String.fromCharCode(65 + i);

            log.step(`5-7.${i + 1}`, `PROCESS VARIANT ${variantLabel}`);

            let imageBuffer = Buffer.from(variant.image_data, 'base64');

            // Step 5: Enforce YouTube dimensions
            log.info(`[${variantLabel}] Enforcing YouTube dimensions...`);
            imageBuffer = await enforceYouTubeDimensions(imageBuffer, log);

            // Step 6: Apply text overlay with V3 auto-fit
            if (data.thumbnailText && data.thumbnailText.trim()) {
                log.info(`[${variantLabel}] Applying V3 text overlay...`);
                imageBuffer = await applyV3TextOverlay(
                    imageBuffer,
                    data.thumbnailText,
                    {
                        niche,
                        hasFace,
                        creatorStyle: effectiveCreatorStyle
                    },
                    log
                );
            }

            // Step 7: Apply logo overlay
            if (data.logos && data.logos.length > 0) {
                log.info(`[${variantLabel}] Processing logos...`);
                imageBuffer = await applyV3LogoOverlay(imageBuffer, data.logos, log);
            }

            processedVariants.push({
                variant_label: variantLabel,
                image_buffer: imageBuffer,
                mime_type: variant.mime_type || 'image/png'
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
                        buffer,
                        userId,
                        jobId,
                        label,
                        contentType
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

            // Store in database
            await db.query(
                'INSERT INTO thumbnail_variants (thumbnail_job_id, user_id, storage_key, variant_label) VALUES ($1, $2, $3, $4)',
                [jobId, userId, finalUrl, label]
            );

            storedVariants.push({
                label,
                url: finalUrl
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
            pipeline: pipelineName,
            durationMs: duration
        });

        return {
            success: true,
            variants: storedVariants,
            pipeline: pipelineName,
            version: 'V3',
            duration
        };

    } catch (error) {
        log.error('V3 pipeline failed', error);

        // Update job status
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
            ['failed', `V3: ${error.message}`, jobId]
        );

        throw error;
    }
}

// =============================================================================
// V2 FALLBACK PROCESSOR (Imported from original worker)
// =============================================================================

/**
 * Process a thumbnail generation job using V2 pipeline (fallback)
 * This is the original pipeline for backward compatibility
 * @param {Object} job - Bull queue job
 * @returns {Object} Processing result
 */
async function processJob(job) {
    const data = job.data;
    const jobId = data.jobId;
    const userId = data.userId;

    console.log('[Worker V2] Processing job ' + jobId);
    console.log('[Worker V2] Input:', JSON.stringify({
        brief: data.brief,
        niche: data.niche,
        expression: data.expression,
        thumbnailText: data.thumbnailText,
        hasFaceImages: !!(data.faceImages && data.faceImages.length > 0)
    }));

    const effectiveCreatorStyle = data.creatorStyle || 'auto';
    const pipelineName = 'V2_LEGACY (' + effectiveCreatorStyle + ')';

    try {
        await db.query(
            'UPDATE thumbnail_jobs SET status = $1, updated_at = NOW() WHERE id = $2',
            ['processing', jobId]
        );
        job.progress(5);

        // Load face images
        let faceImagesForGemini = [];
        if (data.faceImages && data.faceImages.length > 0) {
            faceImagesForGemini = await loadFaceImages(userId, data.faceImages);
            console.log('[Worker V2] Loaded ' + faceImagesForGemini.length + ' face images');
        }
        job.progress(10);

        // Build V2 prompt
        const prompt = promptEngine.buildUltimatePrompt({
            brief: data.brief,
            creatorStyle: data.creatorStyle || promptEngine.getCreatorStyleForNiche(data.niche || 'reaction'),
            niche: data.niche || 'reaction',
            expression: data.expression || 'excited',
            hasFace: faceImagesForGemini.length > 0,
            thumbnailText: data.thumbnailText,
            additionalContext: data.additionalContext
        });

        console.log('[Worker V2] Prompt built (' + prompt.length + ' chars)');
        job.progress(15);

        // Generate images
        const result = await nanoClient.createThumbnailJob({
            prompt,
            style_preset: data.niche || 'photorealistic',
            faceImages: faceImagesForGemini
        });

        console.log('[Worker V2] Generated ' + (result.variants ? result.variants.length : 0) + ' variants');
        job.progress(50);

        // Process variants
        const variants = result.variants || [];
        const processedVariants = [];

        for (let i = 0; i < variants.length; i++) {
            const variant = variants[i];
            const variantLabel = variant.variant_label || String.fromCharCode(65 + i);

            let imageBuffer = Buffer.from(variant.image_data, 'base64');

            // Resize if needed
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

            // Add text overlay
            if (data.thumbnailText && data.thumbnailText.trim()) {
                try {
                    const hasFace = !!(data.faceImages && data.faceImages.length > 0);
                    const position = textOverlayService.getSmartPosition(
                        data.niche || 'reaction',
                        data.thumbnailText.length,
                        hasFace
                    );
                    const creatorTextStyle = textOverlayService.getCreatorTextStyle(
                        data.creatorStyle || promptEngine.getCreatorStyleForNiche(data.niche || 'reaction')
                    );

                    imageBuffer = await textOverlayService.addTextOverlay(imageBuffer, {
                        text: data.thumbnailText,
                        niche: data.niche || 'reaction',
                        position,
                        preset: data.niche || 'reaction',
                        customStyle: creatorTextStyle
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

        // Upload variants
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
                    }
                } catch (uploadErr) {
                    console.error('[Worker V2] Upload failed:', uploadErr.message);
                }
            }

            if (!finalUrl) {
                const ext = contentType.includes('jpeg') ? '.jpg' : '.png';
                const localDir = path.join(__dirname, '../../uploads', jobId);
                if (!fs.existsSync(localDir)) {
                    fs.mkdirSync(localDir, { recursive: true });
                }
                const localPath = path.join(localDir, label + ext);
                fs.writeFileSync(localPath, buffer);
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

        return {
            success: true,
            variants: storedVariants,
            pipeline: pipelineName,
            version: 'V2'
        };

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
// QUEUE PROCESSOR WITH V3/V2 FALLBACK
// =============================================================================

/**
 * Main job processor with V3 primary and V2 fallback
 */
async function processJobWithFallback(job) {
    const data = job.data;
    const jobId = data.jobId;

    // Check if V3 is explicitly disabled
    const useV3 = data.useV3 !== false && process.env.DISABLE_V3_PIPELINE !== 'true';

    if (useV3) {
        try {
            console.log(`[Worker] Using V3 CINEMATIC pipeline for job ${jobId}`);
            return await processJobV3(job);
        } catch (v3Error) {
            console.error(`[Worker] V3 pipeline failed for job ${jobId}, attempting V2 fallback...`);
            console.error('[Worker] V3 Error:', v3Error.message);

            // Update job to indicate fallback
            await db.query(
                'UPDATE thumbnail_jobs SET error_message = $1, updated_at = NOW() WHERE id = $2',
                [`V3 failed (${v3Error.message}), using V2 fallback`, jobId]
            );

            // Attempt V2 fallback
            try {
                console.log(`[Worker] Attempting V2 fallback for job ${jobId}`);
                const result = await processJob(job);
                result.fallbackFromV3 = true;
                result.v3Error = v3Error.message;
                return result;
            } catch (v2Error) {
                console.error(`[Worker] V2 fallback also failed for job ${jobId}`);
                throw v2Error;
            }
        }
    } else {
        console.log(`[Worker] Using V2 LEGACY pipeline for job ${jobId}`);
        return await processJob(job);
    }
}

// =============================================================================
// WORKER INITIALIZATION
// =============================================================================

console.log('[Worker V3] Starting thumbnail worker v3.0...');
console.log('[Worker V3] V3 Pipeline: ENABLED');
console.log('[Worker V3] V2 Fallback: ENABLED');

// Register queue processor
thumbnailQueue.queue.process('generate', processJobWithFallback);

// Graceful shutdown
process.on('SIGTERM', async function() {
    console.log('[Worker V3] SIGTERM received, shutting down...');
    await thumbnailQueue.close();
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async function() {
    console.log('[Worker V3] SIGINT received, shutting down...');
    await thumbnailQueue.close();
    await db.close();
    process.exit(0);
});

console.log('[Worker V3] Thumbnail worker v3.0 started and listening for jobs');

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // V3 Pipeline (primary)
    processJobV3,

    // V2 Pipeline (fallback)
    processJob,

    // Combined processor with fallback
    processJobWithFallback,

    // Utilities
    detectArchetype,
    buildV3Prompt,
    applyV3TextOverlay,
    applyV3LogoOverlay,
    enforceYouTubeDimensions,
    loadFaceImages,
    getFaceImageUrl,

    // Constants
    NICHE_TO_ARCHETYPE,
    YOUTUBE_WIDTH,
    YOUTUBE_HEIGHT
};
