/**
 * Glassy Mode Service V8
 *
 * Adds cinematic premium aesthetic to thumbnails:
 * - Bloom around bright UI elements/logos
 * - Soft reflections and light streaks
 * - Gentle vignette for focus
 * - Intensity slider control (0-100%)
 *
 * Uses Sharp for image processing - NO external dependencies
 */

const sharp = require('sharp');

// Glassy Mode Presets
const GLASSY_PRESETS = {
    subtle: {
        intensity: 25,
        bloom: { radius: 15, strength: 0.2, threshold: 200 },
        vignette: { strength: 0.15, size: 0.7 },
        lightStreaks: { enabled: false },
        colorGrade: { warmth: 1.02, contrast: 1.05 }
    },
    balanced: {
        intensity: 50,
        bloom: { radius: 25, strength: 0.35, threshold: 180 },
        vignette: { strength: 0.25, size: 0.6 },
        lightStreaks: { enabled: true, angle: 45, length: 50, strength: 0.15 },
        colorGrade: { warmth: 1.05, contrast: 1.1 }
    },
    cinematic: {
        intensity: 75,
        bloom: { radius: 40, strength: 0.5, threshold: 160 },
        vignette: { strength: 0.35, size: 0.5 },
        lightStreaks: { enabled: true, angle: 30, length: 80, strength: 0.25 },
        colorGrade: { warmth: 1.08, contrast: 1.15 }
    },
    dramatic: {
        intensity: 100,
        bloom: { radius: 60, strength: 0.7, threshold: 140 },
        vignette: { strength: 0.45, size: 0.4 },
        lightStreaks: { enabled: true, angle: 25, length: 120, strength: 0.35 },
        colorGrade: { warmth: 1.12, contrast: 1.2 }
    }
};

/**
 * Get preset configuration by intensity value
 */
function getPresetByIntensity(intensity) {
    if (intensity <= 25) return GLASSY_PRESETS.subtle;
    if (intensity <= 50) return GLASSY_PRESETS.balanced;
    if (intensity <= 75) return GLASSY_PRESETS.cinematic;
    return GLASSY_PRESETS.dramatic;
}

/**
 * Interpolate between presets based on exact intensity value
 */
function interpolateSettings(intensity) {
    const clampedIntensity = Math.max(0, Math.min(100, intensity));

    // Scale factors based on intensity
    const scale = clampedIntensity / 100;

    return {
        bloom: {
            radius: Math.round(15 + (45 * scale)),
            strength: 0.2 + (0.5 * scale),
            threshold: Math.round(200 - (60 * scale))
        },
        vignette: {
            strength: 0.15 + (0.3 * scale),
            size: 0.7 - (0.3 * scale)
        },
        lightStreaks: {
            enabled: intensity > 30,
            angle: 45 - (20 * scale),
            length: Math.round(50 + (70 * scale)),
            strength: 0.15 + (0.2 * scale)
        },
        colorGrade: {
            warmth: 1.02 + (0.1 * scale),
            contrast: 1.05 + (0.15 * scale)
        }
    };
}

/**
 * Create vignette overlay SVG
 */
