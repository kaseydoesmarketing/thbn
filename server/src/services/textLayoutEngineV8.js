/**
 * ============================================================================
 * ThumbnailBuilder V8 — Text Layout Engine
 * ============================================================================
 *
 * Smart text positioning with:
 * - YouTube safe zone awareness (avoid timestamp, UI overlays)
 * - Rule of thirds alignment
 * - Subject/logo collision avoidance
 * - WCAG contrast compliance
 * - Auto, Manual, and Free positioning modes
 */

const sharp = require('sharp');

// =============================================================================
// CONSTANTS
// =============================================================================

// Canvas dimensions (1920x1080 base)
const CANVAS = {
    width: 1920,
    height: 1080
};

// YouTube UI danger zones to AVOID
const YOUTUBE_DANGER_ZONES = {
    // Bottom-right: Video duration timestamp
    timestamp: {
        x: [1680, 1920],
        y: [980, 1080],
        label: 'Duration badge'
    },
    // Bottom-left: Watch later, playlist icons
    bottomLeftIcons: {
        x: [0, 150],
        y: [950, 1080],
        label: 'Watch later icons'
    },
    // Top-right: Channel badge on hover
    topRightBadge: {
        x: [1750, 1920],
        y: [0, 120],
        label: 'Channel badge'
    }
};

