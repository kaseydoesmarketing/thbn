/**
 * Model Switcher Service - Admin-configurable model selection
 * Allows dynamic switching between Gemini models with cost tracking
 * @module services/modelSwitcher
 * @version 1.0.0
 */

'use strict';

var imageModels = require('../config/imageModels');

/**
 * In-memory state for model configuration
 * In production, this should be persisted to database
 */
var modelState = {
    primaryModel: null,
    fallbackModel: null,
    lastUpdated: null,
    updatedBy: null
};

/**
 * Initialize model state from environment or defaults
 */
function initializeState() {
    modelState.primaryModel = process.env.GEMINI_PRIMARY_MODEL || 'gemini-3-pro-image-preview';
    modelState.fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-image';
    modelState.lastUpdated = new Date().toISOString();
    modelState.updatedBy = 'system';
}

// Initialize on module load
initializeState();

/**
 * Get current model configuration
 * @returns {Object} Current model state
 */
function getCurrentConfig() {
    return {
        primaryModel: modelState.primaryModel,
        fallbackModel: modelState.fallbackModel,
        primaryConfig: imageModels.getModelConfig(modelState.primaryModel),
        fallbackConfig: imageModels.getModelConfig(modelState.fallbackModel),
        lastUpdated: modelState.lastUpdated,
        updatedBy: modelState.updatedBy
    };
}

/**
 * Switch to a new primary model
 * @param {string} modelId - Model identifier to switch to
 * @param {string} [adminId='system'] - ID of admin making the change
 * @returns {Object} Result of the switch operation
 */
function switchPrimaryModel(modelId, adminId) {
    adminId = adminId || 'system';

    // Validate model exists
    if (!imageModels.isModelAvailable(modelId)) {
        return {
            success: false,
            error: 'Model not available: ' + modelId,
            availableModels: imageModels.getAllModels().map(function(m) { return m.id; })
        };
    }

    var previousModel = modelState.primaryModel;
    var newConfig = imageModels.getModelConfig(modelId);
    var previousConfig = imageModels.getModelConfig(previousModel);

    // Calculate cost impact
    var costImpact = {
        previousCostPerImage: previousConfig ? previousConfig.pricing.imagesGenerated : 0,
        newCostPerImage: newConfig.pricing.imagesGenerated,
        percentChange: 0
    };

    if (costImpact.previousCostPerImage > 0) {
        costImpact.percentChange = ((costImpact.newCostPerImage - costImpact.previousCostPerImage) / costImpact.previousCostPerImage * 100).toFixed(2);
    }

    // Update state
    modelState.primaryModel = modelId;
    modelState.lastUpdated = new Date().toISOString();
    modelState.updatedBy = adminId;

    // Update environment variable for other processes
    process.env.GEMINI_PRIMARY_MODEL = modelId;

    console.log('[ModelSwitcher] Primary model switched: ' + previousModel + ' -> ' + modelId + ' by ' + adminId);

    return {
        success: true,
        previousModel: previousModel,
        newModel: modelId,
        newConfig: newConfig,
        costImpact: costImpact,
        updatedAt: modelState.lastUpdated,
        updatedBy: adminId
    };
}

/**
 * Switch to a new fallback model
 * @param {string} modelId - Model identifier to use as fallback
 * @param {string} [adminId='system'] - ID of admin making the change
 * @returns {Object} Result of the switch operation
 */
function switchFallbackModel(modelId, adminId) {
    adminId = adminId || 'system';

    if (!imageModels.isModelAvailable(modelId)) {
        return {
            success: false,
            error: 'Model not available: ' + modelId
        };
    }

    var previousModel = modelState.fallbackModel;
    modelState.fallbackModel = modelId;
    modelState.lastUpdated = new Date().toISOString();
    modelState.updatedBy = adminId;

    process.env.GEMINI_FALLBACK_MODEL = modelId;

    console.log('[ModelSwitcher] Fallback model switched: ' + previousModel + ' -> ' + modelId + ' by ' + adminId);

    return {
        success: true,
        previousModel: previousModel,
        newModel: modelId,
        newConfig: imageModels.getModelConfig(modelId),
        updatedAt: modelState.lastUpdated,
        updatedBy: adminId
    };
}

/**
 * Estimate cost comparison between models
 * @param {number} [imageCount=100] - Number of images for estimation
 * @returns {Object} Cost comparison data
 */
function getCostComparison(imageCount) {
    imageCount = imageCount || 100;
    var allModels = imageModels.getAllModels();

    return {
        imageCount: imageCount,
        models: allModels.map(function(model) {
            return {
                id: model.id,
                name: model.name,
                costPerImage: model.pricing.imagesGenerated,
                totalCost: (model.pricing.imagesGenerated * imageCount).toFixed(4),
                recommended: model.recommended
            };
        }).sort(function(a, b) { return a.costPerImage - b.costPerImage; }),
        currentPrimary: modelState.primaryModel,
        currentFallback: modelState.fallbackModel
    };
}

/**
 * Get model health status
 * @returns {Object} Health status of configured models
 */
function getModelHealth() {
    var primaryConfig = imageModels.getModelConfig(modelState.primaryModel);
    var fallbackConfig = imageModels.getModelConfig(modelState.fallbackModel);

    return {
        primary: {
            model: modelState.primaryModel,
            available: imageModels.isModelAvailable(modelState.primaryModel),
            config: primaryConfig,
            deprecationWarning: primaryConfig && primaryConfig.deprecationDate
                ? 'Model will be deprecated on ' + primaryConfig.deprecationDate
                : null
        },
        fallback: {
            model: modelState.fallbackModel,
            available: imageModels.isModelAvailable(modelState.fallbackModel),
            config: fallbackConfig,
            deprecationWarning: fallbackConfig && fallbackConfig.deprecationDate
                ? 'Model will be deprecated on ' + fallbackConfig.deprecationDate
                : null
        },
        lastUpdated: modelState.lastUpdated
    };
}

/**
 * Reset to default configuration
 * @param {string} [adminId='system'] - ID of admin making the change
 * @returns {Object} Result of reset operation
 */
function resetToDefaults(adminId) {
    adminId = adminId || 'system';

    var previousPrimary = modelState.primaryModel;
    var previousFallback = modelState.fallbackModel;

    modelState.primaryModel = 'gemini-3-pro-image-preview';
    modelState.fallbackModel = 'gemini-2.5-flash-image';
    modelState.lastUpdated = new Date().toISOString();
    modelState.updatedBy = adminId;

    process.env.GEMINI_PRIMARY_MODEL = modelState.primaryModel;
    process.env.GEMINI_FALLBACK_MODEL = modelState.fallbackModel;

    console.log('[ModelSwitcher] Reset to defaults by ' + adminId);

    return {
        success: true,
        previousPrimary: previousPrimary,
        previousFallback: previousFallback,
        newPrimary: modelState.primaryModel,
        newFallback: modelState.fallbackModel,
        updatedAt: modelState.lastUpdated,
        updatedBy: adminId
    };
}

module.exports = {
    getCurrentConfig: getCurrentConfig,
    switchPrimaryModel: switchPrimaryModel,
    switchFallbackModel: switchFallbackModel,
    getCostComparison: getCostComparison,
    getModelHealth: getModelHealth,
    resetToDefaults: resetToDefaults
};
