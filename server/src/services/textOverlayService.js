const sharp = require('sharp');

/**
 * Text Overlay Service for YouTube Thumbnails
 *
 * Renders bold, professional text overlays on generated images.
 * Uses SVG for maximum flexibility with strokes, shadows, and effects.
 *
 * Features:
 * - Bold fonts with customizable stroke/outline
 * - Drop shadows for depth
 * - Glow effects for gaming/neon styles
 * - Smart positioning (avoids bottom-right for duration)
 * - Mobile-legible sizing
 */

// ============================================================================
// TEXT STYLE PRESETS
// ============================================================================

const TEXT_PRESETS = {
    // PRO PRESET: Maximum impact - MrBeast style
    bold: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 140, // LARGER for mobile visibility
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 14, // THICKER stroke
        shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' }, // HARD shadow
        glow: null
    },

    // Gaming: Neon cyberpunk style
    gaming: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 130,
        fill: '#00FFFF',
        stroke: '#000000',
        strokeWidth: 12,
        shadow: { dx: 6, dy: 6, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 20, color: '#00D4FF' }
    },

    // Finance: Gold on black - wealth aesthetic
    finance: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 150,
        fill: '#FFD700',
        stroke: '#000000',
        strokeWidth: 14,
        shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 10, color: '#FFD700' }
    },

    // Tech: Clean but bold - MKBHD style
    tech: {
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontWeight: 800,
        fontSize: 120,
        fill: '#FFFFFF',
        stroke: '#FF0000',
        strokeWidth: 8,
        shadow: { dx: 4, dy: 4, blur: 2, color: 'rgba(0,0,0,0.9)' },
        glow: null
    },

    // Minimal: Clean but visible
    minimal: {
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontWeight: 700,
        fontSize: 110,
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 6,
        shadow: { dx: 4, dy: 4, blur: 0, color: 'rgba(0,0,0,0.8)' },
        glow: null
    },

    // Reaction: MAXIMUM ATTENTION - Yellow on black
    reaction: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 160, // BIGGEST for reaction thumbnails
        fill: '#FFFF00',
        stroke: '#000000',
        strokeWidth: 16, // THICCEST stroke
        shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' }, // Hard shadow
        glow: null
    },

    // Fitness: Red energy
    fitness: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 140,
        fill: '#FFFFFF',
        stroke: '#FF0000',
        strokeWidth: 14,
        shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 12, color: '#FF0000' }
    },

    // Beauty: Soft pink glow
    beauty: {
        fontFamily: 'Georgia, serif',
        fontWeight: 700,
        fontSize: 110,
        fill: '#FFFFFF',
        stroke: '#FFB6C1',
        strokeWidth: 6,
        shadow: { dx: 4, dy: 4, blur: 4, color: 'rgba(0,0,0,0.6)' },
        glow: { blur: 15, color: '#FFB6C1' }
    }
};

// ============================================================================
// POSITION PRESETS
// ============================================================================

const POSITIONS = {
    // Top right - BEST for face-on-left thumbnails
    topRight: { x: 1230, y: 120, anchor: 'end' },

    // Top center - for no-face or centered compositions
    topCenter: { x: 640, y: 120, anchor: 'middle' },

    // Top left - when face is on right
    topLeft: { x: 50, y: 120, anchor: 'start' },

    // Right side center - PRIMARY for face thumbnails (face on left, text on right)
    rightCenter: { x: 1230, y: 360, anchor: 'end' },

    // Right side upper - good for short punchy text
    rightUpper: { x: 1230, y: 250, anchor: 'end' },

    // Center - dramatic, face behind text
    center: { x: 640, y: 400, anchor: 'middle' },

    // Bottom left - safe zone (avoids YouTube duration)
    bottomLeft: { x: 50, y: 620, anchor: 'start' },

    // Bottom right - AVOID (YouTube duration overlay covers this)
    bottomRight: { x: 1230, y: 620, anchor: 'end' },

    // Left third (when face is on right)
    leftThird: { x: 50, y: 360, anchor: 'start' },

    // Right third - DEFAULT for face-on-left thumbnails
    rightThird: { x: 1230, y: 360, anchor: 'end' }
};

// ============================================================================
// SVG TEXT GENERATOR
// ============================================================================

