/**
 * ============================================================================
 * ThumbnailBuilder - Multi-Pass Quality Scoring Service
 * ============================================================================
 *
 * Generates multiple thumbnail variants internally, scores them using AI-like
 * heuristics, and returns only the BEST outputs to the user.
 *
 * Scoring Criteria:
 * - Face quality (clarity, expression visibility)
 * - Composition (rule of thirds, balance)
 * - Text readability potential (contrast zones)
 * - Color harmony
 * - Technical quality (sharpness, noise)
 * - Style adherence
 *
 * This ensures users NEVER see mediocre outputs.
 */

const sharp = require('sharp');
const { analyzeComposition } = require('./compositionAnalysisService');

// =============================================================================
// QUALITY SCORING WEIGHTS
// =============================================================================

const SCORING_WEIGHTS = {
    faceQuality: 0.25,        // Face clarity, expression, positioning
    composition: 0.20,        // Rule of thirds, balance, focus
    textReadability: 0.20,    // Contrast zones, negative space for text
    colorHarmony: 0.15,       // Color balance, saturation, vibrancy
    technicalQuality: 0.10,   // Sharpness, noise levels
    styleAdherence: 0.10      // Matches requested style characteristics
};

// Style-specific scoring adjustments
const STYLE_SCORING_ADJUSTMENTS = {
    mrbeast: {
        preferHighSaturation: true,
        preferHighContrast: true,
        preferBrightColors: true,
        faceImportance: 'high'
    },
    hormozi: {
        preferHighContrast: true,
        preferCleanBackground: true,
        preferCenterFace: true,
        faceImportance: 'high'
    },
    gadzhi: {
        preferLowSaturation: true,
        preferCleanBackground: true,
        preferMinimalist: true,
        faceImportance: 'high'
    },
    gaming: {
        preferHighSaturation: true,
        preferVibrantColors: true,
        preferDynamicComposition: true,
        faceImportance: 'medium'
    },
    documentary: {
        preferCinematicColors: true,
        preferFilmGrain: false,
        preferDramaticLighting: true,
        faceImportance: 'medium'
    }
};

// =============================================================================
// QUALITY SCORING FUNCTIONS
// =============================================================================

/**
 * Score a generated thumbnail image
 * @param {Buffer} imageBuffer - Generated image buffer
 * @param {Object} options - Scoring options
 * @returns {Promise<Object>} Quality scores
 */
async function scoreImage(imageBuffer, options = {}) {
    const {
        creatorStyle = 'default',
        hasFace = false,
        targetText = '',
        niche = null
    } = options;

    console.log('[QualityScoring] Analyzing image quality...');

    try {
        // Run all scoring analyses in parallel
        const [
            technicalScores,
            compositionScores,
            colorScores,
            textZoneScores
        ] = await Promise.all([
            analyzeTechnicalQuality(imageBuffer),
            analyzeCompositionQuality(imageBuffer, { hasFace }),
            analyzeColorQuality(imageBuffer, creatorStyle),
            analyzeTextZones(imageBuffer)
        ]);

        // Get style adjustments
        const styleAdjust = STYLE_SCORING_ADJUSTMENTS[creatorStyle.toLowerCase()] || {};

        // Calculate weighted scores
        let faceScore = hasFace ? compositionScores.faceScore : 75;  // Default if no face
        let compositionScore = compositionScores.overallScore;
        let textReadabilityScore = textZoneScores.score;
        let colorHarmonyScore = colorScores.harmonyScore;
        let technicalScore = technicalScores.overallScore;
        let styleScore = calculateStyleAdherence(colorScores, compositionScores, styleAdjust);

        // Apply style-specific adjustments
        if (styleAdjust.preferHighSaturation && colorScores.saturation > 120) {
            colorHarmonyScore += 10;
        }
        if (styleAdjust.preferHighContrast && technicalScores.contrast > 60) {
            technicalScore += 10;
        }
        if (styleAdjust.faceImportance === 'high' && hasFace) {
            faceScore *= 1.2;  // Boost face importance
        }

        // Calculate final weighted score
        const finalScore =
            (faceScore * SCORING_WEIGHTS.faceQuality) +
            (compositionScore * SCORING_WEIGHTS.composition) +
            (textReadabilityScore * SCORING_WEIGHTS.textReadability) +
            (colorHarmonyScore * SCORING_WEIGHTS.colorHarmony) +
            (technicalScore * SCORING_WEIGHTS.technicalQuality) +
            (styleScore * SCORING_WEIGHTS.styleAdherence);

        // Normalize to 0-100
        const normalizedScore = Math.min(100, Math.max(0, finalScore));

        console.log(`[QualityScoring] Final score: ${normalizedScore.toFixed(1)}/100`);

        return {
            finalScore: normalizedScore,
            breakdown: {
                face: Math.round(faceScore),
                composition: Math.round(compositionScore),
                textReadability: Math.round(textReadabilityScore),
                colorHarmony: Math.round(colorHarmonyScore),
                technical: Math.round(technicalScore),
                style: Math.round(styleScore)
            },
            details: {
                technical: technicalScores,
                composition: compositionScores,
                color: colorScores,
                textZones: textZoneScores
            },
            recommendation: getScoreRecommendation(normalizedScore)
        };

    } catch (error) {
        console.error('[QualityScoring] Analysis failed:', error.message);
        // Return neutral score on error
        return {
            finalScore: 70,
            breakdown: {
                face: 70,
                composition: 70,
                textReadability: 70,
                colorHarmony: 70,
                technical: 70,
                style: 70
            },
            details: {},
            recommendation: 'analysis-failed'
        };
    }
}

