/**
 * Logo Positioning Service Tests
 *
 * Comprehensive test suite for logoPositioningService.js
 *
 * Tests cover:
 * - Position presets
 * - Logo sizing calculations
 * - Placement validation
 * - Grid alignment
 * - Prompt generation
 * - Main prepareLogoOverlay function
 */

const {
    prepareLogoOverlay,
    getPositionPreset,
    getAvailablePositions,
    getRecommendedPosition,
    calculateLogoSize,
    calculateMultipleLogoSizes,
    validateLogoPlacement,
    rectanglesOverlap,
    getLogoBoundingBox,
    alignLogosToGrid,
    calculateEqualSpacing,
    generateLogoPromptInstructions,
    generateCompositeInstructions,
    LOGO_POSITIONS,
    LOGO_SIZE_CONSTRAINTS,
    DEFAULT_LOGO_ASPECTS,
    DEFAULT_CANVAS,
    SAFE_MARGINS,
    YOUTUBE_DURATION_ZONE
} = require('../../src/services/logoPositioningService');

// ============================================================================
// CONSTANTS TESTS
// ============================================================================

describe('Logo Positioning Service - Constants', () => {
    test('DEFAULT_CANVAS should have correct YouTube thumbnail dimensions', () => {
        expect(DEFAULT_CANVAS.width).toBe(1920);
        expect(DEFAULT_CANVAS.height).toBe(1080);
    });

    test('YOUTUBE_DURATION_ZONE should be defined in bottom-right', () => {
        expect(YOUTUBE_DURATION_ZONE.x).toBeGreaterThan(1500);
        expect(YOUTUBE_DURATION_ZONE.y).toBeGreaterThan(800);
        expect(YOUTUBE_DURATION_ZONE.width).toBeGreaterThan(0);
        expect(YOUTUBE_DURATION_ZONE.height).toBeGreaterThan(0);
    });

    test('SAFE_MARGINS should have positive values', () => {
        expect(SAFE_MARGINS.x).toBeGreaterThan(0);
        expect(SAFE_MARGINS.y).toBeGreaterThan(0);
    });

    test('LOGO_SIZE_CONSTRAINTS should have valid ranges', () => {
        expect(LOGO_SIZE_CONSTRAINTS.minHeight).toBeLessThan(LOGO_SIZE_CONSTRAINTS.maxHeight);
        expect(LOGO_SIZE_CONSTRAINTS.singleLogoHeight.min).toBeLessThan(LOGO_SIZE_CONSTRAINTS.singleLogoHeight.max);
        expect(LOGO_SIZE_CONSTRAINTS.multipleLogoHeight.min).toBeLessThan(LOGO_SIZE_CONSTRAINTS.multipleLogoHeight.max);
        expect(LOGO_SIZE_CONSTRAINTS.spacing).toBeGreaterThan(0);
    });

    test('DEFAULT_LOGO_ASPECTS should have common streaming service logos', () => {
        expect(DEFAULT_LOGO_ASPECTS.netflix).toBeDefined();
        expect(DEFAULT_LOGO_ASPECTS.hbo).toBeDefined();
        expect(DEFAULT_LOGO_ASPECTS.disney).toBeDefined();
        expect(DEFAULT_LOGO_ASPECTS.default).toBeDefined();
    });
});

// ============================================================================
// POSITION PRESETS TESTS
// ============================================================================