// Safe margins from edges - INCREASED for better text visibility
const SAFE_MARGINS = {
    desktop: { x: 100, y: 80 },
    mobile: { x: 180, y: 140 }  // Increased Y margin to prevent bottom cutoff
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Text budget constraints
const TEXT_BUDGET = {
    minAreaPercent: 0.08,   // Text should cover at least 8% of canvas
    maxAreaPercent: 0.18,   // Text should cover at most 18% of canvas
    maxWords: 5,
    minFontSize: 80,        // Minimum readable font size
    maxFontSize: 200        // Maximum practical font size
};

// Text position presets for Manual mode (3x3 grid)
const MANUAL_POSITIONS = {
    'top-left': {
        x: 0.12,
        y: 0.15,
        anchor: 'start',
        safeZoneAdjust: null
    },
    'top-center': {
        x: 0.50,
        y: 0.15,
        anchor: 'middle',
        safeZoneAdjust: null
    },
    'top-right': {
        x: 0.88,
        y: 0.15,
        anchor: 'end',
        safeZoneAdjust: null
    },
    'middle-left': {
        x: 0.12,
        y: 0.50,
        anchor: 'start',
        safeZoneAdjust: null
    },
    'middle-center': {
        x: 0.50,
        y: 0.50,
        anchor: 'middle',
        safeZoneAdjust: null
    },
    'middle-right': {
        x: 0.88,
        y: 0.50,
        anchor: 'end',
        safeZoneAdjust: null
    },
    'bottom-left': {
        x: 0.12,
        y: 0.72,  // Moved UP from 0.82 to prevent bottom cutoff
        anchor: 'start',
        // Shift up to avoid bottom-left icons
        safeZoneAdjust: { y: -0.05 }
    },
    'bottom-center': {
        x: 0.50,
        y: 0.72,  // Moved UP from 0.82 to prevent bottom cutoff
        anchor: 'middle',
        safeZoneAdjust: null
    },
    'bottom-right': {
        x: 0.68,  // Moved LEFT from 0.72 to avoid timestamp
        y: 0.68,  // Moved UP from 0.78 to prevent bottom cutoff
        anchor: 'end',
        // Shift left and up to avoid timestamp
        safeZoneAdjust: { x: -0.08, y: -0.05 }
    }
};

// Rule of thirds lines
const RULE_OF_THIRDS = {
    verticalLines: [0.333, 0.667],
    horizontalLines: [0.333, 0.667],
    intersections: [
        { x: 0.333, y: 0.333 },
        { x: 0.667, y: 0.333 },
        { x: 0.333, y: 0.667 },
        { x: 0.667, y: 0.667 }
    ]
};

// Text color palette for auto-selection
const TEXT_COLOR_PALETTE = {
    primary: ['#FFFFFF', '#000000', '#1A1A1A', '#F5F5F5'],
    accents: ['#FF5500', '#FFD700', '#00D68F', '#FF3D71'],
    neutral: ['#2D3436', '#636E72', '#B2BEC3']
};

// =============================================================================
// CONTRAST ENGINE
// =============================================================================

/**
 * Calculate relative luminance of a color
 * @param {string} hexColor - Hex color string
 * @returns {number} Luminance value 0-1
 */
function relativeLuminance(hexColor) {
    const rgb = hexToRgb(hexColor);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG contrast ratio between two colors
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @returns {number} Contrast ratio (1-21)
 */
function contrastRatio(color1, color2) {
    const lum1 = relativeLuminance(color1);
    const lum2 = relativeLuminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Calculate color distance (Euclidean in RGB space)
 */
function colorDistance(color1, color2) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
}

// =============================================================================
// IMAGE ANALYSIS
// =============================================================================

/**
 * Sample average color from a region of an image
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} region - { x, y, width, height } in pixels
 * @returns {Promise<string>} Average hex color
 */
async function sampleRegionColor(imageBuffer, region) {
    try {
        const { data, info } = await sharp(imageBuffer)
            .extract({
                left: Math.max(0, Math.round(region.x)),
                top: Math.max(0, Math.round(region.y)),
                width: Math.min(Math.round(region.width), 100),
                height: Math.min(Math.round(region.height), 100)
            })
            .resize(1, 1, { fit: 'cover' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        return rgbToHex(data[0], data[1], data[2]);
    } catch (err) {
        console.warn('[TextLayoutEngine] Color sampling failed:', err.message);
        return '#808080'; // Default gray
    }
}

/**
 * Sample multiple points in a region and get dominant color
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} bounds - Text bounding box
 * @param {number} samples - Number of sample points (default 9)
 */
async function sampleBackgroundColors(imageBuffer, bounds, samples = 9) {
    const colors = [];
    const gridSize = Math.ceil(Math.sqrt(samples));
    const stepX = bounds.width / gridSize;
    const stepY = bounds.height / gridSize;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const region = {
                x: bounds.x + i * stepX,
                y: bounds.y + j * stepY,
                width: stepX,
                height: stepY
            };
            const color = await sampleRegionColor(imageBuffer, region);
            colors.push(color);
        }
    }

    // Return average color
    const avgRgb = colors.reduce((acc, hex) => {
        const rgb = hexToRgb(hex);
        return { r: acc.r + rgb.r, g: acc.g + rgb.g, b: acc.b + rgb.b };
    }, { r: 0, g: 0, b: 0 });

    return rgbToHex(
        avgRgb.r / colors.length,
        avgRgb.g / colors.length,
        avgRgb.b / colors.length
    );
}

// =============================================================================
// COLLISION DETECTION
// =============================================================================

/**
 * Check if two rectangles intersect
 */
function rectsIntersect(rect1, rect2) {
    return !(
        rect1.x + rect1.width < rect2.x ||
        rect2.x + rect2.width < rect1.x ||
        rect1.y + rect1.height < rect2.y ||
        rect2.y + rect2.height < rect1.y
    );
}

/**
 * Check if a point is in a danger zone
 */
function isInDangerZone(x, y, width, height) {
    const rect = { x, y, width, height };

    for (const [zoneName, zone] of Object.entries(YOUTUBE_DANGER_ZONES)) {
        const zoneRect = {
            x: zone.x[0],
            y: zone.y[0],
            width: zone.x[1] - zone.x[0],
            height: zone.y[1] - zone.y[0]
        };

        if (rectsIntersect(rect, zoneRect)) {
            return { inDanger: true, zone: zoneName, zoneLabel: zone.label };
        }
    }

    return { inDanger: false };
}

/**
 * Check if text overlaps with subject face area
 */
function overlapsSubjectFace(textBounds, subjectBounds) {
    if (!subjectBounds) return false;

    // Face is typically in upper 40% of subject bounding box
    const faceArea = {
        x: subjectBounds.x,
        y: subjectBounds.y,
        width: subjectBounds.width,
        height: subjectBounds.height * 0.4
    };

    return rectsIntersect(textBounds, faceArea);
}

/**
 * Estimate subject bounds from positioning + scale to protect face/text separation
 */
function estimateSubjectBounds(positionKey = 'middle-left', scale = 100) {
    const normalizedScale = clamp(scale / 100, 0.6, 1.4);
    const baseWidth = CANVAS.width * 0.32 * normalizedScale;
    const baseHeight = CANVAS.height * 0.62 * normalizedScale;

    const centerMap = {
        'top-left': { x: 0.28, y: 0.28 },
        'top-center': { x: 0.50, y: 0.28 },
        'top-right': { x: 0.72, y: 0.28 },
        'middle-left': { x: 0.28, y: 0.50 },
        'middle-center': { x: 0.50, y: 0.50 },
        'middle-right': { x: 0.72, y: 0.50 },
        'bottom-left': { x: 0.28, y: 0.72 },
        'bottom-center': { x: 0.50, y: 0.72 },
        'bottom-right': { x: 0.72, y: 0.72 }
    };

    const center = centerMap[positionKey] || centerMap['middle-left'];
    const width = clamp(baseWidth, CANVAS.width * 0.22, CANVAS.width * 0.55);
    const height = clamp(baseHeight, CANVAS.height * 0.4, CANVAS.height * 0.85);

    const x = clamp(center.x * CANVAS.width - width / 2, SAFE_MARGINS.mobile.x, CANVAS.width - SAFE_MARGINS.mobile.x - width);
    const y = clamp(center.y * CANVAS.height - height / 2, SAFE_MARGINS.mobile.y, CANVAS.height - SAFE_MARGINS.mobile.y - height);

    return { x, y, width, height };
}

// =============================================================================
// TEXT POSITION CALCULATION
// =============================================================================

/**
 * Calculate optimal text position using Auto mode
 * @param {Object} options - Configuration options
 * @returns {Object} Calculated position
 */
async function calculateAutoPosition(imageBuffer, options) {
    const {
        text,
        fontSize = 120,
        subjectBounds = null,
        logoBounds = null
    } = options;

    // Estimate text dimensions
    const charWidth = fontSize * 0.6;
    const textWidth = text.length * charWidth;
    const textHeight = fontSize * 1.2;

    // Define candidate zones based on rule of thirds
    // Y positions kept in upper 70% to avoid cutoff at bottom
    const candidates = [
        // Right side (preferred when subject on left)
        { x: 0.65, y: 0.32, anchor: 'end', priority: 1 },
        { x: 0.65, y: 0.48, anchor: 'end', priority: 2 },
        // Left side (when subject on right)
        { x: 0.35, y: 0.32, anchor: 'start', priority: 3 },
        { x: 0.35, y: 0.48, anchor: 'start', priority: 4 },
        // Top center (fallback)
        { x: 0.50, y: 0.18, anchor: 'middle', priority: 5 },
        // Bottom (avoiding timestamp) - moved UP to prevent cutoff
        { x: 0.40, y: 0.65, anchor: 'middle', priority: 6 }
    ];

    // Filter candidates based on subject position
    let filteredCandidates = candidates;

    if (subjectBounds) {
        const subjectCenterX = (subjectBounds.x + subjectBounds.width / 2) / CANVAS.width;

        if (subjectCenterX < 0.5) {
            // Subject on left - prefer right side text
            filteredCandidates = candidates.filter(c => c.x > 0.5);
        } else {
            // Subject on right - prefer left side text
            filteredCandidates = candidates.filter(c => c.x < 0.5);
        }

        // If no candidates after filter, use all
        if (filteredCandidates.length === 0) {
            filteredCandidates = candidates;
        }
    }

    // Score each candidate
    const scoredCandidates = [];

    for (const candidate of filteredCandidates) {
        const pixelX = candidate.x * CANVAS.width;
        const pixelY = candidate.y * CANVAS.height;

        // Calculate actual text bounds based on anchor
        let textX = pixelX;
        if (candidate.anchor === 'middle') textX -= textWidth / 2;
        if (candidate.anchor === 'end') textX -= textWidth;

        // Clamp into mobile safe area to avoid edge cutoffs
        textX = clamp(textX, SAFE_MARGINS.mobile.x, CANVAS.width - SAFE_MARGINS.mobile.x - textWidth);
        const textY = clamp(pixelY - textHeight / 2, SAFE_MARGINS.mobile.y, CANVAS.height - SAFE_MARGINS.mobile.y - textHeight);

        const textBounds = {
            x: textX,
            y: textY,
            width: textWidth,
            height: textHeight
        };

        // Check for collisions
        const dangerCheck = isInDangerZone(textBounds.x, textBounds.y, textBounds.width, textBounds.height);
        const faceOverlap = overlapsSubjectFace(textBounds, subjectBounds);
        const logoOverlap = logoBounds ? rectsIntersect(textBounds, logoBounds) : false;

        // Skip if in danger zone or overlapping face
        if (dangerCheck.inDanger || faceOverlap) continue;

        // Calculate score
        let score = 100 - (candidate.priority * 10);

        // Bonus for rule-of-thirds alignment
        const onThirdLine = RULE_OF_THIRDS.verticalLines.some(l => Math.abs(candidate.x - l) < 0.05);
        if (onThirdLine) score += 15;

        // Penalty for logo overlap
        if (logoOverlap) score -= 20;

        // Sample background and calculate contrast potential
        if (imageBuffer) {
            const bgColor = await sampleBackgroundColors(imageBuffer, textBounds);
            const whiteContrast = contrastRatio('#FFFFFF', bgColor);
            const blackContrast = contrastRatio('#000000', bgColor);
            const bestContrast = Math.max(whiteContrast, blackContrast);

            // Bonus for high contrast areas
            if (bestContrast >= 4.5) score += 20;
            else if (bestContrast >= 3.0) score += 10;
        }

        scoredCandidates.push({
            ...candidate,
            textBounds,
            score
        });
    }

    // Sort by score and return best
    scoredCandidates.sort((a, b) => b.score - a.score);

    const best = scoredCandidates[0] || {
        x: 0.50,
        y: 0.50,
        anchor: 'middle',
        score: 0
    };

    return {
        x: Math.round(best.x * CANVAS.width),
        y: Math.round(best.y * CANVAS.height),
        anchor: best.anchor,
        mode: 'auto',
        score: best.score
    };
}

/**
 * Calculate text position for Manual mode
 */
function calculateManualPosition(positionKey) {
    const preset = MANUAL_POSITIONS[positionKey] || MANUAL_POSITIONS['middle-center'];

    let x = preset.x;
    let y = preset.y;

    // Apply safe zone adjustments
    if (preset.safeZoneAdjust) {
        if (preset.safeZoneAdjust.x) x += preset.safeZoneAdjust.x;
        if (preset.safeZoneAdjust.y) y += preset.safeZoneAdjust.y;
    }

    return {
        x: Math.round(x * CANVAS.width),
        y: Math.round(y * CANVAS.height),
        anchor: preset.anchor,
        mode: 'manual',
        positionKey
    };
}

/**
 * Calculate text position for Free mode (with clamping)
 */
function calculateFreePosition(coordinates, fontSize = 120) {
    const charWidth = fontSize * 0.6;
    const textWidth = 5 * charWidth; // Assume 5 chars for safety margin
    const textHeight = fontSize * 1.2;

    let { x, y } = coordinates;

    // Clamp to safe margins
    x = Math.max(SAFE_MARGINS.desktop.x, Math.min(x, CANVAS.width - SAFE_MARGINS.desktop.x - textWidth));
    y = Math.max(SAFE_MARGINS.desktop.y + textHeight, Math.min(y, CANVAS.height - SAFE_MARGINS.desktop.y));

    // Check danger zones and push out if needed
    const dangerCheck = isInDangerZone(x, y - textHeight, textWidth, textHeight);
    if (dangerCheck.inDanger) {
        // Push text up and left from timestamp zone
        if (dangerCheck.zone === 'timestamp') {
            x = Math.min(x, YOUTUBE_DANGER_ZONES.timestamp.x[0] - textWidth - 20);
            y = Math.min(y, YOUTUBE_DANGER_ZONES.timestamp.y[0] - 20);
        }
    }

    return {
        x: Math.round(x),
        y: Math.round(y),
        anchor: 'start',
        mode: 'free',
        clamped: dangerCheck.inDanger
    };
}

// =============================================================================
// TEXT COLOR SELECTION
// =============================================================================

/**
 * Select optimal text color based on background
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} textBounds - Text bounding box
 * @returns {Object} Color selection result
 */
async function selectOptimalTextColor(imageBuffer, textBounds) {
    // Sample background color
    const bgColor = await sampleBackgroundColors(imageBuffer, textBounds);
    const bgLuminance = relativeLuminance(bgColor);

    // Test all palette colors
    const allColors = [
        ...TEXT_COLOR_PALETTE.primary,
        ...TEXT_COLOR_PALETTE.accents
    ];

    const colorScores = allColors.map(color => ({
        color,
        contrast: contrastRatio(color, bgColor)
    })).sort((a, b) => b.contrast - a.contrast);

    // Select best color meeting WCAG requirements
    const selected = colorScores.find(c => c.contrast >= 4.5)
        || colorScores.find(c => c.contrast >= 3.0)
        || colorScores[0];

    // Determine if backing is needed
    const needsBacking = selected.contrast < 4.5;
    let backingConfig = null;

    if (needsBacking) {
        if (bgLuminance > 0.5) {
            // Light background - dark stroke
            backingConfig = {
                type: 'stroke',
                color: 'rgba(0,0,0,0.8)',
                width: 4
            };
        } else {
            // Dark background - light stroke or shadow
            backingConfig = {
                type: 'shadow',
                color: 'rgba(0,0,0,0.6)',
                blur: 8,
                offsetX: 3,
                offsetY: 3
            };
        }
    }

    return {
        textColor: selected.color,
        contrast: Math.round(selected.contrast * 10) / 10,
        meetsWCAG: selected.contrast >= 3.0,
        meetsWCAGAA: selected.contrast >= 4.5,
        needsBacking,
        backingConfig,
        bgColor,
        bgLuminance: Math.round(bgLuminance * 100) / 100
    };
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Calculate text layout for a thumbnail
 * @param {Object} options - Layout options
 * @returns {Promise<Object>} Layout result
 */
async function calculateTextLayout(options) {
    const {
        imageBuffer,
        text,
        fontSize = 120,
        positionMode = 'auto',          // 'auto' | 'manual' | 'free'
        manualPosition = null,          // For manual: 'top-left', etc.
        freeCoordinates = null,         // For free: { x, y }
        subjectBounds = null,           // Subject bounding box
        logoBounds = null,              // Logo bounding box
        textColorMode = 'auto',         // 'auto' | 'manual'
        manualTextColor = null,         // For manual color
        manualOutlineColor = null       // For manual outline
    } = options;

    // Validate text
    const words = text.trim().split(/\s+/);
    if (words.length > TEXT_BUDGET.maxWords) {
        console.warn(`[TextLayoutEngine] Text has ${words.length} words, max recommended is ${TEXT_BUDGET.maxWords}`);
    }

    // Calculate position based on mode
    let position;
    switch (positionMode) {
        case 'manual':
            position = calculateManualPosition(manualPosition);
            break;
        case 'free':
            position = calculateFreePosition(freeCoordinates, fontSize);
            break;
        case 'auto':
        default:
            position = await calculateAutoPosition(imageBuffer, {
                text,
                fontSize,
                subjectBounds,
                logoBounds
            });
    }

    // Calculate text bounds for color selection
    const charWidth = fontSize * 0.6;
    const textWidth = text.length * charWidth;
    const textHeight = fontSize * 1.2;

    let textX = position.x;
    if (position.anchor === 'middle') textX -= textWidth / 2;
    if (position.anchor === 'end') textX -= textWidth;

    const textBounds = {
        x: textX,
        y: position.y - textHeight,
        width: textWidth,
        height: textHeight
    };

    // Select text color
    let colorResult;
    if (textColorMode === 'manual' && manualTextColor) {
        // Manual color - just validate contrast
        const bgColor = imageBuffer
            ? await sampleBackgroundColors(imageBuffer, textBounds)
            : '#808080';
        const contrast = contrastRatio(manualTextColor, bgColor);

        colorResult = {
            textColor: manualTextColor,
            outlineColor: manualOutlineColor || null,
            contrast: Math.round(contrast * 10) / 10,
            meetsWCAG: contrast >= 3.0,
            meetsWCAGAA: contrast >= 4.5,
            needsBacking: contrast < 3.0,
            backingConfig: contrast < 3.0 ? {
                type: 'stroke',
                color: manualOutlineColor || 'rgba(0,0,0,0.8)',
                width: 4
            } : null,
            bgColor,
            mode: 'manual'
        };
    } else if (imageBuffer) {
        colorResult = await selectOptimalTextColor(imageBuffer, textBounds);
        colorResult.mode = 'auto';
    } else {
        // No image - default to white on dark
        colorResult = {
            textColor: '#FFFFFF',
            contrast: 0,
            meetsWCAG: true,
            meetsWCAGAA: true,
            needsBacking: true,
            backingConfig: {
                type: 'stroke',
                color: 'rgba(0,0,0,0.8)',
                width: 4
            },
            mode: 'default'
        };
    }

    // Check for danger zone warnings
    const dangerCheck = isInDangerZone(textBounds.x, textBounds.y, textBounds.width, textBounds.height);

    const layoutLines = text.split(/\n/);

    return {
        position: {
            x: position.x,
            y: position.y,
            anchor: position.anchor,
            mode: position.mode
        },
        textBounds: { ...textBounds, lines: layoutLines },
        color: colorResult,
        warnings: [
            ...(dangerCheck.inDanger ? [`Text overlaps YouTube ${dangerCheck.zoneLabel}`] : []),
            ...(words.length > TEXT_BUDGET.maxWords ? [`Text has ${words.length} words, recommend ${TEXT_BUDGET.maxWords} max`] : []),
            ...(!colorResult.meetsWCAG ? ['Low contrast - text may be hard to read'] : [])
        ],
        metadata: {
            wordCount: words.length,
            estimatedWidth: textWidth,
            estimatedHeight: textHeight,
            positionScore: position.score || null
        }
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    calculateTextLayout,
    calculateAutoPosition,
    calculateManualPosition,
    calculateFreePosition,
    selectOptimalTextColor,
    contrastRatio,
    relativeLuminance,
    isInDangerZone,
    sampleBackgroundColors,
    estimateSubjectBounds,
    YOUTUBE_DANGER_ZONES,
    MANUAL_POSITIONS,
    TEXT_COLOR_PALETTE,
    TEXT_BUDGET,
    CANVAS
};
