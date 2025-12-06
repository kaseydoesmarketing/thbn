/**
 * ============================================================================
 * ThumbnailBuilder V8 — Heuristics Checker
 * ============================================================================
 *
 * Analyzes generated thumbnails against viral thumbnail best practices:
 * - Face dominance
 * - Text readability at small sizes
 * - Contrast levels
 * - Subject-background separation
 * - Logo sizing
 *
 * Returns a score and detailed pass/fail for each check.
 */

const sharp = require('sharp');
const { contrastRatio, sampleBackgroundColors, relativeLuminance } = require('./textLayoutEngineV8');

// =============================================================================
// CONSTANTS
// =============================================================================

const MOBILE_THUMBNAIL_SIZE = { width: 168, height: 94 };
const FULL_SIZE = { width: 1920, height: 1080 };

// Heuristic thresholds
const THRESHOLDS = {
    faceDominance: {
        minPercent: 12,     // Face should be at least 12% of image area
        idealPercent: 25    // Ideal is 25%+ for viral thumbnails
    },
    textReadability: {
        minContrast: 3.0,   // WCAG large text minimum
        idealContrast: 4.5  // WCAG AA standard
    },
    separation: {
        minScore: 35,       // Minimum separation score
        idealScore: 60      // Good separation score
    },
    logoSize: {
        maxPercent: 10,     // Logos should be under 10% of image
        idealPercent: 6     // Ideal is around 6%
    }
};

// Heuristic weights for overall score
const WEIGHTS = {
    faceDominant: 30,        // Most important
    textReadable: 25,        // Critical for CTR
    highContrast: 20,        // Important for visibility
    subjectSeparated: 15,    // Professional look
    logosLegible: 10         // Minor but matters
};

// =============================================================================
// INDIVIDUAL CHECKS
// =============================================================================

/**
 * Check if face is dominant in the thumbnail
 * @param {Buffer} imageBuffer - Image to analyze
 * @param {Object} faceData - Optional face detection data
 * @returns {Object} Check result
 */