describe('Logo Positioning Service - Position Presets', () => {
    test('LOGO_POSITIONS should have all standard positions', () => {
        expect(LOGO_POSITIONS.topLeft).toBeDefined();
        expect(LOGO_POSITIONS.topCenter).toBeDefined();
        expect(LOGO_POSITIONS.topRight).toBeDefined();
        expect(LOGO_POSITIONS.bottomLeft).toBeDefined();
        expect(LOGO_POSITIONS.bottomCenter).toBeDefined();
    });

    test('LOGO_POSITIONS should have cluster presets', () => {
        expect(Array.isArray(LOGO_POSITIONS.topRightCluster)).toBe(true);
        expect(Array.isArray(LOGO_POSITIONS.topLeftCluster)).toBe(true);
        expect(LOGO_POSITIONS.topRightCluster.length).toBe(3);
        expect(LOGO_POSITIONS.topLeftCluster.length).toBe(3);
    });

    test('LOGO_POSITIONS should have stack presets', () => {
        expect(Array.isArray(LOGO_POSITIONS.leftStack)).toBe(true);
        expect(Array.isArray(LOGO_POSITIONS.rightStack)).toBe(true);
    });

    test('bottomRight should be marked as avoid', () => {
        expect(LOGO_POSITIONS.bottomRight.avoid).toBe(true);
        expect(LOGO_POSITIONS.bottomRight.reason).toBeDefined();
    });

    test('position presets should have valid coordinates', () => {
        const singlePositions = ['topLeft', 'topCenter', 'topRight', 'bottomLeft', 'bottomCenter'];
        for (const posName of singlePositions) {
            const pos = LOGO_POSITIONS[posName];
            expect(pos.x).toBeGreaterThanOrEqual(0);
            expect(pos.x).toBeLessThanOrEqual(DEFAULT_CANVAS.width);
            expect(pos.y).toBeGreaterThanOrEqual(0);
            expect(pos.y).toBeLessThanOrEqual(DEFAULT_CANVAS.height);
            expect(['start', 'middle', 'end']).toContain(pos.anchor);
        }
    });

    test('getPositionPreset should return correct preset', () => {
        expect(getPositionPreset('topRight')).toEqual(LOGO_POSITIONS.topRight);
        expect(getPositionPreset('topRightCluster')).toEqual(LOGO_POSITIONS.topRightCluster);
        expect(getPositionPreset('nonexistent')).toBeNull();
    });

    test('getAvailablePositions should not include avoided positions', () => {
        const positions = getAvailablePositions();
        // bottomRight is avoided, should be excluded
        expect(positions).not.toContain('bottomRight');
        // Other positions should be included
        expect(positions).toContain('topRight');
        expect(positions).toContain('topLeft');
    });

    test('getRecommendedPosition should return appropriate positions', () => {
        expect(getRecommendedPosition('streaming', 1)).toBe('topRight');
        expect(getRecommendedPosition('streaming', 2)).toBe('topRightCluster');
        expect(getRecommendedPosition('network', 1)).toBe('topLeft');
        expect(getRecommendedPosition('production', 1)).toBe('bottomLeft');
    });
});

// ============================================================================
// LOGO SIZING TESTS
// ============================================================================

