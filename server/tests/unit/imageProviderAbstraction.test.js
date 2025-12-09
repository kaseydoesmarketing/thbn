/**
 * Unit Tests for Image Provider Abstraction Layer
 *
 * Tests cover:
 * - imageModels.js configuration functions
 * - modelSwitcher.js service functions
 * - Cost tracking calculations
 * - Model availability checks
 * - Default model configurations
 */

const imageModels = require('../../src/config/imageModels');
const modelSwitcher = require('../../src/services/modelSwitcher');

// ============================================================================
// TEST: imageModels.js
// ============================================================================

describe('imageModels', () => {
    describe('getActiveModel', () => {
        test('should return default primary model when env not set', () => {
            const originalEnv = process.env.GEMINI_PRIMARY_MODEL;
            delete process.env.GEMINI_PRIMARY_MODEL;
            
            const model = imageModels.getActiveModel();
            expect(model).toBe('gemini-3-pro-image-preview');
            
            if (originalEnv) process.env.GEMINI_PRIMARY_MODEL = originalEnv;
        });

        test('should return env model when set', () => {
            const originalEnv = process.env.GEMINI_PRIMARY_MODEL;
            process.env.GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash-image';
            
            const model = imageModels.getActiveModel();
            expect(model).toBe('gemini-2.5-flash-image');
            
            process.env.GEMINI_PRIMARY_MODEL = originalEnv || '';
        });
    });

    describe('getFallbackModel', () => {
        test('should return default fallback model', () => {
            const model = imageModels.getFallbackModel();
            expect(model).toBe('gemini-2.5-flash-image');
        });
    });

    describe('getModelConfig', () => {
        test('should return config for valid model', () => {
            const config = imageModels.getModelConfig('gemini-3-pro-image-preview');
            
            expect(config).toBeDefined();
            expect(config.name).toBe('Gemini 3 Pro Image Preview');
            expect(config.family).toBe('gemini-3');
            expect(config.pricing).toBeDefined();
            expect(config.pricing.imagesGenerated).toBe(0.40);
        });

        test('should return null for invalid model', () => {
            const config = imageModels.getModelConfig('invalid-model');
            expect(config).toBeNull();
        });

        test('should have correct pricing for gemini-2.5-flash', () => {
            const config = imageModels.getModelConfig('gemini-2.5-flash-image');
            
            expect(config.pricing.imagesGenerated).toBe(0.039);
            expect(config.deprecationDate).toBe('2026-01-15');
        });

        test('should have zero pricing for experimental model', () => {
            const config = imageModels.getModelConfig('gemini-2.0-flash-exp');
            
            expect(config.pricing.imagesGenerated).toBe(0);
            expect(config.fallbackOnly).toBe(true);
        });
    });

    describe('estimateCost', () => {
        test('should calculate cost for single image', () => {
            const cost = imageModels.estimateCost('gemini-3-pro-image-preview', 1);
            expect(cost).toBe(0.40);
        });

        test('should calculate cost for multiple images', () => {
            const cost = imageModels.estimateCost('gemini-3-pro-image-preview', 10);
            expect(cost).toBe(4.00);
        });

        test('should return 0 for invalid model', () => {
            const cost = imageModels.estimateCost('invalid-model', 10);
            expect(cost).toBe(0);
        });

        test('should use cheaper rate for flash model', () => {
            const cost = imageModels.estimateCost('gemini-2.5-flash-image', 10);
            expect(cost).toBeCloseTo(0.39, 2);
        });
    });

    describe('getAllModels', () => {
        test('should return array of models', () => {
            const models = imageModels.getAllModels();
            
            expect(Array.isArray(models)).toBe(true);
            expect(models.length).toBeGreaterThan(0);
        });

        test('should include model id in each entry', () => {
            const models = imageModels.getAllModels();
            
            models.forEach(model => {
                expect(model.id).toBeDefined();
                expect(model.name).toBeDefined();
                expect(model.pricing).toBeDefined();
            });
        });
    });

    describe('isModelAvailable', () => {
        test('should return true for available models', () => {
            expect(imageModels.isModelAvailable('gemini-3-pro-image-preview')).toBe(true);
            expect(imageModels.isModelAvailable('gemini-2.5-flash-image')).toBe(true);
        });

        test('should return false for invalid models', () => {
            expect(imageModels.isModelAvailable('invalid-model')).toBe(false);
        });
    });

    describe('getRecommendedModel', () => {
        test('should return quality model for quality use case', () => {
            const model = imageModels.getRecommendedModel('quality');
            expect(model).toBe('gemini-3-pro-image-preview');
        });

        test('should return fast model for speed use case', () => {
            const model = imageModels.getRecommendedModel('speed');
            expect(model).toBe('gemini-2.5-flash-image');
        });

        test('should return free model for cost use case', () => {
            const model = imageModels.getRecommendedModel('cost');
            expect(model).toBe('gemini-2.0-flash-exp');
        });
    });
});

// ============================================================================
// TEST: modelSwitcher.js
// ============================================================================

