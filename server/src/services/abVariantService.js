/**
 * A/B Variant Generator Service - Tier 2
 *
 * Generates multiple thumbnail variants for A/B testing
 * - Different text styles
 * - Different color schemes
 * - Different compositions
 * - Different background effects
 *
 * @module abVariantService
 */

const sharp = require('sharp');

// Import other services for variant generation
const { generateDynamicBackground, BACKGROUND_PRESETS } = require('./dynamicBackgroundService');
const { applyLighting, LIGHTING_PRESETS } = require('./advancedLightingService');
const { generateProText, TEXT_EFFECT_PRESETS } = require('./proTextEffectsService');

// =============================================================================
// VARIANT STRATEGIES
// =============================================================================

const VARIANT_STRATEGIES = {
    // Color Scheme Variants
    'color-contrast': {
        name: 'Color Contrast Test',
        description: 'Test different color schemes for maximum impact',
        variants: [
            { name: 'Original', changes: {} },
            { name: 'High Contrast', changes: { contrast: 1.3, saturation: 1.2 } },
            { name: 'Warm Tones', changes: { warmth: 0.2, saturation: 1.1 } },
            { name: 'Cool Tones', changes: { coolness: 0.2, saturation: 1.1 } }
        ]
    },

    // Text Style Variants
    'text-style': {
        name: 'Text Style Test',
        description: 'Test different text effects for engagement',
        variants: [
            { name: 'MrBeast Yellow', changes: { textPreset: 'mrbeast' } },
            { name: 'MrBeast Red', changes: { textPreset: 'mrbeast-red' } },
            { name: 'Hormozi Style', changes: { textPreset: 'hormozi' } },
            { name: '3D Gold', changes: { textPreset: '3d-gold' } }
        ]
    },

    // Background Variants
    'background': {
        name: 'Background Test',
        description: 'Test different background styles',
        variants: [
            { name: 'Studio Black', changes: { background: 'studio-black' } },
            { name: 'Dramatic Red', changes: { background: 'dramatic-red' } },
            { name: 'Neon Cyan', changes: { background: 'neon-cyan' } },
            { name: 'Bokeh Warm', changes: { background: 'bokeh-warm' } }
        ]
    },

    // Lighting Variants
    'lighting': {
        name: 'Lighting Test',
        description: 'Test different lighting moods',
        variants: [
            { name: 'Natural', changes: { lighting: 'natural' } },
            { name: 'Dramatic', changes: { lighting: 'dramatic' } },
            { name: 'Cinematic', changes: { lighting: 'cinematic' } },
            { name: 'Viral Pop', changes: { lighting: 'viral-pop' } }
        ]
    },

    // Text Position Variants
    'text-position': {
        name: 'Text Position Test',
        description: 'Test different text placements',
        variants: [
            { name: 'Bottom Center', changes: { textPosition: 'bottom', textAlign: 'center' } },
            { name: 'Top Center', changes: { textPosition: 'top', textAlign: 'center' } },
            { name: 'Bottom Left', changes: { textPosition: 'bottom', textAlign: 'left' } },
            { name: 'Split (Top+Bottom)', changes: { textPosition: 'split' } }
        ]
    },

    // Composition Variants
    'composition': {
        name: 'Composition Test',
        description: 'Test different subject/text compositions',
        variants: [
            { name: 'Subject Left', changes: { subjectPosition: 'left' } },
            { name: 'Subject Center', changes: { subjectPosition: 'center' } },
            { name: 'Subject Right', changes: { subjectPosition: 'right' } },
            { name: 'Subject Large', changes: { subjectPosition: 'center', subjectScale: 1.2 } }
        ]
    },

    // Full A/B Test (combines multiple strategies)
    'full-ab': {
        name: 'Full A/B Test',
        description: 'Comprehensive variant generation',
        variants: [
            { name: 'Variant A (Original)', changes: {} },
            { name: 'Variant B (High Energy)', changes: { contrast: 1.2, textPreset: 'mrbeast', lighting: 'viral-pop' } },
            { name: 'Variant C (Professional)', changes: { lighting: 'cinematic', textPreset: 'chrome' } },
            { name: 'Variant D (Bold)', changes: { background: 'dramatic-red', textPreset: 'classic-white', contrast: 1.3 } }
        ]
    },

    // Quick 2-variant test
    'quick-ab': {
        name: 'Quick A/B',
        description: 'Fast 2-variant comparison',
        variants: [
            { name: 'Version A', changes: {} },
            { name: 'Version B', changes: { contrast: 1.15, saturation: 1.1, textPreset: 'mrbeast' } }
        ]
    }
};