/**
 * Analyze technical quality (sharpness, noise, exposure)
 */
async function analyzeTechnicalQuality(imageBuffer) {
    try {
        const { channels, isOpaque } = await sharp(imageBuffer)
            .stats();

        // Calculate contrast from channel standard deviations
        const avgStdDev = channels.reduce((sum, c) => sum + c.stdev, 0) / channels.length;
        const contrast = avgStdDev;  // Higher = more contrast

        // Calculate brightness from means
        const avgBrightness = channels.reduce((sum, c) => sum + c.mean, 0) / channels.length;

        // Sharpness estimate from entropy (higher entropy = more detail)
        const entropy = await estimateSharpness(imageBuffer);

        // Exposure score (penalize too dark or too bright)
        let exposureScore = 100;
        if (avgBrightness < 50) exposureScore -= (50 - avgBrightness);
        if (avgBrightness > 200) exposureScore -= (avgBrightness - 200);

        // Contrast score (prefer medium-high contrast)
        let contrastScore = 70;
        if (contrast > 40 && contrast < 80) contrastScore = 90;
        else if (contrast >= 80) contrastScore = 85;
        else if (contrast < 30) contrastScore = 60;

        // Sharpness score
        const sharpnessScore = Math.min(100, entropy * 15);

        const overallScore = (exposureScore * 0.3 + contrastScore * 0.35 + sharpnessScore * 0.35);

        return {
            contrast,
            brightness: avgBrightness,
            sharpness: entropy,
            exposureScore,
            contrastScore,
            sharpnessScore,
            overallScore
        };

    } catch (error) {
        console.warn('[QualityScoring] Technical analysis failed:', error.message);
        return {
            contrast: 50,
            brightness: 128,
            sharpness: 5,
            exposureScore: 70,
            contrastScore: 70,
            sharpnessScore: 70,
            overallScore: 70
        };
    }
}

/**
 * Estimate image sharpness using edge detection
 */
async function estimateSharpness(imageBuffer) {
    try {
        // Apply Laplacian-like filter and measure variance
        const edges = await sharp(imageBuffer)
            .greyscale()
            .convolve({
                width: 3,
                height: 3,
                kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
            })
            .raw()
            .toBuffer();

        // Calculate variance of edge response
        const mean = edges.reduce((sum, v) => sum + v, 0) / edges.length;
        const variance = edges.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / edges.length;

        return Math.sqrt(variance) / 10;  // Normalize
    } catch (error) {
        return 5;  // Default middle value
    }
}

/**
 * Analyze composition quality
 */
async function analyzeCompositionQuality(imageBuffer, options = {}) {
    const { hasFace } = options;

    try {
        // Use composition analysis service
        const analysis = await analyzeComposition(imageBuffer, {
            textLength: 10,
            fontSize: 160
        });

        // Score based on negative space availability
        const negativeSpaceScore = analysis.negativeSpace.length > 0
            ? Math.min(100, analysis.negativeSpace[0].uniformity + 20)
            : 60;

        // Score based on focal point clarity
        const focalPointScore = analysis.focalPoints.length > 0
            ? Math.min(100, 60 + analysis.focalPoints[0].strength / 2)
            : 70;

        // Face score (if face expected)
        let faceScore = 75;
        if (hasFace && analysis.focalPoints.length > 0) {
            // Check if there's a clear focal point in face region (upper half)
            const upperFocalPoints = analysis.focalPoints.filter(fp => fp.y < analysis.imageSize.height * 0.5);
            faceScore = upperFocalPoints.length > 0 ? 85 : 65;
        }

        // Composition balance score
        const balanceScore = calculateBalanceScore(analysis.focalPoints, analysis.imageSize);

        const overallScore = (negativeSpaceScore * 0.3 + focalPointScore * 0.3 + balanceScore * 0.4);

        return {
            negativeSpaceScore,
            focalPointScore,
            balanceScore,
            faceScore,
            overallScore,
            negativeSpaceCount: analysis.negativeSpace.length,
            focalPointCount: analysis.focalPoints.length
        };

    } catch (error) {
        console.warn('[QualityScoring] Composition analysis failed:', error.message);
        return {
            negativeSpaceScore: 70,
            focalPointScore: 70,
            balanceScore: 70,
            faceScore: 70,
            overallScore: 70,
            negativeSpaceCount: 0,
            focalPointCount: 0
        };
    }
}

