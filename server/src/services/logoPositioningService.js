/**
 * Logo Positioning Service for YouTube Thumbnails
 *
 * BUILD-ENGINE-PRIME: Production-grade logo/brand element positioning system
 *
 * PURPOSE: GUARANTEE that brand logos (Netflix, HBO, Warner Bros, etc.) are:
 * - Never cropped
 * - Properly aligned
 * - Appropriately sized
 * - Never overlapping with subject or text
 *
 * This service provides:
 * - Standard position presets for common logo placements
 * - Smart logo sizing based on canvas and logo count
 * - Validation to prevent overlaps with subject/text
 * - Grid alignment for multiple logos
 * - AI prompt generation for logo placement instructions
 *
 * CRITICAL: All positions avoid the YouTube duration overlay zone (bottom-right)
 */

const { YOUTUBE_THUMBNAIL_SPECS } = require('../config/thumbnailSpecs');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default canvas dimensions (YouTube thumbnail standard)
 */
const DEFAULT_CANVAS = {
    width: 1920,
    height: 1080
};

/**
 * YouTube duration overlay zone - MUST AVOID for logo placement
 * Bottom-right corner where video length is displayed
 */
const YOUTUBE_DURATION_ZONE = {
    x: 1750,      // Start of danger zone (scaled for 1920 width)
    y: 1000,      // Start of danger zone (scaled for 1080 height)
    width: 170,   // Width of duration badge
    height: 80    // Height of duration badge
};

/**
 * Safe margins from canvas edges
 * Ensures logos don't get cropped on various display sizes
 */
const SAFE_MARGINS = {
    x: 80,   // Horizontal margin from edges
    y: 60    // Vertical margin from edges
};

/**
 * Logo size constraints
 * Based on professional thumbnail design standards
 */
const LOGO_SIZE_CONSTRAINTS = {
    minHeight: 40,      // Minimum height for readability
    maxHeight: 180,     // Maximum height to not overwhelm
    singleLogoHeight: {
        min: 100,       // Single logo minimum
        max: 180,       // Single logo maximum
        default: 140    // Single logo default
    },
    multipleLogoHeight: {
        min: 60,        // Multiple logos minimum
        max: 120,       // Multiple logos maximum
        default: 80     // Multiple logos default
    },
    spacing: 40         // Spacing between multiple logos
};

// ============================================================================
// POSITION PRESETS
// ============================================================================

/**
 * Standard logo position presets for 1920x1080 canvas
 *
 * Each position includes:
 * - x, y: Coordinates for logo placement
 * - anchor: 'start' (left), 'middle' (center), 'end' (right) alignment
 *
 * Note: Bottom-right is intentionally NOT included due to YouTube duration overlay
 *
 * @type {Object}
 */
