/**
 * ============================================================================
 * ThumbnailBuilder - Multi-Model Router Service
 * ============================================================================
 *
 * Intelligently routes thumbnail generation requests to the optimal AI model
 * based on the specific requirements of each job:
 *
 * - Photorealistic faces → Flux PuLID (best face preservation)
 * - Cinematic scenes → Gemini 2.5 Flash (best composition)
 * - Gaming/Neon → Gemini with enhanced prompts
 * - Fast iterations → Gemini Flash (fastest)
 * - High quality → Multiple models with best selection
 *
 * This ensures each thumbnail uses the BEST tool for that specific job.
 */

const nanoClient = require('./nanoClient');
const fluxClient = require('./fluxClient');

// =============================================================================
// MODEL CONFIGURATIONS
// =============================================================================

const MODELS = {
    // Primary models
    gemini_flash: {
        name: 'Gemini 2.5 Flash',
        client: 'nano',
        model: 'gemini-2.5-flash-image',
        costPerImage: 0.02,
        avgLatency: 45,  // seconds
        strengths: ['fast', 'composition', 'text-free', 'backgrounds'],
        weaknesses: ['face-consistency'],
        qualityScore: 85
    },

    flux_pulid: {
        name: 'Flux PuLID',
        client: 'flux',
        model: 'flux-pulid',
        costPerImage: 0.04,
        avgLatency: 60,
        strengths: ['face-preservation', 'photorealism', 'likeness'],
        weaknesses: ['slower', 'less-creative-composition'],
        qualityScore: 90
    },

    // Fallback models
    gemini_exp: {
        name: 'Gemini 2.0 Exp',
        client: 'nano',
        model: 'gemini-2.0-flash-exp',
        costPerImage: 0.015,
        avgLatency: 50,
        strengths: ['reliable', 'stable'],
        weaknesses: ['older-model'],
        qualityScore: 80
    }
};

// Style to model mapping (which model is best for each style)
const STYLE_MODEL_MAP = {
    // Face-heavy styles → Flux PuLID
    'mrbeast': { primary: 'flux_pulid', fallback: 'gemini_flash', reason: 'Face prominence requires likeness preservation' },
    'hormozi': { primary: 'flux_pulid', fallback: 'gemini_flash', reason: 'Authority requires accurate face rendering' },
    'gadzhi': { primary: 'flux_pulid', fallback: 'gemini_flash', reason: 'Luxury style needs photorealistic face' },

    // Cinematic/creative styles → Gemini
    'magnates': { primary: 'gemini_flash', fallback: 'flux_pulid', reason: 'Documentary style prioritizes composition' },
    'documentary': { primary: 'gemini_flash', fallback: 'flux_pulid', reason: 'Story-driven visuals over face accuracy' },
    'gaming': { primary: 'gemini_flash', fallback: 'flux_pulid', reason: 'Creative freedom for neon/effects' },

    // Balanced styles
    'lifestyle': { primary: 'flux_pulid', fallback: 'gemini_flash', reason: 'Warm, personal style needs face accuracy' },
    'finance': { primary: 'flux_pulid', fallback: 'gemini_flash', reason: 'Professional trust requires accurate face' },
    'business': { primary: 'flux_pulid', fallback: 'gemini_flash', reason: 'Authority needs face consistency' },

    // Default
    'default': { primary: 'gemini_flash', fallback: 'flux_pulid', reason: 'General purpose, fast generation' }
};

// Niche to model hints
const NICHE_MODEL_HINTS = {
    // Face-critical niches
    'personal-brand': 'flux_pulid',
    'coaching': 'flux_pulid',
    'fitness': 'flux_pulid',
    'beauty': 'flux_pulid',
    'real-estate': 'flux_pulid',

    // Creative niches
    'gaming': 'gemini_flash',
    'tech': 'gemini_flash',
    'animation': 'gemini_flash',
    'music': 'gemini_flash',

    // Story niches
    'documentary': 'gemini_flash',
    'true-crime': 'gemini_flash',
    'history': 'gemini_flash'
};

// =============================================================================
// MODEL SELECTION
// =============================================================================

/**
 * Select the optimal model for a generation job
 * @param {Object} jobParams - Job parameters
 * @returns {Object} Model selection result
 */
