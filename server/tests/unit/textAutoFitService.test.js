/**
 * Unit Tests for textAutoFitService
 *
 * Tests cover:
 * - Text measurement accuracy
 * - Smart word wrapping
 * - Auto-fit algorithm
 * - Position adjustment
 * - Safe zone validation
 * - Edge cases and error handling
 */

const {
    measureTextWidth,
    measureTextBlock,
    getFontMetrics,
    smartWordWrap,
    estimateCharsPerLine,
    autoFitText,
    adjustPositionForText,
    getPosition,
    validateSafeZone,
    getSafeZoneBounds,
    prepareTextOverlay,
    willTextFit,
    findOptimalFontSize,
    SAFE_ZONES,
    YOUTUBE_DURATION_ZONE,
    FONT_METRICS,
    POSITION_PRESETS
} = require('../../src/services/textAutoFitService');

// ============================================================================
// TEST: measureTextWidth
// ============================================================================

describe('measureTextWidth', () => {
    test('should return zero dimensions for empty text', () => {
        const result = measureTextWidth('', 100, 'Impact');
        expect(result.width).toBe(0);
        expect(result.height).toBe(0);
    });

    test('should return zero dimensions for null text', () => {
        const result = measureTextWidth(null, 100, 'Impact');
        expect(result.width).toBe(0);
        expect(result.height).toBe(0);
    });

    test('should measure single character', () => {
        const result = measureTextWidth('A', 100, 'Impact');
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });

    test('should measure simple text', () => {
        const result = measureTextWidth('HELLO', 100, 'Impact');
        expect(result.width).toBeGreaterThan(200);
        expect(result.width).toBeLessThan(500);
        expect(result.height).toBeGreaterThan(90);
    });

    test('should increase width for longer text', () => {
        const short = measureTextWidth('HI', 100, 'Impact');
        const long = measureTextWidth('HELLO WORLD', 100, 'Impact');
        expect(long.width).toBeGreaterThan(short.width);
    });

    test('should scale with font size', () => {
        const small = measureTextWidth('TEST', 50, 'Impact');
        const large = measureTextWidth('TEST', 100, 'Impact');
        expect(large.width).toBeGreaterThan(small.width * 1.5);
    });

    test('should account for wide characters', () => {
        const narrow = measureTextWidth('III', 100, 'Impact');
        const wide = measureTextWidth('MMM', 100, 'Impact');
        expect(wide.width).toBeGreaterThan(narrow.width);
    });

    test('should include bounding box in result', () => {
        const result = measureTextWidth('TEST', 100, 'Impact');
        expect(result.boundingBox).toBeDefined();
        expect(result.boundingBox.left).toBe(0);
        expect(result.boundingBox.right).toBe(result.width);
    });

    test('should include metrics in result', () => {
        const result = measureTextWidth('TEST', 100, 'Impact');
        expect(result.metrics).toBeDefined();
        expect(result.metrics.ascent).toBeGreaterThan(0);
        expect(result.metrics.descent).toBeGreaterThan(0);
    });
});

// ============================================================================
// TEST: getFontMetrics
// ============================================================================

describe('getFontMetrics', () => {
    test('should return Impact metrics for Impact font', () => {
        const metrics = getFontMetrics('Impact');
        expect(metrics).toBe(FONT_METRICS['Impact']);
    });

    test('should extract font from font-family string', () => {
        const metrics = getFontMetrics('Impact, Arial Black, sans-serif');
        expect(metrics).toBe(FONT_METRICS['Impact']);
    });

    test('should return default metrics for unknown font', () => {
        const metrics = getFontMetrics('UnknownFont');
        expect(metrics).toBe(FONT_METRICS['default']);
    });

    test('should handle quoted font names', () => {
        const metrics = getFontMetrics('"Arial Black", sans-serif');
        expect(metrics).toBe(FONT_METRICS['Arial Black']);
    });

    test('should have all required properties', () => {
        const metrics = getFontMetrics('Impact');
        expect(metrics.averageCharWidth).toBeDefined();
        expect(metrics.capitalRatio).toBeDefined();
        expect(metrics.lowerRatio).toBeDefined();
        expect(metrics.spaceRatio).toBeDefined();
        expect(metrics.heightRatio).toBeDefined();
    });
});