/**
 * Calculate balance score based on focal point distribution
 */
function calculateBalanceScore(focalPoints, imageSize) {
    if (focalPoints.length === 0) return 70;

    // Calculate center of mass of focal points
    const totalStrength = focalPoints.reduce((sum, fp) => sum + fp.strength, 0);
    const centerX = focalPoints.reduce((sum, fp) => sum + fp.x * fp.strength, 0) / totalStrength;
    const centerY = focalPoints.reduce((sum, fp) => sum + fp.y * fp.strength, 0) / totalStrength;

    // Ideal center is slightly off-center (rule of thirds)
    const idealX = imageSize.width * 0.4;  // Slightly left of center
    const idealY = imageSize.height * 0.45; // Slightly above center

    const distanceFromIdeal = Math.sqrt(
        Math.pow(centerX - idealX, 2) + Math.pow(centerY - idealY, 2)
    );

    const maxDistance = Math.sqrt(Math.pow(imageSize.width, 2) + Math.pow(imageSize.height, 2)) / 2;
    const balanceScore = 100 - (distanceFromIdeal / maxDistance) * 50;

    return Math.max(50, balanceScore);
}

/**
 * Analyze color quality and harmony
 */
async function analyzeColorQuality(imageBuffer, creatorStyle) {
    try {
        const { dominant, channels } = await sharp(imageBuffer).stats();

        // Calculate saturation from channel spread
        const avgMean = channels.reduce((sum, c) => sum + c.mean, 0) / 3;
        const colorSpread = Math.max(
            Math.abs(channels[0].mean - avgMean),
            Math.abs(channels[1].mean - avgMean),
            Math.abs(channels[2].mean - avgMean)
        );
        const saturation = colorSpread * 2;  // Approximate saturation

        // Calculate vibrancy (weighted saturation favoring less saturated colors)
        const vibrancy = saturation * (1 - saturation / 255);

        // Color harmony score (based on dominant color relationships)
        let harmonyScore = 75;

        // Boost for complementary colors (rough approximation)
        const rg = Math.abs(channels[0].mean - channels[1].mean);
        const rb = Math.abs(channels[0].mean - channels[2].mean);
        const gb = Math.abs(channels[1].mean - channels[2].mean);

        if (rg > 50 || rb > 50 || gb > 50) {
            harmonyScore += 10;  // Has color variety
        }

        // Style-specific color scoring
        const styleAdjust = STYLE_SCORING_ADJUSTMENTS[creatorStyle?.toLowerCase()] || {};

        if (styleAdjust.preferHighSaturation && saturation > 80) {
            harmonyScore += 10;
        }
        if (styleAdjust.preferLowSaturation && saturation < 60) {
            harmonyScore += 10;
        }
        if (styleAdjust.preferVibrantColors && vibrancy > 30) {
            harmonyScore += 10;
        }

        return {
            saturation,
            vibrancy,
            dominant,
            harmonyScore: Math.min(100, harmonyScore),
            colorSpread
        };

    } catch (error) {
        console.warn('[QualityScoring] Color analysis failed:', error.message);
        return {
            saturation: 100,
            vibrancy: 50,
            dominant: { r: 128, g: 128, b: 128 },
            harmonyScore: 70,
            colorSpread: 50
        };
    }
}

/**
 * Analyze text placement zones
 */
