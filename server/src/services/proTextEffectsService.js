/**
 * Pro Text Effects Engine - Tier 2
 *
 * Creates viral-quality text effects for thumbnails
 * - 3D extrusion effect
 * - Metallic/chrome gradients
 * - Neon glow effects
 * - Multi-layer strokes
 * - Drop shadows with perspective
 * - Gradient fills
 * - Outline stacking (MrBeast style)
 *
 * @module proTextEffectsService
 */

const sharp = require('sharp');

// =============================================================================
// TEXT EFFECT PRESETS
// =============================================================================

const TEXT_EFFECT_PRESETS = {
    // MrBeast/Viral Style
    'mrbeast': {
        fill: { type: 'solid', color: '#ffffff' },
        strokes: [
            { width: 24, color: '#000000' },
            { width: 16, color: '#ffdd00' },
            { width: 8, color: '#000000' }
        ],
        shadow: { x: 12, y: 12, blur: 0, color: '#000000', opacity: 1 },
        extrusion: null,
        glow: null
    },
    'mrbeast-red': {
        fill: { type: 'solid', color: '#ffffff' },
        strokes: [
            { width: 24, color: '#000000' },
            { width: 16, color: '#ff0000' },
            { width: 8, color: '#000000' }
        ],
        shadow: { x: 12, y: 12, blur: 0, color: '#000000', opacity: 1 },
        extrusion: null,
        glow: null
    },
    'mrbeast-blue': {
        fill: { type: 'solid', color: '#ffffff' },
        strokes: [
            { width: 24, color: '#000000' },
            { width: 16, color: '#0066ff' },
            { width: 8, color: '#000000' }
        ],
        shadow: { x: 12, y: 12, blur: 0, color: '#000000', opacity: 1 },
        extrusion: null,
        glow: null
    },

    // Hormozi Style
    'hormozi': {
        fill: { type: 'solid', color: '#ffdd00' },
        strokes: [
            { width: 16, color: '#000000' }
        ],
        shadow: { x: 8, y: 8, blur: 0, color: '#000000', opacity: 0.8 },
        extrusion: null,
        glow: null
    },
    'hormozi-white': {
        fill: { type: 'solid', color: '#ffffff' },
        strokes: [
            { width: 16, color: '#000000' }
        ],
        shadow: { x: 8, y: 8, blur: 0, color: '#000000', opacity: 0.8 },
        extrusion: null,
        glow: null
    },

    // 3D Extrusion Effects
    '3d-gold': {
        fill: { type: 'gradient', colors: ['#ffd700', '#ffaa00', '#cc8800'], angle: 180 },
        strokes: [
            { width: 4, color: '#8b6914' }
        ],
        shadow: { x: 6, y: 6, blur: 10, color: '#000000', opacity: 0.6 },
        extrusion: { depth: 8, color: '#8b6914', angle: 135 },
        glow: null
    },
    '3d-silver': {
        fill: { type: 'gradient', colors: ['#ffffff', '#c0c0c0', '#909090'], angle: 180 },
        strokes: [
            { width: 4, color: '#606060' }
        ],
        shadow: { x: 6, y: 6, blur: 10, color: '#000000', opacity: 0.6 },
        extrusion: { depth: 8, color: '#606060', angle: 135 },
        glow: null
    },
    '3d-red': {
        fill: { type: 'gradient', colors: ['#ff4444', '#cc0000', '#880000'], angle: 180 },
        strokes: [
            { width: 4, color: '#440000' }
        ],
        shadow: { x: 6, y: 6, blur: 10, color: '#000000', opacity: 0.6 },
        extrusion: { depth: 8, color: '#660000', angle: 135 },
        glow: null
    },
    '3d-blue': {
        fill: { type: 'gradient', colors: ['#4488ff', '#0044cc', '#002288'], angle: 180 },
        strokes: [
            { width: 4, color: '#001144' }
        ],
        shadow: { x: 6, y: 6, blur: 10, color: '#000000', opacity: 0.6 },
        extrusion: { depth: 8, color: '#002266', angle: 135 },
        glow: null
    },

    // Neon Effects
    'neon-pink': {
        fill: { type: 'solid', color: '#ff00ff' },
        strokes: [
            { width: 2, color: '#ffffff' }
        ],
        shadow: null,
        extrusion: null,
        glow: { color: '#ff00ff', intensity: 0.8, size: 20 }
    },
    'neon-cyan': {
        fill: { type: 'solid', color: '#00ffff' },
        strokes: [
            { width: 2, color: '#ffffff' }
        ],
        shadow: null,
        extrusion: null,
        glow: { color: '#00ffff', intensity: 0.8, size: 20 }
    },
    'neon-green': {
        fill: { type: 'solid', color: '#00ff00' },
        strokes: [
            { width: 2, color: '#ffffff' }
        ],
        shadow: null,
        extrusion: null,
        glow: { color: '#00ff00', intensity: 0.8, size: 20 }
    },
    'neon-orange': {
        fill: { type: 'solid', color: '#ff6600' },
        strokes: [
            { width: 2, color: '#ffffff' }
        ],
        shadow: null,
        extrusion: null,
        glow: { color: '#ff6600', intensity: 0.8, size: 20 }
    },
    'neon-multi': {
        fill: { type: 'gradient', colors: ['#ff00ff', '#00ffff'], angle: 90 },
        strokes: [
            { width: 2, color: '#ffffff' }
        ],
        shadow: null,
        extrusion: null,
        glow: { colors: ['#ff00ff', '#00ffff'], intensity: 0.7, size: 25 }
    },

    // Metallic Effects
    'chrome': {
        fill: { type: 'gradient', colors: ['#ffffff', '#888888', '#ffffff', '#666666', '#ffffff'], angle: 180 },
        strokes: [
            { width: 3, color: '#333333' }
        ],
        shadow: { x: 4, y: 4, blur: 8, color: '#000000', opacity: 0.5 },
        extrusion: null,
        glow: { color: '#ffffff', intensity: 0.3, size: 10 }
    },
    'gold-metallic': {
        fill: { type: 'gradient', colors: ['#fff6b3', '#ffd700', '#cc9900', '#ffd700', '#fff6b3'], angle: 180 },
        strokes: [
            { width: 3, color: '#8b6914' }
        ],
        shadow: { x: 4, y: 4, blur: 8, color: '#000000', opacity: 0.5 },
        extrusion: null,
        glow: { color: '#ffd700', intensity: 0.4, size: 15 }
    },
    'copper': {
        fill: { type: 'gradient', colors: ['#ffcc99', '#cc6633', '#994422', '#cc6633', '#ffcc99'], angle: 180 },
        strokes: [
            { width: 3, color: '#662211' }
        ],
        shadow: { x: 4, y: 4, blur: 8, color: '#000000', opacity: 0.5 },
        extrusion: null,
        glow: null
    },

    // Gaming/Esports Style
    'gaming-fire': {
        fill: { type: 'gradient', colors: ['#ffff00', '#ff6600', '#ff0000'], angle: 180 },
        strokes: [
            { width: 6, color: '#000000' },
            { width: 3, color: '#ff3300' }
        ],
        shadow: { x: 0, y: 0, blur: 20, color: '#ff3300', opacity: 0.8 },
        extrusion: null,
        glow: { color: '#ff6600', intensity: 0.6, size: 15 }
    },
    'gaming-ice': {
        fill: { type: 'gradient', colors: ['#ffffff', '#99ddff', '#0099ff'], angle: 180 },
        strokes: [
            { width: 6, color: '#000000' },
            { width: 3, color: '#0066cc' }
        ],
        shadow: { x: 0, y: 0, blur: 20, color: '#0099ff', opacity: 0.8 },
        extrusion: null,
        glow: { color: '#00ccff', intensity: 0.6, size: 15 }
    },
    'gaming-toxic': {
        fill: { type: 'gradient', colors: ['#ccff00', '#66cc00', '#339900'], angle: 180 },
        strokes: [
            { width: 6, color: '#000000' },
            { width: 3, color: '#006600' }
        ],
        shadow: { x: 0, y: 0, blur: 20, color: '#66ff00', opacity: 0.8 },
        extrusion: null,
        glow: { color: '#99ff00', intensity: 0.6, size: 15 }
    },

    // Classic Styles
    'classic-white': {
        fill: { type: 'solid', color: '#ffffff' },
        strokes: [
            { width: 8, color: '#000000' }
        ],
        shadow: { x: 4, y: 4, blur: 0, color: '#000000', opacity: 0.8 },
        extrusion: null,
        glow: null
    },
    'classic-yellow': {
        fill: { type: 'solid', color: '#ffdd00' },
        strokes: [
            { width: 8, color: '#000000' }
        ],
        shadow: { x: 4, y: 4, blur: 0, color: '#000000', opacity: 0.8 },
        extrusion: null,
        glow: null
    },
    'classic-red': {
        fill: { type: 'solid', color: '#ff0000' },
        strokes: [
            { width: 8, color: '#000000' },
            { width: 4, color: '#ffffff' }
        ],
        shadow: { x: 4, y: 4, blur: 0, color: '#000000', opacity: 0.8 },
        extrusion: null,
        glow: null
    },

    // Minimal/Clean
    'minimal-dark': {
        fill: { type: 'solid', color: '#ffffff' },
        strokes: [],
        shadow: { x: 2, y: 2, blur: 4, color: '#000000', opacity: 0.3 },
        extrusion: null,
        glow: null
    },
    'minimal-light': {
        fill: { type: 'solid', color: '#000000' },
        strokes: [],
        shadow: { x: 2, y: 2, blur: 4, color: '#000000', opacity: 0.2 },
        extrusion: null,
        glow: null
    }
};

