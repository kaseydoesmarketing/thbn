/**
 * Style Transfer Engine - Tier 3
 *
 * Applies artistic styles to thumbnails on user request
 * NOTE: All style transfers are OPTIONAL and require explicit user action
 *
 * Features:
 * - Color palette extraction
 * - Style presets (vintage, cinematic, neon, etc.)
 * - Channel boosters and adjusters
 * - Filter chains
 * - Look-up table (LUT) simulation
 *
 * @module styleTransferService
 */

const sharp = require('sharp');

// =============================================================================
// STYLE PRESETS - User-selectable options
// =============================================================================

const STYLE_PRESETS = {
    // Cinematic Styles
    'cinematic-orange-teal': {
        name: 'Cinematic Orange & Teal',
        description: 'Hollywood blockbuster look with orange highlights and teal shadows',
        category: 'cinematic',
        adjustments: {
            shadows: { r: -15, g: 5, b: 25 },    // Push shadows teal
            highlights: { r: 20, g: 10, b: -15 }, // Push highlights orange
            contrast: 1.15,
            saturation: 1.1,
            warmth: 0.05
        }
    },
    'cinematic-cold': {
        name: 'Cinematic Cold',
        description: 'Thriller/drama cold blue tones',
        category: 'cinematic',
        adjustments: {
            shadows: { r: -10, g: 0, b: 15 },
            highlights: { r: -5, g: 5, b: 10 },
            contrast: 1.2,
            saturation: 0.9,
            warmth: -0.15
        }
    },
    'cinematic-warm': {
        name: 'Cinematic Warm',
        description: 'Golden hour cinematic warmth',
        category: 'cinematic',
        adjustments: {
            shadows: { r: 10, g: 5, b: -10 },
            highlights: { r: 25, g: 15, b: -5 },
            contrast: 1.1,
            saturation: 1.15,
            warmth: 0.2
        }
    },

    // Viral/YouTube Styles
    'viral-pop': {
        name: 'Viral Pop',
        description: 'Maximum saturation and contrast for thumbnails',
        category: 'viral',
        adjustments: {
            contrast: 1.3,
            saturation: 1.35,
            clarity: 0.3,
            pop: 0.25
        }
    },
    'mrbeast': {
        name: 'MrBeast Style',
        description: 'Hyper-saturated, high energy look',
        category: 'viral',
        adjustments: {
            contrast: 1.25,
            saturation: 1.4,
            clarity: 0.35,
            warmth: 0.1,
            pop: 0.3,
            shadows: { r: 5, g: 0, b: 5 }
        }
    },
    'thumbnail-punch': {
        name: 'Thumbnail Punch',
        description: 'Optimized for small preview impact',
        category: 'viral',
        adjustments: {
            contrast: 1.35,
            saturation: 1.25,
            clarity: 0.4,
            sharpen: 0.3
        }
    },

    // Vintage/Retro Styles
    'vintage-warm': {
        name: 'Vintage Warm',
        description: 'Warm analog film look',
        category: 'vintage',
        adjustments: {
            highlights: { r: 15, g: 10, b: -10 },
            shadows: { r: 10, g: 5, b: 0 },
            contrast: 0.95,
            saturation: 0.85,
            warmth: 0.15,
            fade: 0.1
        }
    },
    'vintage-cool': {
        name: 'Vintage Cool',
        description: 'Cool retro film aesthetic',
        category: 'vintage',
        adjustments: {
            highlights: { r: -5, g: 5, b: 15 },
            shadows: { r: 5, g: 10, b: 15 },
            contrast: 0.9,
            saturation: 0.8,
            warmth: -0.1,
            fade: 0.15
        }
    },
    'kodak-gold': {
        name: 'Kodak Gold',
        description: 'Classic Kodak warm film emulation',
        category: 'vintage',
        adjustments: {
            highlights: { r: 20, g: 10, b: -5 },
            shadows: { r: 5, g: 0, b: -5 },
            contrast: 1.05,
            saturation: 1.1,
            warmth: 0.12
        }
    },
    'fuji-velvia': {
        name: 'Fuji Velvia',
        description: 'Punchy Fuji slide film look',
        category: 'vintage',
        adjustments: {
            contrast: 1.2,
            saturation: 1.3,
            shadows: { r: -5, g: 0, b: 10 },
            highlights: { r: 5, g: 0, b: -5 }
        }
    },

    // Modern/Trendy Styles
    'neon-nights': {
        name: 'Neon Nights',
        description: 'Cyberpunk neon glow effect',
        category: 'modern',
        adjustments: {
            shadows: { r: 30, g: -10, b: 40 },
            highlights: { r: 0, g: 20, b: 30 },
            contrast: 1.2,
            saturation: 1.3,
            warmth: -0.1
        }
    },
    'pastel-dream': {
        name: 'Pastel Dream',
        description: 'Soft pastel aesthetic',
        category: 'modern',
        adjustments: {
            contrast: 0.85,
            saturation: 0.7,
            brightness: 1.1,
            fade: 0.2,
            highlights: { r: 10, g: 10, b: 15 }
        }
    },
    'moody-dark': {
        name: 'Moody Dark',
        description: 'Dark dramatic mood',
        category: 'modern',
        adjustments: {
            contrast: 1.25,
            saturation: 0.95,
            brightness: 0.9,
            shadows: { r: -10, g: -5, b: 5 },
            fade: 0.05
        }
    },

    // Gaming Styles
    'gaming-vibrant': {
        name: 'Gaming Vibrant',
        description: 'High energy gaming stream look',
        category: 'gaming',
        adjustments: {
            contrast: 1.3,
            saturation: 1.4,
            clarity: 0.35,
            highlights: { r: 10, g: 0, b: 20 }
        }
    },
    'gaming-dark': {
        name: 'Gaming Dark',
        description: 'Dark atmospheric gaming aesthetic',
        category: 'gaming',
        adjustments: {
            contrast: 1.2,
            saturation: 1.1,
            brightness: 0.85,
            shadows: { r: -5, g: 5, b: 15 },
            clarity: 0.25
        }
    },

    // Professional Styles
    'professional-clean': {
        name: 'Professional Clean',
        description: 'Clean corporate look',
        category: 'professional',
        adjustments: {
            contrast: 1.05,
            saturation: 0.95,
            clarity: 0.15,
            warmth: 0.02
        }
    },
    'professional-warm': {
        name: 'Professional Warm',
        description: 'Approachable professional warmth',
        category: 'professional',
        adjustments: {
            contrast: 1.08,
            saturation: 1.0,
            clarity: 0.1,
            warmth: 0.08,
            highlights: { r: 8, g: 5, b: -3 }
        }
    },

    // Black & White
    'bw-classic': {
        name: 'B&W Classic',
        description: 'Classic black and white conversion',
        category: 'bw',
        adjustments: {
            grayscale: true,
            contrast: 1.15
        }
    },
    'bw-high-contrast': {
        name: 'B&W High Contrast',
        description: 'Dramatic high contrast black and white',
        category: 'bw',
        adjustments: {
            grayscale: true,
            contrast: 1.4,
            clarity: 0.3
        }
    },

    // None
    'none': {
        name: 'None',
        description: 'No style applied',
        category: 'none',
        adjustments: {}
    }
};

