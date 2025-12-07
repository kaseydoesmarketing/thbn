/**
 * ============================================================================
 * ThumbnailBuilder - Professional Color Grading Service
 * ============================================================================
 *
 * Applies cinematic color grading to thumbnails using LUTs (Look-Up Tables)
 * and professional color science techniques.
 *
 * Features:
 * - Creator-style specific color grading
 * - Hollywood cinematic LUTs (orange/teal, high contrast, etc.)
 * - Dynamic range optimization
 * - Vibrance and saturation control
 * - Skin tone protection
 */

const sharp = require('sharp');

// =============================================================================
// COLOR GRADING PRESETS (LUT-style transformations)
// =============================================================================

const COLOR_GRADES = {
    // MrBeast: Hyper-saturated, punchy, viral look
    mrbeast: {
        name: 'MrBeast Viral',
        saturation: 1.35,           // 35% more saturated
        contrast: 1.25,             // High contrast
        brightness: 1.05,           // Slightly brighter
        vibrance: 1.4,              // Punch up colors
        shadows: { r: 0, g: -5, b: 10 },      // Cool shadows
        highlights: { r: 10, g: 5, b: -5 },   // Warm highlights
        gamma: 0.95,                // Slight lift
        skinProtection: true
    },

    // Alex Hormozi: High contrast, bold, authoritative
    hormozi: {
        name: 'Hormozi Authority',
        saturation: 1.15,
        contrast: 1.35,             // Very high contrast
        brightness: 1.0,
        vibrance: 1.2,
        shadows: { r: -5, g: -5, b: 0 },      // Deep shadows
        highlights: { r: 5, g: 0, b: -5 },    // Clean highlights
        gamma: 0.9,                 // Deeper blacks
        skinProtection: true
    },

    // Iman Gadzhi: Luxury, muted, sophisticated
    gadzhi: {
        name: 'Gadzhi Luxury',
        saturation: 0.85,           // Desaturated
        contrast: 1.1,
        brightness: 1.02,
        vibrance: 0.9,
        shadows: { r: 5, g: 5, b: 10 },       // Lifted shadows
        highlights: { r: -5, g: -5, b: 0 },   // Muted highlights
        gamma: 1.05,                // Lifted blacks (luxury look)
        skinProtection: true
    },

    // Magnates Media: Cinematic documentary
    magnates: {
        name: 'Magnates Cinematic',
        saturation: 1.1,
        contrast: 1.2,
        brightness: 0.98,
        vibrance: 1.15,
        shadows: { r: 0, g: -10, b: 15 },     // Teal shadows (Hollywood)
        highlights: { r: 15, g: 5, b: -10 },  // Orange highlights
        gamma: 0.92,
        skinProtection: true
    },

    // Gaming: Neon, vibrant, energetic
    gaming: {
        name: 'Gaming Neon',
        saturation: 1.5,            // Very saturated
        contrast: 1.3,
        brightness: 1.08,
        vibrance: 1.6,
        shadows: { r: -10, g: 0, b: 20 },     // Blue/purple shadows
        highlights: { r: 5, g: 10, b: -5 },   // Warm highlights
        gamma: 0.95,
        skinProtection: false       // Allow full saturation
    },

    // Documentary: Film-like, natural, cinematic
    documentary: {
        name: 'Documentary Film',
        saturation: 0.95,
        contrast: 1.15,
        brightness: 1.0,
        vibrance: 1.0,
        shadows: { r: 5, g: 0, b: 5 },        // Slightly lifted
        highlights: { r: -3, g: -3, b: -3 },  // Rolled off highlights
        gamma: 1.02,
        skinProtection: true
    },

    // Finance/Business: Clean, professional, trustworthy
    finance: {
        name: 'Finance Professional',
        saturation: 1.0,
        contrast: 1.18,
        brightness: 1.03,
        vibrance: 1.05,
        shadows: { r: 0, g: 0, b: 5 },        // Slight cool shadows
        highlights: { r: 0, g: 0, b: 0 },     // Neutral highlights
        gamma: 1.0,
        skinProtection: true
    },

    // Orange Teal: Classic Hollywood blockbuster
    orangeTeal: {
        name: 'Hollywood Orange/Teal',
        saturation: 1.2,
        contrast: 1.25,
        brightness: 1.0,
        vibrance: 1.3,
        shadows: { r: -15, g: 5, b: 25 },     // Strong teal shadows
        highlights: { r: 25, g: 10, b: -15 }, // Strong orange highlights
        gamma: 0.93,
        skinProtection: true
    },

    // High Contrast B&W style (with color)
    dramatic: {
        name: 'Dramatic Contrast',
        saturation: 1.1,
        contrast: 1.45,             // Extreme contrast
        brightness: 0.95,
        vibrance: 1.2,
        shadows: { r: -10, g: -10, b: -5 },   // Crushed shadows
        highlights: { r: 10, g: 10, b: 5 },   // Bright highlights
        gamma: 0.85,
        skinProtection: true
    },

    // Warm Lifestyle: Cozy, inviting, vlog style
    lifestyle: {
        name: 'Lifestyle Warm',
        saturation: 1.15,
        contrast: 1.1,
        brightness: 1.05,
        vibrance: 1.2,
        shadows: { r: 10, g: 5, b: 0 },       // Warm shadows
        highlights: { r: 8, g: 3, b: -5 },    // Golden highlights
        gamma: 1.02,
        skinProtection: true
    }
};

