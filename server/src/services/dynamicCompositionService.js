/**
 * Dynamic Composition Service - Tier 3
 *
 * AI-powered subject positioning and rule-of-thirds optimization
 * - Subject detection (faces, objects)
 * - Rule of thirds calculation
 * - Golden ratio analysis
 * - Safe zone validation
 * - Smart repositioning
 * - Composition scoring (0-100)
 *
 * @module dynamicCompositionService
 */

const sharp = require('sharp');

// =============================================================================
// COMPOSITION RULES
// =============================================================================

const COMPOSITION_RULES = {
    ruleOfThirds: {
        enabled: true,
        weight: 0.4,
        description: 'Subject positioned at 1/3 or 2/3 grid intersection'
    },
    goldenRatio: {
        enabled: true,
        weight: 0.3,
        description: 'Subject positioned at golden ratio point (0.618)'
    },
    centerAlignment: {
        enabled: true,
        weight: 0.1,
        description: 'Subject vertically centered (acceptable for some content)'
    },
    visualWeight: {
        enabled: true,
        weight: 0.2,
        description: 'Subject has proper visual weight in frame'
    }
};

// =============================================================================
// GRID POSITIONS
// =============================================================================

/**
 * Calculate rule-of-thirds grid points
 */
function calculateRuleOfThirdsGrid(width, height) {
    return {
        // Vertical lines (1/3 and 2/3)
        vertical: [
            Math.round(width / 3),
            Math.round((width * 2) / 3)
        ],
        // Horizontal lines (1/3 and 2/3)
        horizontal: [
            Math.round(height / 3),
            Math.round((height * 2) / 3)
        ],
        // Intersection points (power points)
        intersections: [
            // Top intersections
            { x: Math.round(width / 3), y: Math.round(height / 3), name: 'topLeft' },
            { x: Math.round((width * 2) / 3), y: Math.round(height / 3), name: 'topRight' },
            // Bottom intersections
            { x: Math.round(width / 3), y: Math.round((height * 2) / 3), name: 'bottomLeft' },
            { x: Math.round((width * 2) / 3), y: Math.round((height * 2) / 3), name: 'bottomRight' }
        ]
    };
}

/**
 * Calculate golden ratio points
 */
function calculateGoldenRatioPoints(width, height) {
    const phi = 1.618;
    const goldenRatio = 1 / phi;  // 0.618

    return {
        // Horizontal golden points
        vertical: [
            Math.round(width * goldenRatio),
            Math.round(width * (1 - goldenRatio))
        ],
        // Vertical golden points
        horizontal: [
            Math.round(height * goldenRatio),
            Math.round(height * (1 - goldenRatio))
        ],
        // Golden spiral center (right side preferred for YouTube)
        spiral: {
            x: Math.round(width * (1 - goldenRatio)),
            y: Math.round(height * goldenRatio),
            name: 'goldenSpiral'
        }
    };
}

// =============================================================================
// SUBJECT DETECTION (Simplified - No AI Model Yet)
// =============================================================================

/**
 * Detect subject in image
 * For now, uses basic image analysis (brightness, contrast)
 * TODO: Replace with TensorFlow.js face/object detection
 */
async function detectSubject(imageBuffer) {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();
        const stats = await image.stats();

        // Analyze image regions for subject detection
        // This is a simplified version - real implementation would use AI
        const width = metadata.width;
        const height = metadata.height;

        // Assume subject is in center-right (common for YouTube thumbnails)
        // This is a heuristic until we integrate proper AI detection
        const estimatedBounds = {
            x: Math.round(width * 0.4),
            y: Math.round(height * 0.25),
            width: Math.round(width * 0.4),
            height: Math.round(height * 0.5)
        };

        const centerX = estimatedBounds.x + estimatedBounds.width / 2;
        const centerY = estimatedBounds.y + estimatedBounds.height / 2;

        return {
            bounds: estimatedBounds,
            center: { x: centerX, y: centerY },
            confidence: 0.7,  // Heuristic confidence
            type: 'estimated',  // 'face', 'object', or 'estimated'
            metadata: {
                imageWidth: width,
                imageHeight: height,
                method: 'heuristic'
            }
        };

    } catch (err) {
        console.error('Subject detection failed:', err.message);
        return null;
    }
}

// =============================================================================
// COMPOSITION ANALYSIS
// =============================================================================

/**
 * Analyze composition quality
 */
