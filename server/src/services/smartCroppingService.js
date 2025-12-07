/**
 * Smart Cropping Service - Tier 2
 *
 * Intelligent cropping for different platforms and aspect ratios
 * - YouTube thumbnail (16:9 - 1280x720)
 * - Mobile preview (smaller, needs more zoom)
 * - Instagram square (1:1)
 * - Pinterest vertical (2:3)
 * - Facebook (1.91:1)
 * - Subject-aware cropping
 * - Safe zone preservation
 *
 * @module smartCroppingService
 */

const sharp = require('sharp');

// =============================================================================
// PLATFORM CONFIGURATIONS
// =============================================================================

const PLATFORM_CONFIGS = {
    // YouTube Thumbnails
    'youtube': {
        width: 1280,
        height: 720,
        aspectRatio: 16 / 9,
        safeZone: { top: 0.05, right: 0.15, bottom: 0.15, left: 0.05 },
        focus: 'subject',
        minSubjectSize: 0.3,
        mobileOptimized: true
    },
    'youtube-hd': {
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        safeZone: { top: 0.05, right: 0.15, bottom: 0.15, left: 0.05 },
        focus: 'subject',
        minSubjectSize: 0.3,
        mobileOptimized: true
    },

    // Mobile Previews (smaller thumbnails need bigger subjects)
    'youtube-mobile': {
        width: 320,
        height: 180,
        aspectRatio: 16 / 9,
        safeZone: { top: 0.02, right: 0.05, bottom: 0.1, left: 0.02 },
        focus: 'subject',
        minSubjectSize: 0.5,  // Subject should be larger for mobile
        zoom: 1.3,            // Zoom in more for mobile
        mobileOptimized: true
    },
    'youtube-suggested': {
        width: 168,
        height: 94,
        aspectRatio: 16 / 9,
        safeZone: { top: 0, right: 0.05, bottom: 0.08, left: 0 },
        focus: 'subject',
        minSubjectSize: 0.6,  // Subject must be prominent
        zoom: 1.5,            // Significant zoom for tiny previews
        mobileOptimized: true
    },

    // Social Media
    'instagram-square': {
        width: 1080,
        height: 1080,
        aspectRatio: 1,
        safeZone: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
        focus: 'center',
        minSubjectSize: 0.4
    },
    'instagram-portrait': {
        width: 1080,
        height: 1350,
        aspectRatio: 4 / 5,
        safeZone: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
        focus: 'subject',
        minSubjectSize: 0.35
    },
    'instagram-story': {
        width: 1080,
        height: 1920,
        aspectRatio: 9 / 16,
        safeZone: { top: 0.1, right: 0.05, bottom: 0.15, left: 0.05 },
        focus: 'subject',
        minSubjectSize: 0.3
    },

    // Pinterest
    'pinterest': {
        width: 1000,
        height: 1500,
        aspectRatio: 2 / 3,
        safeZone: { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 },
        focus: 'subject',
        minSubjectSize: 0.35
    },

    // Facebook
    'facebook': {
        width: 1200,
        height: 628,
        aspectRatio: 1.91,
        safeZone: { top: 0.05, right: 0.1, bottom: 0.1, left: 0.05 },
        focus: 'center',
        minSubjectSize: 0.3
    },
    'facebook-cover': {
        width: 1640,
        height: 856,
        aspectRatio: 1.91,
        safeZone: { top: 0.1, right: 0.15, bottom: 0.15, left: 0.15 },
        focus: 'center',
        minSubjectSize: 0.25
    },

    // Twitter
    'twitter': {
        width: 1200,
        height: 675,
        aspectRatio: 16 / 9,
        safeZone: { top: 0.05, right: 0.1, bottom: 0.1, left: 0.05 },
        focus: 'center',
        minSubjectSize: 0.3
    },

    // LinkedIn
    'linkedin': {
        width: 1200,
        height: 627,
        aspectRatio: 1.91,
        safeZone: { top: 0.05, right: 0.1, bottom: 0.1, left: 0.05 },
        focus: 'center',
        minSubjectSize: 0.3
    },

    // TikTok
    'tiktok': {
        width: 1080,
        height: 1920,
        aspectRatio: 9 / 16,
        safeZone: { top: 0.15, right: 0.1, bottom: 0.15, left: 0.05 },
        focus: 'subject',
        minSubjectSize: 0.35
    }
};