// ============================================================================
// TEST: measureTextBlock
// ============================================================================

describe('measureTextBlock', () => {
    test('should return zero dimensions for empty lines', () => {
        const result = measureTextBlock([], 100, 'Impact');
        expect(result.width).toBe(0);
        expect(result.height).toBe(0);
    });

    test('should measure single line', () => {
        const result = measureTextBlock(['HELLO'], 100, 'Impact');
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
        expect(result.lines).toHaveLength(1);
    });

    test('should measure multiple lines', () => {
        const result = measureTextBlock(['HELLO', 'WORLD'], 100, 'Impact');
        expect(result.height).toBeGreaterThan(measureTextBlock(['HELLO'], 100, 'Impact').height);
        expect(result.lines).toHaveLength(2);
    });

    test('should use widest line for block width', () => {
        const result = measureTextBlock(['HI', 'HELLO WORLD'], 100, 'Impact');
        const longLine = measureTextWidth('HELLO WORLD', 100, 'Impact');
        expect(result.width).toBe(longLine.width);
    });

    test('should include lineHeight in result', () => {
        const result = measureTextBlock(['TEST'], 100, 'Impact');
        expect(result.lineHeight).toBeGreaterThan(0);
    });
});

// ============================================================================
// TEST: smartWordWrap
// ============================================================================

describe('smartWordWrap', () => {
    test('should return empty array for empty text', () => {
        const result = smartWordWrap('', 20);
        expect(result).toEqual([]);
    });

    test('should return single line for short text', () => {
        const result = smartWordWrap('HELLO', 20);
        expect(result).toEqual(['HELLO']);
    });

    test('should wrap long text into multiple lines', () => {
        const result = smartWordWrap('THIS IS A VERY LONG TEXT', 10);
        expect(result.length).toBeGreaterThan(1);
    });

    test('should respect maxLines parameter', () => {
        const result = smartWordWrap('ONE TWO THREE FOUR FIVE SIX SEVEN', 5, 2);
        expect(result.length).toBeLessThanOrEqual(2);
    });

    test('should break at spaces', () => {
        const result = smartWordWrap('HELLO WORLD', 8);
        expect(result[0]).toBe('HELLO');
        expect(result[1]).toBe('WORLD');
    });

    test('should handle single long word', () => {
        const result = smartWordWrap('SUPERLONGWORD', 5, 3);
        expect(result.length).toBeGreaterThan(1);
    });

    test('should normalize multiple spaces', () => {
        const result = smartWordWrap('HELLO    WORLD', 20);
        expect(result[0]).toBe('HELLO WORLD');
    });

    test('should trim whitespace', () => {
        const result = smartWordWrap('  HELLO  ', 20);
        expect(result[0]).toBe('HELLO');
    });
});

// ============================================================================
// TEST: estimateCharsPerLine
// ============================================================================

describe('estimateCharsPerLine', () => {
    test('should return positive number', () => {
        const result = estimateCharsPerLine(500, 50, 'Impact');
        expect(result).toBeGreaterThan(0);
    });

    test('should increase with wider max width', () => {
        const narrow = estimateCharsPerLine(300, 50, 'Impact');
        const wide = estimateCharsPerLine(600, 50, 'Impact');
        expect(wide).toBeGreaterThan(narrow);
    });

    test('should decrease with larger font size', () => {
        const small = estimateCharsPerLine(500, 30, 'Impact');
        const large = estimateCharsPerLine(500, 60, 'Impact');
        expect(large).toBeLessThan(small);
    });
});

// ============================================================================
// TEST: autoFitText
// ============================================================================

