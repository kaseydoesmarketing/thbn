const sharp = require('sharp');
const { YOUTUBE_THUMBNAIL_SPECS } = require('../config/thumbnailSpecs');

/**
 * Text Overlay Service for YouTube Thumbnails
 *
 * VERSION 2: TBUILDER-QUALITY-UPGRADE-V2
 *
 * Renders bold, professional text overlays on generated images.
 * Uses SVG for maximum flexibility with strokes, shadows, and effects.
 *
 * V2 ENHANCEMENTS:
 * - Stronger text hierarchy (headline + subtext)
 * - Improved contrast with enforced minimum stroke widths
 * - Mobile legibility guaranteed at 168x94px (smallest YouTube preview)
 * - Safe zone awareness (avoids duration overlay)
 * - Ultra-bold presets for maximum thumbnail impact
 *
 * Features:
 * - Bold fonts with customizable stroke/outline
 * - Double-stroke effect for premium look
 * - Drop shadows for depth (hard shadows preferred)
 * - Glow effects for gaming/neon styles
 * - Smart positioning (avoids bottom-right for duration)
 * - Mobile-legible sizing enforced
 */

// ============================================================================
// MOBILE LEGIBILITY CONSTANTS
// ============================================================================

// Minimum font size that remains legible at smallest YouTube preview (168x94)
// At 168px width, we need text that's at least 12px to be readable
// 12px at 168px = ~91px at 1280px (12 * 1280/168 = 91.4)
const MIN_FONT_SIZE_FOR_LEGIBILITY = 100;

// Minimum stroke width for visibility against busy backgrounds
const MIN_STROKE_WIDTH = 8;

// Safe zone margins (from YouTube specs)
const SAFE_MARGIN_X = YOUTUBE_THUMBNAIL_SPECS?.SAFE_ZONES?.desktop?.marginX || 90;
const SAFE_MARGIN_Y = YOUTUBE_THUMBNAIL_SPECS?.SAFE_ZONES?.desktop?.marginY || 50;

// ============================================================================
// TEXT STYLE PRESETS
// ============================================================================

// ============================================================================
// CREATOR-STYLE TEXT PRESETS - Locked-in exact specifications
// ============================================================================