describe('Logo Positioning Service - Logo Sizing', () => {
    test('calculateLogoSize should return larger size for single logo', () => {
        const single = calculateLogoSize(1);
        const multiple = calculateLogoSize(3);
        expect(single.height).toBeGreaterThan(multiple.height);
    });

    test('calculateLogoSize should maintain aspect ratio', () => {
        const aspectRatio = 3.0;
        const size = calculateLogoSize(1, DEFAULT_CANVAS, 'topRight', { aspectRatio });
        const calculatedRatio = size.width / size.height;
        expect(Math.abs(calculatedRatio - aspectRatio)).toBeLessThan(0.1);
    });

    test('calculateLogoSize should respect constraints', () => {
        const size = calculateLogoSize(1);
        expect(size.height).toBeGreaterThanOrEqual(LOGO_SIZE_CONSTRAINTS.minHeight);
        expect(size.height).toBeLessThanOrEqual(LOGO_SIZE_CONSTRAINTS.maxHeight);
    });

    test('calculateLogoSize should scale with canvas size', () => {
        const normalSize = calculateLogoSize(1, { width: 1920, height: 1080 });
        const smallCanvasSize = calculateLogoSize(1, { width: 960, height: 540 });
        expect(smallCanvasSize.height).toBeLessThan(normalSize.height);
    });

    test('calculateMultipleLogoSizes should return sizes for all logos', () => {
        const logos = [
            { name: 'Netflix' },
            { name: 'HBO' },
            { name: 'Disney' }
        ];
        const sizes = calculateMultipleLogoSizes(logos);
        expect(sizes.length).toBe(3);
        sizes.forEach((size, index) => {
            expect(size.width).toBeGreaterThan(0);
            expect(size.height).toBeGreaterThan(0);
            expect(size.index).toBe(index);
        });
    });

    test('calculateMultipleLogoSizes should use default aspect for unknown logos', () => {
        const logos = [{ name: 'UnknownBrand' }];
        const sizes = calculateMultipleLogoSizes(logos);
        expect(sizes[0].aspectRatio).toBe(DEFAULT_LOGO_ASPECTS.default);
    });

    test('calculateMultipleLogoSizes should use known aspect for known logos', () => {
        const logos = [{ name: 'Netflix' }];
        const sizes = calculateMultipleLogoSizes(logos);
        expect(sizes[0].aspectRatio).toBe(DEFAULT_LOGO_ASPECTS.netflix);
    });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('Logo Positioning Service - Validation', () => {
    test('rectanglesOverlap should detect overlapping rectangles', () => {
        const rect1 = { x: 0, y: 0, width: 100, height: 100 };
        const rect2 = { x: 50, y: 50, width: 100, height: 100 };
        expect(rectanglesOverlap(rect1, rect2)).toBe(true);
    });

    test('rectanglesOverlap should not detect non-overlapping rectangles', () => {
        const rect1 = { x: 0, y: 0, width: 100, height: 100 };
        const rect2 = { x: 200, y: 200, width: 100, height: 100 };
        expect(rectanglesOverlap(rect1, rect2, 0)).toBe(false);
    });

    test('rectanglesOverlap should consider padding', () => {
        const rect1 = { x: 0, y: 0, width: 100, height: 100 };
        const rect2 = { x: 110, y: 0, width: 100, height: 100 };
        // Without padding, should not overlap
        expect(rectanglesOverlap(rect1, rect2, 0)).toBe(false);
        // With padding, should overlap
        expect(rectanglesOverlap(rect1, rect2, 20)).toBe(true);
    });

    test('getLogoBoundingBox should calculate correct bounds for start anchor', () => {
        const position = { x: 100, y: 50, anchor: 'start' };
        const size = { width: 150, height: 80 };
        const bounds = getLogoBoundingBox(position, size);
        expect(bounds.x).toBe(100);
        expect(bounds.y).toBe(50);
        expect(bounds.width).toBe(150);
        expect(bounds.height).toBe(80);
    });

    test('getLogoBoundingBox should calculate correct bounds for end anchor', () => {
        const position = { x: 1840, y: 50, anchor: 'end' };
        const size = { width: 150, height: 80 };
        const bounds = getLogoBoundingBox(position, size);
        expect(bounds.x).toBe(1840 - 150);
        expect(bounds.y).toBe(50);
    });

    test('getLogoBoundingBox should calculate correct bounds for middle anchor', () => {
        const position = { x: 960, y: 50, anchor: 'middle' };
        const size = { width: 150, height: 80 };
        const bounds = getLogoBoundingBox(position, size);
        expect(bounds.x).toBe(960 - 75);
        expect(bounds.y).toBe(50);
    });

    test('validateLogoPlacement should return valid for proper placement', () => {
        const logos = [{
            name: 'Netflix',
            x: 1840,
            y: 80,
            width: 150,
            height: 80,
            anchor: 'end'
        }];
        const result = validateLogoPlacement(logos, null, null);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    test('validateLogoPlacement should detect logo outside canvas', () => {
        const logos = [{
            name: 'Netflix',
            x: 2000, // Outside canvas
            y: 80,
            width: 150,
            height: 80,
            anchor: 'start'
        }];
        const result = validateLogoPlacement(logos, null, null);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test('validateLogoPlacement should detect overlap with subject', () => {
        const logos = [{
            name: 'Netflix',
            x: 100,
            y: 100,
            width: 150,
            height: 80,
            anchor: 'start'
        }];
        const subjectBounds = { x: 50, y: 50, width: 300, height: 400 };
        const result = validateLogoPlacement(logos, subjectBounds, null);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('subject'))).toBe(true);
    });

    test('validateLogoPlacement should detect YouTube duration zone conflict', () => {
        const logos = [{
            name: 'Netflix',
            x: 1850,
            y: 1020,
            width: 150,
            height: 80,
            anchor: 'end'
        }];
        const result = validateLogoPlacement(logos, null, null);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('duration'))).toBe(true);
    });

    test('validateLogoPlacement should detect logo-to-logo overlap', () => {
        const logos = [
            {
                name: 'Netflix',
                x: 1840,
                y: 80,
                width: 150,
                height: 80,
                anchor: 'end'
            },
            {
                name: 'HBO',
                x: 1800, // Too close to Netflix
                y: 80,
                width: 140,
                height: 80,
                anchor: 'end'
            }
        ];
        const result = validateLogoPlacement(logos, null, null);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('overlaps'))).toBe(true);
    });

    test('validateLogoPlacement should return warnings for edge proximity', () => {
        const logos = [{
            name: 'Netflix',
            x: 10, // Very close to edge
            y: 10,
            width: 150,
            height: 80,
            anchor: 'start'
        }];
        const result = validateLogoPlacement(logos, null, null);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('validateLogoPlacement should handle empty logos array', () => {
        const result = validateLogoPlacement([]);
        expect(result.isValid).toBe(true);
    });
});

// ============================================================================
// GRID ALIGNMENT TESTS
// ============================================================================

describe('Logo Positioning Service - Grid Alignment', () => {
    test('alignLogosToGrid should align logos using cluster positions', () => {
        const logos = [
            { name: 'Netflix', width: 150, height: 80 },
            { name: 'HBO', width: 140, height: 80 }
        ];
        const aligned = alignLogosToGrid(logos, 'topRightCluster');
        expect(aligned.length).toBe(2);
        expect(aligned[0].x).toBeDefined();
        expect(aligned[0].y).toBeDefined();
        expect(aligned[0].anchor).toBeDefined();
    });

    test('alignLogosToGrid should use predefined cluster positions', () => {
        const logos = [
            { name: 'Logo1', width: 100, height: 50 },
            { name: 'Logo2', width: 100, height: 50 },
            { name: 'Logo3', width: 100, height: 50 }
        ];
        const aligned = alignLogosToGrid(logos, 'topRightCluster');
        expect(aligned.length).toBe(3);
        // Each logo should have a different x position
        const xPositions = aligned.map(l => l.x);
        const uniqueXPositions = [...new Set(xPositions)];
        expect(uniqueXPositions.length).toBe(3);
    });

    test('alignLogosToGrid should handle single position preset', () => {
        const logos = [
            { name: 'Netflix', width: 150, height: 80 },
            { name: 'HBO', width: 140, height: 80 }
        ];
        const aligned = alignLogosToGrid(logos, 'topRight', { direction: 'horizontal' });
        expect(aligned.length).toBe(2);
        // Both should be on same y level for horizontal
        expect(aligned[0].y).toBe(aligned[1].y);
    });

    test('alignLogosToGrid should handle vertical direction', () => {
        const logos = [
            { name: 'Logo1', width: 100, height: 50 },
            { name: 'Logo2', width: 100, height: 50 }
        ];
        const aligned = alignLogosToGrid(logos, 'topRight', { direction: 'vertical' });
        // Both should have same x for vertical
        expect(aligned[0].x).toBe(aligned[1].x);
        // Second logo should be below first
        expect(aligned[1].y).toBeGreaterThan(aligned[0].y);
    });

    test('calculateEqualSpacing should center single logo', () => {
        const logos = [{ width: 100, height: 50 }];
        const boundingBox = { x: 0, y: 0, width: 500, height: 100 };
        const result = calculateEqualSpacing(logos, boundingBox);
        expect(result.positions.length).toBe(1);
        expect(result.positions[0].x).toBe(200); // Centered: (500-100)/2
    });

    test('calculateEqualSpacing should calculate correct spacing for multiple logos', () => {
        const logos = [
            { width: 100, height: 50 },
            { width: 100, height: 50 },
            { width: 100, height: 50 }
        ];
        const boundingBox = { x: 0, y: 0, width: 400, height: 100 };
        const result = calculateEqualSpacing(logos, boundingBox, 'horizontal');
        expect(result.positions.length).toBe(3);
        // Total logo width: 300, available: 400, spacing: 100/(3-1) = 50
        expect(result.spacing).toBe(50);
    });

    test('calculateEqualSpacing should handle empty logos array', () => {
        const result = calculateEqualSpacing([], { x: 0, y: 0, width: 500, height: 100 });
        expect(result.spacing).toBe(0);
        expect(result.positions.length).toBe(0);
    });
});

// ============================================================================
// PROMPT GENERATION TESTS
// ============================================================================

describe('Logo Positioning Service - Prompt Generation', () => {
    test('generateLogoPromptInstructions should generate non-empty instructions', () => {
        const logos = [{
            name: 'Netflix',
            x: 1840,
            y: 80,
            width: 150,
            height: 80,
            anchor: 'end'
        }];
        const instructions = generateLogoPromptInstructions(logos);
        expect(instructions.length).toBeGreaterThan(0);
        expect(instructions).toContain('Netflix');
        expect(instructions).toContain('150');
        expect(instructions).toContain('80');
    });

    test('generateLogoPromptInstructions should include placement requirements', () => {
        const logos = [{ name: 'HBO', x: 100, y: 100, width: 140, height: 80, anchor: 'start' }];
        const instructions = generateLogoPromptInstructions(logos);
        expect(instructions).toContain('BRAND LOGO PLACEMENT');
        expect(instructions).toContain('NOT crop');
        expect(instructions).toContain('proportions');
    });

    test('generateLogoPromptInstructions should include quality requirements', () => {
        const logos = [{ name: 'Test', x: 100, y: 100, width: 100, height: 50, anchor: 'start' }];
        const instructions = generateLogoPromptInstructions(logos);
        expect(instructions).toContain('QUALITY');
        expect(instructions).toContain('crisp');
        expect(instructions).toContain('contrast');
    });

    test('generateLogoPromptInstructions should return empty string for empty array', () => {
        const instructions = generateLogoPromptInstructions([]);
        expect(instructions).toBe('');
    });

    test('generateCompositeInstructions should include context', () => {
        const logos = [{ name: 'Netflix', x: 1840, y: 80, width: 150, height: 80, anchor: 'end' }];
        const context = {
            subjectDescription: 'A person looking surprised',
            textContent: 'SHOCKING NEWS'
        };
        const instructions = generateCompositeInstructions(logos, context);
        expect(instructions).toContain('A person looking surprised');
        expect(instructions).toContain('SHOCKING NEWS');
        expect(instructions).toContain('Netflix');
    });
});

// ============================================================================
// MAIN FUNCTION TESTS
// ============================================================================

describe('Logo Positioning Service - prepareLogoOverlay', () => {
    test('prepareLogoOverlay should handle single logo', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix', position: 'topRight' }],
            canvas: { width: 1920, height: 1080 }
        });

        expect(result.positions.length).toBe(1);
        expect(result.positions[0].name).toBe('Netflix');
        expect(result.positions[0].x).toBeDefined();
        expect(result.positions[0].y).toBeDefined();
        expect(result.positions[0].width).toBeGreaterThan(0);
        expect(result.positions[0].height).toBeGreaterThan(0);
        expect(result.promptInstructions).toContain('Netflix');
        expect(result.valid).toBe(true);
    });

    test('prepareLogoOverlay should handle multiple logos at same position', () => {
        const result = prepareLogoOverlay({
            logos: [
                { name: 'Netflix', position: 'topRight' },
                { name: 'HBO', position: 'topRight' }
            ],
            canvas: { width: 1920, height: 1080 }
        });

        expect(result.positions.length).toBe(2);
        expect(result.valid).toBe(true);
        // Logos should not overlap (different x positions for cluster)
        expect(result.positions[0].x).not.toBe(result.positions[1].x);
    });

    test('prepareLogoOverlay should handle multiple logos at different positions', () => {
        const result = prepareLogoOverlay({
            logos: [
                { name: 'Netflix', position: 'topRight' },
                { name: 'HBO', position: 'topLeft' }
            ],
            canvas: { width: 1920, height: 1080 }
        });

        expect(result.positions.length).toBe(2);
        expect(result.valid).toBe(true);
    });

    test('prepareLogoOverlay should validate against subject bounds', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix', position: 'topLeft' }],
            canvas: { width: 1920, height: 1080 },
            subject: {
                bounds: { x: 0, y: 0, width: 800, height: 1080 } // Subject covers left side
            }
        });

        // Should have validation issues or adjusted positions
        expect(result.validation).toBeDefined();
    });

    test('prepareLogoOverlay should handle empty logos array', () => {
        const result = prepareLogoOverlay({
            logos: [],
            canvas: { width: 1920, height: 1080 }
        });

        expect(result.positions.length).toBe(0);
        expect(result.valid).toBe(true);
        expect(result.promptInstructions).toBe('');
    });

    test('prepareLogoOverlay should use default canvas if not provided', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix', position: 'topRight' }]
        });

        expect(result.positions.length).toBe(1);
        expect(result._input.canvas.width).toBe(DEFAULT_CANVAS.width);
        expect(result._input.canvas.height).toBe(DEFAULT_CANVAS.height);
    });

    test('prepareLogoOverlay should default to topRight position', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix' }] // No position specified
        });

        expect(result.positions.length).toBe(1);
        // Should be in top-right area
        expect(result.positions[0].x).toBeGreaterThan(DEFAULT_CANVAS.width / 2);
        expect(result.positions[0].y).toBeLessThan(DEFAULT_CANVAS.height / 2);
    });

    test('prepareLogoOverlay should include validation details', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix', position: 'topRight' }],
            canvas: { width: 1920, height: 1080 }
        });

        expect(result.validation).toBeDefined();
        expect(result.validation.isValid).toBeDefined();
        expect(result.validation.errors).toBeDefined();
        expect(result.validation.warnings).toBeDefined();
    });

    test('prepareLogoOverlay should generate prompt instructions', () => {
        const result = prepareLogoOverlay({
            logos: [
                { name: 'Netflix', position: 'topRight' },
                { name: 'HBO', position: 'topLeft' }
            ]
        });

        expect(result.promptInstructions).toContain('Netflix');
        expect(result.promptInstructions).toContain('HBO');
        expect(result.promptInstructions).toContain('BRAND LOGO');
    });

    test('prepareLogoOverlay output should match expected structure', () => {
        const result = prepareLogoOverlay({
            logos: [
                { name: 'Netflix', position: 'topRight' },
                { name: 'HBO', position: 'topRight' }
            ],
            canvas: { width: 1920, height: 1080 },
            subject: { bounds: { x: 100, y: 200, width: 600, height: 800 } },
            text: { bounds: { x: 900, y: 300, width: 900, height: 200 } }
        });

        // Check top-level structure
        expect(result).toHaveProperty('positions');
        expect(result).toHaveProperty('promptInstructions');
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('warnings');
        expect(result).toHaveProperty('validation');

        // Check positions structure
        result.positions.forEach(pos => {
            expect(pos).toHaveProperty('name');
            expect(pos).toHaveProperty('x');
            expect(pos).toHaveProperty('y');
            expect(pos).toHaveProperty('width');
            expect(pos).toHaveProperty('height');
            expect(pos).toHaveProperty('anchor');
        });
    });
});

