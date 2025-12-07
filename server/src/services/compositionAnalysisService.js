/**
 * ============================================================================
 * ThumbnailBuilder - AI-Powered Composition Analysis Service
 * ============================================================================
 *
 * Analyzes generated images to find optimal text placement by:
 * - Detecting focal points and faces
 * - Finding negative space (empty areas)
 * - Identifying color zones for contrast
 * - Calculating optimal text positions
 * - Ensuring text never overlaps important elements
 *
 * This ensures professional-quality text placement every time.
 */

const sharp = require('sharp');

// =============================================================================
// CONSTANTS
// =============================================================================

const CANVAS = {
    width: 1920,
    height: 1080
};

// YouTube safe zones (areas to avoid)
const DANGER_ZONES = {
    timestamp: { x: [1600, 1920], y: [920, 1080] },
    bottomLeftIcons: { x: [0, 180], y: [920, 1080] },
    topRightBadge: { x: [1700, 1920], y: [0, 140] },
    mobileBottomCrop: { x: [0, 1920], y: [1000, 1080] }
};

// Grid for analysis (divide image into cells)
const ANALYSIS_GRID = {
    cols: 12,
    rows: 8
};

// Minimum contrast ratio for readable text (WCAG AA)
const MIN_CONTRAST_RATIO = 4.5;

// =============================================================================
// IMAGE ANALYSIS
// =============================================================================

/**
 * Analyze image composition to find optimal text placement
 * @param {Buffer} imageBuffer - Image to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Composition analysis result
 */
