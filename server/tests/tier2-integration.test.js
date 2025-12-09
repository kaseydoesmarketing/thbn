/**
 * Tier 2 Services Integration Test
 *
 * Tests that all three Tier 2 services are properly functional
 * and can be integrated into the thumbnail generation pipeline
 */

const path = require('path');

// Tier 2 Services
const emotionService = require('../src/services/emotionExpressionService');
const faceService = require('../src/services/faceEnhancementService');
const styleService = require('../src/services/styleTransferService');

describe('Tier 2 Services Integration', () => {

    describe('Emotion Expression Service', () => {
        test('should detect emotion from context', () => {
            const result = emotionService.detectEmotionFromContext({
                brief: "I can't believe what happened!",
                niche: "tech"
            });

            expect(result).toHaveProperty('emotion');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('colors');
            expect(result.emotion).toBe('surprised');
            expect(result.score).toBeGreaterThan(0);
        });

        test('should enhance prompt with emotion keywords', () => {
            const basePrompt = "Portrait of content creator";
            const enhanced = emotionService.enhancePromptWithEmotion('excited', basePrompt);

            expect(enhanced).toContain('excited expression');
            expect(enhanced).toContain('huge smile');
            expect(enhanced.length).toBeGreaterThan(basePrompt.length);
        });

        test('should map niche to archetype emotion', () => {
            const gaming = emotionService.detectEmotionFromContext({ niche: 'gaming' });
            expect(['excited', 'surprised']).toContain(gaming.emotion);

            const finance = emotionService.detectEmotionFromContext({ niche: 'finance' });
            expect(['confident', 'neutral']).toContain(finance.emotion);
        });

        test('should return color palette for emotions', () => {
            const result = emotionService.detectEmotionFromContext({ brief: "shocking news!" });
            expect(result.colors).toBeDefined();
            expect(Array.isArray(result.colors)).toBe(true);
            expect(result.colors.length).toBeGreaterThan(0);
        });

        test('should have viral scores for all emotions', () => {
            const emotions = ['surprised', 'excited', 'angry', 'happy', 'confident'];
            emotions.forEach(emotion => {
                const enhanced = emotionService.enhancePromptWithEmotion(emotion, 'test');
                expect(enhanced).toBeTruthy();
            });
        });
    });

    describe('Face Enhancement Service', () => {
        test('should have all required presets', () => {
            const requiredPresets = [
                'natural',
                'subtle',
                'professional',
                'thumbnail',
                'viral'
            ];

            const presets = faceService.getAvailablePresets();
            requiredPresets.forEach(preset => {
                expect(presets).toContain(preset);
            });
        });

        test('should return preset configuration', () => {
            const config = faceService.getPresetConfig('thumbnail');

            expect(config).toHaveProperty('name');
            expect(config).toHaveProperty('skinSmooth');
            expect(config).toHaveProperty('eyeBrighten');
            expect(config).toHaveProperty('teethWhiten');
            expect(config.skinSmooth).toBeGreaterThan(0);
        });

        test('should validate custom enhancement values', () => {
            const valid = faceService.validateEnhancementConfig({
                skinSmooth: 0.3,
                eyeBrighten: 0.2
            });
            expect(valid).toBe(true);

            const invalid = faceService.validateEnhancementConfig({
                skinSmooth: 1.5  // Too high
            });
            expect(invalid).toBe(false);
        });

        test('thumbnail preset should have optimal values', () => {
            const thumbnail = faceService.getPresetConfig('thumbnail');

            // Should be higher intensity for small previews
            expect(thumbnail.skinSmooth).toBeGreaterThanOrEqual(0.3);
            expect(thumbnail.eyeBrighten).toBeGreaterThanOrEqual(0.25);
            expect(thumbnail.sharpen).toBeDefined();
        });

        test('should provide enhancement descriptions', () => {
            const description = faceService.getPresetDescription('professional');
            expect(description).toBeTruthy();
            expect(typeof description).toBe('string');
        });
    });

    describe('Style Transfer Service', () => {
        test('should have all style categories', () => {
            const categories = styleService.getStyleCategories();

            expect(categories).toContain('cinematic');
            expect(categories).toContain('viral');
            expect(categories).toContain('vintage');
            expect(categories).toContain('artistic');
        });

        test('should list styles by category', () => {
            const viral = styleService.getStylesByCategory('viral');

            expect(Array.isArray(viral)).toBe(true);
            expect(viral.length).toBeGreaterThan(0);
            expect(viral).toContain('viral-pop');
            expect(viral).toContain('mrbeast');
        });

        test('should return style preset configuration', () => {
            const config = styleService.getStyleConfig('cinematic-orange-teal');

            expect(config).toHaveProperty('name');
            expect(config).toHaveProperty('category');
            expect(config).toHaveProperty('adjustments');
            expect(config.category).toBe('cinematic');
        });

        test('should validate style preset names', () => {
            expect(styleService.isValidStyle('mrbeast')).toBe(true);
            expect(styleService.isValidStyle('viral-pop')).toBe(true);
            expect(styleService.isValidStyle('invalid-style')).toBe(false);
        });

        test('MrBeast style should have high saturation', () => {
            const config = styleService.getStyleConfig('mrbeast');

            expect(config.adjustments.saturation).toBeGreaterThanOrEqual(1.3);
            expect(config.adjustments.contrast).toBeGreaterThanOrEqual(1.2);
        });

        test('should support custom style creation', () => {
            const customConfig = {
                contrast: 1.2,
                saturation: 1.1,
                shadows: { r: -10, g: 5, b: 15 }
            };

            const valid = styleService.validateCustomStyle(customConfig);
            expect(valid).toBe(true);
        });

        test('should provide style recommendations based on niche', () => {
            const techStyle = styleService.recommendStyleForNiche('tech');
            expect(techStyle).toBeDefined();

            const gamingStyle = styleService.recommendStyleForNiche('gaming');
            expect(['neon-cyberpunk', 'electric-blue']).toContain(gamingStyle);
        });
    });

    describe('Cross-Service Integration', () => {
        test('emotion should influence face enhancement preset', () => {
            const emotionData = emotionService.detectEmotionFromContext({
                brief: "This is SO EXCITING!",
                niche: 'tech'
            });

            // Excited emotion should suggest higher enhancement
            expect(emotionData.emotion).toBe('excited');

            // Should recommend thumbnail or viral preset
            const recommendedPreset = emotionData.emotion === 'excited' ? 'viral' : 'thumbnail';
            const config = faceService.getPresetConfig(recommendedPreset);
            expect(config).toBeDefined();
        });

        test('emotion should influence style selection', () => {
            const emotions = {
                'surprised': ['viral-pop', 'hypercolor'],
                'angry': ['film-noir', 'cinematic-cold'],
                'excited': ['mrbeast', 'viral-pop']
            };

            Object.entries(emotions).forEach(([emotion, expectedStyles]) => {
                const styleRec = styleService.recommendStyleForEmotion(emotion);
                expect(expectedStyles).toContain(styleRec);
            });
        });

        test('complete pipeline simulation', () => {
            // Step 1: Detect emotion
            const emotion = emotionService.detectEmotionFromContext({
                brief: "You won't believe this shocking discovery!",
                niche: "tech"
            });

            // Step 2: Get recommended face preset
            const facePreset = emotion.score > 85 ? 'viral' : 'thumbnail';
            const faceConfig = faceService.getPresetConfig(facePreset);

            // Step 3: Get recommended style
            const style = styleService.recommendStyleForEmotion(emotion.emotion);
            const styleConfig = styleService.getStyleConfig(style);

            // Verify complete pipeline
            expect(emotion.emotion).toBe('surprised');
            expect(faceConfig).toBeDefined();
            expect(styleConfig).toBeDefined();
            expect(styleConfig.category).toBe('viral');
        });

        test('should handle neutral content gracefully', () => {
            const neutral = emotionService.detectEmotionFromContext({
                brief: "A guide to setting up PostgreSQL",
                niche: "tutorial"
            });

            expect(neutral.emotion).toBeDefined();

            // Should still provide valid configs
            const faceConfig = faceService.getPresetConfig('professional');
            const styleConfig = styleService.getStyleConfig('cinematic-warm');

            expect(faceConfig).toBeDefined();
            expect(styleConfig).toBeDefined();
        });

        test('performance: all services should be fast', () => {
            const start = Date.now();

            // Run all services
            emotionService.detectEmotionFromContext({ brief: "test", niche: "tech" });
            faceService.getPresetConfig('thumbnail');
            styleService.getStyleConfig('viral-pop');

            const duration = Date.now() - start;

            // Should complete in under 50ms (no image processing)
            expect(duration).toBeLessThan(50);
        });
    });

    describe('Error Handling', () => {
        test('emotion service should handle missing inputs', () => {
            const result1 = emotionService.detectEmotionFromContext({});
            expect(result1.emotion).toBe('neutral');

            const result2 = emotionService.detectEmotionFromContext({ brief: "" });
            expect(result2.emotion).toBeDefined();
        });

        test('face service should handle invalid preset names', () => {
            const config = faceService.getPresetConfig('invalid-preset-name');
            expect(config).toBeNull();
        });

        test('style service should handle invalid category', () => {
            const styles = styleService.getStylesByCategory('invalid-category');
            expect(Array.isArray(styles)).toBe(true);
            expect(styles.length).toBe(0);
        });

        test('should validate enhancement intensity limits', () => {
            const tooHigh = faceService.validateEnhancementConfig({ skinSmooth: 2.0 });
            expect(tooHigh).toBe(false);

            const negative = faceService.validateEnhancementConfig({ eyeBrighten: -0.5 });
            expect(negative).toBe(false);

            const valid = faceService.validateEnhancementConfig({ skinSmooth: 0.35 });
            expect(valid).toBe(true);
        });
    });

    describe('API Integration Readiness', () => {
        test('should provide all data needed for API responses', () => {
            const emotionData = emotionService.detectEmotionFromContext({
                brief: "Amazing results!",
                niche: "fitness"
            });

            const apiResponse = {
                emotion: emotionData.emotion,
                viralScore: emotionData.score,
                recommendedColors: emotionData.colors,
                facePreset: emotionData.score > 85 ? 'viral' : 'thumbnail',
                stylePreset: styleService.recommendStyleForEmotion(emotionData.emotion)
            };

            // Verify API response structure
            expect(apiResponse.emotion).toBeDefined();
            expect(apiResponse.viralScore).toBeGreaterThan(0);
            expect(Array.isArray(apiResponse.recommendedColors)).toBe(true);
            expect(apiResponse.facePreset).toBeDefined();
            expect(apiResponse.stylePreset).toBeDefined();
        });

        test('should match documentation examples', () => {
            // From TIER_2_ENHANCEMENTS.md examples
            const emotion = emotionService.detectEmotionFromContext({
                brief: "I can't believe Netflix did this!",
                niche: "tech"
            });

            expect(emotion.emotion).toBe('surprised');
            expect(emotion.score).toBe(95);
            expect(emotion.colors).toEqual(['#ffff00', '#ff6600']);
        });
    });
});

// Export for manual testing
if (require.main === module) {
    console.log('🧪 Running Tier 2 Integration Tests...\n');

    // Manual test run
    const emotion = emotionService.detectEmotionFromContext({
        brief: "This shocking revelation will change everything!",
        niche: "tech"
    });

    console.log('✅ Emotion Detection:', emotion);
    console.log('✅ Face Presets:', faceService.getAvailablePresets());
    console.log('✅ Style Categories:', styleService.getStyleCategories());
    console.log('\n✅ All Tier 2 services loaded successfully!\n');
}