// ============================================================================
// EDGE CASES TESTS
// ============================================================================

describe('Logo Positioning Service - Edge Cases', () => {
    test('should handle very small canvas', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix', position: 'topRight' }],
            canvas: { width: 320, height: 180 }
        });

        expect(result.positions.length).toBe(1);
        // Logo should be scaled down but respects minimum height constraint
        // With min height 40 and aspect ratio 3.5 (netflix), width = 140
        // But constrained by maxWidth (40% of 320 = 128)
        // Height recalculated: 128 / 3.5 = 36.5 which is below min, so clamped
        // Final: height=40, width=min(40*3.5=140, 128)=128
        expect(result.positions[0].width).toBeLessThanOrEqual(128);
        expect(result.positions[0].height).toBeGreaterThanOrEqual(LOGO_SIZE_CONSTRAINTS.minHeight);
    });

    test('should handle very large canvas (4K)', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix', position: 'topRight' }],
            canvas: { width: 3840, height: 2160 }
        });

        expect(result.positions.length).toBe(1);
        // Logo should be scaled up proportionally
        expect(result.positions[0].width).toBeGreaterThan(150);
    });

    test('should handle logo with custom aspect ratio', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Custom', position: 'topRight', aspectRatio: 5.0 }],
            canvas: { width: 1920, height: 1080 }
        });

        expect(result.positions.length).toBe(1);
        const ratio = result.positions[0].width / result.positions[0].height;
        // Should be close to the custom aspect ratio (may be constrained by max width)
        expect(ratio).toBeLessThanOrEqual(5.0);
    });

    test('should handle maximum number of logos (3)', () => {
        const result = prepareLogoOverlay({
            logos: [
                { name: 'Logo1', position: 'topRight' },
                { name: 'Logo2', position: 'topRight' },
                { name: 'Logo3', position: 'topRight' }
            ],
            canvas: { width: 1920, height: 1080 }
        });

        expect(result.positions.length).toBe(3);
        // All logos should be smaller than single logo would be
        result.positions.forEach(pos => {
            expect(pos.height).toBeLessThanOrEqual(LOGO_SIZE_CONSTRAINTS.multipleLogoHeight.max);
        });
    });

    test('should handle null subject and text bounds', () => {
        const result = prepareLogoOverlay({
            logos: [{ name: 'Netflix', position: 'topRight' }],
            canvas: { width: 1920, height: 1080 },
            subject: null,
            text: null
        });

        expect(result.valid).toBe(true);
    });

    test('should preserve input in _input field', () => {
        const input = {
            logos: [{ name: 'Netflix', position: 'topRight' }],
            canvas: { width: 1920, height: 1080 },
            subject: { bounds: { x: 100, y: 200, width: 600, height: 800 } },
            text: { bounds: { x: 900, y: 300, width: 900, height: 200 } }
        };
        const result = prepareLogoOverlay(input);

        expect(result._input).toBeDefined();
        expect(result._input.logos).toEqual(input.logos);
        expect(result._input.canvas).toEqual(input.canvas);
    });
});
