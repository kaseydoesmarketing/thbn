/**
 * Advanced Lighting System - Tier 2
 *
 * Creates dramatic, professional lighting effects for thumbnails
 * - Rim lighting (backlight glow)
 * - Key/fill/back 3-point lighting simulation
 * - Volumetric light rays (god rays)
 * - Dramatic shadows
 * - Color temperature control
 * - Light streak effects
 *
 * @module advancedLightingService
 */

const sharp = require('sharp');

// =============================================================================
// LIGHTING PRESETS
// =============================================================================

const LIGHTING_PRESETS = {
    // Standard Lighting
    'natural': {
        keyLight: { angle: 45, intensity: 1.0, color: '#ffffff', softness: 0.5 },
        fillLight: { angle: -30, intensity: 0.4, color: '#e0e8ff', softness: 0.7 },
        backLight: null,
        ambient: { intensity: 0.2, color: '#ffffff' },
        shadows: { intensity: 0.3, softness: 0.6 }
    },
    'soft': {
        keyLight: { angle: 30, intensity: 0.8, color: '#fff5e6', softness: 0.8 },
        fillLight: { angle: -45, intensity: 0.5, color: '#e6f0ff', softness: 0.9 },
        backLight: null,
        ambient: { intensity: 0.3, color: '#ffffff' },
        shadows: { intensity: 0.2, softness: 0.8 }
    },

    // Dramatic Lighting
    'dramatic': {
        keyLight: { angle: 60, intensity: 1.2, color: '#ffffff', softness: 0.3 },
        fillLight: { angle: -60, intensity: 0.2, color: '#8090a0', softness: 0.4 },
        backLight: { angle: 180, intensity: 0.6, color: '#ffffff', rim: true },
        ambient: { intensity: 0.1, color: '#1a1a2e' },
        shadows: { intensity: 0.7, softness: 0.3 }
    },
    'cinematic': {
        keyLight: { angle: 45, intensity: 1.1, color: '#ffeedd', softness: 0.4 },
        fillLight: { angle: -30, intensity: 0.25, color: '#99aacc', softness: 0.5 },
        backLight: { angle: 170, intensity: 0.8, color: '#ffd700', rim: true },
        ambient: { intensity: 0.15, color: '#1a1a2e' },
        shadows: { intensity: 0.6, softness: 0.4 },
        colorGrade: { warmth: 0.1, contrast: 1.1 }
    },
    'noir': {
        keyLight: { angle: 75, intensity: 1.3, color: '#ffffff', softness: 0.2 },
        fillLight: null,
        backLight: { angle: 180, intensity: 0.4, color: '#666666', rim: true },
        ambient: { intensity: 0.05, color: '#000000' },
        shadows: { intensity: 0.9, softness: 0.2 },
        colorGrade: { desaturate: 0.5, contrast: 1.3 }
    },

    // Colored Lighting
    'golden-hour': {
        keyLight: { angle: 20, intensity: 1.0, color: '#ffcc66', softness: 0.5 },
        fillLight: { angle: -45, intensity: 0.3, color: '#ff9966', softness: 0.6 },
        backLight: { angle: 160, intensity: 0.7, color: '#ffdd99', rim: true },
        ambient: { intensity: 0.2, color: '#ffeecc' },
        shadows: { intensity: 0.4, softness: 0.5, color: '#663300' },
        colorGrade: { warmth: 0.3 }
    },
    'blue-hour': {
        keyLight: { angle: 30, intensity: 0.9, color: '#99ccff', softness: 0.5 },
        fillLight: { angle: -40, intensity: 0.35, color: '#6699cc', softness: 0.6 },
        backLight: { angle: 175, intensity: 0.5, color: '#ccddff', rim: true },
        ambient: { intensity: 0.25, color: '#334466' },
        shadows: { intensity: 0.5, softness: 0.5, color: '#112244' },
        colorGrade: { coolness: 0.2 }
    },
    'neon-glow': {
        keyLight: { angle: 0, intensity: 0.8, color: '#ff00ff', softness: 0.6 },
        fillLight: { angle: 180, intensity: 0.6, color: '#00ffff', softness: 0.6 },
        backLight: { angle: 90, intensity: 0.5, color: '#ff00ff', rim: true },
        ambient: { intensity: 0.15, color: '#110022' },
        shadows: { intensity: 0.4, softness: 0.4 },
        glow: { intensity: 0.4, colors: ['#ff00ff', '#00ffff'] }
    },
    'fire-light': {
        keyLight: { angle: -30, intensity: 1.1, color: '#ff6600', softness: 0.4 },
        fillLight: { angle: 45, intensity: 0.4, color: '#ff3300', softness: 0.5 },
        backLight: null,
        ambient: { intensity: 0.1, color: '#330000' },
        shadows: { intensity: 0.6, softness: 0.4, color: '#220000' },
        flicker: { intensity: 0.15, speed: 'medium' }
    },

    // Special Effects
    'spotlight': {
        keyLight: { angle: 0, intensity: 1.5, color: '#ffffff', softness: 0.2, spotlight: true },
        fillLight: null,
        backLight: null,
        ambient: { intensity: 0.05, color: '#000000' },
        shadows: { intensity: 0.9, softness: 0.1 }
    },
    'rim-only': {
        keyLight: null,
        fillLight: null,
        backLight: { angle: 180, intensity: 1.2, color: '#ffffff', rim: true, thickness: 0.03 },
        ambient: { intensity: 0.1, color: '#1a1a1a' },
        shadows: { intensity: 0.5, softness: 0.3 }
    },
    'split': {
        keyLight: { angle: 90, intensity: 1.1, color: '#ff6600', softness: 0.3 },
        fillLight: { angle: -90, intensity: 1.1, color: '#0066ff', softness: 0.3 },
        backLight: null,
        ambient: { intensity: 0.1, color: '#1a1a1a' },
        shadows: { intensity: 0.6, softness: 0.3 }
    },

    // MrBeast/Hormozi Style
    'viral-pop': {
        keyLight: { angle: 30, intensity: 1.2, color: '#ffffff', softness: 0.3 },
        fillLight: { angle: -45, intensity: 0.5, color: '#ffffff', softness: 0.5 },
        backLight: { angle: 180, intensity: 1.0, color: '#ffdd00', rim: true, thickness: 0.02 },
        ambient: { intensity: 0.2, color: '#ffffff' },
        shadows: { intensity: 0.4, softness: 0.4 },
        colorGrade: { saturation: 1.15, contrast: 1.1, vibrance: 1.2 }
    },
    'thumbnail-pro': {
        keyLight: { angle: 25, intensity: 1.15, color: '#fff5ee', softness: 0.35 },
        fillLight: { angle: -35, intensity: 0.45, color: '#e8f0ff', softness: 0.5 },
        backLight: { angle: 175, intensity: 0.9, color: '#ffffff', rim: true, thickness: 0.025 },
        ambient: { intensity: 0.15, color: '#ffffff' },
        shadows: { intensity: 0.35, softness: 0.45 },
        colorGrade: { saturation: 1.1, contrast: 1.08, clarity: 1.1 }
    }
};