function selectModel(jobParams) {
    const {
        creatorStyle = 'default',
        niche = null,
        hasFaceImage = false,
        priority = 'quality',  // 'quality', 'speed', 'cost'
        qualityTier = 'pro'    // 'basic', 'pro', 'premium'
    } = jobParams;

    console.log(`[ModelRouter] Selecting model for style: ${creatorStyle}, niche: ${niche}, hasFace: ${hasFaceImage}`);

    // Start with style-based selection
    const styleConfig = STYLE_MODEL_MAP[creatorStyle.toLowerCase()] || STYLE_MODEL_MAP['default'];
    let selectedModel = styleConfig.primary;
    let reason = styleConfig.reason;

    // Override based on face image presence
    if (hasFaceImage) {
        // If there's a face image, strongly prefer Flux PuLID
        if (priority !== 'speed') {
            selectedModel = 'flux_pulid';
            reason = 'Face image provided - using Flux PuLID for best likeness';
        }
    } else {
        // No face image - Gemini is often better (faster, more creative)
        if (selectedModel === 'flux_pulid') {
            selectedModel = 'gemini_flash';
            reason = 'No face image - using Gemini for better composition';
        }
    }

    // Override based on niche hints
    if (niche && NICHE_MODEL_HINTS[niche.toLowerCase()]) {
        const nicheModel = NICHE_MODEL_HINTS[niche.toLowerCase()];
        // Only override if it makes sense
        if (hasFaceImage && nicheModel === 'flux_pulid') {
            selectedModel = nicheModel;
            reason = `Niche "${niche}" benefits from face-focused model`;
        } else if (!hasFaceImage && nicheModel === 'gemini_flash') {
            selectedModel = nicheModel;
            reason = `Niche "${niche}" benefits from creative composition`;
        }
    }

    // Override based on priority
    if (priority === 'speed') {
        selectedModel = 'gemini_flash';
        reason = 'Speed priority - using fastest model';
    } else if (priority === 'cost') {
        selectedModel = 'gemini_exp';
        reason = 'Cost priority - using most economical model';
    }

    // Get model config
    const modelConfig = MODELS[selectedModel];
    const fallbackModel = styleConfig.fallback !== selectedModel ? styleConfig.fallback : 'gemini_exp';

    console.log(`[ModelRouter] Selected: ${modelConfig.name} (${reason})`);

    return {
        model: selectedModel,
        modelName: modelConfig.name,
        client: modelConfig.client,
        modelId: modelConfig.model,
        fallback: fallbackModel,
        reason,
        expectedLatency: modelConfig.avgLatency,
        expectedCost: modelConfig.costPerImage,
        qualityScore: modelConfig.qualityScore
    };
}

/**
 * Execute generation using the selected model
 * @param {Object} selection - Model selection from selectModel()
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} Generation result
 */
async function executeWithModel(selection, params) {
    const {
        prompt,
        faceImageUrl = null,
        faceImageBase64 = null,
        width = 1920,
        height = 1080,
        numVariants = 1
    } = params;

    console.log(`[ModelRouter] Executing with ${selection.modelName}...`);

    try {
        if (selection.client === 'nano') {
            // Use Gemini via NanoClient
            return await executeWithGemini(selection, params);
        } else if (selection.client === 'flux') {
            // Use Flux PuLID
            return await executeWithFlux(selection, params);
        } else {
            throw new Error(`Unknown client: ${selection.client}`);
        }
    } catch (error) {
        console.error(`[ModelRouter] ${selection.modelName} failed:`, error.message);

        // Try fallback model
        if (selection.fallback) {
            console.log(`[ModelRouter] Trying fallback: ${selection.fallback}`);
            const fallbackConfig = MODELS[selection.fallback];
            const fallbackSelection = {
                ...selection,
                model: selection.fallback,
                modelName: fallbackConfig.name,
                client: fallbackConfig.client,
                modelId: fallbackConfig.model
            };
            return await executeWithModel(fallbackSelection, params);
        }

        throw error;
    }
}

/**
 * Execute generation with Gemini
 */