// =============================================================================
// SVG GENERATION UTILITIES
// =============================================================================

/**
 * Generate SVG gradient definition
 */
function generateGradientDef(id, config) {
    if (config.type !== 'gradient') return '';

    const angle = config.angle || 0;
    const angleRad = (angle * Math.PI) / 180;

    const x1 = 50 + 50 * Math.cos(angleRad + Math.PI);
    const y1 = 50 + 50 * Math.sin(angleRad + Math.PI);
    const x2 = 50 + 50 * Math.cos(angleRad);
    const y2 = 50 + 50 * Math.sin(angleRad);

    const stops = config.colors.map((color, i) => {
        const offset = (i / (config.colors.length - 1)) * 100;
        return `<stop offset="${offset}%" stop-color="${color}" />`;
    }).join('\n      ');

    return `
    <linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">
      ${stops}
    </linearGradient>`;
}

/**
 * Generate SVG filter for glow effect
 */
function generateGlowFilter(id, config) {
    if (!config) return '';

    const { color = '#ffffff', intensity = 0.5, size = 10 } = config;

    return `
    <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${size}" result="blur" />
      <feFlood flood-color="${color}" flood-opacity="${intensity}" result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>`;
}

/**
 * Generate SVG filter for drop shadow
 */
function generateShadowFilter(id, config) {
    if (!config) return '';

    const { x = 4, y = 4, blur = 0, color = '#000000', opacity = 1 } = config;

    return `
    <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="${x}" dy="${y}" stdDeviation="${blur}" flood-color="${color}" flood-opacity="${opacity}" />
    </filter>`;
}

