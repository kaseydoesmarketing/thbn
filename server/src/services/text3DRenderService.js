/**
 * ============================================================================
 * ThumbnailBuilder - 3D Text Rendering Service
 * ============================================================================
 *
 * Creates professional 3D text effects for thumbnails including:
 * - Extruded 3D text with depth
 * - Metallic and glossy effects
 * - Realistic drop shadows with perspective
 * - Gradient fills and bevels
 * - Chrome, gold, neon effects
 *
 * Uses SVG with advanced filters for maximum compatibility
 */

const sharp = require('sharp');

// =============================================================================
// 3D TEXT PRESETS
// =============================================================================

const TEXT_3D_PRESETS = {
    // MrBeast: Bold, extruded, high impact
    mrbeast: {
        name: 'MrBeast 3D',
        fill: 'linear-gradient(180deg, #FFFF00 0%, #FFD700 50%, #FFA500 100%)',
        fillColors: ['#FFFF00', '#FFD700', '#FFA500'],
        stroke: '#000000',
        strokeWidth: 8,
        extrusion: {
            depth: 12,
            color: '#8B4513',
            direction: { x: 4, y: 6 }
        },
        bevel: {
            enabled: true,
            highlight: '#FFFFFF',
            shadow: '#8B4513',
            size: 3
        },
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.8)',
            blur: 8,
            offset: { x: 8, y: 12 }
        },
        glow: {
            enabled: true,
            color: '#FFD700',
            blur: 15,
            opacity: 0.6
        }
    },

    // Hormozi: Clean, bold, professional 3D
    hormozi: {
        name: 'Hormozi Bold',
        fill: 'linear-gradient(180deg, #FFFFFF 0%, #E0E0E0 100%)',
        fillColors: ['#FFFFFF', '#E0E0E0'],
        stroke: '#000000',
        strokeWidth: 6,
        extrusion: {
            depth: 8,
            color: '#333333',
            direction: { x: 3, y: 4 }
        },
        bevel: {
            enabled: true,
            highlight: '#FFFFFF',
            shadow: '#666666',
            size: 2
        },
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.9)',
            blur: 4,
            offset: { x: 6, y: 8 }
        },
        glow: {
            enabled: false
        }
    },

    // Gaming: Neon glow, chrome effect
    gaming: {
        name: 'Gaming Neon',
        fill: 'linear-gradient(180deg, #00FFFF 0%, #0080FF 50%, #8000FF 100%)',
        fillColors: ['#00FFFF', '#0080FF', '#8000FF'],
        stroke: '#FFFFFF',
        strokeWidth: 4,
        extrusion: {
            depth: 6,
            color: '#000066',
            direction: { x: 2, y: 3 }
        },
        bevel: {
            enabled: true,
            highlight: '#FFFFFF',
            shadow: '#000066',
            size: 2
        },
        shadow: {
            enabled: true,
            color: 'rgba(0,0,255,0.6)',
            blur: 20,
            offset: { x: 0, y: 4 }
        },
        glow: {
            enabled: true,
            color: '#00FFFF',
            blur: 30,
            opacity: 0.8
        }
    },

    // Chrome: Metallic reflective
    chrome: {
        name: 'Chrome Metal',
        fill: 'linear-gradient(180deg, #FFFFFF 0%, #C0C0C0 25%, #808080 50%, #C0C0C0 75%, #FFFFFF 100%)',
        fillColors: ['#FFFFFF', '#C0C0C0', '#808080', '#C0C0C0', '#FFFFFF'],
        stroke: '#333333',
        strokeWidth: 3,
        extrusion: {
            depth: 10,
            color: '#404040',
            direction: { x: 3, y: 5 }
        },
        bevel: {
            enabled: true,
            highlight: '#FFFFFF',
            shadow: '#404040',
            size: 4
        },
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.7)',
            blur: 10,
            offset: { x: 5, y: 8 }
        },
        glow: {
            enabled: false
        }
    },

    // Gold: Luxury metallic
    gold: {
        name: 'Gold Luxury',
        fill: 'linear-gradient(180deg, #FFD700 0%, #FFA500 30%, #B8860B 50%, #FFD700 70%, #FFFACD 100%)',
        fillColors: ['#FFD700', '#FFA500', '#B8860B', '#FFD700', '#FFFACD'],
        stroke: '#8B4513',
        strokeWidth: 4,
        extrusion: {
            depth: 10,
            color: '#8B4513',
            direction: { x: 4, y: 6 }
        },
        bevel: {
            enabled: true,
            highlight: '#FFFACD',
            shadow: '#8B4513',
            size: 3
        },
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.6)',
            blur: 12,
            offset: { x: 6, y: 10 }
        },
        glow: {
            enabled: true,
            color: '#FFD700',
            blur: 20,
            opacity: 0.4
        }
    },

    // Fire: Red/orange dramatic
    fire: {
        name: 'Fire Effect',
        fill: 'linear-gradient(180deg, #FFFF00 0%, #FF6600 40%, #FF0000 70%, #990000 100%)',
        fillColors: ['#FFFF00', '#FF6600', '#FF0000', '#990000'],
        stroke: '#000000',
        strokeWidth: 5,
        extrusion: {
            depth: 8,
            color: '#660000',
            direction: { x: 3, y: 5 }
        },
        bevel: {
            enabled: true,
            highlight: '#FFFF00',
            shadow: '#660000',
            size: 2
        },
        shadow: {
            enabled: true,
            color: 'rgba(255,0,0,0.5)',
            blur: 20,
            offset: { x: 0, y: 6 }
        },
        glow: {
            enabled: true,
            color: '#FF6600',
            blur: 25,
            opacity: 0.7
        }
    },

    // Ice: Cool blue frozen effect
    ice: {
        name: 'Ice Frozen',
        fill: 'linear-gradient(180deg, #FFFFFF 0%, #E0FFFF 30%, #87CEEB 60%, #4169E1 100%)',
        fillColors: ['#FFFFFF', '#E0FFFF', '#87CEEB', '#4169E1'],
        stroke: '#000080',
        strokeWidth: 4,
        extrusion: {
            depth: 8,
            color: '#000080',
            direction: { x: 3, y: 4 }
        },
        bevel: {
            enabled: true,
            highlight: '#FFFFFF',
            shadow: '#4169E1',
            size: 3
        },
        shadow: {
            enabled: true,
            color: 'rgba(0,0,128,0.5)',
            blur: 15,
            offset: { x: 4, y: 8 }
        },
        glow: {
            enabled: true,
            color: '#87CEEB',
            blur: 20,
            opacity: 0.5
        }
    },

    // Clean: Simple but professional 3D
    clean: {
        name: 'Clean Professional',
        fill: '#FFFFFF',
        fillColors: ['#FFFFFF'],
        stroke: '#000000',
        strokeWidth: 6,
        extrusion: {
            depth: 6,
            color: '#404040',
            direction: { x: 3, y: 4 }
        },
        bevel: {
            enabled: false
        },
        shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.8)',
            blur: 0,
            offset: { x: 6, y: 8 }
        },
        glow: {
            enabled: false
        }
    }
};