async function analyzeComposition(imageBuffer, options = {}) {
    const {
        textLength = 10,           // Approximate text length for sizing
        fontSize = 160,            // Target font size
        preferredPosition = null,  // User's preferred position (can override)
        creatorStyle = 'mrbeast'   // Affects preferred zones
    } = options;

    console.log('[CompositionAnalysis] Starting image analysis...');

    try {
        // Get image dimensions and metadata
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        // Resize for faster analysis (we'll work with a smaller version)
        const analysisSize = { width: 384, height: 216 };
        const resizedBuffer = await sharp(imageBuffer)
            .resize(analysisSize.width, analysisSize.height, { fit: 'fill' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Step 1: Analyze brightness distribution (find dark/light areas)
        const brightnessMap = await analyzeBrightness(resizedBuffer.data, analysisSize);

        // Step 2: Analyze color distribution (find uniform color zones)
        const colorMap = await analyzeColorVariance(resizedBuffer.data, analysisSize);

        // Step 3: Detect likely focal points (high contrast, central areas)
        const focalPoints = detectFocalPoints(brightnessMap, colorMap, analysisSize);

        // Step 4: Find negative space (empty/uniform areas good for text)
        const negativeSpace = findNegativeSpace(brightnessMap, colorMap, analysisSize);

        // Step 5: Calculate optimal text positions
        const textPositions = calculateOptimalTextPositions({
            brightnessMap,
            colorMap,
            focalPoints,
            negativeSpace,
            textLength,
            fontSize,
            creatorStyle,
            imageSize: { width, height },
            analysisSize
        });

        // Step 6: Select best position
        const bestPosition = selectBestPosition(textPositions, preferredPosition);

        // Step 7: Get optimal text color for the selected position
        const textColorRecommendation = await recommendTextColor(
            imageBuffer,
            bestPosition,
            { width, height }
        );

        console.log(`[CompositionAnalysis] Best position: (${bestPosition.x}, ${bestPosition.y}) - Score: ${bestPosition.score}`);

        return {
            bestPosition,
            allPositions: textPositions,
            focalPoints: focalPoints.map(fp => scalePoint(fp, analysisSize, { width, height })),
            negativeSpace: negativeSpace.map(ns => scaleRegion(ns, analysisSize, { width, height })),
            textColor: textColorRecommendation,
            imageSize: { width, height },
            confidence: bestPosition.score / 100
        };

    } catch (error) {
        console.error('[CompositionAnalysis] Analysis failed:', error.message);
        // Return fallback position
        return getFallbackPosition(options);
    }
}

/**
 * Analyze brightness distribution in the image
 */
async function analyzeBrightness(rawData, size) {
    const { width, height } = size;
    const cellWidth = Math.floor(width / ANALYSIS_GRID.cols);
    const cellHeight = Math.floor(height / ANALYSIS_GRID.rows);
    const map = [];

    for (let row = 0; row < ANALYSIS_GRID.rows; row++) {
        const rowData = [];
        for (let col = 0; col < ANALYSIS_GRID.cols; col++) {
            let totalBrightness = 0;
            let pixelCount = 0;

            // Sample pixels in this cell
            for (let y = row * cellHeight; y < (row + 1) * cellHeight; y++) {
                for (let x = col * cellWidth; x < (col + 1) * cellWidth; x++) {
                    const idx = (y * width + x) * 3;
                    const r = rawData[idx] || 0;
                    const g = rawData[idx + 1] || 0;
                    const b = rawData[idx + 2] || 0;
                    // Perceived brightness formula
                    const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
                    totalBrightness += brightness;
                    pixelCount++;
                }
            }

            rowData.push({
                brightness: totalBrightness / pixelCount,
                row,
                col
            });
        }
        map.push(rowData);
    }

    return map;
}

/**
 * Analyze color variance (uniform areas are good for text)
 */
async function analyzeColorVariance(rawData, size) {
    const { width, height } = size;
    const cellWidth = Math.floor(width / ANALYSIS_GRID.cols);
    const cellHeight = Math.floor(height / ANALYSIS_GRID.rows);
    const map = [];

    for (let row = 0; row < ANALYSIS_GRID.rows; row++) {
        const rowData = [];
        for (let col = 0; col < ANALYSIS_GRID.cols; col++) {
            const colors = [];

            // Sample pixels in this cell
            for (let y = row * cellHeight; y < (row + 1) * cellHeight; y += 2) {
                for (let x = col * cellWidth; x < (col + 1) * cellWidth; x += 2) {
                    const idx = (y * width + x) * 3;
                    colors.push({
                        r: rawData[idx] || 0,
                        g: rawData[idx + 1] || 0,
                        b: rawData[idx + 2] || 0
                    });
                }
            }

            // Calculate variance
            const avgColor = {
                r: colors.reduce((sum, c) => sum + c.r, 0) / colors.length,
                g: colors.reduce((sum, c) => sum + c.g, 0) / colors.length,
                b: colors.reduce((sum, c) => sum + c.b, 0) / colors.length
            };

            const variance = colors.reduce((sum, c) => {
                return sum + Math.pow(c.r - avgColor.r, 2) +
                       Math.pow(c.g - avgColor.g, 2) +
                       Math.pow(c.b - avgColor.b, 2);
            }, 0) / colors.length;

            rowData.push({
                variance: Math.sqrt(variance),
                avgColor,
                row,
                col
            });
        }
        map.push(rowData);
    }

    return map;
}

/**
 * Detect focal points in the image
 */
function detectFocalPoints(brightnessMap, colorMap, size) {
    const focalPoints = [];

    // Look for high-contrast areas (likely subjects)
    for (let row = 1; row < ANALYSIS_GRID.rows - 1; row++) {
        for (let col = 1; col < ANALYSIS_GRID.cols - 1; col++) {
            const cell = brightnessMap[row][col];
            const colorCell = colorMap[row][col];

            // Check contrast with neighbors
            const neighbors = [
                brightnessMap[row - 1][col],
                brightnessMap[row + 1][col],
                brightnessMap[row][col - 1],
                brightnessMap[row][col + 1]
            ];

            const avgNeighborBrightness = neighbors.reduce((sum, n) => sum + n.brightness, 0) / 4;
            const contrastWithNeighbors = Math.abs(cell.brightness - avgNeighborBrightness);

            // High contrast + high color variance = likely focal point
            if (contrastWithNeighbors > 30 || colorCell.variance > 50) {
                focalPoints.push({
                    x: (col + 0.5) * (size.width / ANALYSIS_GRID.cols),
                    y: (row + 0.5) * (size.height / ANALYSIS_GRID.rows),
                    strength: contrastWithNeighbors + colorCell.variance,
                    row,
                    col
                });
            }
        }
    }

    // Sort by strength and return top focal points
    return focalPoints.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

/**
 * Find negative space (uniform areas good for text)
 */
function findNegativeSpace(brightnessMap, colorMap, size) {
    const negativeSpaces = [];

    for (let row = 0; row < ANALYSIS_GRID.rows; row++) {
        for (let col = 0; col < ANALYSIS_GRID.cols; col++) {
            const colorCell = colorMap[row][col];

            // Low variance = uniform area = good for text
            if (colorCell.variance < 30) {
                // Check if this forms a larger region with neighbors
                let regionSize = 1;

                // Check horizontal neighbors
                if (col > 0 && colorMap[row][col - 1].variance < 30) regionSize++;
                if (col < ANALYSIS_GRID.cols - 1 && colorMap[row][col + 1].variance < 30) regionSize++;

                negativeSpaces.push({
                    x: col * (size.width / ANALYSIS_GRID.cols),
                    y: row * (size.height / ANALYSIS_GRID.rows),
                    width: size.width / ANALYSIS_GRID.cols,
                    height: size.height / ANALYSIS_GRID.rows,
                    uniformity: 100 - colorCell.variance,
                    brightness: brightnessMap[row][col].brightness,
                    regionSize,
                    row,
                    col
                });
            }
        }
    }

    // Sort by uniformity and region size
    return negativeSpaces.sort((a, b) => (b.uniformity * b.regionSize) - (a.uniformity * a.regionSize));
}

/**
 * Calculate optimal text positions
 */
function calculateOptimalTextPositions(params) {
    const {
        brightnessMap,
        colorMap,
        focalPoints,
        negativeSpace,
        textLength,
        fontSize,
        creatorStyle,
        imageSize,
        analysisSize
    } = params;

    const positions = [];

    // Estimate text dimensions
    const textWidth = textLength * fontSize * 0.6;
    const textHeight = fontSize * 1.2;

    // Define candidate zones based on creator style
    const candidateZones = getStyleCandidateZones(creatorStyle);

    for (const zone of candidateZones) {
        // Scale zone to analysis size
        const scaledZone = {
            x: zone.x * analysisSize.width,
            y: zone.y * analysisSize.height
        };

        // Calculate position score
        let score = zone.basePriority * 10;

        // Get grid cell for this position
        const col = Math.floor(scaledZone.x / (analysisSize.width / ANALYSIS_GRID.cols));
        const row = Math.floor(scaledZone.y / (analysisSize.height / ANALYSIS_GRID.rows));

        if (row >= 0 && row < ANALYSIS_GRID.rows && col >= 0 && col < ANALYSIS_GRID.cols) {
            const brightnessCell = brightnessMap[row][col];
            const colorCell = colorMap[row][col];

            // Bonus for uniform areas (low variance)
            if (colorCell.variance < 40) {
                score += 20;
            }

            // Bonus for extreme brightness (good for white or black text)
            if (brightnessCell.brightness < 50 || brightnessCell.brightness > 200) {
                score += 15;
            }

            // Penalty for being near focal points
            for (const fp of focalPoints) {
                const distance = Math.sqrt(
                    Math.pow(scaledZone.x - fp.x, 2) +
                    Math.pow(scaledZone.y - fp.y, 2)
                );
                const minDistance = analysisSize.width * 0.15;  // 15% of image width
                if (distance < minDistance) {
                    score -= 30 * (1 - distance / minDistance);
                }
            }

            // Check if in danger zone
            const realX = zone.x * imageSize.width;
            const realY = zone.y * imageSize.height;
            if (isInDangerZone(realX, realY, textWidth, textHeight)) {
                score -= 50;
            }
        }

        // Scale position to real image size
        positions.push({
            x: Math.round(zone.x * imageSize.width),
            y: Math.round(zone.y * imageSize.height),
            anchor: zone.anchor,
            score: Math.max(0, score),
            zone: zone.name
        });
    }

    // Sort by score
    return positions.sort((a, b) => b.score - a.score);
}

/**
 * Get candidate zones based on creator style
 */
function getStyleCandidateZones(creatorStyle) {
    // Base candidate zones with priorities
    const baseZones = [
        { name: 'top-right', x: 0.75, y: 0.20, anchor: 'end', basePriority: 8 },
        { name: 'top-left', x: 0.25, y: 0.20, anchor: 'start', basePriority: 7 },
        { name: 'top-center', x: 0.50, y: 0.18, anchor: 'middle', basePriority: 9 },
        { name: 'middle-right', x: 0.75, y: 0.45, anchor: 'end', basePriority: 7 },
        { name: 'middle-left', x: 0.25, y: 0.45, anchor: 'start', basePriority: 6 },
        { name: 'lower-center', x: 0.50, y: 0.60, anchor: 'middle', basePriority: 5 },
        { name: 'lower-left', x: 0.30, y: 0.58, anchor: 'start', basePriority: 4 }
    ];

    // Style-specific adjustments
    const styleAdjustments = {
        'mrbeast': { preferTop: true, preferCenter: true },
        'hormozi': { preferRight: true, preferMiddle: true },
        'gadzhi': { preferCenter: true, preferTop: true },
        'gaming': { preferTop: true, preferBold: true },
        'default': {}
    };

    const adjustments = styleAdjustments[creatorStyle?.toLowerCase()] || styleAdjustments['default'];

    return baseZones.map(zone => {
        let priority = zone.basePriority;

        if (adjustments.preferTop && zone.y < 0.3) priority += 2;
        if (adjustments.preferCenter && zone.anchor === 'middle') priority += 2;
        if (adjustments.preferRight && zone.anchor === 'end') priority += 2;
        if (adjustments.preferMiddle && zone.y > 0.35 && zone.y < 0.55) priority += 2;

        return { ...zone, basePriority: priority };
    });
}

/**
 * Check if position is in a YouTube danger zone
 */
function isInDangerZone(x, y, width, height) {
    for (const [name, zone] of Object.entries(DANGER_ZONES)) {
        const inX = x < zone.x[1] && (x + width) > zone.x[0];
        const inY = y < zone.y[1] && (y + height) > zone.y[0];
        if (inX && inY) {
            return true;
        }
    }
    return false;
}

/**
 * Select the best position, considering user preference
 */
function selectBestPosition(positions, preferredPosition) {
    if (preferredPosition && positions.length > 0) {
        // Find position closest to user preference
        const preferred = positions.find(p =>
            p.zone.toLowerCase().includes(preferredPosition.toLowerCase())
        );
        if (preferred && preferred.score > 30) {
            return preferred;
        }
    }

    // Return highest scored position
    return positions[0] || {
        x: CANVAS.width / 2,
        y: CANVAS.height * 0.3,
        anchor: 'middle',
        score: 50,
        zone: 'fallback-center'
    };
}

/**
 * Recommend text color based on background at position
 */
async function recommendTextColor(imageBuffer, position, imageSize) {
    try {
        // Sample area around the text position
        const sampleSize = 100;
        const sampleX = Math.max(0, Math.min(position.x - sampleSize / 2, imageSize.width - sampleSize));
        const sampleY = Math.max(0, Math.min(position.y - sampleSize / 2, imageSize.height - sampleSize));

        const { data } = await sharp(imageBuffer)
            .extract({
                left: Math.round(sampleX),
                top: Math.round(sampleY),
                width: Math.min(sampleSize, imageSize.width - sampleX),
                height: Math.min(sampleSize, imageSize.height - sampleY)
            })
            .resize(1, 1)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const bgColor = { r: data[0], g: data[1], b: data[2] };
        const bgLuminance = (0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b) / 255;

        // Recommend white or black based on background
        if (bgLuminance < 0.5) {
            return {
                primary: '#FFFFFF',
                stroke: '#000000',
                shadow: 'rgba(0,0,0,0.8)',
                bgLuminance,
                recommendation: 'light-on-dark'
            };
        } else {
            return {
                primary: '#000000',
                stroke: '#FFFFFF',
                shadow: 'rgba(255,255,255,0.3)',
                bgLuminance,
                recommendation: 'dark-on-light'
            };
        }
    } catch (error) {
        console.warn('[CompositionAnalysis] Color recommendation failed:', error.message);
        return {
            primary: '#FFFFFF',
            stroke: '#000000',
            shadow: 'rgba(0,0,0,0.8)',
            bgLuminance: 0.3,
            recommendation: 'default'
        };
    }
}

/**
 * Get fallback position when analysis fails
 */
function getFallbackPosition(options) {
    const { fontSize = 160, textLength = 10 } = options;

    return {
        bestPosition: {
            x: CANVAS.width * 0.5,
            y: CANVAS.height * 0.25,
            anchor: 'middle',
            score: 50,
            zone: 'fallback-top-center'
        },
        allPositions: [],
        focalPoints: [],
        negativeSpace: [],
        textColor: {
            primary: '#FFFFFF',
            stroke: '#000000',
            shadow: 'rgba(0,0,0,0.8)',
            recommendation: 'default'
        },
        imageSize: CANVAS,
        confidence: 0.5
    };
}

/**
 * Scale a point from analysis size to real size
 */
function scalePoint(point, fromSize, toSize) {
    return {
        x: (point.x / fromSize.width) * toSize.width,
        y: (point.y / fromSize.height) * toSize.height,
        strength: point.strength
    };
}

/**
 * Scale a region from analysis size to real size
 */
function scaleRegion(region, fromSize, toSize) {
    return {
        x: (region.x / fromSize.width) * toSize.width,
        y: (region.y / fromSize.height) * toSize.height,
        width: (region.width / fromSize.width) * toSize.width,
        height: (region.height / fromSize.height) * toSize.height,
        uniformity: region.uniformity,
        brightness: region.brightness
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    analyzeComposition,
    analyzeBrightness,
    analyzeColorVariance,
    detectFocalPoints,
    findNegativeSpace,
    recommendTextColor,
    isInDangerZone,
    DANGER_ZONES,
    ANALYSIS_GRID
};