/**
 * Generate text with multi-layer strokes (MrBeast style)
 */
function generateStrokedText(text, x, y, fontSize, fontFamily, config) {
    const { fill, strokes = [], extrusion } = config;
    const layers = [];

    // Generate extrusion layers first (behind everything)
    if (extrusion) {
        const { depth, color, angle = 135 } = extrusion;
        const angleRad = (angle * Math.PI) / 180;
        const stepX = Math.cos(angleRad);
        const stepY = Math.sin(angleRad);

        for (let i = depth; i > 0; i--) {
            layers.push(`
        <text x="${x + stepX * i}" y="${y + stepY * i}"
          font-family="${fontFamily}"
          font-size="${fontSize}"
          font-weight="900"
          text-anchor="middle"
          fill="${color}"
        >${escapeXml(text)}</text>`);
        }
    }

    // Generate stroke layers (from outermost to innermost)
    for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        layers.push(`
        <text x="${x}" y="${y}"
          font-family="${fontFamily}"
          font-size="${fontSize}"
          font-weight="900"
          text-anchor="middle"
          fill="none"
          stroke="${stroke.color}"
          stroke-width="${stroke.width}"
          stroke-linejoin="round"
          stroke-linecap="round"
        >${escapeXml(text)}</text>`);
    }

    // Generate fill layer (on top)
    const fillAttr = fill.type === 'gradient' ? `url(#textFillGradient)` : fill.color;
    layers.push(`
        <text x="${x}" y="${y}"
          font-family="${fontFamily}"
          font-size="${fontSize}"
          font-weight="900"
          text-anchor="middle"
          fill="${fillAttr}"
        >${escapeXml(text)}</text>`);

    return layers.join('');
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// =============================================================================
// MAIN EXPORT FUNCTIONS
// =============================================================================