async function analyzeTextZones(imageBuffer) {
    try {
        const analysis = await analyzeComposition(imageBuffer, {
            textLength: 10,
            fontSize: 160
        });

        // Score based on text position quality
        const bestPosition = analysis.bestPosition;
        let score = bestPosition.score;

        // Boost for positions with high confidence
        if (analysis.confidence > 0.7) score += 10;

        // Boost for good text color contrast
        if (analysis.textColor.bgLuminance < 0.3 || analysis.textColor.bgLuminance > 0.7) {
            score += 10;  // Good contrast potential
        }

        return {
            score: Math.min(100, score),
            bestPosition,
            textColorRecommendation: analysis.textColor,
            confidence: analysis.confidence
        };

    } catch (error) {
        console.warn('[QualityScoring] Text zone analysis failed:', error.message);
        return {
            score: 70,
            bestPosition: { x: 960, y: 300, anchor: 'middle' },
            textColorRecommendation: { primary: '#FFFFFF', stroke: '#000000' },
            confidence: 0.5
        };
    }
}

/**
 * Calculate style adherence score
 */
function calculateStyleAdherence(colorScores, compositionScores, styleAdjust) {
    let score = 70;

    if (styleAdjust.preferHighSaturation) {
        score += colorScores.saturation > 100 ? 15 : -5;
    }
    if (styleAdjust.preferHighContrast) {
        score += colorScores.colorSpread > 40 ? 15 : -5;
    }
    if (styleAdjust.preferCleanBackground) {
        score += compositionScores.negativeSpaceCount > 3 ? 15 : -5;
    }
    if (styleAdjust.faceImportance === 'high') {
        score += compositionScores.focalPointCount > 0 ? 10 : -10;
    }

    return Math.max(50, Math.min(100, score));
}

/**
 * Get recommendation based on score
 */
function getScoreRecommendation(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 55) return 'acceptable';
    if (score >= 40) return 'needs-improvement';
    return 'poor';
}

// =============================================================================
// MULTI-PASS SELECTION
// =============================================================================

/**
 * Generate multiple variants and select the best ones
 * @param {Function} generateFn - Function that generates a single variant
 * @param {Object} options - Options for generation and selection
 * @returns {Promise<Array>} Best variants sorted by score
 */
async function generateAndSelectBest(generateFn, options = {}) {
    const {
        numToGenerate = 4,     // Generate this many internally
        numToReturn = 2,       // Return this many to user
        creatorStyle = 'default',
        hasFace = false,
        minScore = 50          // Minimum acceptable score
    } = options;

    console.log(`[QualityScoring] Generating ${numToGenerate} variants, selecting best ${numToReturn}...`);

    // Generate all variants
    const variants = [];
    for (let i = 0; i < numToGenerate; i++) {
        try {
            console.log(`[QualityScoring] Generating variant ${i + 1}/${numToGenerate}...`);
            const result = await generateFn(i);

            // Score the variant
            const score = await scoreImage(result.imageBuffer, {
                creatorStyle,
                hasFace
            });

            variants.push({
                ...result,
                score: score.finalScore,
                scoreBreakdown: score.breakdown,
                recommendation: score.recommendation,
                variantIndex: i
            });

        } catch (error) {
            console.error(`[QualityScoring] Variant ${i + 1} failed:`, error.message);
        }
    }

    if (variants.length === 0) {
        throw new Error('All variant generations failed');
    }

    // Sort by score descending
    variants.sort((a, b) => b.score - a.score);

    // Filter by minimum score
    const acceptableVariants = variants.filter(v => v.score >= minScore);

    // Return best N variants
    const selectedVariants = (acceptableVariants.length >= numToReturn
        ? acceptableVariants
        : variants
    ).slice(0, numToReturn);

    console.log(`[QualityScoring] Selected ${selectedVariants.length} variants:`);
    selectedVariants.forEach((v, i) => {
        console.log(`  ${i + 1}. Score: ${v.score.toFixed(1)} (${v.recommendation})`);
    });

    return selectedVariants;
}

/**
 * Compare two images and return the better one
 */
async function compareTwoImages(imageA, imageB, options = {}) {
    const [scoreA, scoreB] = await Promise.all([
        scoreImage(imageA, options),
        scoreImage(imageB, options)
    ]);

    return {
        winner: scoreA.finalScore >= scoreB.finalScore ? 'A' : 'B',
        winnerBuffer: scoreA.finalScore >= scoreB.finalScore ? imageA : imageB,
        scoreA: scoreA.finalScore,
        scoreB: scoreB.finalScore,
        margin: Math.abs(scoreA.finalScore - scoreB.finalScore)
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    scoreImage,
    generateAndSelectBest,
    compareTwoImages,
    analyzeTechnicalQuality,
    analyzeCompositionQuality,
    analyzeColorQuality,
    analyzeTextZones,
    SCORING_WEIGHTS,
    STYLE_SCORING_ADJUSTMENTS
};