const CREATOR_TEXT_PRESETS = {
    // MrBeast: MASSIVE text, bright yellow, thick black stroke, hard shadow
    // ENHANCED: Double-stroke + slight rotation for maximum viral impact
    mrbeast: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 200, // INCREASED for maximum impact
        fill: '#FFFF00', // Bright yellow (signature)
        stroke: '#000000',
        strokeWidth: 20, // THICKER
        doubleStroke: true, // NEW: Double-stroke effect
        innerStroke: '#FFFFFF', // White inner stroke
        innerStrokeWidth: 4,
        shadow: { dx: 14, dy: 14, blur: 0, color: 'rgba(0,0,0,1)' }, // HARD shadow
        glow: { blur: 18, color: '#FFFF00' }, // Yellow glow
        rotation: -2, // Slight tilt for energy
        textCase: 'uppercase'
    },

    // Alex Hormozi: Montserrat Black 900, yellow #F7C204, ALL CAPS (research-backed)
    // ENHANCED: Larger size, double-stroke for authority
    hormozi: {
        fontFamily: 'Impact, Arial Black, sans-serif', // Montserrat Black fallback
        fontWeight: 900,          // BLACK weight (research: Montserrat 900)
        fontSize: 160, // INCREASED
        fill: '#F7C204',          // EXACT Hormozi yellow (research-verified)
        fillAlt: '#02FB23',       // EXACT Hormozi green for emphasis
        stroke: '#000000',
        strokeWidth: 14,
        doubleStroke: true, // NEW: Double-stroke effect
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 3,
        shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: null,
        textCase: 'uppercase'     // ALL CAPS (research-backed)
    },

    // Iman Gadzhi: MINIMALIST - WHITE ONLY, lowercase, NO glow (research-backed)
    // KEEP SUBTLE - This style is intentionally understated for luxury feel
    gadzhi: {
        fontFamily: 'Helvetica Neue, Arial, sans-serif', // Montserrat Light fallback
        fontWeight: 300,          // LIGHT weight (research: Montserrat Light)
        fontWeightBold: 700,      // Bold for emphasis words
        fontSize: 110,            // Slightly larger but still elegant
        fill: '#FFFFFF',          // WHITE ONLY - no colors
        stroke: '#000000',
        strokeWidth: 5,           // Subtle stroke (not thick)
        doubleStroke: false,      // NO double-stroke for minimalist feel
        shadow: { dx: 5, dy: 5, blur: 0, color: 'rgba(0,0,0,0.8)' },
        glow: null,               // NO GLOW - clean minimalist
        textCase: 'lowercase'     // CRITICAL: lowercase for premium feel
    },

    // Magnates Media: Documentary cinematic - Impact/Bebas Neue, red/black (research-backed)
    // ENHANCED: Double-stroke with red accents for drama
    magnates: {
        fontFamily: 'Impact, Arial Black, sans-serif', // Bebas Neue fallback (tall narrow)
        fontWeight: 900,
        fontSize: 150, // INCREASED
        fill: '#FFFFFF',          // White text primary
        fillAlt: '#CC0000',       // Red text for emphasis
        stroke: '#000000',        // Black stroke (red/black palette)
        strokeWidth: 12,
        doubleStroke: true, // NEW: Double-stroke effect
        innerStroke: '#CC0000', // Red inner stroke for drama
        innerStrokeWidth: 3,
        shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 22, color: '#CC0000' }, // Red dramatic glow
        rotation: -1, // Slight tilt
        textCase: 'uppercase'     // ALL CAPS documentary style
    }
};