/**
 * Generate pro-quality text with effects
 *
 * @param {string} text - Text to render
 * @param {object} options - Rendering options
 * @param {string|object} options.preset - Effect preset name or custom config
 * @param {number} options.width - Canvas width
 * @param {number} options.height - Canvas height
 * @param {number} options.fontSize - Font size in pixels
 * @param {string} options.fontFamily - Font family
 * @param {string} options.position - Text position ('top', 'center', 'bottom')
 * @returns {Promise<Buffer>} Rendered text as PNG buffer
 */
async function generateProText(text, options = {}) {
    const {
        preset = 'mrbeast',
        width = 1920,
        height = 1080,
        fontSize = 120,
        fontFamily = 'Impact, Arial Black, sans-serif',
        position = 'bottom',
        offsetX = 0,
        offsetY = 0
    } = options;

    // Get effect configuration
    let config;
    if (typeof preset === 'string') {
        config = TEXT_EFFECT_PRESETS[preset];
        if (!config) {
            console.warn(`[ProText] Unknown preset: ${preset}, using mrbeast`);
            config = TEXT_EFFECT_PRESETS['mrbeast'];
        }
    } else {
        config = preset;
    }

    // Calculate text position
    const x = width / 2 + offsetX;
    let y;
    switch (position) {
        case 'top':
            y = fontSize * 1.2 + offsetY;
            break;
        case 'center':
            y = height / 2 + fontSize / 3 + offsetY;
            break;
        case 'bottom':
        default:
            y = height - fontSize * 0.5 + offsetY;
            break;
    }

    // Generate SVG definitions
    let defs = '<defs>';

    // Add gradient if needed
    if (config.fill && config.fill.type === 'gradient') {
        defs += generateGradientDef('textFillGradient', config.fill);
    }

    // Add glow filter if needed
    if (config.glow) {
        defs += generateGlowFilter('glowFilter', config.glow);
    }

    // Add shadow filter if needed
    if (config.shadow) {
        defs += generateShadowFilter('shadowFilter', config.shadow);
    }

    defs += '</defs>';

    // Determine which filter to apply
    let filterAttr = '';
    if (config.glow) {
        filterAttr = 'filter="url(#glowFilter)"';
    } else if (config.shadow) {
        filterAttr = 'filter="url(#shadowFilter)"';
    }

    // Generate the text layers
    const textLayers = generateStrokedText(text, x, y, fontSize, fontFamily, config);

    // Build complete SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${defs}
  <g ${filterAttr}>
    ${textLayers}
  </g>
</svg>`;

    // Convert SVG to PNG
    return sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}

/**
 * Apply text effect to existing image
 *
 * @param {Buffer} imageBuffer - Base image buffer
 * @param {string} text - Text to overlay
 * @param {object} options - Text options (same as generateProText)
 * @returns {Promise<Buffer>} Image with text overlay
 */
async function applyProText(imageBuffer, text, options = {}) {
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    // Generate text overlay with matching dimensions
    const textOverlay = await generateProText(text, {
        ...options,
        width,
        height
    });

    // Composite text onto image
    return sharp(imageBuffer)
        .composite([{ input: textOverlay, blend: 'over' }])
        .png()
        .toBuffer();
}

/**
 * Get list of available presets
 */
function getAvailablePresets() {
    return Object.keys(TEXT_EFFECT_PRESETS);
}

/**
 * Get preset configuration
 */
function getPresetConfig(preset) {
    return TEXT_EFFECT_PRESETS[preset] || null;
}

/**
 * Get preset categories for UI
 */
function getPresetCategories() {
    return {
        'Viral/YouTube': ['mrbeast', 'mrbeast-red', 'mrbeast-blue', 'hormozi', 'hormozi-white'],
        '3D Effects': ['3d-gold', '3d-silver', '3d-red', '3d-blue'],
        'Neon/Glow': ['neon-pink', 'neon-cyan', 'neon-green', 'neon-orange', 'neon-multi'],
        'Metallic': ['chrome', 'gold-metallic', 'copper'],
        'Gaming': ['gaming-fire', 'gaming-ice', 'gaming-toxic'],
        'Classic': ['classic-white', 'classic-yellow', 'classic-red'],
        'Minimal': ['minimal-dark', 'minimal-light']
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    generateProText,
    applyProText,
    getAvailablePresets,
    getPresetConfig,
    getPresetCategories,
    TEXT_EFFECT_PRESETS
};
