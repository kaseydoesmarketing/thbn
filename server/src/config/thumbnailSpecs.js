/**
 * YouTube Thumbnail Specifications
 *
 * OFFICIAL SPECS (Verified December 2025):
 * Source: YouTube Creator Resources & Official Documentation
 *
 * These are the AUTHORITATIVE specs that MUST be enforced across
 * all generation, processing, and export pipelines.
 */

const YOUTUBE_THUMBNAIL_SPECS = {
    // ==========================================================================
    // DIMENSIONS
    // ==========================================================================

    // Standard HD Resolution (RECOMMENDED for most use cases)
    WIDTH: 1280,
    HEIGHT: 720,
    ASPECT_RATIO: '16:9',
    ASPECT_RATIO_DECIMAL: 16 / 9, // 1.7777...

    // 4K Resolution (For TV viewers - YouTube 2025 update)
    WIDTH_4K: 3840,
    HEIGHT_4K: 2160,

    // Minimum requirements
    MIN_WIDTH: 640,
    MIN_HEIGHT: 360,

    // ==========================================================================
    // FILE CONSTRAINTS
    // ==========================================================================

    MAX_FILE_SIZE_MB: 2, // Standard limit
    MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024, // 2MB in bytes
    MAX_FILE_SIZE_4K_MB: 50, // 4K limit (YouTube 2025 update)
    MAX_FILE_SIZE_4K_BYTES: 50 * 1024 * 1024, // 50MB in bytes

    // ==========================================================================
    // FORMATS
    // ==========================================================================

    ALLOWED_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
    PREFERRED_FORMAT: 'png', // Best for text clarity
    FALLBACK_FORMAT: 'jpg', // Best for file size
    MIME_TYPES: {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        bmp: 'image/bmp',
        webp: 'image/webp'
    },

    // ==========================================================================
    // SAFE ZONES (avoid UI overlays)
    // ==========================================================================

    SAFE_ZONES: {
        // Desktop safe zone
        desktop: {
            width: 1100,
            height: 620,
            marginX: 90, // (1280 - 1100) / 2
            marginY: 50  // (720 - 620) / 2
        },
        // Mobile safe zone (more conservative)
        mobile: {
            width: 960,
            height: 540,
            marginX: 160,
            marginY: 90
        },
        // Duration overlay zone (BOTTOM RIGHT - AVOID)
        durationOverlay: {
            x: 1180, // Start of danger zone
            y: 640,  // Start of danger zone
            width: 100,
            height: 80
        }
    },

    // ==========================================================================
    // PREVIEW SIZES (for UI previews)
    // ==========================================================================

    PREVIEW_SIZES: {
        // Suggested video sidebar
        suggested: { width: 168, height: 94 },
        // Search results
        search: { width: 360, height: 202 },
        // Homepage
        home: { width: 320, height: 180 },
        // Watch page end screen
        endScreen: { width: 246, height: 138 },
        // Mobile feed
        mobileFeed: { width: 320, height: 180 }
    },

    // ==========================================================================
    // QUALITY SETTINGS
    // ==========================================================================

    QUALITY: {
        // JPEG quality (0-100)
        jpegQuality: 92,
        // PNG compression level (0-9)
        pngCompression: 6,
        // WebP quality (0-100)
        webpQuality: 90,
        // Color profile
        colorProfile: 'sRGB'
    }
};

/**
 * Validate thumbnail dimensions
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Validation result with isValid and errors
 */