function createVignetteOverlay(width, height, strength, size) {
    // size: 0 = tight focus, 1 = wide/subtle
    // strength: 0 = transparent, 1 = dark edges

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const innerRadius = maxRadius * size;

    // Create radial gradient for smooth vignette
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="vignette" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
                    <stop offset="${size * 100}%" style="stop-color:black;stop-opacity:0"/>
                    <stop offset="100%" style="stop-color:black;stop-opacity:${strength}"/>
                </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#vignette)"/>
        </svg>
    `;

    return Buffer.from(svg);
}

/**
 * Create bloom effect using Gaussian blur on bright areas
 * This is a simplified approach that works well with Sharp
 */
async function applyBloom(imageBuffer, options) {
    const { radius, strength, threshold } = options;

    try {
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        // Create a blurred version for bloom
        const blurred = await sharp(imageBuffer)
            .blur(radius)
            .toBuffer();

        // Composite: original + blurred (screen blend simulation)
        // Since Sharp doesn't have screen blend, we'll use overlay with reduced opacity
        const result = await sharp(imageBuffer)
            .composite([{
                input: blurred,
                blend: 'soft-light',
                opacity: strength
            }])
            .toBuffer();

        return result;
    } catch (error) {
        console.error('[GlassyMode] Bloom error:', error.message);
        return imageBuffer; // Return original on error
    }
}

/**
 * Apply cinematic color grading
 */
async function applyColorGrade(imageBuffer, options) {
    const { warmth, contrast } = options;

    try {
        // Apply contrast and slight warmth
        // Warmth is simulated by adjusting saturation and modulate
        const result = await sharp(imageBuffer)
            .modulate({
                brightness: 1,
                saturation: warmth > 1 ? 1.05 : 1,
                hue: warmth > 1 ? 5 : 0 // Slight warm shift
            })
            .linear(contrast, -(128 * (contrast - 1))) // Contrast adjustment
            .toBuffer();

        return result;
    } catch (error) {
        console.error('[GlassyMode] Color grade error:', error.message);
        return imageBuffer;
    }
}

/**
 * Apply vignette effect
 */
async function applyVignette(imageBuffer, options) {
    const { strength, size } = options;

    try {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        // Create vignette overlay
        const vignetteOverlay = createVignetteOverlay(width, height, strength, size);

        // Composite vignette over image
        const result = await sharp(imageBuffer)
            .composite([{
                input: vignetteOverlay,
                blend: 'multiply'
            }])
            .toBuffer();

        return result;
    } catch (error) {
        console.error('[GlassyMode] Vignette error:', error.message);
        return imageBuffer;
    }
}

/**
 * Create light streak overlay (anamorphic lens flare simulation)
 */
function createLightStreakOverlay(width, height, options) {
    const { angle, length, strength } = options;

    // Create horizontal light streaks emanating from center
    const centerX = width / 2;
    const centerY = height / 2;

    // Calculate streak endpoints
    const radians = (angle * Math.PI) / 180;
    const dx = Math.cos(radians) * length;
    const dy = Math.sin(radians) * length;

    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="streak1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:white;stop-opacity:0"/>
                    <stop offset="50%" style="stop-color:white;stop-opacity:${strength}"/>
                    <stop offset="100%" style="stop-color:white;stop-opacity:0"/>
                </linearGradient>
                <filter id="blur">
                    <feGaussianBlur stdDeviation="3"/>
                </filter>
            </defs>
            <!-- Horizontal light streak -->
            <rect x="0" y="${centerY - 2}" width="${width}" height="4"
                  fill="url(#streak1)" filter="url(#blur)" opacity="${strength * 0.5}"/>
            <!-- Diagonal streak -->
            <line x1="${centerX - dx}" y1="${centerY - dy}"
                  x2="${centerX + dx}" y2="${centerY + dy}"
                  stroke="rgba(255,255,255,${strength * 0.3})"
                  stroke-width="2" filter="url(#blur)"/>
        </svg>
    `;

    return Buffer.from(svg);
}

/**
 * Apply light streak effect (anamorphic lens flare)
 */
async function applyLightStreaks(imageBuffer, options) {
    if (!options.enabled) {
        return imageBuffer;
    }

    try {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;

        const streakOverlay = createLightStreakOverlay(width, height, options);

        const result = await sharp(imageBuffer)
            .composite([{
                input: streakOverlay,
                blend: 'screen'
            }])
            .toBuffer();

        return result;
    } catch (error) {
        console.error('[GlassyMode] Light streak error:', error.message);
        return imageBuffer;
    }
}

/**
 * Apply highlight enhancement for UI elements and bright areas
 */
async function enhanceHighlights(imageBuffer, intensity) {
    try {
        // Subtle highlight enhancement
        const enhanceAmount = 1 + (intensity / 500); // Very subtle: 1.0 to 1.2

        const result = await sharp(imageBuffer)
            .modulate({
                brightness: enhanceAmount
            })
            .toBuffer();

        return result;
    } catch (error) {
        console.error('[GlassyMode] Highlight enhance error:', error.message);
        return imageBuffer;
    }
}