/**
 * Generate SVG text with styling
 * @param {string} text - The text to render
 * @param {Object} style - Style configuration
 * @param {Object} position - Position configuration
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function generateTextSVG(text, style, position, width = 1280, height = 720) {
    const {
        fontFamily = 'Impact, sans-serif',
        fontWeight = 900,
        fontSize = 120,
        fill = '#FFFFFF',
        stroke = '#000000',
        strokeWidth = 10,
        shadow = null,
        glow = null,
        rotation = 0
    } = style;

    const { x, y, anchor = 'start' } = position;

    // Scale font size based on canvas dimensions
    const scaledFontSize = Math.round(fontSize * (width / 1280));
    const scaledStrokeWidth = Math.round(strokeWidth * (width / 1280));

    // Build filter definitions for effects
    let filterDefs = '';
    let filterRef = '';

    if (shadow || glow) {
        filterDefs = '<defs>';

        if (shadow && glow) {
            filterDefs += `
                <filter id="textEffect" x="-50%" y="-50%" width="200%" height="200%">
                    <!-- Glow -->
                    <feGaussianBlur in="SourceGraphic" stdDeviation="${glow.blur}" result="glow"/>
                    <feFlood flood-color="${glow.color}" result="glowColor"/>
                    <feComposite in="glowColor" in2="glow" operator="in" result="coloredGlow"/>
                    <!-- Shadow -->
                    <feOffset in="SourceGraphic" dx="${shadow.dx}" dy="${shadow.dy}" result="shadowOffset"/>
                    <feGaussianBlur in="shadowOffset" stdDeviation="${shadow.blur}" result="shadowBlur"/>
                    <feFlood flood-color="${shadow.color}" result="shadowColor"/>
                    <feComposite in="shadowColor" in2="shadowBlur" operator="in" result="shadow"/>
                    <!-- Merge -->
                    <feMerge>
                        <feMergeNode in="coloredGlow"/>
                        <feMergeNode in="shadow"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>`;
            filterRef = 'filter="url(#textEffect)"';
        } else if (shadow) {
            filterDefs += `
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur}" flood-color="${shadow.color}"/>
                </filter>`;
            filterRef = 'filter="url(#shadow)"';
        } else if (glow) {
            filterDefs += `
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="${glow.blur}" result="blur"/>
                    <feFlood flood-color="${glow.color}" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>`;
            filterRef = 'filter="url(#glow)"';
        }

        filterDefs += '</defs>';
    }

    // Handle multi-line text
    const lines = text.split('\n');
    const lineHeight = scaledFontSize * 1.1;
    const totalHeight = lines.length * lineHeight;
    const startY = y - (totalHeight / 2) + (scaledFontSize / 2);

    let textElements = '';
    lines.forEach((line, index) => {
        const lineY = startY + (index * lineHeight);

        // Text with stroke (paint-order makes stroke render behind fill)
        textElements += `
            <text
                x="${x}"
                y="${lineY}"
                font-family="${fontFamily}"
                font-weight="${fontWeight}"
                font-size="${scaledFontSize}"
                text-anchor="${anchor}"
                fill="${fill}"
                stroke="${stroke}"
                stroke-width="${scaledStrokeWidth}"
                stroke-linejoin="round"
                paint-order="stroke fill"
                ${filterRef}
                ${rotation ? `transform="rotate(${rotation} ${x} ${lineY})"` : ''}
            >${escapeXML(line)}</text>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            ${filterDefs}
            ${textElements}
        </svg>`;
}

/**
 * Escape special XML characters
 */
function escapeXML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============================================================================
// MAIN TEXT OVERLAY FUNCTION
// ============================================================================

/**
 * Add text overlay to an image
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {Object} options - Text options
 * @param {string} options.text - Text to render (use \n for multi-line)
 * @param {string} options.preset - Style preset name (bold, gaming, finance, etc.)
 * @param {string} options.position - Position preset name or custom {x, y, anchor}
 * @param {Object} options.customStyle - Custom style overrides
 * @param {string} options.niche - Niche for auto-styling
 */
async function addTextOverlay(imageBuffer, options) {
    const {
        text,
        preset = 'bold',
        position = 'leftThird',
        customStyle = {},
        niche
    } = options;

    if (!text || text.trim() === '') {
        // No text to add, return original
        return imageBuffer;
    }

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1280;
    const height = metadata.height || 720;

    // Get style preset
    let style = TEXT_PRESETS[preset] || TEXT_PRESETS.bold;

    // If niche provided, get niche-specific styling
    if (niche) {
        const nicheStyle = getNicheTextStyle(niche);
        style = { ...style, ...nicheStyle };
    }

    // Apply custom overrides
    style = { ...style, ...customStyle };

    // Get position
    let pos;
    if (typeof position === 'string') {
        pos = POSITIONS[position] || POSITIONS.leftThird;
        // Scale position to actual image size
        pos = {
            x: Math.round(pos.x * (width / 1280)),
            y: Math.round(pos.y * (height / 720)),
            anchor: pos.anchor
        };
    } else {
        pos = position;
    }

    // Generate SVG
    const svg = generateTextSVG(text.toUpperCase(), style, pos, width, height);

    // Composite SVG onto image
    const result = await sharp(imageBuffer)
        .composite([{
            input: Buffer.from(svg),
            top: 0,
            left: 0
        }])
        .toBuffer();

    return result;
}