// =============================================================================
// COLOR UTILITIES
// =============================================================================

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function blendColors(base, overlay, opacity) {
    return {
        r: base.r + (overlay.r - base.r) * opacity,
        g: base.g + (overlay.g - base.g) * opacity,
        b: base.b + (overlay.b - base.b) * opacity
    };
}

// =============================================================================
// LIGHTING EFFECT GENERATORS
// =============================================================================

/**
 * Generate rim light effect overlay
 */
async function generateRimLight(width, height, config) {
    const { angle = 180, intensity = 0.8, color = '#ffffff', thickness = 0.02 } = config;
    const rimColor = hexToRgb(color);

    const channels = 4;
    const buffer = Buffer.alloc(width * height * channels);

    const angleRad = (angle * Math.PI) / 180;
    const rimThickness = Math.floor(width * thickness);

    // Create rim on the side opposite to light source
    const lightDirX = Math.cos(angleRad);
    const lightDirY = Math.sin(angleRad);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Distance from center
            const centerX = x - width / 2;
            const centerY = y - height / 2;

            // Project onto light direction
            const projection = -(centerX * lightDirX + centerY * lightDirY);
            const normalizedProjection = (projection + Math.max(width, height) / 2) / Math.max(width, height);

            // Rim intensity based on angle from light
            let rimIntensity = 0;
            if (normalizedProjection > 0.7) {
                // Edge detection would go here in full implementation
                // For now, create gradient rim on far edge
                const edgeFactor = (normalizedProjection - 0.7) / 0.3;
                rimIntensity = Math.pow(edgeFactor, 2) * intensity;
            }

            const offset = (y * width + x) * channels;
            const alpha = Math.min(255, Math.floor(rimIntensity * 255));

            buffer[offset] = rimColor.r;
            buffer[offset + 1] = rimColor.g;
            buffer[offset + 2] = rimColor.b;
            buffer[offset + 3] = alpha;
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Generate vignette/shadow overlay
 */
async function generateVignette(width, height, config) {
    const { intensity = 0.5, softness = 0.5, color = '#000000' } = config;
    const vignetteColor = hexToRgb(color);

    const channels = 4;
    const buffer = Buffer.alloc(width * height * channels);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

    // Softness affects where vignette starts (higher = starts closer to center)
    const startRadius = maxRadius * (1 - softness * 0.5);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let vignetteAmount = 0;
            if (distance > startRadius) {
                const t = (distance - startRadius) / (maxRadius - startRadius);
                vignetteAmount = Math.pow(t, 2 - softness) * intensity;
            }

            const offset = (y * width + x) * channels;
            const alpha = Math.min(255, Math.floor(vignetteAmount * 255));

            buffer[offset] = vignetteColor.r;
            buffer[offset + 1] = vignetteColor.g;
            buffer[offset + 2] = vignetteColor.b;
            buffer[offset + 3] = alpha;
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Generate directional light gradient
 */
async function generateDirectionalLight(width, height, config) {
    const { angle = 45, intensity = 1.0, color = '#ffffff', softness = 0.5 } = config;
    const lightColor = hexToRgb(color);

    const channels = 4;
    const buffer = Buffer.alloc(width * height * channels);

    const angleRad = (angle * Math.PI) / 180;
    const dirX = Math.cos(angleRad);
    const dirY = Math.sin(angleRad);

    const gradientLength = Math.abs(width * dirX) + Math.abs(height * dirY);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const centerX = x - width / 2;
            const centerY = y - height / 2;

            // Project onto light direction
            const projection = (centerX * dirX + centerY * dirY + gradientLength / 2) / gradientLength;

            // Soft falloff
            const lightAmount = Math.pow(Math.max(0, Math.min(1, projection)), 1 + softness) * intensity;

            const offset = (y * width + x) * channels;
            const alpha = Math.min(255, Math.floor(lightAmount * 100)); // Lower opacity for subtle effect

            buffer[offset] = lightColor.r;
            buffer[offset + 1] = lightColor.g;
            buffer[offset + 2] = lightColor.b;
            buffer[offset + 3] = alpha;
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Generate spotlight effect
 */
async function generateSpotlight(width, height, config) {
    const { intensity = 1.0, color = '#ffffff', size = 0.4, x = 0.5, y = 0.4 } = config;
    const spotColor = hexToRgb(color);

    const channels = 4;
    const buffer = Buffer.alloc(width * height * channels);

    const spotX = width * x;
    const spotY = height * y;
    const spotRadius = Math.min(width, height) * size;

    for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
            const dx = px - spotX;
            const dy = py - spotY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let spotIntensity = 0;
            if (distance < spotRadius) {
                spotIntensity = Math.pow(1 - distance / spotRadius, 0.5) * intensity;
            }

            const offset = (py * width + px) * channels;
            const alpha = Math.min(255, Math.floor(spotIntensity * 150));

            buffer[offset] = spotColor.r;
            buffer[offset + 1] = spotColor.g;
            buffer[offset + 2] = spotColor.b;
            buffer[offset + 3] = alpha;
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Generate god rays / volumetric light
 */
async function generateGodRays(width, height, config) {
    const { angle = -45, intensity = 0.5, color = '#ffffff', rays = 8 } = config;
    const rayColor = hexToRgb(color);

    const channels = 4;
    const buffer = Buffer.alloc(width * height * channels);

    const originX = width * 0.5;
    const originY = -height * 0.2; // Above the image

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - originX;
            const dy = y - originY;
            const angle = Math.atan2(dy, dx);
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Create ray pattern
            const rayAngle = (angle * rays) / (2 * Math.PI);
            const rayIntensity = Math.pow(Math.abs(Math.sin(rayAngle * Math.PI)), 3);

            // Fade with distance
            const distanceFade = Math.min(1, distance / (height * 1.5));
            const finalIntensity = rayIntensity * distanceFade * intensity;

            const offset = (y * width + x) * channels;
            const alpha = Math.min(255, Math.floor(finalIntensity * 80));

            buffer[offset] = rayColor.r;
            buffer[offset + 1] = rayColor.g;
            buffer[offset + 2] = rayColor.b;
            buffer[offset + 3] = alpha;
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

// =============================================================================
// MAIN EXPORT FUNCTIONS
// =============================================================================

/**
 * Apply lighting preset to an image
 *
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {string|object} preset - Lighting preset name or custom config
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function applyLighting(imageBuffer, preset) {
    let config;

    if (typeof preset === 'string') {
        config = LIGHTING_PRESETS[preset];
        if (!config) {
            console.warn(`[Lighting] Unknown preset: ${preset}, using natural`);
            config = LIGHTING_PRESETS['natural'];
        }
    } else {
        config = preset;
    }

    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;

    let result = sharp(imageBuffer);
    const composites = [];

    // Apply color grading first
    if (config.colorGrade) {
        const grade = config.colorGrade;

        if (grade.saturation) {
            result = result.modulate({ saturation: grade.saturation });
        }
        if (grade.brightness) {
            result = result.modulate({ brightness: grade.brightness });
        }
        if (grade.contrast) {
            result = result.linear(grade.contrast, -(128 * (grade.contrast - 1)));
        }
        if (grade.warmth && grade.warmth > 0) {
            // Apply warm tint
            result = result.tint({ r: 255, g: 240, b: 220 });
        }
        if (grade.coolness && grade.coolness > 0) {
            // Apply cool tint
            result = result.tint({ r: 220, g: 230, b: 255 });
        }
    }

    // Generate and apply key light
    if (config.keyLight) {
        if (config.keyLight.spotlight) {
            const spotlight = await generateSpotlight(width, height, {
                intensity: config.keyLight.intensity,
                color: config.keyLight.color
            });
            composites.push({ input: spotlight, blend: 'soft-light' });
        } else {
            const keyLight = await generateDirectionalLight(width, height, config.keyLight);
            composites.push({ input: keyLight, blend: 'soft-light' });
        }
    }

    // Generate and apply fill light
    if (config.fillLight) {
        const fillLight = await generateDirectionalLight(width, height, config.fillLight);
        composites.push({ input: fillLight, blend: 'soft-light' });
    }

    // Generate and apply back/rim light
    if (config.backLight && config.backLight.rim) {
        const rimLight = await generateRimLight(width, height, config.backLight);
        composites.push({ input: rimLight, blend: 'screen' });
    }

    // Generate and apply shadows/vignette
    if (config.shadows) {
        const shadows = await generateVignette(width, height, config.shadows);
        composites.push({ input: shadows, blend: 'multiply' });
    }

    // Apply glow effect
    if (config.glow) {
        // Create outer glow by blurring and overlaying
        const glowBuffer = await sharp(imageBuffer)
            .blur(30)
            .modulate({ brightness: 1.5, saturation: 1.3 })
            .png()
            .toBuffer();

        composites.push({
            input: glowBuffer,
            blend: 'screen',
            opacity: config.glow.intensity || 0.3
        });
    }

    // Apply all composites
    if (composites.length > 0) {
        result = result.composite(composites);
    }

    return result.png().toBuffer();
}

/**
 * Get prompt enhancement for lighting
 *
 * @param {string} preset - Lighting preset name
 * @returns {string} Prompt enhancement text
 */
function getLightingPromptEnhancement(preset) {
    const enhancements = {
        'natural': 'natural soft lighting, balanced exposure',
        'soft': 'soft diffused lighting, gentle shadows, flattering light',
        'dramatic': 'dramatic high-contrast lighting, deep shadows, cinematic',
        'cinematic': 'cinematic lighting, golden rim light, movie poster quality',
        'noir': 'film noir lighting, high contrast, mysterious shadows',
        'golden-hour': 'golden hour lighting, warm sunset tones, romantic atmosphere',
        'blue-hour': 'blue hour lighting, cool twilight tones, serene mood',
        'neon-glow': 'neon lighting, cyberpunk glow, vibrant colors, synthwave',
        'fire-light': 'warm fire lighting, flickering orange glow, dramatic',
        'spotlight': 'dramatic spotlight, dark background, theatrical',
        'rim-only': 'backlit silhouette, strong rim light, dramatic outline',
        'split': 'split lighting, two-tone colors, artistic contrast',
        'viral-pop': 'bright punchy lighting, high saturation, thumbnail optimized',
        'thumbnail-pro': 'professional thumbnail lighting, clear subject, high clarity'
    };

    return enhancements[preset] || 'professional studio lighting';
}

/**
 * Get list of available presets
 */
function getAvailablePresets() {
    return Object.keys(LIGHTING_PRESETS);
}

/**
 * Get preset configuration
 */
function getPresetConfig(preset) {
    return LIGHTING_PRESETS[preset] || null;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    applyLighting,
    getLightingPromptEnhancement,
    getAvailablePresets,
    getPresetConfig,
    generateRimLight,
    generateVignette,
    generateGodRays,
    generateSpotlight,
    LIGHTING_PRESETS
};