// =============================================================================
// SUBJECT DETECTION (Simple Heuristics)
// =============================================================================

/**
 * Estimate subject position using edge detection heuristics
 * In production, this would use ML-based face/object detection
 *
 * @param {Buffer} imageBuffer - Image to analyze
 * @returns {Promise<object>} Subject bounds { x, y, width, height } as percentages
 */
async function estimateSubjectBounds(imageBuffer) {
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    // Get image statistics for each region
    const regions = [];
    const gridSize = 3; // 3x3 grid

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const regionWidth = Math.floor(width / gridSize);
            const regionHeight = Math.floor(height / gridSize);
            const left = col * regionWidth;
            const top = row * regionHeight;

            try {
                const region = await sharp(imageBuffer)
                    .extract({ left, top, width: regionWidth, height: regionHeight })
                    .stats();

                // Calculate "interestingness" based on channel variation
                const variance = region.channels.reduce((sum, ch) => sum + ch.stdev, 0) / 3;
                const brightness = region.channels.reduce((sum, ch) => sum + ch.mean, 0) / 3;

                regions.push({
                    col, row,
                    x: left + regionWidth / 2,
                    y: top + regionHeight / 2,
                    variance,
                    brightness,
                    // Higher variance = more detail = likely subject
                    // Moderate brightness = not too dark/bright
                    score: variance * (1 - Math.abs(brightness - 128) / 128)
                });
            } catch (e) {
                regions.push({ col, row, x: left, y: top, variance: 0, brightness: 128, score: 0 });
            }
        }
    }

    // Find the region with highest score (likely contains subject)
    regions.sort((a, b) => b.score - a.score);
    const topRegions = regions.slice(0, 3);

    // Calculate weighted center of top regions
    const totalScore = topRegions.reduce((sum, r) => sum + r.score, 0);
    const weightedX = topRegions.reduce((sum, r) => sum + r.x * r.score, 0) / totalScore;
    const weightedY = topRegions.reduce((sum, r) => sum + r.y * r.score, 0) / totalScore;

    // Estimate subject size based on score distribution
    const scoreRange = regions[0].score - regions[regions.length - 1].score;
    const subjectSize = scoreRange > 20 ? 0.4 : 0.6; // More variance = smaller focused subject

    return {
        x: weightedX / width,
        y: weightedY / height,
        width: subjectSize,
        height: subjectSize
    };
}

/**
 * Use provided subject bounds or estimate them
 */
async function getSubjectBounds(imageBuffer, providedBounds = null) {
    if (providedBounds) {
        return providedBounds;
    }
    return estimateSubjectBounds(imageBuffer);
}

// =============================================================================
// SMART CROPPING
// =============================================================================

/**
 * Calculate optimal crop region
 *
 * @param {number} sourceWidth - Source image width
 * @param {number} sourceHeight - Source image height
 * @param {object} targetConfig - Platform configuration
 * @param {object} subjectBounds - Subject position and size
 * @returns {object} Crop region { left, top, width, height }
 */