// =============================================================================
// COLOR ADJUSTMENTS
// =============================================================================

/**
 * Apply color adjustments to an image
 */
async function applyColorAdjustments(imageBuffer, adjustments) {
    let result = sharp(imageBuffer);

    if (adjustments.brightness) {
        result = result.modulate({ brightness: adjustments.brightness });
    }

    if (adjustments.saturation) {
        result = result.modulate({ saturation: adjustments.saturation });
    }

    if (adjustments.contrast) {
        result = result.linear(adjustments.contrast, -(128 * (adjustments.contrast - 1)));
    }

    if (adjustments.warmth && adjustments.warmth > 0) {
        // Apply warm color shift
        result = result.recomb([
            [1 + adjustments.warmth * 0.1, 0, 0],
            [0, 1, 0],
            [0, 0, 1 - adjustments.warmth * 0.1]
        ]);
    }

    if (adjustments.coolness && adjustments.coolness > 0) {
        // Apply cool color shift
        result = result.recomb([
            [1 - adjustments.coolness * 0.1, 0, 0],
            [0, 1, 0],
            [0, 0, 1 + adjustments.coolness * 0.1]
        ]);
    }

    return result.png().toBuffer();
}

// =============================================================================
// VARIANT GENERATION
// =============================================================================

/**
 * Generate a single variant of an image
 *
 * @param {Buffer} baseImage - Base image buffer
 * @param {object} changes - Changes to apply
 * @param {object} baseConfig - Original thumbnail configuration
 * @returns {Promise<Buffer>} Variant image buffer
 */
async function generateVariant(baseImage, changes, baseConfig = {}) {
    let result = baseImage;
    const metadata = await sharp(baseImage).metadata();
    const { width, height } = metadata;

    // Apply background change
    if (changes.background && BACKGROUND_PRESETS[changes.background]) {
        const background = await generateDynamicBackground(changes.background, width, height);
        // Composite original onto new background (assumes subject is extracted)
        // For now, just blend the background
        result = await sharp(background)
            .composite([{ input: result, blend: 'over' }])
            .png()
            .toBuffer();
    }

    // Apply lighting change
    if (changes.lighting && LIGHTING_PRESETS[changes.lighting]) {
        result = await applyLighting(result, changes.lighting);
    }

    // Apply color adjustments
    const colorAdjustments = {};
    if (changes.contrast) colorAdjustments.contrast = changes.contrast;
    if (changes.saturation) colorAdjustments.saturation = changes.saturation;
    if (changes.brightness) colorAdjustments.brightness = changes.brightness;
    if (changes.warmth) colorAdjustments.warmth = changes.warmth;
    if (changes.coolness) colorAdjustments.coolness = changes.coolness;

    if (Object.keys(colorAdjustments).length > 0) {
        result = await applyColorAdjustments(result, colorAdjustments);
    }

    // Apply text changes
    if (changes.textPreset && baseConfig.text) {
        const textOverlay = await generateProText(baseConfig.text, {
            preset: changes.textPreset,
            width,
            height,
            fontSize: baseConfig.fontSize || 100,
            position: changes.textPosition || baseConfig.textPosition || 'bottom'
        });

        result = await sharp(result)
            .composite([{ input: textOverlay, blend: 'over' }])
            .png()
            .toBuffer();
    }

    return result;
}

/**
 * Generate all variants for a given strategy
 *
 * @param {Buffer} baseImage - Base image buffer
 * @param {string} strategy - Strategy name from VARIANT_STRATEGIES
 * @param {object} config - Thumbnail configuration (text, etc.)
 * @returns {Promise<Array>} Array of variant objects with name and buffer
 */