const LOGO_POSITIONS = {
    // Top row positions - Most common for brand logos
    topLeft: {
        x: SAFE_MARGINS.x,
        y: SAFE_MARGINS.y,
        anchor: 'start',
        description: 'Top-left corner, safe from YouTube UI'
    },
    topCenter: {
        x: 960,  // Center of 1920px canvas
        y: SAFE_MARGINS.y,
        anchor: 'middle',
        description: 'Top-center, good for single prominent logo'
    },
    topRight: {
        x: DEFAULT_CANVAS.width - SAFE_MARGINS.x,
        y: SAFE_MARGINS.y,
        anchor: 'end',
        description: 'Top-right corner, classic Netflix-style placement'
    },

    // Top-right cluster for multiple logos (e.g., Netflix + Original)
    topRightCluster: [
        {
            x: DEFAULT_CANVAS.width - SAFE_MARGINS.x,
            y: SAFE_MARGINS.y,
            anchor: 'end',
            slot: 0,
            description: 'First logo in top-right cluster'
        },
        {
            x: DEFAULT_CANVAS.width - SAFE_MARGINS.x - 160,
            y: SAFE_MARGINS.y,
            anchor: 'end',
            slot: 1,
            description: 'Second logo in top-right cluster'
        },
        {
            x: DEFAULT_CANVAS.width - SAFE_MARGINS.x - 320,
            y: SAFE_MARGINS.y,
            anchor: 'end',
            slot: 2,
            description: 'Third logo in top-right cluster'
        }
    ],

    // Top-left cluster for multiple logos
    topLeftCluster: [
        {
            x: SAFE_MARGINS.x,
            y: SAFE_MARGINS.y,
            anchor: 'start',
            slot: 0,
            description: 'First logo in top-left cluster'
        },
        {
            x: SAFE_MARGINS.x + 160,
            y: SAFE_MARGINS.y,
            anchor: 'start',
            slot: 1,
            description: 'Second logo in top-left cluster'
        },
        {
            x: SAFE_MARGINS.x + 320,
            y: SAFE_MARGINS.y,
            anchor: 'start',
            slot: 2,
            description: 'Third logo in top-left cluster'
        }
    ],

    // Bottom row positions - Avoid bottom-right!
    bottomLeft: {
        x: SAFE_MARGINS.x,
        y: DEFAULT_CANVAS.height - SAFE_MARGINS.y,
        anchor: 'start',
        description: 'Bottom-left corner, safe zone for logos'
    },
    bottomCenter: {
        x: 960,
        y: DEFAULT_CANVAS.height - SAFE_MARGINS.y,
        anchor: 'middle',
        description: 'Bottom-center, avoid for important logos'
    },

    // AVOID: Bottom-right (YouTube duration overlay)
    // This position is intentionally NOT recommended
    bottomRight: {
        x: DEFAULT_CANVAS.width - SAFE_MARGINS.x,
        y: DEFAULT_CANVAS.height - SAFE_MARGINS.y,
        anchor: 'end',
        description: 'WARNING: Bottom-right conflicts with YouTube duration',
        avoid: true,
        reason: 'YouTube duration overlay covers this area'
    },

    // Vertical stack positions (for multiple logos on same side)
    leftStack: [
        {
            x: SAFE_MARGINS.x,
            y: SAFE_MARGINS.y,
            anchor: 'start',
            slot: 0,
            description: 'Top of left vertical stack'
        },
        {
            x: SAFE_MARGINS.x,
            y: SAFE_MARGINS.y + 100,
            anchor: 'start',
            slot: 1,
            description: 'Middle of left vertical stack'
        },
        {
            x: SAFE_MARGINS.x,
            y: SAFE_MARGINS.y + 200,
            anchor: 'start',
            slot: 2,
            description: 'Bottom of left vertical stack'
        }
    ],

    rightStack: [
        {
            x: DEFAULT_CANVAS.width - SAFE_MARGINS.x,
            y: SAFE_MARGINS.y,
            anchor: 'end',
            slot: 0,
            description: 'Top of right vertical stack'
        },
        {
            x: DEFAULT_CANVAS.width - SAFE_MARGINS.x,
            y: SAFE_MARGINS.y + 100,
            anchor: 'end',
            slot: 1,
            description: 'Middle of right vertical stack'
        },
        {
            x: DEFAULT_CANVAS.width - SAFE_MARGINS.x,
            y: SAFE_MARGINS.y + 200,
            anchor: 'end',
            slot: 2,
            description: 'Bottom of right vertical stack'
        }
    ]
};

/**
 * Default aspect ratios for common brand logos
 * Used when actual logo dimensions are unknown
 */
const DEFAULT_LOGO_ASPECTS = {
    netflix: 3.5,        // Wide horizontal logo
    hbo: 2.8,            // HBO logo
    warner: 1.2,         // Warner Bros shield (more square)
    disney: 3.2,         // Disney+ logo
    hulu: 2.5,           // Hulu logo
    amazon: 4.0,         // Amazon Prime logo
    apple: 1.0,          // Apple TV+ (square apple)
    paramount: 1.1,      // Paramount mountain
    peacock: 2.0,        // Peacock logo
    default: 2.5         // Default assumption for unknown logos
};

// ============================================================================
// LOGO SIZING FUNCTIONS
// ============================================================================

/**
 * Calculate optimal logo size based on context
 *
 * Factors considered:
 * - Number of logos to display
 * - Canvas dimensions
 * - Position (clustered vs single)
 * - Logo aspect ratio
 *
 * @param {number} logoCount - Number of logos to display
 * @param {Object} canvasSize - Canvas dimensions {width, height}
 * @param {string} position - Position preset name
 * @param {Object} options - Additional sizing options
 * @returns {Object} Logo size configuration {width, height, maxWidth, maxHeight}
 */
