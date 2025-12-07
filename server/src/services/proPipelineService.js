/**
 * ============================================================================
 * ThumbnailBuilder - PRO Pipeline Service (World-Class Quality)
 * ============================================================================
 *
 * This is the MASTER PIPELINE that integrates all Tier 1 quality upgrades:
 *
 * 1. Multi-Model Selection - Routes to best AI model for each job
 * 2. Multi-Pass Generation - Generates 4 variants, selects best 2
 * 3. AI Composition Analysis - Finds optimal text placement
 * 4. Professional Color Grading - Cinematic LUTs per creator style
 * 5. 3D Text Rendering - Professional extruded text effects
 *
 * Result: Every thumbnail is WORLD-CLASS quality.
 */

const sharp = require('sharp');

// Import all Tier 1 services
const colorGradingService = require('./colorGradingService');
const text3DRenderService = require('./text3DRenderService');
const compositionAnalysisService = require('./compositionAnalysisService');
const modelRouterService = require('./modelRouterService');
const qualityScoringService = require('./qualityScoringService');

// Import existing services
const nanoClient = require('./nanoClient');
const textOverlayService = require('./textOverlayService');
const promptEngine = require('./promptEngine');

// =============================================================================
// PIPELINE CONFIGURATION
// =============================================================================

const PIPELINE_CONFIG = {
    // Multi-pass generation settings
    generation: {
        variantsToGenerate: 4,    // Generate 4 internally
        variantsToReturn: 2,      // Return best 2 to user
        minQualityScore: 60,      // Minimum acceptable score
        enableParallel: false     // Sequential to respect rate limits
    },

    // Color grading settings
    colorGrading: {
        enabled: true,
        intensity: 0.85,          // 85% strength (not overpowering)
        preserveOriginal: 0.1     // Blend 10% original
    },

    // 3D text settings
    text3D: {
        enabled: true,
        minFontSize: 120,         // Minimum readable size
        maxFontSize: 200          // Maximum for impact
    },

    // Composition analysis settings
    composition: {
        enabled: true,
        autoPosition: true,       // Let AI choose text position
        respectUserPosition: true // Override if user specifies
    },

    // Quality scoring settings
    scoring: {
        enabled: true,
        logScores: true
    }
};

// =============================================================================
// PRO PIPELINE - MAIN ENTRY POINT
// =============================================================================

/**
 * Generate professional thumbnails using the full Pro Pipeline
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} Generation results with best variants
 */
async function generateProThumbnails(params) {
    const {
        prompt,
        creatorStyle = 'mrbeast',
        niche = null,
        thumbnailText = '',
        faceImageUrl = null,
        faceImageBase64 = null,
        numVariants = 2,
        textPosition = null,      // User-specified position (or null for auto)
        enableColorGrading = true,
        enable3DText = true,
        qualityTier = 'pro'       // 'basic', 'pro', 'premium'
    } = params;

    console.log('[ProPipeline] ========================================');
    console.log('[ProPipeline] Starting WORLD-CLASS thumbnail generation');
    console.log(`[ProPipeline] Style: ${creatorStyle}, Niche: ${niche || 'auto'}`);
    console.log('[ProPipeline] ========================================');

    const startTime = Date.now();

    try {
        // STEP 1: Select optimal AI model
        console.log('[ProPipeline] Step 1: Selecting optimal AI model...');
        const modelSelection = modelRouterService.selectModel({
            creatorStyle,
            niche,
            hasFaceImage: !!(faceImageUrl || faceImageBase64),
            priority: qualityTier === 'premium' ? 'quality' : 'quality',
            qualityTier
        });
        console.log(`[ProPipeline] Selected model: ${modelSelection.modelName}`);

        // STEP 2: Generate multiple variants with quality scoring
        console.log('[ProPipeline] Step 2: Multi-pass generation with quality selection...');

        const variantsToGenerate = qualityTier === 'premium'
            ? PIPELINE_CONFIG.generation.variantsToGenerate
            : Math.max(2, numVariants);

        const generateVariant = async (variantIndex) => {
            // Add variation to prompt
            const variantPrompt = variantsToGenerate > 1
                ? addPromptVariation(prompt, variantIndex, creatorStyle)
                : prompt;

            // Generate with selected model
            const generationResult = await modelRouterService.executeWithModel(modelSelection, {
                prompt: variantPrompt,
                faceImageUrl,
                faceImageBase64,
                numVariants: 1
            });

            return {
                imageBuffer: generationResult.results[0].imageBuffer,
                model: modelSelection.modelName,
                variantIndex
            };
        };

        // Generate and score variants
        let selectedVariants;
        if (PIPELINE_CONFIG.scoring.enabled && qualityTier !== 'basic') {
            selectedVariants = await qualityScoringService.generateAndSelectBest(
                generateVariant,
                {
                    numToGenerate: variantsToGenerate,
                    numToReturn: numVariants,
                    creatorStyle,
                    hasFace: !!(faceImageUrl || faceImageBase64),
                    minScore: PIPELINE_CONFIG.generation.minQualityScore
                }
            );
        } else {
            // Basic tier: generate without scoring
            selectedVariants = [];
            for (let i = 0; i < numVariants; i++) {
                const variant = await generateVariant(i);
                selectedVariants.push({ ...variant, score: 70, recommendation: 'basic' });
            }
        }

        // STEP 3: Process each selected variant through the enhancement pipeline
        console.log('[ProPipeline] Step 3: Enhancing variants with Pro features...');

        const enhancedVariants = await Promise.all(
            selectedVariants.map((variant, index) =>
                enhanceVariant(variant, {
                    creatorStyle,
                    thumbnailText,
                    textPosition,
                    enableColorGrading: enableColorGrading && PIPELINE_CONFIG.colorGrading.enabled,
                    enable3DText: enable3DText && PIPELINE_CONFIG.text3D.enabled,
                    variantLabel: `v${index + 1}`
                })
            )
        );

        const processingTime = Date.now() - startTime;

        console.log('[ProPipeline] ========================================');
        console.log(`[ProPipeline] Generation complete in ${(processingTime / 1000).toFixed(1)}s`);
        console.log(`[ProPipeline] Returned ${enhancedVariants.length} world-class thumbnails`);
        console.log('[ProPipeline] ========================================');

        return {
            success: true,
            variants: enhancedVariants,
            metadata: {
                model: modelSelection.modelName,
                processingTime,
                qualityTier,
                creatorStyle,
                features: {
                    multiModelSelection: true,
                    multiPassGeneration: qualityTier !== 'basic',
                    colorGrading: enableColorGrading,
                    text3D: enable3DText && thumbnailText,
                    aiComposition: PIPELINE_CONFIG.composition.autoPosition
                }
            }
        };

    } catch (error) {
        console.error('[ProPipeline] Pipeline failed:', error.message);
        throw error;
    }
}