describe('autoFitText', () => {
    test('should return fit result for simple text', () => {
        const result = autoFitText('HELLO', {
            maxWidth: 500,
            maxHeight: 200,
            minFontSize: 40,
            maxFontSize: 100
        });

        expect(result.fits).toBe(true);
        expect(result.fontSize).toBeGreaterThanOrEqual(40);
        expect(result.fontSize).toBeLessThanOrEqual(100);
        expect(result.lines).toHaveLength(1);
    });

    test('should reduce font size for long text', () => {
        const result = autoFitText('THIS IS A VERY LONG TEXT THAT NEEDS SMALLER FONT', {
            maxWidth: 300,
            maxHeight: 200,
            minFontSize: 20,
            maxFontSize: 100
        });

        expect(result.fontSize).toBeLessThan(100);
    });

    test('should wrap text into multiple lines when needed', () => {
        const result = autoFitText('HELLO WORLD TESTING', {
            maxWidth: 200,
            maxHeight: 400,
            minFontSize: 40,
            maxFontSize: 100
        });

        expect(result.lines.length).toBeGreaterThanOrEqual(1);
    });

    test('should warn when at minimum font size', () => {
        const result = autoFitText('EXTREMELY LONG TEXT THAT CANNOT FIT', {
            maxWidth: 100,
            maxHeight: 50,
            minFontSize: 80,
            maxFontSize: 100
        });

        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should include width and height in result', () => {
        const result = autoFitText('TEST', {
            maxWidth: 500,
            maxHeight: 200
        });

        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
    });

    test('should account for stroke width', () => {
        const withoutStroke = autoFitText('TEST', {
            maxWidth: 300,
            strokeWidth: 0
        });

        const withStroke = autoFitText('TEST', {
            maxWidth: 300,
            strokeWidth: 20
        });

        expect(withStroke.fontSize).toBeLessThanOrEqual(withoutStroke.fontSize);
    });
});

// ============================================================================
// TEST: getPosition
// ============================================================================

describe('getPosition', () => {
    test('should return preset position for string input', () => {
        const result = getPosition('topLeft');
        expect(result).toEqual(POSITION_PRESETS.topLeft);
    });

    test('should return custom position for object input', () => {
        const custom = { x: 100, y: 200, anchor: 'start' };
        const result = getPosition(custom);
        expect(result.x).toBe(100);
        expect(result.y).toBe(200);
        expect(result.anchor).toBe('start');
    });

    test('should use center for unknown preset', () => {
        const result = getPosition('unknownPosition');
        expect(result).toEqual(POSITION_PRESETS.center);
    });

    test('should provide defaults for partial object input', () => {
        const result = getPosition({ x: 100 });
        expect(result.x).toBe(100);
        expect(result.y).toBe(540);
        expect(result.anchor).toBe('middle');
    });
});

// ============================================================================
// TEST: adjustPositionForText
// ============================================================================

describe('adjustPositionForText', () => {
    const canvas = { width: 1920, height: 1080 };
    const safeZone = SAFE_ZONES.desktop;

    test('should not adjust position already in safe zone', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 960, y: 540, anchor: 'middle' };

        const result = adjustPositionForText(textBlock, position, canvas, safeZone);

        expect(result.adjusted).toBe(false);
    });

    test('should adjust position too far left', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 50, y: 540, anchor: 'start' };

        const result = adjustPositionForText(textBlock, position, canvas, safeZone);

        expect(result.adjusted).toBe(true);
        expect(result.x).toBeGreaterThanOrEqual(safeZone.marginX);
    });

    test('should adjust position too far right', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 1900, y: 540, anchor: 'end' };

        const result = adjustPositionForText(textBlock, position, canvas, safeZone);

        expect(result.adjusted).toBe(true);
        expect(result.x).toBeLessThanOrEqual(canvas.width - safeZone.marginX);
    });

    test('should adjust position too far up', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 960, y: 30, anchor: 'middle' };

        const result = adjustPositionForText(textBlock, position, canvas, safeZone);

        expect(result.adjusted).toBe(true);
        expect(result.y).toBeGreaterThanOrEqual(safeZone.marginY);
    });

    test('should adjust position too far down', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 960, y: 1060, anchor: 'middle' };

        const result = adjustPositionForText(textBlock, position, canvas, safeZone);

        expect(result.adjusted).toBe(true);
        expect(result.y).toBeLessThanOrEqual(canvas.height - safeZone.marginY);
    });

    test('should include adjustment descriptions', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 0, y: 0, anchor: 'start' };

        const result = adjustPositionForText(textBlock, position, canvas, safeZone);

        expect(result.adjustments).toBeDefined();
        expect(result.adjustments.length).toBeGreaterThan(0);
    });
});