function calculateLogoSize(logoCount, canvasSize = DEFAULT_CANVAS, position = 'topRight', options = {}) {
    const {
        aspectRatio = DEFAULT_LOGO_ASPECTS.default,
        minHeight = LOGO_SIZE_CONSTRAINTS.minHeight,
        maxHeight = LOGO_SIZE_CONSTRAINTS.maxHeight
    } = options;

    const isCluster = position.includes('Cluster') || position.includes('Stack');
    let targetHeight;

    if (logoCount === 1) {
        // Single logo: Use larger size
        targetHeight = LOGO_SIZE_CONSTRAINTS.singleLogoHeight.default;
    } else if (logoCount === 2) {
        // Two logos: Slightly reduced
        targetHeight = isCluster
            ? LOGO_SIZE_CONSTRAINTS.multipleLogoHeight.default
            : LOGO_SIZE_CONSTRAINTS.singleLogoHeight.min;
    } else {
        // Three or more: Use minimum multiple logo size
        targetHeight = LOGO_SIZE_CONSTRAINTS.multipleLogoHeight.min;
    }

    // Scale based on canvas size (relative to 1920x1080)
    const scaleFactor = Math.min(
        canvasSize.width / DEFAULT_CANVAS.width,
        canvasSize.height / DEFAULT_CANVAS.height
    );

    // Apply scale factor
    targetHeight = Math.round(targetHeight * scaleFactor);

    // Clamp to min/max
    targetHeight = Math.max(minHeight, Math.min(maxHeight, targetHeight));

    // Calculate width from aspect ratio
    const targetWidth = Math.round(targetHeight * aspectRatio);

    // Maximum width constraint (don't exceed 40% of canvas width for single logo)
    const maxWidthPercent = logoCount === 1 ? 0.4 : 0.25;
    const maxWidthAllowed = Math.round(canvasSize.width * maxWidthPercent);
    let finalWidth = Math.min(targetWidth, maxWidthAllowed);

    // If width was constrained, recalculate height to maintain aspect ratio
    let finalHeight = finalWidth < targetWidth
        ? Math.round(finalWidth / aspectRatio)
        : targetHeight;

    // Enforce minimum height AFTER width constraint adjustment
    // If final height is below minimum, use minimum and recalculate width
    if (finalHeight < minHeight) {
        finalHeight = minHeight;
        // Recalculate width with minimum height, but still respect max width
        finalWidth = Math.min(Math.round(finalHeight * aspectRatio), maxWidthAllowed);
    }

    return {
        width: finalWidth,
        height: finalHeight,
        maxWidth: maxWidthAllowed,
        maxHeight: maxHeight * scaleFactor,
        scaleFactor,
        aspectRatio
    };
}

/**
 * Calculate sizes for multiple logos with consistent scaling
 *
 * @param {Array} logos - Array of logo configurations [{name, aspectRatio}]
 * @param {Object} canvasSize - Canvas dimensions
 * @param {string} position - Position preset
 * @returns {Array} Array of size configurations for each logo
 */