function analyzeComposition(imageMetadata, subjectBounds) {
    const width = imageMetadata.width;
    const height = imageMetadata.height;

    if (!subjectBounds) {
        return {
            score: 0,
            recommendation: 'Unable to analyze - no subject detected',
            issues: ['No subject detected']
        };
    }

    const centerX = subjectBounds.center.x;
    const centerY = subjectBounds.center.y;

    let score = 0;
    const issues = [];
    const strengths = [];

    // Rule of Thirds Analysis
    const ruleOfThirds = calculateRuleOfThirdsGrid(width, height);
    const nearestIntersection = findNearestPoint(
        { x: centerX, y: centerY },
        ruleOfThirds.intersections
    );

    const distanceToIntersection = calculateDistance(
        { x: centerX, y: centerY },
        nearestIntersection
    );

    // Close to rule of thirds? (within 10% of image diagonal)
    const diagonal = Math.sqrt(width * width + height * height);
    const threshold = diagonal * 0.1;

    if (distanceToIntersection < threshold) {
        score += 40;
        strengths.push('Subject near rule-of-thirds intersection');
    } else {
        issues.push('Subject not aligned with rule-of-thirds grid');
    }

    // Golden Ratio Analysis
    const goldenRatio = calculateGoldenRatioPoints(width, height);
    const distanceToGolden = calculateDistance(
        { x: centerX, y: centerY },
        goldenRatio.spiral
    );

    if (distanceToGolden < threshold) {
        score += 30;
        strengths.push('Subject near golden ratio point');
    }

    // Visual Weight (subject size relative to frame)
    const subjectArea = subjectBounds.bounds.width * subjectBounds.bounds.height;
    const imageArea = width * height;
    const coverage = subjectArea / imageArea;

    if (coverage >= 0.2 && coverage <= 0.5) {
        score += 20;  // Good size
        strengths.push('Subject has appropriate visual weight');
    } else if (coverage < 0.2) {
        issues.push('Subject too small in frame');
        score += 5;
    } else {
        issues.push('Subject too large in frame');
        score += 10;
    }

    // Vertical Centering (acceptable for some compositions)
    const verticalCenter = height / 2;
    const verticalOffset = Math.abs(centerY - verticalCenter) / height;

    if (verticalOffset < 0.15) {
        score += 10;
        strengths.push('Subject vertically centered');
    }

    return {
        score: Math.min(score, 100),
        recommendation: score >= 70 ? 'Excellent composition' :
                        score >= 50 ? 'Good composition' :
                        score >= 30 ? 'Acceptable composition' :
                        'Poor composition - recommend repositioning',
        issues,
        strengths,
        analysis: {
            ruleOfThirds: {
                nearestPoint: nearestIntersection.name,
                distance: Math.round(distanceToIntersection),
                threshold: Math.round(threshold),
                aligned: distanceToIntersection < threshold
            },
            goldenRatio: {
                distance: Math.round(distanceToGolden),
                aligned: distanceToGolden < threshold
            },
            visualWeight: {
                coverage: parseFloat((coverage * 100).toFixed(1)),
                ideal: coverage >= 0.2 && coverage <= 0.5
            }
        }
    };
}

/**
 * Find optimal composition target position
 */
function findOptimalPosition(imageMetadata, targetRule = 'golden-ratio') {
    const width = imageMetadata.width;
    const height = imageMetadata.height;

    switch (targetRule) {
        case 'golden-ratio':
            const golden = calculateGoldenRatioPoints(width, height);
            return {
                x: golden.spiral.x,
                y: golden.spiral.y,
                name: 'goldenSpiral',
                rule: 'golden-ratio'
            };

        case 'rule-of-thirds-topRight':
            const grid = calculateRuleOfThirdsGrid(width, height);
            return {
                ...grid.intersections.find(p => p.name === 'topRight'),
                rule: 'rule-of-thirds'
            };

        case 'rule-of-thirds-bottomLeft':
            const grid2 = calculateRuleOfThirdsGrid(width, height);
            return {
                ...grid2.intersections.find(p => p.name === 'bottomLeft'),
                rule: 'rule-of-thirds'
            };

        case 'center':
            return {
                x: Math.round(width / 2),
                y: Math.round(height / 2),
                name: 'center',
                rule: 'centered'
            };

        default:
            // Default to golden ratio
            return findOptimalPosition(imageMetadata, 'golden-ratio');
    }
}

// =============================================================================
// REPOSITIONING (Cropping/Resizing)
// =============================================================================