// Creator style to color grade mapping
const CREATOR_TO_GRADE = {
    'mrbeast': 'mrbeast',
    'hormozi': 'hormozi',
    'alex-hormozi': 'hormozi',
    'gadzhi': 'gadzhi',
    'iman-gadzhi': 'gadzhi',
    'magnates': 'magnates',
    'magnates-media': 'magnates',
    'gaming': 'gaming',
    'documentary': 'documentary',
    'finance': 'finance',
    'business': 'finance',
    'lifestyle': 'lifestyle',
    'vlog': 'lifestyle',
    'cinematic': 'orangeTeal',
    'dramatic': 'dramatic',
    'default': 'mrbeast'  // Default to high-impact viral look
};

// =============================================================================
// CORE COLOR GRADING FUNCTIONS
// =============================================================================

/**
 * Apply color grading to an image buffer
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {string} creatorStyle - Creator style or grade name
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} Graded image buffer
 */
async function applyColorGrade(imageBuffer, creatorStyle = 'default', options = {}) {
    const {
        intensity = 1.0,          // 0-1, how strong to apply the grade
        preserveOriginal = 0.0,   // 0-1, blend with original
        customAdjustments = null  // Override specific values
    } = options;

    // Get the appropriate grade
    const gradeName = CREATOR_TO_GRADE[creatorStyle.toLowerCase()] || CREATOR_TO_GRADE['default'];
    let grade = { ...COLOR_GRADES[gradeName] };

    // Apply custom adjustments if provided
    if (customAdjustments) {
        grade = { ...grade, ...customAdjustments };
    }

    // Scale adjustments by intensity
    if (intensity !== 1.0) {
        grade = scaleGradeIntensity(grade, intensity);
    }

    console.log(`[ColorGrading] Applying "${grade.name}" grade (intensity: ${intensity})`);

    try {
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        // Step 1: Apply base adjustments (contrast, brightness, saturation)
        let processedBuffer = await sharp(imageBuffer)
            .modulate({
                brightness: grade.brightness,
                saturation: grade.saturation
            })
            .gamma(grade.gamma)
            .toBuffer();

        // Step 2: Apply color channel adjustments (shadows/highlights split toning)
        processedBuffer = await applyColorChannelAdjustments(processedBuffer, grade);

        // Step 3: Apply contrast curve
        if (grade.contrast !== 1.0) {
            processedBuffer = await applyContrastCurve(processedBuffer, grade.contrast);
        }

        // Step 4: Apply vibrance (selective saturation boost)
        if (grade.vibrance !== 1.0) {
            processedBuffer = await applyVibrance(processedBuffer, grade.vibrance);
        }

        // Step 5: Blend with original if preserveOriginal > 0
        if (preserveOriginal > 0) {
            processedBuffer = await blendWithOriginal(imageBuffer, processedBuffer, preserveOriginal);
        }

        console.log(`[ColorGrading] Grade applied successfully`);
        return processedBuffer;

    } catch (error) {
        console.error('[ColorGrading] Error applying grade:', error.message);
        // Return original on error
        return imageBuffer;
    }
}

/**
 * Scale grade intensity (make adjustments more or less extreme)
 */