async function executeWithGemini(selection, params) {
    const {
        prompt,
        faceImageBase64 = null,
        numVariants = 1
    } = params;

    const results = [];

    for (let i = 0; i < numVariants; i++) {
        // Add variation to prompt for multiple variants
        const variantPrompt = numVariants > 1
            ? `${prompt}\n\n[Variation ${i + 1}: Slight compositional variation]`
            : prompt;

        const result = await nanoClient.generateImage({
            prompt: variantPrompt,
            model: selection.modelId,
            faceImageBase64,
            aspectRatio: '16:9'
        });

        results.push({
            imageBuffer: result.imageBuffer,
            model: selection.modelName,
            variant: i + 1
        });
    }

    return {
        results,
        model: selection.modelName,
        client: 'gemini'
    };
}

/**
 * Execute generation with Flux PuLID
 */
async function executeWithFlux(selection, params) {
    const {
        prompt,
        faceImageUrl = null,
        numVariants = 1
    } = params;

    // Flux PuLID requires face image URL
    if (!faceImageUrl) {
        console.warn('[ModelRouter] Flux PuLID requires face image, falling back to Gemini');
        const fallbackSelection = {
            ...selection,
            model: 'gemini_flash',
            modelName: MODELS['gemini_flash'].name,
            client: 'nano',
            modelId: MODELS['gemini_flash'].model
        };
        return await executeWithGemini(fallbackSelection, params);
    }

    const results = [];

    for (let i = 0; i < numVariants; i++) {
        const variantPrompt = numVariants > 1
            ? `${prompt} [Variant ${i + 1}]`
            : prompt;

        const result = await fluxClient.generateWithFace({
            prompt: variantPrompt,
            faceImageUrl,
            width: 1280,
            height: 720,
            numSteps: 20,
            guidanceScale: 4,
            idWeight: 1.2
        });

        results.push({
            imageBuffer: result.imageBuffer,
            model: selection.modelName,
            variant: i + 1
        });
    }

    return {
        results,
        model: selection.modelName,
        client: 'flux'
    };
}

// =============================================================================
// MULTI-MODEL GENERATION
// =============================================================================

/**
 * Generate with multiple models and compare results
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} Best result from all models
 */
async function generateWithMultipleModels(params) {
    const {
        prompt,
        faceImageUrl,
        faceImageBase64,
        creatorStyle,
        niche,
        selectBest = true  // If true, return only the best result
    } = params;

    console.log('[ModelRouter] Running multi-model generation...');

    const models = ['gemini_flash'];

    // Add Flux if we have a face image
    if (faceImageUrl) {
        models.push('flux_pulid');
    }

    const results = await Promise.allSettled(
        models.map(async (modelKey) => {
            const modelConfig = MODELS[modelKey];
            const selection = {
                model: modelKey,
                modelName: modelConfig.name,
                client: modelConfig.client,
                modelId: modelConfig.model
            };

            try {
                const result = await executeWithModel(selection, {
                    prompt,
                    faceImageUrl,
                    faceImageBase64,
                    numVariants: 1
                });

                return {
                    model: modelKey,
                    result: result.results[0],
                    qualityScore: modelConfig.qualityScore
                };
            } catch (error) {
                console.error(`[ModelRouter] ${modelConfig.name} failed:`, error.message);
                return null;
            }
        })
    );

    // Filter successful results
    const successfulResults = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

    if (successfulResults.length === 0) {
        throw new Error('All models failed to generate');
    }

    if (!selectBest || successfulResults.length === 1) {
        return successfulResults;
    }

    // Return all results for comparison or selection
    return successfulResults.sort((a, b) => b.qualityScore - a.qualityScore);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get model statistics
 */
function getModelStats() {
    return Object.entries(MODELS).map(([key, config]) => ({
        id: key,
        name: config.name,
        cost: config.costPerImage,
        latency: config.avgLatency,
        quality: config.qualityScore,
        strengths: config.strengths,
        weaknesses: config.weaknesses
    }));
}

/**
 * Get recommended model for a style
 */
function getRecommendedModel(style) {
    const config = STYLE_MODEL_MAP[style.toLowerCase()] || STYLE_MODEL_MAP['default'];
    return {
        recommended: config.primary,
        fallback: config.fallback,
        reason: config.reason
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    selectModel,
    executeWithModel,
    generateWithMultipleModels,
    getModelStats,
    getRecommendedModel,
    MODELS,
    STYLE_MODEL_MAP,
    NICHE_MODEL_HINTS
};