/**
 * Main Glassy Mode Application
 *
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {Object} options - Glassy mode options
 * @param {number} options.intensity - Effect intensity (0-100)
 * @param {string} [options.preset] - Optional preset name ('subtle', 'balanced', 'cinematic', 'dramatic')
 * @param {boolean} [options.bloom=true] - Enable bloom effect
 * @param {boolean} [options.vignette=true] - Enable vignette
 * @param {boolean} [options.lightStreaks=true] - Enable light streaks
 * @param {boolean} [options.colorGrade=true] - Enable color grading
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function applyGlassyMode(imageBuffer, options = {}) {
    const {
        intensity = 50,
        preset = null,
        bloom: enableBloom = true,
        vignette: enableVignette = true,
        lightStreaks: enableLightStreaks = true,
        colorGrade: enableColorGrade = true
    } = options;

    // Skip processing if intensity is 0
    if (intensity === 0) {
        console.log('[GlassyMode] Intensity 0, skipping processing');
        return imageBuffer;
    }

    console.log(`[GlassyMode] Applying with intensity: ${intensity}${preset ? `, preset: ${preset}` : ''}`);

    // Get settings from preset or interpolate
    const settings = preset && GLASSY_PRESETS[preset]
        ? GLASSY_PRESETS[preset]
        : interpolateSettings(intensity);

    let processedBuffer = imageBuffer;

    try {
        // Apply effects in order for best visual result

        // 1. Color grading first (foundational adjustment)
        if (enableColorGrade) {
            console.log('[GlassyMode] Applying color grade...');
            processedBuffer = await applyColorGrade(processedBuffer, settings.colorGrade);
        }

        // 2. Bloom effect (adds glow to bright areas)
        if (enableBloom) {
            console.log('[GlassyMode] Applying bloom...');
            processedBuffer = await applyBloom(processedBuffer, settings.bloom);
        }

        // 3. Light streaks (cinematic flare)
        if (enableLightStreaks && settings.lightStreaks.enabled) {
            console.log('[GlassyMode] Applying light streaks...');
            processedBuffer = await applyLightStreaks(processedBuffer, settings.lightStreaks);
        }

        // 4. Vignette last (frames the final image)
        if (enableVignette) {
            console.log('[GlassyMode] Applying vignette...');
            processedBuffer = await applyVignette(processedBuffer, settings.vignette);
        }

        // 5. Final highlight polish
        if (intensity > 50) {
            console.log('[GlassyMode] Enhancing highlights...');
            processedBuffer = await enhanceHighlights(processedBuffer, intensity);
        }

        console.log('[GlassyMode] Processing complete');
        return processedBuffer;

    } catch (error) {
        console.error('[GlassyMode] Processing error:', error.message);
        return imageBuffer; // Return original on any error
    }
}

/**
 * Get available presets with descriptions
 */
function getPresets() {
    return {
        subtle: {
            name: 'Subtle',
            description: 'Light enhancement, professional look',
            intensity: 25
        },
        balanced: {
            name: 'Balanced',
            description: 'Moderate cinematic effects, good for most thumbnails',
            intensity: 50
        },
        cinematic: {
            name: 'Cinematic',
            description: 'Strong cinematic look with visible effects',
            intensity: 75
        },
        dramatic: {
            name: 'Dramatic',
            description: 'Maximum impact, bold artistic style',
            intensity: 100
        }
    };
}

/**
 * Validate intensity value
 */
function validateIntensity(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, error: 'Intensity must be a number' };
    if (num < 0 || num > 100) return { valid: false, error: 'Intensity must be between 0 and 100' };
    return { valid: true, value: num };
}

/**
 * Generate prompt enhancement for glassy aesthetic
 * Used when generating the base image with AI
 */
function getGlassyPromptEnhancement(intensity) {
    if (intensity === 0) return '';

    const scale = intensity / 100;

    const enhancements = [];

    if (scale > 0.2) {
        enhancements.push('cinematic lighting');
    }
    if (scale > 0.4) {
        enhancements.push('subtle lens flare');
        enhancements.push('professional color grading');
    }
    if (scale > 0.6) {
        enhancements.push('anamorphic bokeh');
        enhancements.push('film-like quality');
    }
    if (scale > 0.8) {
        enhancements.push('dramatic lighting contrast');
        enhancements.push('cinematic atmosphere');
    }

    return enhancements.length > 0
        ? `, ${enhancements.join(', ')}`
        : '';
}

module.exports = {
    applyGlassyMode,
    getPresets,
    validateIntensity,
    getGlassyPromptEnhancement,
    GLASSY_PRESETS,
    // Export individual effects for testing/customization
    applyBloom,
    applyVignette,
    applyLightStreaks,
    applyColorGrade
};