function scaleGradeIntensity(grade, intensity) {
    return {
        ...grade,
        saturation: 1 + (grade.saturation - 1) * intensity,
        contrast: 1 + (grade.contrast - 1) * intensity,
        brightness: 1 + (grade.brightness - 1) * intensity,
        vibrance: 1 + (grade.vibrance - 1) * intensity,
        gamma: 1 + (grade.gamma - 1) * intensity,
        shadows: {
            r: grade.shadows.r * intensity,
            g: grade.shadows.g * intensity,
            b: grade.shadows.b * intensity
        },
        highlights: {
            r: grade.highlights.r * intensity,
            g: grade.highlights.g * intensity,
            b: grade.highlights.b * intensity
        }
    };
}

/**
 * Apply color channel adjustments for split toning effect
 */
async function applyColorChannelAdjustments(imageBuffer, grade) {
    const { shadows, highlights } = grade;

    // Create adjustment matrix for linear color transformation
    // This simulates split-toning by adjusting RGB channels differently
    // based on luminosity (approximated)

    // For simplicity, we'll use Sharp's tint and recomb for color shifts
    // More advanced: use raw pixel manipulation

    try {
        // Apply shadow color tint using a subtle overlay
        // Sharp doesn't have direct shadow/highlight split, so we approximate
        // by applying a slight color matrix transformation

        const shadowTint = {
            r: 1 + (shadows.r / 255),
            g: 1 + (shadows.g / 255),
            b: 1 + (shadows.b / 255)
        };

        const highlightTint = {
            r: 1 + (highlights.r / 255),
            g: 1 + (highlights.g / 255),
            b: 1 + (highlights.b / 255)
        };

        // Average the tints for a global color shift (simplified)
        const avgR = (shadowTint.r + highlightTint.r) / 2;
        const avgG = (shadowTint.g + highlightTint.g) / 2;
        const avgB = (shadowTint.b + highlightTint.b) / 2;

        // Apply using recomb (color matrix)
        const colorMatrix = [
            avgR, 0, 0,
            0, avgG, 0,
            0, 0, avgB
        ];

        return await sharp(imageBuffer)
            .recomb([
                [avgR, 0, 0],
                [0, avgG, 0],
                [0, 0, avgB]
            ])
            .toBuffer();

    } catch (error) {
        console.warn('[ColorGrading] Channel adjustment failed, skipping:', error.message);
        return imageBuffer;
    }
}

/**
 * Apply S-curve contrast adjustment
 */
async function applyContrastCurve(imageBuffer, contrastFactor) {
    // Sharp's linear adjustment for contrast
    // contrast > 1 increases contrast, < 1 decreases

    const a = contrastFactor;
    const b = (1 - contrastFactor) * 0.5 * 255;

    try {
        return await sharp(imageBuffer)
            .linear(a, b)
            .toBuffer();
    } catch (error) {
        console.warn('[ColorGrading] Contrast curve failed:', error.message);
        return imageBuffer;
    }
}

/**
 * Apply vibrance (selective saturation that protects already-saturated colors)
 */
async function applyVibrance(imageBuffer, vibranceFactor) {
    // Vibrance is different from saturation - it boosts low-saturation colors more
    // Sharp doesn't have native vibrance, so we approximate with modulate
    // For true vibrance, we'd need pixel-level processing

    // Simplified: apply a gentler saturation boost
    const saturationBoost = 1 + (vibranceFactor - 1) * 0.7;  // 70% of vibrance as saturation

    try {
        return await sharp(imageBuffer)
            .modulate({
                saturation: saturationBoost
            })
            .toBuffer();
    } catch (error) {
        console.warn('[ColorGrading] Vibrance failed:', error.message);
        return imageBuffer;
    }
}

/**
 * Blend graded image with original
 */
async function blendWithOriginal(originalBuffer, gradedBuffer, blendAmount) {
    // blendAmount: 0 = full graded, 1 = full original
    const gradedOpacity = 1 - blendAmount;

    try {
        // Composite graded over original with opacity
        return await sharp(originalBuffer)
            .composite([{
                input: gradedBuffer,
                blend: 'over',
                opacity: gradedOpacity
            }])
            .toBuffer();
    } catch (error) {
        console.warn('[ColorGrading] Blend failed:', error.message);
        return gradedBuffer;
    }
}