/**
 * Add multiple text elements to an image
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {Array} textElements - Array of text options
 */
async function addMultipleTexts(imageBuffer, textElements) {
    let result = imageBuffer;

    for (const element of textElements) {
        result = await addTextOverlay(result, element);
    }

    return result;
}

/**
 * Get text styling based on niche
 */
function getNicheTextStyle(niche) {
    const nicheStyles = {
        gaming: {
            fill: '#00FFFF',
            stroke: '#000000',
            strokeWidth: 8,
            glow: { blur: 12, color: '#00D4FF' }
        },
        tech: {
            fill: '#FFFFFF',
            stroke: '#FF0000',
            strokeWidth: 6,
            glow: null
        },
        finance: {
            fill: '#FFD700',
            stroke: '#000000',
            strokeWidth: 10,
            glow: null
        },
        beauty: {
            fill: '#FFFFFF',
            stroke: '#FFB6C1',
            strokeWidth: 4,
            glow: { blur: 8, color: '#FFB6C1' }
        },
        fitness: {
            fill: '#FFFFFF',
            stroke: '#FF0000',
            strokeWidth: 10,
            glow: null
        },
        cooking: {
            fill: '#FFFFFF',
            stroke: '#8B4513',
            strokeWidth: 8,
            glow: null
        },
        travel: {
            fill: '#FFD700',
            stroke: '#000000',
            strokeWidth: 10,
            glow: null
        },
        reaction: {
            fill: '#FFFF00',
            stroke: '#000000',
            strokeWidth: 12,
            glow: null
        },
        podcast: {
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 6,
            glow: null
        },
        tutorial: {
            fill: '#FFFFFF',
            stroke: '#4A90D9',
            strokeWidth: 6,
            glow: null
        }
    };

    return nicheStyles[niche] || nicheStyles.reaction;
}

/**
 * Smart text positioning based on composition
 * DEFAULT: Text on RIGHT side (face is on LEFT in pro thumbnails)
 *
 * @param {string} niche - Content niche
 * @param {number} textLength - Character count
 * @param {boolean} hasFace - Whether thumbnail has a face (affects positioning)
 */
function getSmartPosition(niche, textLength, hasFace = true) {
    const isShort = textLength <= 12;
    const isMedium = textLength <= 25;

    // PRO THUMBNAIL RULE: Face on LEFT, text on RIGHT
    // This creates visual balance and directs eye flow

    if (hasFace) {
        // Face thumbnail: Text goes on RIGHT side
        const facePositionPrefs = {
            gaming: isShort ? 'rightUpper' : 'rightCenter',
            tech: 'rightUpper',
            finance: isShort ? 'rightUpper' : 'rightCenter',
            beauty: 'rightCenter',
            fitness: isShort ? 'rightUpper' : 'rightCenter',
            cooking: 'rightCenter',
            travel: 'rightCenter',
            reaction: isShort ? 'rightUpper' : 'rightCenter', // Maximum impact position
            podcast: 'rightCenter',
            tutorial: 'rightUpper'
        };
        return facePositionPrefs[niche] || 'rightCenter';
    } else {
        // No face: Can use full frame
        const noFacePositionPrefs = {
            gaming: isShort ? 'center' : 'topCenter',
            tech: 'topRight',
            finance: isShort ? 'center' : 'topCenter',
            beauty: 'bottomLeft',
            fitness: 'center',
            cooking: 'bottomLeft',
            travel: 'bottomLeft',
            reaction: isShort ? 'center' : 'topCenter',
            podcast: 'topLeft',
            tutorial: 'topLeft'
        };
        return noFacePositionPrefs[niche] || 'topCenter';
    }
}

module.exports = {
    addTextOverlay,
    addMultipleTexts,
    generateTextSVG,
    getSmartPosition,
    getNicheTextStyle,
    TEXT_PRESETS,
    POSITIONS
};