// Creator style to 3D preset mapping
const CREATOR_TO_3D = {
    'mrbeast': 'mrbeast',
    'hormozi': 'hormozi',
    'alex-hormozi': 'hormozi',
    'gadzhi': 'gold',
    'iman-gadzhi': 'gold',
    'gaming': 'gaming',
    'magnates': 'chrome',
    'magnates-media': 'chrome',
    'documentary': 'clean',
    'finance': 'hormozi',
    'business': 'hormozi',
    'lifestyle': 'clean',
    'default': 'mrbeast'
};

// =============================================================================
// 3D TEXT RENDERING
// =============================================================================

/**
 * Generate 3D text as SVG
 * @param {string} text - Text to render
 * @param {Object} options - Rendering options
 * @returns {string} SVG string
 */
function generate3DTextSVG(text, options = {}) {
    const {
        width = 1920,
        height = 400,
        fontSize = 160,
        fontFamily = 'Impact, Arial Black, sans-serif',
        fontWeight = 900,
        x = 960,
        y = 250,
        anchor = 'middle',
        preset = 'mrbeast',
        rotation = 0,
        customStyle = null
    } = options;

    // Get preset or use custom style
    const style = customStyle || TEXT_3D_PRESETS[preset] || TEXT_3D_PRESETS['mrbeast'];

    // Generate unique IDs for filters
    const filterId = `filter3d_${Date.now()}`;
    const gradientId = `grad_${Date.now()}`;
    const glowId = `glow_${Date.now()}`;

    // Build gradient definition
    const gradientDef = buildGradientDef(gradientId, style.fillColors);

    // Build filter definitions
    const filterDef = buildFilterDef(filterId, glowId, style);

    // Build extrusion layers (back to front)
    const extrusionLayers = buildExtrusionLayers(text, style, {
        x, y, fontSize, fontFamily, fontWeight, anchor
    });

    // Build main text layer
    const mainTextLayer = buildMainTextLayer(text, style, gradientId, {
        x, y, fontSize, fontFamily, fontWeight, anchor
    });

    // Build bevel layers if enabled
    const bevelLayers = style.bevel?.enabled
        ? buildBevelLayers(text, style, { x, y, fontSize, fontFamily, fontWeight, anchor })
        : '';

    // Build glow layer if enabled
    const glowLayer = style.glow?.enabled
        ? buildGlowLayer(text, style, glowId, { x, y, fontSize, fontFamily, fontWeight, anchor })
        : '';

    // Assemble SVG
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
        ${gradientDef}
        ${filterDef}
    </defs>

    <g transform="rotate(${rotation}, ${x}, ${y})">
        <!-- Glow layer (behind everything) -->
        ${glowLayer}

        <!-- Shadow layer -->
        ${style.shadow?.enabled ? buildShadowLayer(text, style, { x, y, fontSize, fontFamily, fontWeight, anchor }) : ''}

        <!-- Extrusion layers (3D depth) -->
        ${extrusionLayers}

        <!-- Bevel layers -->
        ${bevelLayers}

        <!-- Main text layer -->
        ${mainTextLayer}
    </g>
</svg>`;

    return svg.trim();
}

/**
 * Build linear gradient definition
 */
function buildGradientDef(id, colors) {
    if (!colors || colors.length === 0) return '';
    if (colors.length === 1) {
        return `<linearGradient id="${id}"><stop offset="0%" stop-color="${colors[0]}"/></linearGradient>`;
    }

    const stops = colors.map((color, i) => {
        const offset = (i / (colors.length - 1)) * 100;
        return `<stop offset="${offset}%" stop-color="${color}"/>`;
    }).join('\n        ');

    return `
        <linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
            ${stops}
        </linearGradient>`;
}

/**
 * Build filter definitions for glow, shadow, etc.
 */
function buildFilterDef(filterId, glowId, style) {
    let filters = '';

    // Glow filter
    if (style.glow?.enabled) {
        filters += `
        <filter id="${glowId}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="${style.glow.blur}" result="blur"/>
            <feFlood flood-color="${style.glow.color}" flood-opacity="${style.glow.opacity}" result="color"/>
            <feComposite in="color" in2="blur" operator="in" result="glow"/>
            <feMerge>
                <feMergeNode in="glow"/>
                <feMergeNode in="glow"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>`;
    }

    // Drop shadow filter
    if (style.shadow?.enabled && style.shadow.blur > 0) {
        filters += `
        <filter id="${filterId}_shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="${style.shadow.offset.x}" dy="${style.shadow.offset.y}"
                          stdDeviation="${style.shadow.blur}" flood-color="${style.shadow.color}"/>
        </filter>`;
    }

    return filters;
}

/**
 * Build extrusion layers for 3D depth effect
 */
function buildExtrusionLayers(text, style, textProps) {
    if (!style.extrusion || style.extrusion.depth === 0) return '';

    const { depth, color, direction } = style.extrusion;
    const { x, y, fontSize, fontFamily, fontWeight, anchor } = textProps;

    let layers = '';

    // Create layers from back to front
    for (let i = depth; i > 0; i--) {
        const offsetX = (direction.x / depth) * i;
        const offsetY = (direction.y / depth) * i;

        // Darken color for depth
        const darkness = 1 - (i / depth) * 0.3;
        const layerColor = adjustColorBrightness(color, darkness);

        layers += `
        <text x="${x + offsetX}" y="${y + offsetY}"
              font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
              text-anchor="${anchor}" fill="${layerColor}">${escapeXml(text)}</text>`;
    }

    return layers;
}

/**
 * Build main text layer with gradient fill and stroke
 */
function buildMainTextLayer(text, style, gradientId, textProps) {
    const { x, y, fontSize, fontFamily, fontWeight, anchor } = textProps;

    const fill = style.fillColors.length > 1 ? `url(#${gradientId})` : style.fillColors[0];

    return `
        <text x="${x}" y="${y}"
              font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
              text-anchor="${anchor}"
              fill="${fill}"
              stroke="${style.stroke}" stroke-width="${style.strokeWidth}"
              paint-order="stroke fill">${escapeXml(text)}</text>`;
}

/**
 * Build bevel layers for 3D edge effect
 */
function buildBevelLayers(text, style, textProps) {
    if (!style.bevel?.enabled) return '';

    const { highlight, shadow, size } = style.bevel;
    const { x, y, fontSize, fontFamily, fontWeight, anchor } = textProps;

    // Highlight (top-left offset)
    const highlightLayer = `
        <text x="${x - size * 0.5}" y="${y - size * 0.5}"
              font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
              text-anchor="${anchor}"
              fill="none" stroke="${highlight}" stroke-width="2"
              opacity="0.5">${escapeXml(text)}</text>`;

    // Shadow (bottom-right offset) - rendered behind
    const shadowLayer = `
        <text x="${x + size * 0.5}" y="${y + size * 0.5}"
              font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
              text-anchor="${anchor}"
              fill="none" stroke="${shadow}" stroke-width="2"
              opacity="0.3">${escapeXml(text)}</text>`;

    return shadowLayer + highlightLayer;
}

/**
 * Build shadow layer
 */
function buildShadowLayer(text, style, textProps) {
    const { shadow } = style;
    const { x, y, fontSize, fontFamily, fontWeight, anchor } = textProps;

    return `
        <text x="${x + shadow.offset.x}" y="${y + shadow.offset.y}"
              font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
              text-anchor="${anchor}"
              fill="${shadow.color}"
              ${shadow.blur > 0 ? `filter="url(#${Date.now()}_shadow)"` : ''}>${escapeXml(text)}</text>`;
}

/**
 * Build glow layer
 */
function buildGlowLayer(text, style, glowId, textProps) {
    const { x, y, fontSize, fontFamily, fontWeight, anchor } = textProps;

    return `
        <text x="${x}" y="${y}"
              font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
              text-anchor="${anchor}"
              fill="${style.glow.color}"
              filter="url(#${glowId})">${escapeXml(text)}</text>`;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Adjust color brightness
 */
function adjustColorBrightness(hexColor, factor) {
    const hex = hexColor.replace('#', '');
    const r = Math.min(255, Math.floor(parseInt(hex.substr(0, 2), 16) * factor));
    const g = Math.min(255, Math.floor(parseInt(hex.substr(2, 2), 16) * factor));
    const b = Math.min(255, Math.floor(parseInt(hex.substr(4, 2), 16) * factor));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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

/**
 * Render 3D text SVG to image buffer
 */
async function render3DText(text, options = {}) {
    const {
        width = 1920,
        height = 400,
        format = 'png',
        ...svgOptions
    } = options;

    const svg = generate3DTextSVG(text, { width, height, ...svgOptions });

    try {
        const buffer = await sharp(Buffer.from(svg))
            .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toFormat(format)
            .toBuffer();

        return buffer;
    } catch (error) {
        console.error('[Text3D] Render error:', error.message);
        throw error;
    }
}

/**
 * Composite 3D text onto an image
 */
async function composite3DTextOnImage(imageBuffer, text, options = {}) {
    const {
        x = 960,
        y = 540,
        fontSize = 160,
        preset = 'mrbeast',
        creatorStyle = null,
        ...rest
    } = options;

    // Get preset from creator style if provided
    const effectivePreset = creatorStyle
        ? (CREATOR_TO_3D[creatorStyle.toLowerCase()] || preset)
        : preset;

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const { width: imgWidth, height: imgHeight } = metadata;

    // Calculate text layer dimensions (full width, appropriate height)
    const textHeight = Math.ceil(fontSize * 2.5);  // Extra space for effects

    // Generate 3D text SVG
    const textSvg = generate3DTextSVG(text, {
        width: imgWidth,
        height: textHeight,
        fontSize,
        x: x,
        y: textHeight * 0.6,  // Center vertically in text layer
        preset: effectivePreset,
        ...rest
    });

    // Convert SVG to buffer
    const textBuffer = await sharp(Buffer.from(textSvg))
        .toFormat('png')
        .toBuffer();

    // Composite onto image
    const result = await sharp(imageBuffer)
        .composite([{
            input: textBuffer,
            top: Math.round(y - textHeight * 0.6),
            left: 0
        }])
        .toBuffer();

    console.log(`[Text3D] Composited "${text}" with ${effectivePreset} preset`);
    return result;
}

/**
 * Get 3D preset for creator style
 */
function get3DPresetForStyle(creatorStyle) {
    return CREATOR_TO_3D[creatorStyle?.toLowerCase()] || 'mrbeast';
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    generate3DTextSVG,
    render3DText,
    composite3DTextOnImage,
    get3DPresetForStyle,
    TEXT_3D_PRESETS,
    CREATOR_TO_3D
};