function calculateSmartCrop(sourceWidth, sourceHeight, targetConfig, subjectBounds) {
    const { aspectRatio, safeZone, focus, minSubjectSize, zoom = 1 } = targetConfig;

    // Calculate crop dimensions maintaining aspect ratio
    let cropWidth, cropHeight;
    const sourceAspect = sourceWidth / sourceHeight;

    if (sourceAspect > aspectRatio) {
        // Source is wider, crop width
        cropHeight = sourceHeight;
        cropWidth = cropHeight * aspectRatio;
    } else {
        // Source is taller, crop height
        cropWidth = sourceWidth;
        cropHeight = cropWidth / aspectRatio;
    }

    // Apply zoom (reduces crop size to zoom in)
    cropWidth = cropWidth / zoom;
    cropHeight = cropHeight / zoom;

    // Ensure crop doesn't exceed source dimensions
    cropWidth = Math.min(cropWidth, sourceWidth);
    cropHeight = Math.min(cropHeight, sourceHeight);

    // Calculate center point based on focus strategy
    let centerX, centerY;

    if (focus === 'subject' && subjectBounds) {
        // Center on subject
        centerX = subjectBounds.x * sourceWidth;
        centerY = subjectBounds.y * sourceHeight;

        // Adjust to ensure subject fits within safe zone
        const safeLeft = cropWidth * safeZone.left;
        const safeRight = cropWidth * (1 - safeZone.right);
        const safeTop = cropHeight * safeZone.top;
        const safeBottom = cropHeight * (1 - safeZone.bottom);

        // Subject position within crop
        const subjectInCropX = subjectBounds.x * sourceWidth - (centerX - cropWidth / 2);
        const subjectInCropY = subjectBounds.y * sourceHeight - (centerY - cropHeight / 2);

        // Adjust if subject is outside safe zone
        if (subjectInCropX < safeLeft) {
            centerX -= (safeLeft - subjectInCropX);
        } else if (subjectInCropX > safeRight) {
            centerX += (subjectInCropX - safeRight);
        }

        if (subjectInCropY < safeTop) {
            centerY -= (safeTop - subjectInCropY);
        } else if (subjectInCropY > safeBottom) {
            centerY += (subjectInCropY - safeBottom);
        }
    } else {
        // Center on image center
        centerX = sourceWidth / 2;
        centerY = sourceHeight / 2;
    }

    // Calculate final crop position
    let left = Math.round(centerX - cropWidth / 2);
    let top = Math.round(centerY - cropHeight / 2);

    // Ensure crop stays within bounds
    left = Math.max(0, Math.min(left, sourceWidth - cropWidth));
    top = Math.max(0, Math.min(top, sourceHeight - cropHeight));

    return {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(cropWidth),
        height: Math.round(cropHeight)
    };
}

// =============================================================================
// MAIN EXPORT FUNCTIONS
// =============================================================================

/**
 * Smart crop an image for a specific platform
 *
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {string} platform - Platform name from PLATFORM_CONFIGS
 * @param {object} options - Additional options
 * @param {object} options.subjectBounds - Pre-calculated subject bounds
 * @param {boolean} options.autoDetect - Auto-detect subject (default: true)
 * @returns {Promise<Buffer>} Cropped image buffer
 */
async function smartCrop(imageBuffer, platform, options = {}) {
    const config = PLATFORM_CONFIGS[platform];

    if (!config) {
        console.warn(`[SmartCrop] Unknown platform: ${platform}, using youtube`);
        return smartCrop(imageBuffer, 'youtube', options);
    }

    const metadata = await sharp(imageBuffer).metadata();
    const { width: sourceWidth, height: sourceHeight } = metadata;

    // Get subject bounds
    let subjectBounds = options.subjectBounds;
    if (!subjectBounds && options.autoDetect !== false) {
        subjectBounds = await estimateSubjectBounds(imageBuffer);
    }

    // Calculate crop region
    const cropRegion = calculateSmartCrop(
        sourceWidth,
        sourceHeight,
        config,
        subjectBounds
    );

    // Perform crop and resize
    return sharp(imageBuffer)
        .extract(cropRegion)
        .resize(config.width, config.height, {
            fit: 'fill',
            kernel: 'lanczos3'
        })
        .png()
        .toBuffer();
}

/**
 * Generate crops for multiple platforms
 *
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {Array<string>} platforms - List of platform names
 * @param {object} options - Options for each platform
 * @returns {Promise<object>} Object with platform names as keys and buffers as values
 */