// ============================================================================
// TEST: validateSafeZone
// ============================================================================

describe('validateSafeZone', () => {
    const canvas = { width: 1920, height: 1080 };
    const safeZone = SAFE_ZONES.desktop;

    test('should validate text in safe zone', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 960, y: 540, anchor: 'middle' };

        const result = validateSafeZone(textBlock, position, canvas, safeZone);

        expect(result.valid).toBe(true);
        expect(result.overflow.left).toBe(0);
        expect(result.overflow.right).toBe(0);
        expect(result.overflow.top).toBe(0);
        expect(result.overflow.bottom).toBe(0);
    });

    test('should detect left overflow', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 50, y: 540, anchor: 'start' };

        const result = validateSafeZone(textBlock, position, canvas, safeZone);

        expect(result.valid).toBe(false);
        expect(result.overflow.left).toBeGreaterThan(0);
    });

    test('should detect right overflow', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 1900, y: 540, anchor: 'start' };

        const result = validateSafeZone(textBlock, position, canvas, safeZone);

        expect(result.valid).toBe(false);
        expect(result.overflow.right).toBeGreaterThan(0);
    });

    test('should include text bounds in result', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 960, y: 540, anchor: 'middle' };

        const result = validateSafeZone(textBlock, position, canvas, safeZone);

        expect(result.textBounds).toBeDefined();
        expect(result.textBounds.left).toBeDefined();
        expect(result.textBounds.right).toBeDefined();
    });

    test('should detect duration zone conflict', () => {
        const textBlock = { width: 200, height: 100 };
        const position = { x: 1850, y: 1030, anchor: 'end' };

        const result = validateSafeZone(textBlock, position, canvas, safeZone);

        expect(result.inDurationZone).toBe(true);
    });
});

// ============================================================================
// TEST: getSafeZoneBounds
// ============================================================================

describe('getSafeZoneBounds', () => {
    test('should return desktop bounds by default', () => {
        const result = getSafeZoneBounds(1920, 1080);

        expect(result.left).toBe(SAFE_ZONES.desktop.marginX);
        expect(result.right).toBe(1920 - SAFE_ZONES.desktop.marginX);
        expect(result.device).toBe('desktop');
    });

    test('should return mobile bounds when specified', () => {
        const result = getSafeZoneBounds(1920, 1080, 'mobile');

        expect(result.left).toBe(SAFE_ZONES.mobile.marginX);
        expect(result.device).toBe('mobile');
    });

    test('should calculate width and height', () => {
        const result = getSafeZoneBounds(1920, 1080);

        expect(result.width).toBe(1920 - (SAFE_ZONES.desktop.marginX * 2));
        expect(result.height).toBe(1080 - (SAFE_ZONES.desktop.marginY * 2));
    });
});

// ============================================================================
// TEST: prepareTextOverlay
// ============================================================================

describe('prepareTextOverlay', () => {
    test('should prepare simple text overlay', () => {
        const result = prepareTextOverlay('HELLO', {}, 'center');

        expect(result.fontSize).toBeGreaterThan(0);
        expect(result.lines).toBeDefined();
        expect(result.x).toBeDefined();
        expect(result.y).toBeDefined();
        expect(result.fits).toBe(true);
    });

    test('should use position preset', () => {
        const result = prepareTextOverlay('TEST', {}, 'topLeft');

        expect(result.anchor).toBe('start');
    });

    test('should accept custom style', () => {
        const result = prepareTextOverlay('TEST', {
            fontFamily: 'Arial',
            fontWeight: 700
        });

        expect(result._config.fontFamily).toBe('Arial');
        expect(result._config.fontWeight).toBe(700);
    });

    test('should accept custom canvas size', () => {
        const result = prepareTextOverlay('TEST', {}, 'center', {
            width: 3840,
            height: 2160
        });

        expect(result._input.canvasSize.width).toBe(3840);
        expect(result._input.canvasSize.height).toBe(2160);
    });

    test('should include validation in result', () => {
        const result = prepareTextOverlay('TEST');

        expect(result.validation).toBeDefined();
        expect(result.validation.valid).toBeDefined();
    });

    test('should guarantee text fits when possible', () => {
        const result = prepareTextOverlay('SHORT TEXT', {
            minFontSize: 40,
            maxFontSize: 200
        }, 'center', { width: 1920, height: 1080 });

        expect(result.fits).toBe(true);
    });

    test('should warn when text cannot fit', () => {
        const result = prepareTextOverlay(
            'THIS IS AN EXTREMELY LONG TEXT THAT ABSOLUTELY CANNOT FIT IN A TINY SPACE',
            { minFontSize: 100, maxFontSize: 100 },
            'center',
            { width: 1920, height: 1080 },
            { maxWidth: 100, maxHeight: 50 }
        );

        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should adjust position when needed', () => {
        // Position that would overflow
        const result = prepareTextOverlay(
            'WIDE TEXT',
            {},
            { x: 1900, y: 540, anchor: 'start' }
        );

        // Position should be adjusted to fit
        expect(result.positionAdjusted).toBe(true);
    });
});