const TEXT_PRESETS = {
    // PRO PRESET: Maximum impact - MrBeast style (default)
    // ENHANCED: Double-stroke for viral impact
    bold: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 180, // EVEN LARGER for mobile visibility
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 18, // THICKER stroke
        doubleStroke: true, // NEW
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 4,
        shadow: { dx: 12, dy: 12, blur: 0, color: 'rgba(0,0,0,1)' }, // HARD shadow
        glow: null,
        textCase: 'uppercase'
    },

    // Gaming: Neon cyberpunk style (MrBeast meets gaming)
    // ENHANCED: Brighter glow, double-stroke
    gaming: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 170,
        fill: '#00FFFF',
        stroke: '#000000',
        strokeWidth: 16,
        doubleStroke: true, // NEW
        innerStroke: '#00FFFF',
        innerStrokeWidth: 3,
        shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 30, color: '#00D4FF' }, // BIGGER glow
        textCase: 'uppercase'
    },

    // Finance: Gold on black - Hormozi wealth aesthetic
    // ENHANCED: Richer gold, double-stroke
    finance: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 170,
        fill: '#FFD700',
        stroke: '#000000',
        strokeWidth: 16,
        doubleStroke: true, // NEW
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 3,
        shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 15, color: '#FFD700' },
        textCase: 'uppercase'
    },

    // Tech: Clean but bold - Hormozi/MKBHD hybrid
    tech: {
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontWeight: 800,
        fontSize: 130,
        fill: '#FFFFFF',
        stroke: '#FF0000',
        strokeWidth: 10,
        shadow: { dx: 6, dy: 6, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: null
    },

    // Minimal: Gadzhi-style clean
    minimal: {
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontWeight: 700,
        fontSize: 120,
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 8,
        shadow: { dx: 5, dy: 5, blur: 0, color: 'rgba(0,0,0,0.9)' },
        glow: null
    },

    // Reaction: MAXIMUM ATTENTION - MrBeast signature
    // ENHANCED: Double-stroke + rotation for viral energy
    reaction: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 200, // BIGGEST for reaction thumbnails
        fill: '#FFFF00',
        stroke: '#000000',
        strokeWidth: 22, // THICCEST stroke
        doubleStroke: true, // NEW
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 5,
        shadow: { dx: 14, dy: 14, blur: 0, color: 'rgba(0,0,0,1)' }, // Hard shadow
        glow: { blur: 20, color: '#FFFF00' }, // Yellow glow for attention
        rotation: -2, // Slight tilt
        textCase: 'uppercase'
    },

    // Fitness: Red energy - Hormozi intensity
    fitness: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 150,
        fill: '#FFFFFF',
        stroke: '#FF0000',
        strokeWidth: 14,
        shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 15, color: '#FF0000' }
    },

    // Beauty: Soft pink glow - Gadzhi luxury
    beauty: {
        fontFamily: 'Georgia, serif',
        fontWeight: 700,
        fontSize: 120,
        fill: '#FFFFFF',
        stroke: '#FFB6C1',
        strokeWidth: 8,
        shadow: { dx: 5, dy: 5, blur: 2, color: 'rgba(0,0,0,0.7)' },
        glow: { blur: 18, color: '#FFB6C1' }
    },

    // Documentary: Magnates Media cinematic
    documentary: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 140,
        fill: '#FFFFFF',
        stroke: '#CC0000',
        strokeWidth: 12,
        shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 20, color: '#CC0000' }
    },

    // Podcast: Magnates clean documentary
    podcast: {
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontWeight: 800,
        fontSize: 130,
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 10,
        shadow: { dx: 6, dy: 6, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: null
    },

    // Travel: Gadzhi luxury aspirational
    travel: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 140,
        fill: '#FFD700',
        stroke: '#000000',
        strokeWidth: 12,
        shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 12, color: '#C9A227' }
    },

    // Cooking: MrBeast vibrant energy
    cooking: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 150,
        fill: '#FFFFFF',
        stroke: '#8B4513',
        strokeWidth: 12,
        shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: null
    },

    // Tutorial: Hormozi professional trust
    tutorial: {
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontWeight: 800,
        fontSize: 130,
        fill: '#FFFFFF',
        stroke: '#4A90D9',
        strokeWidth: 10,
        shadow: { dx: 6, dy: 6, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: null
    },

    // ============================================================================
    // V2 ULTRA-BOLD PRESETS - Maximum mobile visibility
    // ============================================================================

    // ULTRA_IMPACT: Maximum visibility at any size
    ultra_impact: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 220, // BIGGEST possible
        fill: '#FFFFFF',
        stroke: '#000000',
        strokeWidth: 24, // Extra thick stroke
        doubleStroke: true,
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 6,
        shadow: { dx: 16, dy: 16, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: null,
        textCase: 'uppercase'
    },

    // VIRAL: Yellow + black for maximum CTR
    viral: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 200,
        fill: '#FFFF00',
        stroke: '#000000',
        strokeWidth: 22,
        doubleStroke: true,
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 5,
        shadow: { dx: 14, dy: 14, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 25, color: '#FFFF00' },
        rotation: -2,
        textCase: 'uppercase'
    },

    // MONEY: Gold wealth aesthetic
    money: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 180,
        fill: '#FFD700',
        stroke: '#000000',
        strokeWidth: 20,
        doubleStroke: true,
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 4,
        shadow: { dx: 12, dy: 12, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 15, color: '#FFD700' },
        textCase: 'uppercase'
    },

    // DANGER: Red alert style
    danger: {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontWeight: 900,
        fontSize: 180,
        fill: '#FF0000',
        stroke: '#000000',
        strokeWidth: 20,
        doubleStroke: true,
        innerStroke: '#FFFFFF',
        innerStrokeWidth: 4,
        shadow: { dx: 12, dy: 12, blur: 0, color: 'rgba(0,0,0,1)' },
        glow: { blur: 20, color: '#FF0000' },
        textCase: 'uppercase'
    }
};