async function generateVariants(baseImage, strategy = 'quick-ab', config = {}) {
    const strategyConfig = VARIANT_STRATEGIES[strategy];

    if (!strategyConfig) {
        console.warn(`[ABVariant] Unknown strategy: ${strategy}, using quick-ab`);
        return generateVariants(baseImage, 'quick-ab', config);
    }

    const variants = [];

    for (const variant of strategyConfig.variants) {
        try {
            const buffer = await generateVariant(baseImage, variant.changes, config);
            variants.push({
                name: variant.name,
                buffer,
                changes: variant.changes,
                strategy: strategy
            });
        } catch (error) {
            console.error(`[ABVariant] Error generating variant "${variant.name}":`, error);
            // Include original as fallback
            variants.push({
                name: variant.name + ' (fallback)',
                buffer: baseImage,
                changes: {},
                error: error.message
            });
        }
    }

    return variants;
}

/**
 * Generate custom variants with specific changes
 *
 * @param {Buffer} baseImage - Base image buffer
 * @param {Array} variantConfigs - Array of {name, changes} objects
 * @param {object} config - Base thumbnail configuration
 * @returns {Promise<Array>} Array of variant objects
 */
async function generateCustomVariants(baseImage, variantConfigs, config = {}) {
    const variants = [];

    for (const variantConfig of variantConfigs) {
        try {
            const buffer = await generateVariant(baseImage, variantConfig.changes, config);
            variants.push({
                name: variantConfig.name,
                buffer,
                changes: variantConfig.changes,
                strategy: 'custom'
            });
        } catch (error) {
            console.error(`[ABVariant] Error generating custom variant "${variantConfig.name}":`, error);
            variants.push({
                name: variantConfig.name + ' (fallback)',
                buffer: baseImage,
                changes: {},
                error: error.message
            });
        }
    }

    return variants;
}

/**
 * Generate comparison grid of all variants
 *
 * @param {Array} variants - Array of variant objects from generateVariants
 * @param {object} options - Grid options
 * @returns {Promise<Buffer>} Grid image buffer
 */
async function generateComparisonGrid(variants, options = {}) {
    const {
        columns = 2,
        padding = 20,
        labelHeight = 40
    } = options;

    if (variants.length === 0) {
        throw new Error('No variants to compare');
    }

    // Get dimensions from first variant
    const firstMetadata = await sharp(variants[0].buffer).metadata();
    const cellWidth = firstMetadata.width;
    const cellHeight = firstMetadata.height;

    // Calculate grid dimensions
    const rows = Math.ceil(variants.length / columns);
    const gridWidth = columns * cellWidth + (columns + 1) * padding;
    const gridHeight = rows * (cellHeight + labelHeight) + (rows + 1) * padding;

    // Create base grid
    let grid = sharp({
        create: {
            width: gridWidth,
            height: gridHeight,
            channels: 3,
            background: { r: 30, g: 30, b: 30 }
        }
    });

    // Prepare composites
    const composites = [];

    for (let i = 0; i < variants.length; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);

        const x = padding + col * (cellWidth + padding);
        const y = padding + row * (cellHeight + labelHeight + padding);

        // Add variant image
        composites.push({
            input: variants[i].buffer,
            left: x,
            top: y
        });

        // Create label
        const labelSvg = `
        <svg width="${cellWidth}" height="${labelHeight}">
            <rect width="100%" height="100%" fill="#1a1a1a"/>
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
                font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white">
                ${variants[i].name}
            </text>
        </svg>`;

        composites.push({
            input: Buffer.from(labelSvg),
            left: x,
            top: y + cellHeight
        });
    }

    // Apply all composites
    grid = grid.composite(composites);

    return grid.png().toBuffer();
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Get available strategies
 */
function getAvailableStrategies() {
    return Object.entries(VARIANT_STRATEGIES).map(([key, value]) => ({
        id: key,
        name: value.name,
        description: value.description,
        variantCount: value.variants.length
    }));
}

/**
 * Get strategy details
 */
function getStrategyDetails(strategy) {
    return VARIANT_STRATEGIES[strategy] || null;
}

module.exports = {
    generateVariants,
    generateVariant,
    generateCustomVariants,
    generateComparisonGrid,
    getAvailableStrategies,
    getStrategyDetails,
    VARIANT_STRATEGIES
};