// ============================================================================
// TEST: willTextFit
// ============================================================================

describe('willTextFit', () => {
    test('should return true for text that fits', () => {
        expect(willTextFit('HI', 50, 500, 'Impact')).toBe(true);
    });

    test('should return false for text that does not fit', () => {
        expect(willTextFit('HELLO WORLD', 200, 100, 'Impact')).toBe(false);
    });
});

// ============================================================================
// TEST: findOptimalFontSize
// ============================================================================

describe('findOptimalFontSize', () => {
    test('should return font size within bounds', () => {
        const result = findOptimalFontSize('TEST', 500, 40, 200, 'Impact');

        expect(result).toBeGreaterThanOrEqual(40);
        expect(result).toBeLessThanOrEqual(200);
    });

    test('should return maximum possible size', () => {
        const result = findOptimalFontSize('HI', 1000, 40, 200, 'Impact');

        // Should be at or near max for short text
        expect(result).toBeGreaterThan(150);
    });

    test('should return minimum for text that cannot fit', () => {
        const result = findOptimalFontSize('HELLO WORLD', 50, 40, 200, 'Impact');

        expect(result).toBe(40);
    });
});

// ============================================================================
// TEST: Constants
// ============================================================================

describe('Constants', () => {
    test('SAFE_ZONES should have desktop and mobile', () => {
        expect(SAFE_ZONES.desktop).toBeDefined();
        expect(SAFE_ZONES.mobile).toBeDefined();
    });

    test('YOUTUBE_DURATION_ZONE should have required properties', () => {
        expect(YOUTUBE_DURATION_ZONE.x).toBeDefined();
        expect(YOUTUBE_DURATION_ZONE.y).toBeDefined();
        expect(YOUTUBE_DURATION_ZONE.width).toBeDefined();
        expect(YOUTUBE_DURATION_ZONE.height).toBeDefined();
    });

    test('POSITION_PRESETS should have common positions', () => {
        expect(POSITION_PRESETS.topLeft).toBeDefined();
        expect(POSITION_PRESETS.center).toBeDefined();
        expect(POSITION_PRESETS.bottomRight).toBeDefined();
        expect(POSITION_PRESETS.rightCenter).toBeDefined();
    });
});

// ============================================================================
// TEST: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
    test('should handle emoji in text', () => {
        // Should not throw, may not measure perfectly
        expect(() => measureTextWidth('HELLO ', 100, 'Impact')).not.toThrow();
    });

    test('should handle very long single word', () => {
        const result = smartWordWrap('SUPERCALIFRAGILISTICEXPIALIDOCIOUS', 10, 3);
        expect(result.length).toBeGreaterThan(0);
    });

    test('should handle text with only spaces', () => {
        const result = smartWordWrap('     ', 20);
        expect(result).toEqual([]);
    });

    test('should handle zero max width', () => {
        const result = autoFitText('TEST', { maxWidth: 0, minFontSize: 10 });
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should handle very small canvas', () => {
        const result = prepareTextOverlay('TEST', {}, 'center', {
            width: 100,
            height: 50
        });
        expect(result).toBeDefined();
    });

    test('should handle very large canvas', () => {
        const result = prepareTextOverlay('TEST', {}, 'center', {
            width: 7680,
            height: 4320
        });
        expect(result).toBeDefined();
    });
});