// =============================================================================
// COLOR ADJUSTMENT FUNCTIONS
// =============================================================================

/**
 * Apply selective color adjustments to shadows and highlights
 */
async function applySelectiveColor(imageBuffer, shadows, highlights) {
    // This is a simplified implementation
    // In production, you'd use more sophisticated tone mapping

    let result = sharp(imageBuffer);

    // Create a color matrix for overall shift
    const matrix = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ];

    // Blend shadows and highlights influence
    if (shadows || highlights) {
        const sr = ((shadows?.r || 0) + (highlights?.r || 0)) / 510;
        const sg = ((shadows?.g || 0) + (highlights?.g || 0)) / 510;
        const sb = ((shadows?.b || 0) + (highlights?.b || 0)) / 510;

        matrix[0][0] = 1 + sr;
        matrix[1][1] = 1 + sg;
        matrix[2][2] = 1 + sb;
    }

    return result.recomb(matrix).toBuffer();
}

/**
 * Apply warmth adjustment
 */
async function applyWarmth(imageBuffer, intensity) {
    if (intensity === 0) return imageBuffer;

    const matrix = intensity > 0
        ? [
            [1 + intensity * 0.15, 0, 0],
            [0, 1 + intensity * 0.05, 0],
            [0, 0, 1 - intensity * 0.1]
        ]
        : [
            [1 + intensity * 0.1, 0, 0],
            [0, 1 - Math.abs(intensity) * 0.02, 0],
            [0, 0, 1 - intensity * 0.15]
        ];

    return sharp(imageBuffer).recomb(matrix).toBuffer();
}