describe('modelSwitcher', () => {
    beforeEach(() => {
        // Reset to defaults before each test
        modelSwitcher.resetToDefaults('test');
    });

    describe('getCurrentConfig', () => {
        test('should return current configuration', () => {
            const config = modelSwitcher.getCurrentConfig();
            
            expect(config.primaryModel).toBeDefined();
            expect(config.fallbackModel).toBeDefined();
            expect(config.primaryConfig).toBeDefined();
            expect(config.fallbackConfig).toBeDefined();
            expect(config.lastUpdated).toBeDefined();
            expect(config.updatedBy).toBeDefined();
        });

        test('should have default models after reset', () => {
            const config = modelSwitcher.getCurrentConfig();
            
            expect(config.primaryModel).toBe('gemini-3-pro-image-preview');
            expect(config.fallbackModel).toBe('gemini-2.5-flash-image');
        });
    });

    describe('switchPrimaryModel', () => {
        test('should switch to valid model', () => {
            const result = modelSwitcher.switchPrimaryModel('gemini-2.5-flash-image', 'admin');
            
            expect(result.success).toBe(true);
            expect(result.newModel).toBe('gemini-2.5-flash-image');
            expect(result.previousModel).toBe('gemini-3-pro-image-preview');
            expect(result.updatedBy).toBe('admin');
        });

        test('should fail for invalid model', () => {
            const result = modelSwitcher.switchPrimaryModel('invalid-model', 'admin');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('not available');
        });

        test('should calculate cost impact', () => {
            const result = modelSwitcher.switchPrimaryModel('gemini-2.5-flash-image', 'admin');
            
            expect(result.costImpact).toBeDefined();
            expect(result.costImpact.previousCostPerImage).toBe(0.40);
            expect(result.costImpact.newCostPerImage).toBe(0.039);
        });
    });

    describe('switchFallbackModel', () => {
        test('should switch fallback to valid model', () => {
            const result = modelSwitcher.switchFallbackModel('gemini-2.0-flash-exp', 'admin');
            
            expect(result.success).toBe(true);
            expect(result.newModel).toBe('gemini-2.0-flash-exp');
        });

        test('should fail for invalid model', () => {
            const result = modelSwitcher.switchFallbackModel('invalid-model', 'admin');
            
            expect(result.success).toBe(false);
        });
    });

    describe('getCostComparison', () => {
        test('should compare costs for default image count', () => {
            const comparison = modelSwitcher.getCostComparison();
            
            expect(comparison.imageCount).toBe(100);
            expect(Array.isArray(comparison.models)).toBe(true);
            expect(comparison.models.length).toBeGreaterThan(0);
        });

        test('should compare costs for custom image count', () => {
            const comparison = modelSwitcher.getCostComparison(1000);
            
            expect(comparison.imageCount).toBe(1000);
            
            // Models should be sorted by cost
            const costs = comparison.models.map(m => m.costPerImage);
            for (let i = 1; i < costs.length; i++) {
                expect(costs[i]).toBeGreaterThanOrEqual(costs[i-1]);
            }
        });
    });

    describe('getModelHealth', () => {
        test('should return health status for configured models', () => {
            const health = modelSwitcher.getModelHealth();
            
            expect(health.primary).toBeDefined();
            expect(health.fallback).toBeDefined();
            expect(health.primary.available).toBe(true);
            expect(health.fallback.available).toBe(true);
        });

        test('should include deprecation warnings where applicable', () => {
            const health = modelSwitcher.getModelHealth();
            
            // Check if fallback (gemini-2.5-flash-image) has deprecation warning
            if (health.fallback.model === 'gemini-2.5-flash-image') {
                expect(health.fallback.deprecationWarning).toContain('deprecated');
            }
        });
    });

    describe('resetToDefaults', () => {
        test('should reset all settings to defaults', () => {
            // First change some settings
            modelSwitcher.switchPrimaryModel('gemini-2.5-flash-image', 'admin');
            modelSwitcher.switchFallbackModel('gemini-2.0-flash-exp', 'admin');
            
            // Then reset
            const result = modelSwitcher.resetToDefaults('admin');
            
            expect(result.success).toBe(true);
            expect(result.newPrimary).toBe('gemini-3-pro-image-preview');
            expect(result.newFallback).toBe('gemini-2.5-flash-image');
        });
    });
});

// ============================================================================
// TEST: ImageProvider base class
// ============================================================================

describe('ImageProvider', () => {
    const ImageProvider = require('../../src/services/imageProvider');
    const { ImageProviderError } = ImageProvider;

    describe('ImageProviderError', () => {
        test('should create error with all properties', () => {
            const error = new ImageProviderError(
                'Test error',
                'TEST_CODE',
                400,
                false,
                { extra: 'data' }
            );
            
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.statusCode).toBe(400);
            expect(error.isRetryable).toBe(false);
            expect(error.context.extra).toBe('data');
            expect(error.timestamp).toBeDefined();
        });

        test('should use defaults for optional properties', () => {
            const error = new ImageProviderError('Simple error');
            
            expect(error.code).toBe('PROVIDER_ERROR');
            expect(error.statusCode).toBe(500);
            expect(error.isRetryable).toBe(false);
        });

        test('should serialize to JSON correctly', () => {
            const error = new ImageProviderError('Test error', 'TEST_CODE', 400);
            const json = error.toJSON();
            
            expect(json.error).toBeDefined();
            expect(json.error.code).toBe('TEST_CODE');
            expect(json.error.message).toBe('Test error');
            expect(json.error.statusCode).toBe(400);
        });
    });

    describe('ImageProvider abstract class', () => {
        test('should throw when instantiated directly', () => {
            expect(() => {
                new ImageProvider({ apiKey: 'test' });
            }).toThrow('ImageProvider is an abstract class');
        });

        test('should require config', () => {
            class ConcreteProvider extends ImageProvider {}
            
            expect(() => {
                new ConcreteProvider();
            }).toThrow();
        });

        test('should require API key', () => {
            class ConcreteProvider extends ImageProvider {}
            
            expect(() => {
                new ConcreteProvider({});
            }).toThrow();
        });
    });
});