async function checkFaceDominance(imageBuffer, faceData = null) {
    // If we have face detection data, use it
    if (faceData && faceData.bounds) {
        const imageArea = FULL_SIZE.width * FULL_SIZE.height;
        const faceArea = faceData.bounds.width * faceData.bounds.height;
        const facePercent = (faceArea / imageArea) * 100;

        return {
            passed: facePercent >= THRESHOLDS.faceDominance.minPercent,
            score: Math.min(100, (facePercent / THRESHOLDS.faceDominance.idealPercent) * 100),
            details: {
                facePercent: Math.round(facePercent * 10) / 10,
                threshold: THRESHOLDS.faceDominance.minPercent,
                ideal: THRESHOLDS.faceDominance.idealPercent
            },
            message: facePercent >= THRESHOLDS.faceDominance.idealPercent
                ? 'Face is prominently featured'
                : facePercent >= THRESHOLDS.faceDominance.minPercent
                    ? 'Face is visible but could be larger'
                    : 'Face is too small - increase subject scale'
        };
    }

    // Fallback: Analyze image for skin tones as proxy for face
    try {
        const { data, info } = await sharp(imageBuffer)
            .resize(100, 56, { fit: 'cover' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        let skinTonePixels = 0;
        const totalPixels = info.width * info.height;

        for (let i = 0; i < data.length; i += 3) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Simple skin tone detection (works for various skin tones)
            if (isSkinTone(r, g, b)) {
                skinTonePixels++;
            }
        }

        const skinPercent = (skinTonePixels / totalPixels) * 100;
        // Skin coverage of 8%+ usually indicates visible face
        const estimatedFacePercent = skinPercent * 1.5; // Rough estimate

        return {
            passed: estimatedFacePercent >= THRESHOLDS.faceDominance.minPercent,
            score: Math.min(100, (estimatedFacePercent / THRESHOLDS.faceDominance.idealPercent) * 100),
            details: {
                estimatedFacePercent: Math.round(estimatedFacePercent * 10) / 10,
                skinTonePercent: Math.round(skinPercent * 10) / 10,
                method: 'skin-tone-analysis'
            },
            message: estimatedFacePercent >= THRESHOLDS.faceDominance.minPercent
                ? 'Face appears to be present and visible'
                : 'Face may be too small or not clearly visible'
        };
    } catch (err) {
        console.error('[HeuristicsChecker] Face dominance check failed:', err);
        return {
            passed: false,
            score: 0,
            details: { error: err.message },
            message: 'Could not analyze face dominance'
        };
    }
}

/**
 * Detect if RGB values represent skin tone
 */
function isSkinTone(r, g, b) {
    // Multiple skin tone ranges to be inclusive
    const ranges = [
        // Light skin
        { r: [180, 255], g: [130, 200], b: [100, 180] },
        // Medium skin
        { r: [140, 200], g: [90, 150], b: [60, 120] },
        // Dark skin
        { r: [80, 160], g: [50, 120], b: [30, 90] },
        // Very dark skin
        { r: [50, 100], g: [30, 80], b: [20, 60] }
    ];

    return ranges.some(range =>
        r >= range.r[0] && r <= range.r[1] &&
        g >= range.g[0] && g <= range.g[1] &&
        b >= range.b[0] && b <= range.b[1] &&
        r > g && g > b // Typical skin: R > G > B
    );
}

/**
 * Check if text is readable at mobile thumbnail size
 * @param {Buffer} imageBuffer - Image to analyze
 * @param {Object} textData - Text bounds and color
 * @returns {Object} Check result
 */
async function checkTextReadability(imageBuffer, textData) {
    if (!textData || !textData.bounds) {
        return {
            passed: true, // No text = passes by default
            score: 100,
            details: { hasText: false },
            message: 'No text to evaluate'
        };
    }

    try {
        // Scale bounds to mobile size
        const scaleX = MOBILE_THUMBNAIL_SIZE.width / FULL_SIZE.width;
        const scaleY = MOBILE_THUMBNAIL_SIZE.height / FULL_SIZE.height;

        const mobileBounds = {
            x: textData.bounds.x * scaleX,
            y: textData.bounds.y * scaleY,
            width: textData.bounds.width * scaleX,
            height: textData.bounds.height * scaleY
        };

        // Check if text area is large enough to be readable
        const mobileTextHeight = mobileBounds.height;
        const minReadableHeight = 8; // Minimum ~8px for readability

        // Get background color under text at mobile size
        const mobileBuffer = await sharp(imageBuffer)
            .resize(MOBILE_THUMBNAIL_SIZE.width, MOBILE_THUMBNAIL_SIZE.height, { fit: 'cover' })
            .toBuffer();

        const bgColor = await sampleBackgroundColors(mobileBuffer, mobileBounds, 5);
        const textColor = textData.color || '#FFFFFF';
        const contrast = contrastRatio(textColor, bgColor);

        const heightOk = mobileTextHeight >= minReadableHeight;
        const contrastOk = contrast >= THRESHOLDS.textReadability.minContrast;

        return {
            passed: heightOk && contrastOk,
            score: Math.min(100,
                (heightOk ? 50 : 0) +
                (contrastOk ? (contrast / THRESHOLDS.textReadability.idealContrast) * 50 : 0)
            ),
            details: {
                mobileTextHeight: Math.round(mobileTextHeight * 10) / 10,
                minHeight: minReadableHeight,
                contrast: Math.round(contrast * 10) / 10,
                minContrast: THRESHOLDS.textReadability.minContrast,
                bgColor,
                textColor
            },
            message: !heightOk
                ? 'Text too small at mobile size'
                : !contrastOk
                    ? 'Text contrast too low for mobile viewing'
                    : 'Text is readable at mobile size'
        };
    } catch (err) {
        console.error('[HeuristicsChecker] Text readability check failed:', err);
        return {
            passed: false,
            score: 0,
            details: { error: err.message },
            message: 'Could not analyze text readability'
        };
    }
}

/**
 * Check overall image contrast
 * @param {Buffer} imageBuffer - Image to analyze
 * @param {Object} textData - Text color data
 * @returns {Object} Check result
 */
async function checkHighContrast(imageBuffer, textData) {
    if (!textData || !textData.color || !textData.bounds) {
        // Analyze general image contrast
        try {
            const { data } = await sharp(imageBuffer)
                .resize(50, 28, { fit: 'cover' })
                .greyscale()
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Calculate contrast range
            let min = 255, max = 0;
            for (let i = 0; i < data.length; i++) {
                min = Math.min(min, data[i]);
                max = Math.max(max, data[i]);
            }

            const contrastRange = max - min;
            const highContrast = contrastRange > 150;

            return {
                passed: highContrast,
                score: Math.min(100, (contrastRange / 255) * 100),
                details: {
                    contrastRange,
                    min,
                    max,
                    method: 'luminance-range'
                },
                message: highContrast
                    ? 'Image has good overall contrast'
                    : 'Image may appear flat - consider increasing contrast'
            };
        } catch (err) {
            return {
                passed: false,
                score: 0,
                details: { error: err.message },
                message: 'Could not analyze contrast'
            };
        }
    }

    // Use text contrast data
    const contrast = textData.contrast || 0;
    return {
        passed: contrast >= THRESHOLDS.textReadability.minContrast,
        score: Math.min(100, (contrast / THRESHOLDS.textReadability.idealContrast) * 100),
        details: {
            textContrast: contrast,
            threshold: THRESHOLDS.textReadability.minContrast,
            ideal: THRESHOLDS.textReadability.idealContrast
        },
        message: contrast >= THRESHOLDS.textReadability.idealContrast
            ? 'Excellent text/background contrast'
            : contrast >= THRESHOLDS.textReadability.minContrast
                ? 'Acceptable contrast, could be improved'
                : 'Low contrast - text may be hard to read'
    };
}

/**
 * Check subject-background separation
 * @param {Buffer} imageBuffer - Image to analyze
 * @param {Object} subjectData - Subject bounds
 * @returns {Object} Check result
 */
async function checkSubjectSeparation(imageBuffer, subjectData = null) {
    try {
        // Sample colors from center (likely subject) and edges (likely background)
        const { data, info } = await sharp(imageBuffer)
            .resize(100, 56, { fit: 'cover' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Sample center region (subject area)
        const centerColors = [];
        const edgeColors = [];

        for (let y = 0; y < info.height; y++) {
            for (let x = 0; x < info.width; x++) {
                const idx = (y * info.width + x) * 3;
                const color = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };

                // Center region (middle 60%)
                const inCenter = x >= info.width * 0.2 && x <= info.width * 0.8 &&
                    y >= info.height * 0.2 && y <= info.height * 0.8;

                if (inCenter) {
                    centerColors.push(color);
                } else {
                    edgeColors.push(color);
                }
            }
        }

        // Calculate average colors
        const avgCenter = averageColor(centerColors);
        const avgEdge = averageColor(edgeColors);

        // Calculate color distance
        const distance = Math.sqrt(
            Math.pow(avgCenter.r - avgEdge.r, 2) +
            Math.pow(avgCenter.g - avgEdge.g, 2) +
            Math.pow(avgCenter.b - avgEdge.b, 2)
        );

        // Normalize to 0-100 score
        const separationScore = Math.min(100, (distance / 255) * 100 * 1.5);
        const passed = separationScore >= THRESHOLDS.separation.minScore;

        return {
            passed,
            score: separationScore,
            details: {
                colorDistance: Math.round(distance),
                avgCenterColor: rgbToHex(avgCenter.r, avgCenter.g, avgCenter.b),
                avgEdgeColor: rgbToHex(avgEdge.r, avgEdge.g, avgEdge.b),
                threshold: THRESHOLDS.separation.minScore
            },
            message: separationScore >= THRESHOLDS.separation.idealScore
                ? 'Subject is clearly separated from background'
                : passed
                    ? 'Acceptable separation, could be improved with rim lighting'
                    : 'Subject blends into background - needs better separation'
        };
    } catch (err) {
        console.error('[HeuristicsChecker] Separation check failed:', err);
        return {
            passed: false,
            score: 0,
            details: { error: err.message },
            message: 'Could not analyze subject separation'
        };
    }
}

function averageColor(colors) {
    const sum = colors.reduce((acc, c) => ({
        r: acc.r + c.r,
        g: acc.g + c.g,
        b: acc.b + c.b
    }), { r: 0, g: 0, b: 0 });

    return {
        r: Math.round(sum.r / colors.length),
        g: Math.round(sum.g / colors.length),
        b: Math.round(sum.b / colors.length)
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Check if logos are legible but not dominant
 * @param {Object} logoData - Logo bounds
 * @returns {Object} Check result
 */
function checkLogosLegible(logoData) {
    if (!logoData || !logoData.bounds) {
        return {
            passed: true,
            score: 100,
            details: { hasLogos: false },
            message: 'No logos to evaluate'
        };
    }

    const imageArea = FULL_SIZE.width * FULL_SIZE.height;
    const logoArea = logoData.bounds.width * logoData.bounds.height;
    const logoPercent = (logoArea / imageArea) * 100;

    const passed = logoPercent <= THRESHOLDS.logoSize.maxPercent;
    const ideal = logoPercent <= THRESHOLDS.logoSize.idealPercent;

    return {
        passed,
        score: passed ? (ideal ? 100 : 70) : 30,
        details: {
            logoPercent: Math.round(logoPercent * 10) / 10,
            maxPercent: THRESHOLDS.logoSize.maxPercent,
            idealPercent: THRESHOLDS.logoSize.idealPercent
        },
        message: ideal
            ? 'Logo is appropriately sized'
            : passed
                ? 'Logo is visible but slightly large'
                : 'Logo is too large - may compete with subject'
    };
}

// =============================================================================
// MAIN CHECK FUNCTION
// =============================================================================

/**
 * Run all heuristic checks on a thumbnail
 * @param {Buffer} imageBuffer - Generated thumbnail image
 * @param {Object} metadata - Generation metadata (text, face, logo data)
 * @returns {Promise<Object>} Complete heuristics report
 */
async function runHeuristicsCheck(imageBuffer, metadata = {}) {
    const {
        textData = null,
        faceData = null,
        logoData = null,
        subjectData = null
    } = metadata;

    // Run all checks
    const results = {
        faceDominant: await checkFaceDominance(imageBuffer, faceData),
        textReadable: await checkTextReadability(imageBuffer, textData),
        highContrast: await checkHighContrast(imageBuffer, textData),
        subjectSeparated: await checkSubjectSeparation(imageBuffer, subjectData),
        logosLegible: checkLogosLegible(logoData)
    };

    // Calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;
    let passedCount = 0;

    for (const [key, result] of Object.entries(results)) {
        const weight = WEIGHTS[key] || 10;
        totalScore += result.score * weight;
        totalWeight += weight;
        if (result.passed) passedCount++;
    }

    const overallScore = Math.round(totalScore / totalWeight);
    const allPassed = passedCount === Object.keys(results).length;

    // Generate summary
    const failedChecks = Object.entries(results)
        .filter(([_, r]) => !r.passed)
        .map(([key, r]) => ({ check: key, message: r.message }));

    const recommendations = failedChecks.map(f => {
        switch (f.check) {
            case 'faceDominant':
                return 'Increase subject scale or move camera closer';
            case 'textReadable':
                return 'Increase text size or improve text contrast';
            case 'highContrast':
                return 'Add text outline or backing for better visibility';
            case 'subjectSeparated':
                return 'Add rim lighting or darken background behind subject';
            case 'logosLegible':
                return 'Reduce logo size to make subject more prominent';
            default:
                return f.message;
        }
    });

    return {
        score: overallScore,
        passedCount,
        totalChecks: Object.keys(results).length,
        allPassed,
        results,
        failedChecks,
        recommendations,
        summary: allPassed
            ? 'Thumbnail meets all viral heuristics'
            : `${failedChecks.length} issue(s) found - see recommendations`
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    runHeuristicsCheck,
    checkFaceDominance,
    checkTextReadability,
    checkHighContrast,
    checkSubjectSeparation,
    checkLogosLegible,
    THRESHOLDS,
    WEIGHTS
};