/**
 * Apply fade/lift to blacks
 */
async function applyFade(imageBuffer, intensity) {
    if (intensity <= 0) return imageBuffer;

    // Lift the black point
    const lift = Math.round(intensity * 40);

    return sharp(imageBuffer)
        .linear(1 - intensity * 0.1, lift)
        .toBuffer();
}

/**
 * Apply clarity (local contrast)
 */
async function applyClarity(imageBuffer, intensity) {
    if (intensity <= 0) return imageBuffer;

    return sharp(imageBuffer)
        .sharpen({
            sigma: 30,
            m1: intensity * 1.5,
            m2: intensity * 0.75
        })
        .toBuffer();
}

/**
 * Apply pop effect (saturation + contrast boost)
 */
async function applyPop(imageBuffer, intensity) {
    if (intensity <= 0) return imageBuffer;

    return sharp(imageBuffer)
        .modulate({ saturation: 1 + intensity * 0.3 })
        .linear(1 + intensity * 0.15, -(128 * intensity * 0.15))
        .toBuffer();
}

// =============================================================================
// MAIN STYLE APPLICATION FUNCTION
// =============================================================================

/**
 * Apply a style preset to an image
 *
 * NOTE: This function should only be called when user explicitly
 * selects a style - it does NOT run automatically
 *
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {string} styleId - Style preset ID
 * @returns {Promise<Buffer>} Styled image buffer
 */
async function applyStyle(imageBuffer, styleId) {
    const preset = STYLE_PRESETS[styleId];

    if (!preset || styleId === 'none') {
        return imageBuffer;
    }

    const adj = preset.adjustments;
    let result = imageBuffer;

    try {
        // 1. Apply grayscale if B&W style
        if (adj.grayscale) {
            result = await sharp(result).grayscale().toBuffer();
        }

        // 2. Apply selective color (shadows/highlights)
        if (adj.shadows || adj.highlights) {
            result = await applySelectiveColor(result, adj.shadows, adj.highlights);
        }

        // 3. Apply warmth
        if (adj.warmth && adj.warmth !== 0) {
            result = await applyWarmth(result, adj.warmth);
        }

        // 4. Apply brightness/contrast/saturation via modulate
        const modOptions = {};
        if (adj.brightness) modOptions.brightness = adj.brightness;
        if (adj.saturation) modOptions.saturation = adj.saturation;

        if (Object.keys(modOptions).length > 0) {
            result = await sharp(result).modulate(modOptions).toBuffer();
        }

        // 5. Apply contrast
        if (adj.contrast && adj.contrast !== 1) {
            result = await sharp(result)
                .linear(adj.contrast, -(128 * (adj.contrast - 1)))
                .toBuffer();
        }

        // 6. Apply clarity
        if (adj.clarity && adj.clarity > 0) {
            result = await applyClarity(result, adj.clarity);
        }

        // 7. Apply pop
        if (adj.pop && adj.pop > 0) {
            result = await applyPop(result, adj.pop);
        }

        // 8. Apply fade
        if (adj.fade && adj.fade > 0) {
            result = await applyFade(result, adj.fade);
        }

        // 9. Apply sharpen
        if (adj.sharpen && adj.sharpen > 0) {
            const sigma = 1 + adj.sharpen;
            result = await sharp(result)
                .sharpen({ sigma, m1: adj.sharpen * 2, m2: adj.sharpen })
                .toBuffer();
        }

    } catch (error) {
        console.error(`[StyleTransfer] Error applying style "${styleId}":`, error);
        return imageBuffer; // Return original on error
    }

    return result;
}

/**
 * Apply custom style adjustments
 * For when user wants fine-grained control
 *
 * @param {Buffer} imageBuffer - Input image
 * @param {object} adjustments - Custom adjustments object
 * @returns {Promise<Buffer>} Styled image
 */