function validateDimensions(width, height) {
    const errors = [];

    if (width < YOUTUBE_THUMBNAIL_SPECS.MIN_WIDTH) {
        errors.push(`Width ${width}px is below minimum ${YOUTUBE_THUMBNAIL_SPECS.MIN_WIDTH}px`);
    }

    if (height < YOUTUBE_THUMBNAIL_SPECS.MIN_HEIGHT) {
        errors.push(`Height ${height}px is below minimum ${YOUTUBE_THUMBNAIL_SPECS.MIN_HEIGHT}px`);
    }

    const aspectRatio = width / height;
    const expectedRatio = YOUTUBE_THUMBNAIL_SPECS.ASPECT_RATIO_DECIMAL;
    const tolerance = 0.01;

    if (Math.abs(aspectRatio - expectedRatio) > tolerance) {
        errors.push(`Aspect ratio ${aspectRatio.toFixed(3)} does not match 16:9 (${expectedRatio.toFixed(3)})`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        actualRatio: aspectRatio,
        expectedRatio: expectedRatio
    };
}

/**
 * Validate file size
 * @param {number} sizeBytes - File size in bytes
 * @param {boolean} is4K - Whether this is a 4K thumbnail
 * @returns {Object} Validation result
 */
function validateFileSize(sizeBytes, is4K = false) {
    const maxBytes = is4K
        ? YOUTUBE_THUMBNAIL_SPECS.MAX_FILE_SIZE_4K_BYTES
        : YOUTUBE_THUMBNAIL_SPECS.MAX_FILE_SIZE_BYTES;

    const maxMB = is4K
        ? YOUTUBE_THUMBNAIL_SPECS.MAX_FILE_SIZE_4K_MB
        : YOUTUBE_THUMBNAIL_SPECS.MAX_FILE_SIZE_MB;

    const sizeMB = sizeBytes / (1024 * 1024);

    return {
        isValid: sizeBytes <= maxBytes,
        sizeMB: sizeMB.toFixed(2),
        maxMB,
        error: sizeBytes > maxBytes
            ? `File size ${sizeMB.toFixed(2)}MB exceeds maximum ${maxMB}MB`
            : null
    };
}

/**
 * Validate format
 * @param {string} format - File format/extension
 * @returns {Object} Validation result
 */
function validateFormat(format) {
    const normalizedFormat = format.toLowerCase().replace('.', '');
    const isValid = YOUTUBE_THUMBNAIL_SPECS.ALLOWED_FORMATS.includes(normalizedFormat);

    return {
        isValid,
        format: normalizedFormat,
        error: isValid ? null : `Format '${format}' is not allowed. Use: ${YOUTUBE_THUMBNAIL_SPECS.ALLOWED_FORMATS.join(', ')}`
    };
}

/**
 * Get resize dimensions maintaining aspect ratio
 * @param {number} width - Current width
 * @param {number} height - Current height
 * @param {boolean} use4K - Whether to resize to 4K
 * @returns {Object} Target dimensions
 */
function getResizeDimensions(width, height, use4K = false) {
    const targetWidth = use4K ? YOUTUBE_THUMBNAIL_SPECS.WIDTH_4K : YOUTUBE_THUMBNAIL_SPECS.WIDTH;
    const targetHeight = use4K ? YOUTUBE_THUMBNAIL_SPECS.HEIGHT_4K : YOUTUBE_THUMBNAIL_SPECS.HEIGHT;

    return {
        width: targetWidth,
        height: targetHeight,
        needsResize: width !== targetWidth || height !== targetHeight
    };
}

/**
 * Check if point is in safe zone
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} device - 'desktop' or 'mobile'
 * @returns {boolean} Whether point is in safe zone
 */
function isInSafeZone(x, y, device = 'desktop') {
    const safeZone = YOUTUBE_THUMBNAIL_SPECS.SAFE_ZONES[device];
    const marginX = safeZone.marginX;
    const marginY = safeZone.marginY;

    return x >= marginX &&
           x <= (YOUTUBE_THUMBNAIL_SPECS.WIDTH - marginX) &&
           y >= marginY &&
           y <= (YOUTUBE_THUMBNAIL_SPECS.HEIGHT - marginY);
}

/**
 * Check if point conflicts with duration overlay
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {boolean} Whether point is in duration overlay danger zone
 */
function isInDurationOverlay(x, y) {
    const overlay = YOUTUBE_THUMBNAIL_SPECS.SAFE_ZONES.durationOverlay;
    return x >= overlay.x && y >= overlay.y;
}

/**
 * Full validation of a thumbnail
 * @param {Object} options
 * @param {number} options.width - Image width
 * @param {number} options.height - Image height
 * @param {number} options.sizeBytes - File size in bytes
 * @param {string} options.format - File format
 * @param {boolean} options.is4K - Whether this is a 4K thumbnail
 * @returns {Object} Complete validation result
 */
function validateThumbnail(options) {
    const { width, height, sizeBytes, format, is4K = false } = options;

    const dimensionResult = validateDimensions(width, height);
    const sizeResult = validateFileSize(sizeBytes, is4K);
    const formatResult = validateFormat(format);

    const allErrors = [
        ...dimensionResult.errors,
        sizeResult.error,
        formatResult.error
    ].filter(Boolean);

    return {
        isValid: allErrors.length === 0,
        dimensions: dimensionResult,
        fileSize: sizeResult,
        format: formatResult,
        errors: allErrors,
        specs: {
            targetWidth: is4K ? YOUTUBE_THUMBNAIL_SPECS.WIDTH_4K : YOUTUBE_THUMBNAIL_SPECS.WIDTH,
            targetHeight: is4K ? YOUTUBE_THUMBNAIL_SPECS.HEIGHT_4K : YOUTUBE_THUMBNAIL_SPECS.HEIGHT,
            maxFileSizeMB: is4K ? YOUTUBE_THUMBNAIL_SPECS.MAX_FILE_SIZE_4K_MB : YOUTUBE_THUMBNAIL_SPECS.MAX_FILE_SIZE_MB,
            allowedFormats: YOUTUBE_THUMBNAIL_SPECS.ALLOWED_FORMATS
        }
    };
}

module.exports = {
    YOUTUBE_THUMBNAIL_SPECS,
    validateDimensions,
    validateFileSize,
    validateFormat,
    validateThumbnail,
    getResizeDimensions,
    isInSafeZone,
    isInDurationOverlay
};