// ============================================================================
// HIERARCHY PRESETS - For headline + subtext combinations
// ============================================================================

const HIERARCHY_PRESETS = {
    // Standard: Large headline, smaller subtext
    standard: {
        headline: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontWeight: 900,
            fontSize: 180,
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 18,
            doubleStroke: true,
            innerStroke: '#FFFFFF',
            innerStrokeWidth: 4,
            shadow: { dx: 12, dy: 12, blur: 0, color: 'rgba(0,0,0,1)' },
            textCase: 'uppercase'
        },
        subtext: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontWeight: 900,
            fontSize: 100,
            fill: '#FFFF00',
            stroke: '#000000',
            strokeWidth: 10,
            shadow: { dx: 6, dy: 6, blur: 0, color: 'rgba(0,0,0,1)' },
            textCase: 'uppercase'
        }
    },

    // Authority: Business/Finance style
    authority: {
        headline: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontWeight: 900,
            fontSize: 160,
            fill: '#F7C204', // Hormozi yellow
            stroke: '#000000',
            strokeWidth: 16,
            doubleStroke: true,
            innerStroke: '#FFFFFF',
            innerStrokeWidth: 3,
            shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' },
            textCase: 'uppercase'
        },
        subtext: {
            fontFamily: 'Helvetica Neue, Arial, sans-serif',
            fontWeight: 700,
            fontSize: 80,
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 6,
            shadow: { dx: 4, dy: 4, blur: 0, color: 'rgba(0,0,0,1)' },
            textCase: 'uppercase'
        }
    },

    // Luxury: Gadzhi-style elegant
    luxury: {
        headline: {
            fontFamily: 'Helvetica Neue, Arial, sans-serif',
            fontWeight: 300,
            fontSize: 120,
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 6,
            shadow: { dx: 5, dy: 5, blur: 0, color: 'rgba(0,0,0,0.8)' },
            textCase: 'lowercase'
        },
        subtext: {
            fontFamily: 'Helvetica Neue, Arial, sans-serif',
            fontWeight: 700,
            fontSize: 70,
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 4,
            shadow: { dx: 3, dy: 3, blur: 0, color: 'rgba(0,0,0,0.7)' },
            textCase: 'lowercase'
        }
    },

    // Documentary: Magnates-style cinematic
    documentary: {
        headline: {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontWeight: 900,
            fontSize: 150,
            fill: '#FFFFFF',
            stroke: '#CC0000',
            strokeWidth: 14,
            doubleStroke: true,
            innerStroke: '#CC0000',
            innerStrokeWidth: 3,
            shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' },
            glow: { blur: 20, color: '#CC0000' },
            textCase: 'uppercase'
        },
        subtext: {
            fontFamily: 'Helvetica Neue, Arial, sans-serif',
            fontWeight: 600,
            fontSize: 70,
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeWidth: 5,
            shadow: { dx: 4, dy: 4, blur: 0, color: 'rgba(0,0,0,1)' },
            textCase: 'uppercase'
        }
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
 * ENHANCED: Double-stroke effect for maximum impact (inner stroke + outer stroke)
 *
 * FONT FIX: Uses embedded base64 fonts OR system fonts guaranteed on Ubuntu
 * The font-family stack ensures text renders even without Impact installed
 *
 * @param {string} text - The text to render
 * @param {Object} style - Style configuration
 * @param {Object} position - Position configuration
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function generateTextSVG(text, style, position, width = 1920, height = 1080) {
    const {
        fontFamily = 'sans-serif',  // FIXED: Use guaranteed system font as base
        fontWeight = 900,
        fontSize = 120,
        fill = '#FFFFFF',
        stroke = '#000000',
        strokeWidth = 10,
        shadow = null,
        glow = null,
        rotation = 0,
        doubleStroke = false,           // NEW: Enable double-stroke effect
        innerStroke = '#FFFFFF',         // NEW: Inner stroke color
        innerStrokeWidth = 4             // NEW: Inner stroke width
    } = style;

    // FONT FIX V2: FORCE use fonts that are CONFIRMED installed on Ubuntu server
    // Installed via apt: Liberation Sans, FreeSans, DejaVu Sans (with bold variants)
    // These are the ONLY fonts guaranteed to render with Sharp/SVG on the server
    //
    // Liberation Sans Bold is the best Impact alternative on Linux

    // ALWAYS use Liberation Sans - it's guaranteed to work
    const safeFontFamily = 'Liberation Sans, FreeSans, DejaVu Sans, sans-serif';

    console.log(`[TextOverlay] Rendering text "${text.substring(0, 20)}..." with Liberation Sans (weight: ${fontWeight})`)

    const { x, y, anchor = 'start' } = position;

    // Scale font size based on canvas dimensions (20% boost for impact)
    const scaledFontSize = Math.round(fontSize * 1.15 * (width / 1280));
    const scaledStrokeWidth = Math.round(strokeWidth * (width / 1280));
    const scaledInnerStrokeWidth = Math.round(innerStrokeWidth * (width / 1280));

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
        const rotationAttr = rotation ? `transform="rotate(${rotation} ${x} ${lineY})"` : '';

        if (doubleStroke) {
            // DOUBLE-STROKE TECHNIQUE: Outer black stroke + Inner white stroke + Fill
            // Layer 1: Large outer stroke (black) - for separation from background
            textElements += `
            <text
                x="${x}"
                y="${lineY}"
                font-family="${safeFontFamily}"
                font-weight="${fontWeight}"
                font-size="${scaledFontSize}"
                text-anchor="${anchor}"
                fill="none"
                stroke="${stroke}"
                stroke-width="${scaledStrokeWidth + scaledInnerStrokeWidth}"
                stroke-linejoin="round"
                ${filterRef}
                ${rotationAttr}
            >${escapeXML(line)}</text>`;

            // Layer 2: Inner stroke (white or accent) - for polish
            textElements += `
            <text
                x="${x}"
                y="${lineY}"
                font-family="${safeFontFamily}"
                font-weight="${fontWeight}"
                font-size="${scaledFontSize}"
                text-anchor="${anchor}"
                fill="none"
                stroke="${innerStroke}"
                stroke-width="${scaledInnerStrokeWidth}"
                stroke-linejoin="round"
                ${rotationAttr}
            >${escapeXML(line)}</text>`;

            // Layer 3: Fill on top
            textElements += `
            <text
                x="${x}"
                y="${lineY}"
                font-family="${safeFontFamily}"
                font-weight="${fontWeight}"
                font-size="${scaledFontSize}"
                text-anchor="${anchor}"
                fill="${fill}"
                ${rotationAttr}
            >${escapeXML(line)}</text>`;
        } else {
            // Single stroke with paint-order (original behavior)
            textElements += `
            <text
                x="${x}"
                y="${lineY}"
                font-family="${safeFontFamily}"
                font-weight="${fontWeight}"
                font-size="${scaledFontSize}"
                text-anchor="${anchor}"
                fill="${fill}"
                stroke="${stroke}"
                stroke-width="${scaledStrokeWidth}"
                stroke-linejoin="round"
                paint-order="stroke fill"
                ${filterRef}
                ${rotationAttr}
            >${escapeXML(line)}</text>`;
        }
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
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

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

    // Apply text case transformation based on style (default uppercase, but Gadzhi uses lowercase)
    let processedText = text;
    if (style.textCase === 'lowercase') {
        processedText = text.toLowerCase();
    } else if (style.textCase === 'uppercase' || !style.textCase) {
        processedText = text.toUpperCase();  // Default to uppercase for viral impact
    }
    // else: preserve original case

    // Generate SVG
    const svg = generateTextSVG(processedText, style, pos, width, height);

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

/**
 * Get text style for a specific creator style (MrBeast, Hormozi, Gadzhi, Magnates)
 * Returns COMPLETE style including textCase for proper uppercase/lowercase handling
 * @param {string} creatorStyle - Creator style key
 * @returns {Object} Text style configuration with textCase
 */
function getCreatorTextStyle(creatorStyle) {
    const preset = CREATOR_TEXT_PRESETS[creatorStyle] || CREATOR_TEXT_PRESETS.mrbeast;

    // Ensure textCase is included (default to uppercase if not specified)
    return {
        ...preset,
        textCase: preset.textCase || 'uppercase'
    };
}

/**
 * Auto-select the best creator text style based on niche
 * Maps niches to the most appropriate creator style
 * Returns COMPLETE style including textCase for proper uppercase/lowercase handling
 * @param {string} niche - Content niche
 * @returns {Object} Text style configuration with textCase
 */
function getAutoCreatorStyle(niche) {
    const nicheToCreator = {
        gaming: 'mrbeast',        // High energy, viral
        tech: 'hormozi',          // Clean, professional
        finance: 'hormozi',       // Business authority
        beauty: 'gadzhi',         // Luxury aesthetic (lowercase!)
        fitness: 'hormozi',       // Confidence, results
        cooking: 'mrbeast',       // Vibrant, exciting
        travel: 'gadzhi',         // Aspirational luxury (lowercase!)
        reaction: 'mrbeast',      // Maximum attention
        podcast: 'magnates',      // Documentary feel
        tutorial: 'hormozi',      // Professional trust
        business: 'hormozi',      // Authority
        luxury: 'gadzhi',         // Sophisticated (lowercase!)
        documentary: 'magnates',  // Cinematic
        entertainment: 'mrbeast'  // Viral energy
    };

    const creatorKey = nicheToCreator[niche] || 'mrbeast';
    const preset = CREATOR_TEXT_PRESETS[creatorKey];

    // Ensure textCase is included
    return {
        ...preset,
        textCase: preset.textCase || 'uppercase'
    };
}

// ============================================================================
// V2: HIERARCHICAL TEXT OVERLAY
// ============================================================================

/**
 * Add hierarchical text (headline + subtext) to an image
 * Creates proper visual hierarchy with different sizes and styles
 *
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {Object} options - Hierarchical text options
 * @param {string} options.headline - Main headline text
 * @param {string} options.subtext - Secondary subtext (optional)
 * @param {string} options.preset - Hierarchy preset (standard, authority, luxury, documentary)
 * @param {string} options.position - Position preset for headline
 * @param {number} options.spacing - Vertical spacing between headline and subtext (default: 20)
 */
async function addHierarchicalText(imageBuffer, options) {
    const {
        headline,
        subtext,
        preset = 'standard',
        position = 'rightCenter',
        spacing = 20
    } = options;

    if (!headline || headline.trim() === '') {
        return imageBuffer;
    }

    // Get hierarchy preset
    const hierarchyPreset = HIERARCHY_PRESETS[preset] || HIERARCHY_PRESETS.standard;

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // Get base position
    let pos;
    if (typeof position === 'string') {
        pos = POSITIONS[position] || POSITIONS.rightCenter;
        pos = {
            x: Math.round(pos.x * (width / 1280)),
            y: Math.round(pos.y * (height / 720)),
            anchor: pos.anchor
        };
    } else {
        pos = position;
    }

    // Add headline
    let result = await addTextOverlay(imageBuffer, {
        text: headline,
        customStyle: enforceMinimumLegibility(hierarchyPreset.headline),
        position: pos
    });

    // Add subtext if provided
    if (subtext && subtext.trim() !== '') {
        const subtextPos = {
            ...pos,
            y: pos.y + hierarchyPreset.headline.fontSize * 0.7 + spacing
        };

        result = await addTextOverlay(result, {
            text: subtext,
            customStyle: enforceMinimumLegibility(hierarchyPreset.subtext),
            position: subtextPos
        });
    }

    return result;
}

/**
 * Enforce minimum legibility standards on text style
 * Ensures text is readable at smallest YouTube thumbnail size (168x94)
 *
 * @param {Object} style - Text style configuration
 * @returns {Object} Style with enforced minimums
 */
function enforceMinimumLegibility(style) {
    return {
        ...style,
        fontSize: Math.max(style.fontSize || 100, MIN_FONT_SIZE_FOR_LEGIBILITY),
        strokeWidth: Math.max(style.strokeWidth || 8, MIN_STROKE_WIDTH)
    };
}

/**
 * Check if a position is in the safe zone (avoids YouTube UI overlays)
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {boolean} Whether position is safe
 */
function isInSafeZone(x, y, width = 1920, height = 1080) {
    // Check if in duration overlay danger zone (bottom right)
    const durationOverlay = YOUTUBE_THUMBNAIL_SPECS?.SAFE_ZONES?.durationOverlay;
    if (durationOverlay) {
        const scaledX = durationOverlay.x * (width / 1280);
        const scaledY = durationOverlay.y * (height / 720);
        if (x >= scaledX && y >= scaledY) {
            return false;
        }
    }

    // Check if within safe margins
    const marginX = SAFE_MARGIN_X * (width / 1280);
    const marginY = SAFE_MARGIN_Y * (height / 720);

    return x >= marginX &&
           x <= (width - marginX) &&
           y >= marginY &&
           y <= (height - marginY);
}

/**
 * Get a safe position that avoids YouTube UI overlays
 * Adjusts position if it would conflict with duration overlay
 *
 * @param {Object} desiredPos - Desired position {x, y, anchor}
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Safe position
 */
function getSafePosition(desiredPos, width = 1920, height = 1080) {
    const { x, y, anchor } = desiredPos;

    // If position is unsafe (in duration overlay), move it
    if (!isInSafeZone(x, y, width, height)) {
        // Move to safe zone - prefer left side if right side is blocked
        const safeX = anchor === 'end' ? width - SAFE_MARGIN_X - 100 : SAFE_MARGIN_X + 100;
        const safeY = Math.min(y, height - SAFE_MARGIN_Y - 100);

        return { x: safeX, y: safeY, anchor };
    }

    return desiredPos;
}

/**
 * Get hierarchy preset for a niche
 * @param {string} niche - Content niche
 * @returns {Object} Hierarchy preset configuration
 */
function getHierarchyPresetForNiche(niche) {
    const nicheToHierarchy = {
        gaming: 'standard',
        tech: 'authority',
        finance: 'authority',
        beauty: 'luxury',
        fitness: 'standard',
        cooking: 'standard',
        travel: 'luxury',
        reaction: 'standard',
        podcast: 'documentary',
        tutorial: 'authority',
        documentary: 'documentary',
        business: 'authority',
        luxury: 'luxury'
    };

    return HIERARCHY_PRESETS[nicheToHierarchy[niche]] || HIERARCHY_PRESETS.standard;
}

module.exports = {
    // Main functions
    addTextOverlay,
    addMultipleTexts,
    addHierarchicalText,  // V2: New hierarchical text
    generateTextSVG,

    // Position helpers
    getSmartPosition,
    getSafePosition,      // V2: Safe zone aware positioning
    isInSafeZone,         // V2: Safe zone check

    // Style helpers
    getNicheTextStyle,
    getCreatorTextStyle,
    getAutoCreatorStyle,
    getHierarchyPresetForNiche, // V2: Hierarchy for niches
    enforceMinimumLegibility,   // V2: Legibility enforcement

    // Presets
    TEXT_PRESETS,
    CREATOR_TEXT_PRESETS,
    HIERARCHY_PRESETS,    // V2: New hierarchy presets
    POSITIONS,

    // Constants
    MIN_FONT_SIZE_FOR_LEGIBILITY,
    MIN_STROKE_WIDTH
};
