/**
 * Image Model Configurations
 * Pricing based on official Gemini API docs (December 2025)
 * @module config/imageModels
 * @version 1.0.0
 */

'use strict';

/**
 * Available image generation models with pricing and capabilities
 */
const models = {
    'gemini-3-pro-image-preview': {
        name: 'Gemini 3 Pro Image Preview',
        family: 'gemini-3',
        pricing: {
            inputTokens: 0.10,      // $0.10 per 1K input tokens
            outputTokens: 0.40,     // $0.40 per 1K output tokens (estimate)
            imagesGenerated: 0.40   // ~1K tokens per image
        },
        limits: {
            maxRPM: 100,            // Requests per minute
            maxRPD: 1000            // Requests per day
        },
        features: ['high-quality', 'face-reference', 'aspect-ratios'],
        recommended: true,
        description: 'Latest Gemini 3 Pro with enhanced image generation'
    },
    'gemini-2.5-flash-image': {
        name: 'Gemini 2.5 Flash Image',
        family: 'gemini-2.5',
        pricing: {
            inputTokens: 0.0375,    // $0.0375 per 1K input tokens
            outputTokens: 0.03,     // $0.03 per 1K output tokens
            imagesGenerated: 0.039  // 1290 tokens @ $30/1M = $0.039
        },
        limits: {
            maxRPM: 500,
            maxRPD: 2000
        },
        features: ['fast', 'face-reference', 'aspect-ratios'],
        recommended: false,
        deprecationDate: '2026-01-15',
        description: 'Fast and cost-effective image generation'
    },
    'gemini-2.0-flash-exp': {
        name: 'Gemini 2.0 Flash Experimental',
        family: 'gemini-2.0',
        pricing: {
            inputTokens: 0,
            outputTokens: 0,
            imagesGenerated: 0      // Free tier
        },
        limits: {
            maxRPM: 15,
            maxRPD: 100
        },
        features: ['experimental'],
        recommended: false,
        fallbackOnly: true,
        description: 'Experimental model for testing (free tier)'
    }
};

/**
 * Get the currently active primary model
 * @returns {string} Model ID
 */
function getActiveModel() {
    return process.env.GEMINI_PRIMARY_MODEL || 'gemini-3-pro-image-preview';
}

/**
 * Get the fallback model
 * @returns {string} Model ID
 */
function getFallbackModel() {
    return process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-image';
}

/**
 * Get configuration for a specific model
 * @param {string} modelName - Model identifier
 * @returns {Object|null} Model configuration or null if not found
 */
function getModelConfig(modelName) {
    return models[modelName] || null;
}

/**
 * Estimate cost for image generation
 * @param {string} modelName - Model identifier
 * @param {number} [imageCount=1] - Number of images to generate
 * @returns {number} Estimated cost in USD
 */
function estimateCost(modelName, imageCount) {
    imageCount = imageCount || 1;
    var model = getModelConfig(modelName);
    if (!model) return 0;
    return model.pricing.imagesGenerated * imageCount;
}

/**
 * Get all available models
 * @param {boolean} [includeDeprecated=false] - Include deprecated models
 * @returns {Array<Object>} Array of model configurations
 */
function getAllModels(includeDeprecated) {
    includeDeprecated = includeDeprecated || false;
    return Object.entries(models)
        .filter(function(entry) {
            if (!includeDeprecated && entry[1].deprecationDate) {
                var deprecationDate = new Date(entry[1].deprecationDate);
                if (deprecationDate < new Date()) return false;
            }
            return true;
        })
        .map(function(entry) {
            return { id: entry[0], ...entry[1] };
        });
}

/**
 * Check if a model exists and is available
 * @param {string} modelName - Model identifier
 * @returns {boolean} True if model exists and is not deprecated
 */
function isModelAvailable(modelName) {
    var model = getModelConfig(modelName);
    if (!model) return false;
    if (model.deprecationDate) {
        var deprecationDate = new Date(model.deprecationDate);
        if (deprecationDate < new Date()) return false;
    }
    return true;
}

/**
 * Get recommended model for a use case
 * @param {string} [useCase='default'] - Use case (quality, speed, cost)
 * @returns {string} Recommended model ID
 */
function getRecommendedModel(useCase) {
    useCase = useCase || 'default';
    switch (useCase) {
        case 'quality':
            return 'gemini-3-pro-image-preview';
        case 'speed':
            return 'gemini-2.5-flash-image';
        case 'cost':
            return 'gemini-2.0-flash-exp';
        default:
            return getActiveModel();
    }
}

module.exports = {
    models: models,
    getActiveModel: getActiveModel,
    getFallbackModel: getFallbackModel,
    getModelConfig: getModelConfig,
    estimateCost: estimateCost,
    getAllModels: getAllModels,
    isModelAvailable: isModelAvailable,
    getRecommendedModel: getRecommendedModel
};