async function applyCustomStyle(imageBuffer, adjustments) {
    // Use 'custom' as a temporary preset
    const customPreset = {
        name: 'Custom',
        description: 'User-defined style',
        adjustments
    };

    // Store temporarily and apply
    STYLE_PRESETS['_custom'] = customPreset;
    const result = await applyStyle(imageBuffer, '_custom');
    delete STYLE_PRESETS['_custom'];

    return result;
}

/**
 * Generate style preview thumbnails
 * Creates small previews of each style for UI display
 *
 * @param {Buffer} imageBuffer - Source image
 * @param {Array<string>} styleIds - List of style IDs to preview
 * @param {number} previewSize - Preview thumbnail size (default 200)
 * @returns {Promise<Array>} Array of {styleId, name, buffer}
 */
async function generateStylePreviews(imageBuffer, styleIds = null, previewSize = 200) {
    // Default to all styles if not specified
    const stylesToPreview = styleIds || Object.keys(STYLE_PRESETS).filter(id => id !== 'none');

    // Create small base image for faster processing
    const smallBase = await sharp(imageBuffer)
        .resize(previewSize, previewSize, { fit: 'cover' })
        .toBuffer();

    const previews = [];

    for (const styleId of stylesToPreview) {
        try {
            const styled = await applyStyle(smallBase, styleId);
            previews.push({
                styleId,
                name: STYLE_PRESETS[styleId]?.name || styleId,
                category: STYLE_PRESETS[styleId]?.category || 'other',
                buffer: styled
            });
        } catch (error) {
            console.error(`[StyleTransfer] Error generating preview for "${styleId}":`, error);
        }
    }

    return previews;
}

/**
 * Get color palette from image
 * Extracts dominant colors for UI display
 *
 * @param {Buffer} imageBuffer - Image to analyze
 * @param {number} count - Number of colors to extract
 * @returns {Promise<Array>} Array of hex color strings
 */
async function extractColorPalette(imageBuffer, count = 5) {
    try {
        // Resize to small size for faster analysis
        const small = await sharp(imageBuffer)
            .resize(50, 50, { fit: 'cover' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { data, info } = small;
        const pixels = [];

        // Sample pixels
        for (let i = 0; i < data.length; i += info.channels) {
            pixels.push({
                r: data[i],
                g: data[i + 1],
                b: data[i + 2]
            });
        }

        // Simple k-means-like clustering (simplified)
        const clusters = [];
        const step = Math.floor(pixels.length / count);

        for (let i = 0; i < count; i++) {
            const pixel = pixels[i * step];
            if (pixel) {
                const hex = `#${pixel.r.toString(16).padStart(2, '0')}${pixel.g.toString(16).padStart(2, '0')}${pixel.b.toString(16).padStart(2, '0')}`;
                clusters.push(hex);
            }
        }

        return clusters;
    } catch (error) {
        console.error('[StyleTransfer] Error extracting palette:', error);
        return ['#333333', '#666666', '#999999', '#cccccc', '#ffffff'];
    }
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Get all available styles
 */
function getAvailableStyles() {
    return Object.entries(STYLE_PRESETS)
        .filter(([key]) => key !== 'none')
        .map(([key, value]) => ({
            id: key,
            name: value.name,
            description: value.description,
            category: value.category
        }));
}

/**
 * Get styles by category
 */
function getStylesByCategory(category) {
    return Object.entries(STYLE_PRESETS)
        .filter(([_, value]) => value.category === category)
        .map(([key, value]) => ({
            id: key,
            name: value.name,
            description: value.description
        }));
}

/**
 * Get style categories
 */
function getStyleCategories() {
    const categories = new Set();
    Object.values(STYLE_PRESETS).forEach(preset => {
        if (preset.category && preset.category !== 'none') {
            categories.add(preset.category);
        }
    });
    return Array.from(categories);
}

/**
 * Get style details
 */
function getStyleDetails(styleId) {
    return STYLE_PRESETS[styleId] || null;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    applyStyle,
    applyCustomStyle,
    generateStylePreviews,
    extractColorPalette,
    getAvailableStyles,
    getStylesByCategory,
    getStyleCategories,
    getStyleDetails,
    STYLE_PRESETS
};