/**
 * Enhance a single variant with color grading, composition, and 3D text
 */
async function enhanceVariant(variant, options) {
    const {
        creatorStyle,
        thumbnailText,
        textPosition,
        enableColorGrading,
        enable3DText,
        variantLabel
    } = options;

    let imageBuffer = variant.imageBuffer;

    try {
        // ENHANCEMENT 1: Professional Color Grading
        if (enableColorGrading) {
            console.log(`[ProPipeline] Applying ${creatorStyle} color grade to ${variantLabel}...`);
            imageBuffer = await colorGradingService.applyColorGrade(
                imageBuffer,
                creatorStyle,
                {
                    intensity: PIPELINE_CONFIG.colorGrading.intensity,
                    preserveOriginal: PIPELINE_CONFIG.colorGrading.preserveOriginal
                }
            );
        }

        // ENHANCEMENT 2: AI Composition Analysis (for text placement)
        let optimalTextPosition = textPosition;
        let textColorRecommendation = null;

        if (thumbnailText && PIPELINE_CONFIG.composition.enabled) {
            console.log(`[ProPipeline] Analyzing composition for ${variantLabel}...`);
            const compositionAnalysis = await compositionAnalysisService.analyzeComposition(
                imageBuffer,
                {
                    textLength: thumbnailText.length,
                    fontSize: 160,
                    preferredPosition: textPosition,
                    creatorStyle
                }
            );

            // Use AI-determined position if auto-position enabled
            if (PIPELINE_CONFIG.composition.autoPosition && !textPosition) {
                optimalTextPosition = compositionAnalysis.bestPosition;
                console.log(`[ProPipeline] AI selected position: (${optimalTextPosition.x}, ${optimalTextPosition.y})`);
            }

            textColorRecommendation = compositionAnalysis.textColor;
        }

        // ENHANCEMENT 3: 3D Text Rendering
        if (thumbnailText && enable3DText) {
            console.log(`[ProPipeline] Rendering 3D text "${thumbnailText}" for ${variantLabel}...`);

            // Determine text position
            const textX = optimalTextPosition?.x || 960;
            const textY = optimalTextPosition?.y || 300;
            const anchor = optimalTextPosition?.anchor || 'middle';

            // Calculate optimal font size based on text length
            const fontSize = calculateOptimalFontSize(thumbnailText, creatorStyle);

            // Render 3D text
            imageBuffer = await text3DRenderService.composite3DTextOnImage(
                imageBuffer,
                thumbnailText.toUpperCase(),  // Thumbnails use ALL CAPS
                {
                    x: textX,
                    y: textY,
                    fontSize,
                    creatorStyle,
                    anchor
                }
            );
        } else if (thumbnailText) {
            // Fallback to regular text overlay if 3D disabled
            console.log(`[ProPipeline] Adding standard text overlay for ${variantLabel}...`);
            imageBuffer = await textOverlayService.addTextOverlay(
                imageBuffer,
                thumbnailText.toUpperCase(),
                {
                    creatorStyle,
                    x: optimalTextPosition?.x || 960,
                    y: optimalTextPosition?.y || 300
                }
            );
        }

        // ENHANCEMENT 4: Final quality optimization
        imageBuffer = await optimizeFinalOutput(imageBuffer);

        return {
            imageBuffer,
            variantLabel,
            score: variant.score,
            recommendation: variant.recommendation,
            metadata: {
                colorGraded: enableColorGrading,
                text3D: enable3DText && !!thumbnailText,
                textPosition: optimalTextPosition,
                textColor: textColorRecommendation
            }
        };

    } catch (error) {
        console.error(`[ProPipeline] Enhancement failed for ${variantLabel}:`, error.message);
        // Return original variant on enhancement failure
        return {
            imageBuffer: variant.imageBuffer,
            variantLabel,
            score: variant.score,
            recommendation: 'enhancement-failed',
            metadata: { error: error.message }
        };
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Add variation to prompt for diverse outputs
 */
function addPromptVariation(basePrompt, variantIndex, creatorStyle) {
    const variations = {
        0: '',  // Original prompt
        1: '\n\nSlight variation: different lighting angle, same energy',
        2: '\n\nSlight variation: slightly different background elements',
        3: '\n\nSlight variation: alternative composition, same style'
    };

    const variation = variations[variantIndex % 4] || '';
    return basePrompt + variation;
}

/**
 * Calculate optimal font size based on text length and style
 */
function calculateOptimalFontSize(text, creatorStyle) {
    const wordCount = text.trim().split(/\s+/).length;
    const charCount = text.length;

    // Base size by style
    const styleSizes = {
        'mrbeast': 180,
        'hormozi': 160,
        'gadzhi': 140,
        'gaming': 170,
        'default': 160
    };

    let baseSize = styleSizes[creatorStyle?.toLowerCase()] || styleSizes['default'];

    // Reduce for longer text
    if (charCount > 15) baseSize -= 20;
    if (charCount > 25) baseSize -= 20;
    if (wordCount > 3) baseSize -= 15;

    // Clamp to reasonable range
    return Math.max(
        PIPELINE_CONFIG.text3D.minFontSize,
        Math.min(PIPELINE_CONFIG.text3D.maxFontSize, baseSize)
    );
}

/**
 * Final output optimization (format, size, quality)
 */
async function optimizeFinalOutput(imageBuffer) {
    try {
        // Ensure correct dimensions and format
        let optimized = await sharp(imageBuffer)
            .resize(1920, 1080, { fit: 'cover' })
            .png({ quality: 95, compressionLevel: 6 })
            .toBuffer();

        // Check file size (YouTube limit is 2MB for standard thumbnails)
        const MAX_SIZE = 2 * 1024 * 1024;  // 2MB

        if (optimized.length > MAX_SIZE) {
            console.log('[ProPipeline] Optimizing file size...');
            optimized = await sharp(optimized)
                .png({ quality: 85, compressionLevel: 9 })
                .toBuffer();

            // If still too large, convert to JPEG
            if (optimized.length > MAX_SIZE) {
                optimized = await sharp(optimized)
                    .jpeg({ quality: 90 })
                    .toBuffer();
            }
        }

        return optimized;
    } catch (error) {
        console.warn('[ProPipeline] Output optimization failed:', error.message);
        return imageBuffer;
    }
}

// =============================================================================
// QUICK GENERATION (Simplified pipeline for speed)
// =============================================================================

/**
 * Quick generation without full Pro pipeline (for basic tier)
 */
async function generateQuickThumbnail(params) {
    const {
        prompt,
        creatorStyle = 'mrbeast',
        thumbnailText = '',
        faceImageBase64 = null
    } = params;

    console.log('[ProPipeline] Quick generation mode...');

    // Generate single image
    const result = await nanoClient.generateImage({
        prompt,
        model: 'gemini-2.5-flash-image',
        faceImageBase64,
        aspectRatio: '16:9'
    });

    let imageBuffer = result.imageBuffer;

    // Quick color grade
    imageBuffer = await colorGradingService.applyColorGrade(imageBuffer, creatorStyle, {
        intensity: 0.7
    });

    // Add text if provided
    if (thumbnailText) {
        imageBuffer = await textOverlayService.addTextOverlay(
            imageBuffer,
            thumbnailText.toUpperCase(),
            { creatorStyle }
        );
    }

    // Optimize output
    imageBuffer = await optimizeFinalOutput(imageBuffer);

    return {
        success: true,
        variants: [{
            imageBuffer,
            variantLabel: 'v1',
            score: 70,
            recommendation: 'quick-mode'
        }],
        metadata: {
            mode: 'quick',
            processingTime: 0
        }
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    generateProThumbnails,
    generateQuickThumbnail,
    enhanceVariant,
    calculateOptimalFontSize,
    optimizeFinalOutput,
    PIPELINE_CONFIG
};