/**
 * Optimize composition by repositioning subject
 * This crops/reframes the image to place subject at optimal position
 */
async function optimizeComposition(imageBuffer, targetPosition = 'golden-ratio') {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();

        // Detect subject
        const subject = await detectSubject(imageBuffer);
        if (!subject) {
            console.warn('Cannot optimize composition without subject detection');
            return imageBuffer;  // Return original
        }

        // Find optimal target position
        const optimal = findOptimalPosition(metadata, targetPosition);

        // Calculate offset needed to move subject center to optimal position
        const offsetX = optimal.x - subject.center.x;
        const offsetY = optimal.y - subject.center.y;

        // Create a crop/resize strategy
        // For now, we'll use extract (crop) if offset is reasonable
        const maxOffset = Math.min(metadata.width, metadata.height) * 0.3;

        if (Math.abs(offsetX) < maxOffset && Math.abs(offsetY) < maxOffset) {
            // Calculate crop region
            const cropX = Math.max(0, Math.min(metadata.width - 1920, -offsetX));
            const cropY = Math.max(0, Math.min(metadata.height - 1080, -offsetY));

            const optimized = await image
                .extract({
                    left: Math.round(cropX),
                    top: Math.round(cropY),
                    width: 1920,
                    height: 1080
                })
                .toBuffer();

            return optimized;
        } else {
            // Offset too large - resize instead
            const resized = await image
                .resize(1920, 1080, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            return resized;
        }

    } catch (err) {
        console.error('Composition optimization failed:', err.message);
        return imageBuffer;  // Return original on error
    }
}

// =============================================================================
// SAFE ZONE VALIDATION
// =============================================================================

/**
 * Validate composition against YouTube safe zones
 */
function validateSafeZones(composition, safeZones) {
    const issues = [];

    // Check if subject is in YouTube duration overlay zone
    const durationZone = safeZones?.youtubeDuration || {
        x: 1750, y: 1000, width: 170, height: 80
    };

    if (isOverlapping(composition.bounds, durationZone)) {
        issues.push('Subject overlaps with YouTube duration display area');
    }

    // Check mobile safe zones (160px margins)
    const mobileSafe = safeZones?.mobile || {
        marginX: 160,
        marginY: 90
    };

    if (composition.bounds.x < mobileSafe.marginX ||
        composition.bounds.x + composition.bounds.width > (1920 - mobileSafe.marginX)) {
        issues.push('Subject extends into mobile crop zone (horizontal)');
    }

    if (composition.bounds.y < mobileSafe.marginY ||
        composition.bounds.y + composition.bounds.height > (1080 - mobileSafe.marginY)) {
        issues.push('Subject extends into mobile crop zone (vertical)');
    }

    return {
        safe: issues.length === 0,
        issues
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function findNearestPoint(point, candidates) {
    let nearest = candidates[0];
    let minDistance = Infinity;

    for (const candidate of candidates) {
        const distance = calculateDistance(point, candidate);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = candidate;
        }
    }

    return nearest;
}

function isOverlapping(rect1, rect2) {
    return !(
        rect1.x + rect1.width < rect2.x ||
        rect2.x + rect2.width < rect1.x ||
        rect1.y + rect1.height < rect2.y ||
        rect2.y + rect2.height < rect1.y
    );
}

// =============================================================================
// SCORE COMPOSITION (Main Entry Point)
// =============================================================================

/**
 * Score composition quality (0-100)
 */
async function scoreComposition(imageBuffer) {
    try {
        const image = sharp(imageBuffer);
        const metadata = await image.metadata();

        // Detect subject
        const subject = await detectSubject(imageBuffer);
        if (!subject) {
            return {
                score: 0,
                message: 'Unable to detect subject in image'
            };
        }

        // Analyze composition
        const analysis = analyzeComposition(metadata, subject);

        return {
            score: analysis.score,
            recommendation: analysis.recommendation,
            issues: analysis.issues,
            strengths: analysis.strengths,
            details: analysis.analysis,
            subject: {
                bounds: subject.bounds,
                center: subject.center,
                confidence: subject.confidence
            }
        };

    } catch (err) {
        console.error('Composition scoring failed:', err.message);
        return {
            score: 0,
            message: 'Error scoring composition',
            error: err.message
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    detectSubject,
    analyzeComposition,
    optimizeComposition,
    scoreComposition,
    findOptimalPosition,
    validateSafeZones,
    calculateRuleOfThirdsGrid,
    calculateGoldenRatioPoints,
    COMPOSITION_RULES
};