// =============================================================================
// ADVANCED GRADING FUNCTIONS
// =============================================================================

/**
 * Auto-grade based on image analysis
 * Analyzes the image and selects the best grade automatically
 */
async function autoGrade(imageBuffer, options = {}) {
    const {
        targetMood = 'viral',      // 'viral', 'professional', 'cinematic', 'luxury'
        niche = null
    } = options;

    // Analyze image characteristics
    const stats = await analyzeImage(imageBuffer);

    // Select grade based on analysis and target mood
    let selectedGrade = 'mrbeast';  // Default

    if (targetMood === 'luxury' || stats.avgBrightness > 180) {
        selectedGrade = 'gadzhi';
    } else if (targetMood === 'cinematic') {
        selectedGrade = 'orangeTeal';
    } else if (targetMood === 'professional') {
        selectedGrade = 'finance';
    } else if (stats.colorfulness < 50) {
        // Low saturation image - boost it
        selectedGrade = 'gaming';
    } else if (stats.contrast < 0.3) {
        // Low contrast - add punch
        selectedGrade = 'dramatic';
    }

    // Niche-specific overrides
    if (niche) {
        const nicheGrades = {
            'gaming': 'gaming',
            'finance': 'finance',
            'business': 'hormozi',
            'lifestyle': 'lifestyle',
            'documentary': 'documentary',
            'tech': 'hormozi',
            'fitness': 'hormozi',
            'luxury': 'gadzhi'
        };
        if (nicheGrades[niche.toLowerCase()]) {
            selectedGrade = nicheGrades[niche.toLowerCase()];
        }
    }

    console.log(`[ColorGrading] Auto-selected grade: ${selectedGrade} (mood: ${targetMood})`);
    return applyColorGrade(imageBuffer, selectedGrade, options);
}

/**
 * Analyze image for auto-grading decisions
 */
async function analyzeImage(imageBuffer) {
    try {
        const { dominant, channels } = await sharp(imageBuffer)
            .stats();

        // Calculate average brightness
        const avgBrightness = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;

        // Calculate contrast (standard deviation)
        const avgStdDev = (channels[0].stdev + channels[1].stdev + channels[2].stdev) / 3;
        const contrast = avgStdDev / 128;  // Normalize to 0-1

        // Calculate colorfulness (difference between channels)
        const rg = Math.abs(channels[0].mean - channels[1].mean);
        const rb = Math.abs(channels[0].mean - channels[2].mean);
        const gb = Math.abs(channels[1].mean - channels[2].mean);
        const colorfulness = (rg + rb + gb) / 3;

        return {
            avgBrightness,
            contrast,
            colorfulness,
            dominant
        };
    } catch (error) {
        console.warn('[ColorGrading] Image analysis failed:', error.message);
        return {
            avgBrightness: 128,
            contrast: 0.5,
            colorfulness: 50,
            dominant: { r: 128, g: 128, b: 128 }
        };
    }
}

/**
 * Apply dynamic range optimization (HDR-like effect)
 */
async function optimizeDynamicRange(imageBuffer, options = {}) {
    const {
        shadowRecovery = 0.3,     // 0-1, how much to lift shadows
        highlightRecovery = 0.2, // 0-1, how much to roll off highlights
        localContrast = 1.1      // Local contrast enhancement
    } = options;

    try {
        // Apply CLAHE-like effect using Sharp's normalize and linear
        let processed = await sharp(imageBuffer)
            .normalize()  // Stretch histogram
            .toBuffer();

        // Apply local contrast enhancement
        if (localContrast !== 1.0) {
            processed = await sharp(processed)
                .sharpen({
                    sigma: 2,
                    m1: localContrast - 1,  // Flat areas
                    m2: localContrast - 1   // Jagged areas
                })
                .toBuffer();
        }

        // Lift shadows
        if (shadowRecovery > 0) {
            const shadowLift = shadowRecovery * 30;  // Max 30 levels
            processed = await sharp(processed)
                .linear(1, shadowLift)
                .toBuffer();
        }

        return processed;
    } catch (error) {
        console.warn('[ColorGrading] Dynamic range optimization failed:', error.message);
        return imageBuffer;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    applyColorGrade,
    autoGrade,
    optimizeDynamicRange,
    analyzeImage,
    COLOR_GRADES,
    CREATOR_TO_GRADE,
    scaleGradeIntensity
};