async function generateMultiPlatformCrops(imageBuffer, platforms, options = {}) {
    // Pre-calculate subject bounds once
    let subjectBounds = options.subjectBounds;
    if (!subjectBounds && options.autoDetect !== false) {
        subjectBounds = await estimateSubjectBounds(imageBuffer);
    }

    const crops = {};

    for (const platform of platforms) {
        try {
            crops[platform] = await smartCrop(imageBuffer, platform, {
                ...options,
                subjectBounds
            });
        } catch (error) {
            console.error(`[SmartCrop] Error cropping for ${platform}:`, error);
            // Include original resized as fallback
            const config = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS['youtube'];
            crops[platform] = await sharp(imageBuffer)
                .resize(config.width, config.height, { fit: 'cover' })
                .png()
                .toBuffer();
        }
    }

    return crops;
}

/**
 * Generate a preview grid showing all platform crops
 *
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {object} options - Options
 * @returns {Promise<Buffer>} Grid preview image
 */
async function generatePlatformPreview(imageBuffer, options = {}) {
    const platforms = ['youtube', 'youtube-mobile', 'instagram-square', 'tiktok', 'facebook', 'pinterest'];
    const crops = await generateMultiPlatformCrops(imageBuffer, platforms, options);

    // Calculate grid layout
    const maxWidth = 400;
    const padding = 10;
    const labelHeight = 25;

    const composites = [];
    let currentX = padding;
    let currentY = padding;
    let rowHeight = 0;
    let gridWidth = padding;

    for (const platform of platforms) {
        const config = PLATFORM_CONFIGS[platform];
        const scale = maxWidth / config.width;
        const scaledWidth = Math.round(config.width * scale);
        const scaledHeight = Math.round(config.height * scale);

        // Check if we need to wrap to next row
        if (currentX + scaledWidth + padding > 1200) {
            currentX = padding;
            currentY += rowHeight + labelHeight + padding;
            rowHeight = 0;
        }

        // Resize crop for preview
        const resizedCrop = await sharp(crops[platform])
            .resize(scaledWidth, scaledHeight)
            .png()
            .toBuffer();

        composites.push({
            input: resizedCrop,
            left: currentX,
            top: currentY
        });

        // Add label
        const labelSvg = `
        <svg width="${scaledWidth}" height="${labelHeight}">
            <rect width="100%" height="100%" fill="#1a1a1a"/>
            <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
                font-family="Arial" font-size="12" fill="white">
                ${platform} (${config.width}x${config.height})
            </text>
        </svg>`;

        composites.push({
            input: Buffer.from(labelSvg),
            left: currentX,
            top: currentY + scaledHeight
        });

        currentX += scaledWidth + padding;
        rowHeight = Math.max(rowHeight, scaledHeight);
        gridWidth = Math.max(gridWidth, currentX);
    }

    const gridHeight = currentY + rowHeight + labelHeight + padding;

    // Create grid
    return sharp({
        create: {
            width: gridWidth,
            height: gridHeight,
            channels: 3,
            background: { r: 40, g: 40, b: 40 }
        }
    })
        .composite(composites)
        .png()
        .toBuffer();
}

/**
 * Get available platforms
 */
function getAvailablePlatforms() {
    return Object.entries(PLATFORM_CONFIGS).map(([key, value]) => ({
        id: key,
        width: value.width,
        height: value.height,
        aspectRatio: value.aspectRatio.toFixed(2),
        mobileOptimized: value.mobileOptimized || false
    }));
}

/**
 * Get platform configuration
 */
function getPlatformConfig(platform) {
    return PLATFORM_CONFIGS[platform] || null;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    smartCrop,
    generateMultiPlatformCrops,
    generatePlatformPreview,
    estimateSubjectBounds,
    getAvailablePlatforms,
    getPlatformConfig,
    PLATFORM_CONFIGS
};