function calculateMultipleLogoSizes(logos, canvasSize = DEFAULT_CANVAS, position = 'topRightCluster') {
    if (!logos || logos.length === 0) {
        return [];
    }

    const logoCount = logos.length;

    return logos.map((logo, index) => {
        const aspectRatio = logo.aspectRatio ||
            DEFAULT_LOGO_ASPECTS[logo.name?.toLowerCase()] ||
            DEFAULT_LOGO_ASPECTS.default;

        const size = calculateLogoSize(logoCount, canvasSize, position, {
            aspectRatio
        });

        return {
            index,
            name: logo.name,
            ...size
        };
    });
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if two rectangles overlap
 *
 * @param {Object} rect1 - First rectangle {x, y, width, height}
 * @param {Object} rect2 - Second rectangle {x, y, width, height}
 * @param {number} padding - Additional padding to consider (default: 20)
 * @returns {boolean} True if rectangles overlap
 */
function rectanglesOverlap(rect1, rect2, padding = 20) {
    return !(
        rect1.x + rect1.width + padding < rect2.x ||
        rect2.x + rect2.width + padding < rect1.x ||
        rect1.y + rect1.height + padding < rect2.y ||
        rect2.y + rect2.height + padding < rect1.y
    );
}

/**
 * Calculate logo bounding box based on position and anchor
 *
 * @param {Object} position - Position {x, y, anchor}
 * @param {Object} size - Size {width, height}
 * @returns {Object} Bounding box {x, y, width, height}
 */
function getLogoBoundingBox(position, size) {
    let x;
    switch (position.anchor) {
        case 'start':
            x = position.x;
            break;
        case 'middle':
            x = position.x - size.width / 2;
            break;
        case 'end':
            x = position.x - size.width;
            break;
        default:
            x = position.x;
    }

    return {
        x,
        y: position.y,
        width: size.width,
        height: size.height
    };
}

/**
 * Validate logo placement against subject and text bounds
 *
 * Checks for:
 * - Overlap with subject
 * - Overlap with text
 * - Logo fully within canvas bounds
 * - Conflict with YouTube duration overlay
 *
 * @param {Array} logos - Array of logo placements [{name, x, y, width, height, anchor}]
 * @param {Object} subjectBounds - Subject bounding box {x, y, width, height}
 * @param {Object} textBounds - Text bounding box {x, y, width, height}
 * @param {Object} canvasSize - Canvas dimensions {width, height}
 * @returns {Object} Validation result with isValid, errors, warnings, and suggestions
 */
function validateLogoPlacement(logos, subjectBounds = null, textBounds = null, canvasSize = DEFAULT_CANVAS) {
    const errors = [];
    const warnings = [];
    const suggestions = [];

    if (!logos || logos.length === 0) {
        return {
            isValid: true,
            errors: [],
            warnings: ['No logos provided for validation'],
            suggestions: []
        };
    }

    for (let i = 0; i < logos.length; i++) {
        const logo = logos[i];
        const logoBounds = getLogoBoundingBox(
            { x: logo.x, y: logo.y, anchor: logo.anchor || 'start' },
            { width: logo.width, height: logo.height }
        );

        const logoLabel = logo.name || `Logo ${i + 1}`;

        // Check if logo is within canvas bounds
        if (logoBounds.x < 0) {
            errors.push(`${logoLabel}: Extends beyond left edge by ${Math.abs(logoBounds.x)}px`);
            suggestions.push(`Move ${logoLabel} right or reduce size`);
        }
        if (logoBounds.y < 0) {
            errors.push(`${logoLabel}: Extends beyond top edge by ${Math.abs(logoBounds.y)}px`);
            suggestions.push(`Move ${logoLabel} down or reduce size`);
        }
        if (logoBounds.x + logoBounds.width > canvasSize.width) {
            const overflow = (logoBounds.x + logoBounds.width) - canvasSize.width;
            errors.push(`${logoLabel}: Extends beyond right edge by ${overflow}px`);
            suggestions.push(`Move ${logoLabel} left or reduce size`);
        }
        if (logoBounds.y + logoBounds.height > canvasSize.height) {
            const overflow = (logoBounds.y + logoBounds.height) - canvasSize.height;
            errors.push(`${logoLabel}: Extends beyond bottom edge by ${overflow}px`);
            suggestions.push(`Move ${logoLabel} up or reduce size`);
        }

        // Check for safe margin violations
        if (logoBounds.x < SAFE_MARGINS.x) {
            warnings.push(`${logoLabel}: Close to left edge (may be clipped on some displays)`);
        }
        if (logoBounds.y < SAFE_MARGINS.y) {
            warnings.push(`${logoLabel}: Close to top edge (may be clipped on some displays)`);
        }

        // Check overlap with subject
        if (subjectBounds && rectanglesOverlap(logoBounds, subjectBounds, 30)) {
            errors.push(`${logoLabel}: Overlaps with subject`);
            suggestions.push(`Move ${logoLabel} away from subject or reduce size`);
        }

        // Check overlap with text
        if (textBounds && rectanglesOverlap(logoBounds, textBounds, 20)) {
            warnings.push(`${logoLabel}: May overlap with text`);
            suggestions.push(`Consider repositioning ${logoLabel} to avoid text`);
        }

        // Check for YouTube duration overlay conflict
        const durationZone = {
            x: YOUTUBE_DURATION_ZONE.x,
            y: YOUTUBE_DURATION_ZONE.y,
            width: YOUTUBE_DURATION_ZONE.width,
            height: YOUTUBE_DURATION_ZONE.height
        };

        if (rectanglesOverlap(logoBounds, durationZone, 10)) {
            errors.push(`${logoLabel}: Conflicts with YouTube duration overlay zone`);
            suggestions.push(`Move ${logoLabel} away from bottom-right corner`);
        }

        // Check for logo-to-logo overlap
        for (let j = i + 1; j < logos.length; j++) {
            const otherLogo = logos[j];
            const otherBounds = getLogoBoundingBox(
                { x: otherLogo.x, y: otherLogo.y, anchor: otherLogo.anchor || 'start' },
                { width: otherLogo.width, height: otherLogo.height }
            );

            if (rectanglesOverlap(logoBounds, otherBounds, 10)) {
                const otherLabel = otherLogo.name || `Logo ${j + 1}`;
                errors.push(`${logoLabel} overlaps with ${otherLabel}`);
                suggestions.push(`Increase spacing between ${logoLabel} and ${otherLabel}`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        logoCount: logos.length
    };
}

// ============================================================================
// GRID ALIGNMENT FUNCTIONS
// ============================================================================

/**
 * Align multiple logos to a grid layout
 *
 * Supports horizontal and vertical arrangements with equal spacing.
 *
 * @param {Array} logos - Array of logo configurations [{name, width, height}]
 * @param {string} position - Position preset name
 * @param {Object} options - Alignment options
 * @returns {Array} Array of aligned logo positions
 */
function alignLogosToGrid(logos, position = 'topRightCluster', options = {}) {
    if (!logos || logos.length === 0) {
        return [];
    }

    const {
        spacing = LOGO_SIZE_CONSTRAINTS.spacing,
        direction = 'horizontal', // 'horizontal' or 'vertical'
        canvasSize = DEFAULT_CANVAS
    } = options;

    // Get the base position preset
    const positionPreset = LOGO_POSITIONS[position];

    // Check if it's a cluster/stack preset (array) or single position
    const isCluster = Array.isArray(positionPreset);

    if (isCluster && positionPreset.length > 0) {
        // Use predefined cluster positions but DYNAMICALLY adjust based on logo widths
        // to prevent overlapping
        const baseSlot = positionPreset[0];
        const isRightAligned = baseSlot.anchor === 'end';
        const isVertical = position.includes('Stack');

        return logos.map((logo, index) => {
            if (isVertical) {
                // Vertical stack: use base position for x, calculate y dynamically
                const yOffset = logos.slice(0, index).reduce(
                    (sum, l) => sum + l.height + spacing, 0
                );
                return {
                    ...logo,
                    x: baseSlot.x,
                    y: baseSlot.y + yOffset,
                    anchor: baseSlot.anchor,
                    slot: index
                };
            } else {
                // Horizontal cluster: calculate x dynamically based on logo widths
                const xOffset = logos.slice(0, index).reduce(
                    (sum, l) => sum + l.width + spacing, 0
                );
                const x = isRightAligned
                    ? baseSlot.x - xOffset  // Move left from anchor for right-aligned
                    : baseSlot.x + xOffset; // Move right from anchor for left-aligned

                return {
                    ...logo,
                    x,
                    y: baseSlot.y,
                    anchor: baseSlot.anchor,
                    slot: index
                };
            }
        });
    }

    // For single position, calculate grid from that point
    const basePos = positionPreset || LOGO_POSITIONS.topRight;

    if (basePos.avoid) {
        console.warn(`[LogoPositioning] Position "${position}" is marked as avoid: ${basePos.reason}`);
    }

    return logos.map((logo, index) => {
        let x, y;

        if (direction === 'horizontal') {
            // Horizontal layout
            if (basePos.anchor === 'end') {
                // Right-aligned: logos go left from anchor
                x = basePos.x - (index * (logo.width + spacing));
            } else if (basePos.anchor === 'middle') {
                // Center-aligned: logos spread from center
                const totalWidth = logos.reduce((sum, l) => sum + l.width, 0) + (spacing * (logos.length - 1));
                const startX = basePos.x - totalWidth / 2;
                x = startX + logos.slice(0, index).reduce((sum, l) => sum + l.width + spacing, 0);
            } else {
                // Left-aligned: logos go right from anchor
                x = basePos.x + (index * (logo.width + spacing));
            }
            y = basePos.y;
        } else {
            // Vertical layout
            x = basePos.x;
            y = basePos.y + (index * (logo.height + spacing));
        }

        return {
            ...logo,
            x: Math.round(x),
            y: Math.round(y),
            anchor: basePos.anchor,
            slot: index
        };
    });
}

/**
 * Calculate equal spacing for logos within a bounding area
 *
 * @param {Array} logos - Array of logo sizes [{width, height}]
 * @param {Object} boundingBox - Area to distribute logos within {x, y, width, height}
 * @param {string} direction - 'horizontal' or 'vertical'
 * @returns {Object} Spacing configuration {spacing, positions}
 */
function calculateEqualSpacing(logos, boundingBox, direction = 'horizontal') {
    if (!logos || logos.length === 0) {
        return { spacing: 0, positions: [] };
    }

    if (logos.length === 1) {
        // Single logo: center in bounding box
        return {
            spacing: 0,
            positions: [{
                x: boundingBox.x + (boundingBox.width - logos[0].width) / 2,
                y: boundingBox.y + (boundingBox.height - logos[0].height) / 2
            }]
        };
    }

    const totalLogoSize = logos.reduce(
        (sum, logo) => sum + (direction === 'horizontal' ? logo.width : logo.height),
        0
    );

    const availableSpace = direction === 'horizontal'
        ? boundingBox.width - totalLogoSize
        : boundingBox.height - totalLogoSize;

    const spacing = availableSpace / (logos.length - 1);

    const positions = [];
    let currentOffset = 0;

    for (const logo of logos) {
        if (direction === 'horizontal') {
            positions.push({
                x: boundingBox.x + currentOffset,
                y: boundingBox.y + (boundingBox.height - logo.height) / 2
            });
            currentOffset += logo.width + spacing;
        } else {
            positions.push({
                x: boundingBox.x + (boundingBox.width - logo.width) / 2,
                y: boundingBox.y + currentOffset
            });
            currentOffset += logo.height + spacing;
        }
    }

    return {
        spacing: Math.round(spacing),
        positions: positions.map(p => ({
            x: Math.round(p.x),
            y: Math.round(p.y)
        }))
    };
}

// ============================================================================
// PROMPT GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate AI prompt instructions for logo placement
 *
 * Creates clear, specific instructions for AI image generation
 * to properly place and render brand logos.
 *
 * @param {Array} logos - Array of logo configurations
 * @returns {string} Formatted prompt instructions
 */
function generateLogoPromptInstructions(logos) {
    if (!logos || logos.length === 0) {
        return '';
    }

    const instructions = [];

    instructions.push('BRAND LOGO PLACEMENT REQUIREMENTS:');
    instructions.push('');

    for (let i = 0; i < logos.length; i++) {
        const logo = logos[i];
        const position = getPositionDescription(logo.x, logo.y, logo.anchor);

        instructions.push(`${i + 1}. ${logo.name || 'Brand Logo'}:`);
        instructions.push(`   - Position: ${position}`);
        instructions.push(`   - Size: ${logo.width}px wide x ${logo.height}px tall`);
        instructions.push(`   - Alignment: ${getAnchorDescription(logo.anchor)}`);
        instructions.push(`   - CRITICAL: Do NOT crop, warp, or distort the logo`);
        instructions.push(`   - Maintain original logo proportions exactly`);
        instructions.push('');
    }

    instructions.push('LOGO QUALITY REQUIREMENTS:');
    instructions.push('- All logos must be crisp and clearly visible');
    instructions.push('- Maintain high contrast against background');
    instructions.push('- No blur, pixelation, or compression artifacts');
    instructions.push('- Logo colors must be accurate to brand guidelines');
    instructions.push('');

    instructions.push('LOGO PLACEMENT CONSTRAINTS:');
    instructions.push('- Logos must NOT overlap with the main subject');
    instructions.push('- Logos must NOT be placed in bottom-right corner (YouTube duration overlay zone)');
    instructions.push('- Maintain at least 40px spacing between multiple logos');
    instructions.push('- Keep logos within safe zone margins (80px from edges)');

    return instructions.join('\n');
}

/**
 * Get human-readable position description
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} anchor - Anchor type
 * @returns {string} Position description
 */
function getPositionDescription(x, y, anchor) {
    const horizontalPos = x < 640 ? 'left' : x > 1280 ? 'right' : 'center';
    const verticalPos = y < 360 ? 'top' : y > 720 ? 'bottom' : 'middle';

    return `${verticalPos}-${horizontalPos} area (${x}px, ${y}px)`;
}

/**
 * Get human-readable anchor description
 *
 * @param {string} anchor - Anchor type
 * @returns {string} Anchor description
 */
function getAnchorDescription(anchor) {
    switch (anchor) {
        case 'start':
            return 'Left-aligned (position is left edge)';
        case 'middle':
            return 'Center-aligned (position is center point)';
        case 'end':
            return 'Right-aligned (position is right edge)';
        default:
            return 'Left-aligned';
    }
}

/**
 * Generate composite instruction string for AI systems
 *
 * @param {Array} logos - Array of positioned logos
 * @param {Object} context - Additional context {subjectDescription, textContent}
 * @returns {string} Complete AI instruction string
 */
function generateCompositeInstructions(logos, context = {}) {
    const parts = [];

    if (context.subjectDescription) {
        parts.push(`Subject: ${context.subjectDescription}`);
    }

    if (context.textContent) {
        parts.push(`Text overlay: "${context.textContent}"`);
    }

    parts.push('');
    parts.push(generateLogoPromptInstructions(logos));

    return parts.join('\n');
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Prepare complete logo overlay configuration
 *
 * This is the PRIMARY export function that:
 * 1. Calculates optimal logo sizes
 * 2. Determines positions based on preset or custom input
 * 3. Validates placement against subject and text
 * 4. Generates AI prompt instructions
 *
 * @param {Object} input - Logo overlay input
 * @param {Array} input.logos - Array of logos [{name, position, aspectRatio?}]
 * @param {Object} input.canvas - Canvas dimensions {width, height}
 * @param {Object} input.subject - Subject bounds {bounds: {x, y, width, height}}
 * @param {Object} input.text - Text bounds {bounds: {x, y, width, height}}
 * @returns {Object} Complete logo overlay configuration
 *
 * @example
 * const result = prepareLogoOverlay({
 *     logos: [
 *         { name: 'Netflix', position: 'topRight' },
 *         { name: 'HBO', position: 'topRight' }
 *     ],
 *     canvas: { width: 1920, height: 1080 },
 *     subject: { bounds: { x: 100, y: 200, width: 600, height: 800 } },
 *     text: { bounds: { x: 900, y: 300, width: 900, height: 200 } }
 * });
 *
 * // Returns:
 * // {
 * //     positions: [
 * //         { name: 'Netflix', x: 1840, y: 60, width: 150, height: 80, anchor: 'end' },
 * //         { name: 'HBO', x: 1680, y: 60, width: 140, height: 80, anchor: 'end' }
 * //     ],
 * //     promptInstructions: "Place Netflix logo (150x80px) at top-right corner...",
 * //     valid: true,
 * //     warnings: []
 * // }
 */
function prepareLogoOverlay(input) {
    const {
        logos = [],
        canvas = DEFAULT_CANVAS,
        subject = null,
        text = null
    } = input;

    // Handle empty logos array
    if (!logos || logos.length === 0) {
        return {
            positions: [],
            promptInstructions: '',
            valid: true,
            warnings: ['No logos provided'],
            validation: {
                isValid: true,
                errors: [],
                warnings: ['No logos provided'],
                suggestions: []
            }
        };
    }

    // Group logos by position
    const logosByPosition = {};
    for (const logo of logos) {
        const pos = logo.position || 'topRight';
        if (!logosByPosition[pos]) {
            logosByPosition[pos] = [];
        }
        logosByPosition[pos].push(logo);
    }

    // Process each position group
    const processedLogos = [];

    for (const [position, positionLogos] of Object.entries(logosByPosition)) {
        // Calculate sizes for this group
        const sizes = calculateMultipleLogoSizes(positionLogos, canvas, position);

        // Determine if we need cluster positioning
        const useCluster = positionLogos.length > 1;
        const clusterPosition = useCluster
            ? `${position}Cluster` in LOGO_POSITIONS ? `${position}Cluster` : position
            : position;

        // Align logos to grid
        const aligned = alignLogosToGrid(
            sizes.map((size, idx) => ({
                ...size,
                name: positionLogos[idx].name
            })),
            clusterPosition,
            { canvasSize: canvas }
        );

        // Add to processed logos
        processedLogos.push(...aligned);
    }

    // Extract bounds for validation
    const subjectBounds = subject?.bounds || null;
    const textBounds = text?.bounds || null;

    // Validate placement
    const validation = validateLogoPlacement(
        processedLogos,
        subjectBounds,
        textBounds,
        canvas
    );

    // Generate prompt instructions
    const promptInstructions = generateLogoPromptInstructions(processedLogos);

    // Compile warnings
    const allWarnings = [...validation.warnings];
    if (validation.errors.length > 0) {
        allWarnings.push(...validation.errors.map(e => `ERROR: ${e}`));
    }

    return {
        positions: processedLogos.map(logo => ({
            name: logo.name,
            x: logo.x,
            y: logo.y,
            width: logo.width,
            height: logo.height,
            anchor: logo.anchor,
            slot: logo.slot
        })),
        promptInstructions,
        valid: validation.isValid,
        warnings: allWarnings,
        validation,
        _input: {
            logos,
            canvas,
            subject,
            text
        }
    };
}

/**
 * Get position preset by name
 *
 * @param {string} name - Position preset name
 * @returns {Object|Array|null} Position preset or null if not found
 */
function getPositionPreset(name) {
    return LOGO_POSITIONS[name] || null;
}

/**
 * Get all available position preset names
 *
 * @returns {string[]} Array of position preset names
 */
function getAvailablePositions() {
    return Object.keys(LOGO_POSITIONS).filter(key => {
        const preset = LOGO_POSITIONS[key];
        // Exclude positions marked as avoid
        if (!Array.isArray(preset) && preset.avoid) {
            return false;
        }
        return true;
    });
}

/**
 * Get recommended position for a specific scenario
 *
 * @param {string} scenario - Scenario type ('streaming', 'network', 'production', 'sponsor')
 * @param {number} logoCount - Number of logos
 * @returns {string} Recommended position preset name
 */
function getRecommendedPosition(scenario, logoCount = 1) {
    const recommendations = {
        streaming: {
            single: 'topRight',
            multiple: 'topRightCluster'
        },
        network: {
            single: 'topLeft',
            multiple: 'topLeftCluster'
        },
        production: {
            single: 'bottomLeft',
            multiple: 'leftStack'
        },
        sponsor: {
            single: 'topLeft',
            multiple: 'topLeftCluster'
        }
    };

    const scenarioConfig = recommendations[scenario] || recommendations.streaming;
    return logoCount > 1 ? scenarioConfig.multiple : scenarioConfig.single;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Main function - use this for complete logo overlay preparation
    prepareLogoOverlay,

    // Position functions
    getPositionPreset,
    getAvailablePositions,
    getRecommendedPosition,

    // Sizing functions
    calculateLogoSize,
    calculateMultipleLogoSizes,

    // Validation functions
    validateLogoPlacement,
    rectanglesOverlap,
    getLogoBoundingBox,

    // Grid alignment functions
    alignLogosToGrid,
    calculateEqualSpacing,

    // Prompt generation functions
    generateLogoPromptInstructions,
    generateCompositeInstructions,

    // Constants
    LOGO_POSITIONS,
    LOGO_SIZE_CONSTRAINTS,
    DEFAULT_LOGO_ASPECTS,
    DEFAULT_CANVAS,
    SAFE_MARGINS,
    YOUTUBE_DURATION_ZONE
};
