/**
 * Dynamic Background Effects Service - Tier 2
 *
 * Creates cinematic, attention-grabbing backgrounds for thumbnails
 * - Gradient backgrounds (radial, linear, angular)
 * - Particle systems (sparks, dust, bokeh)
 * - Motion blur effects
 * - Environment presets (studio, outdoor, neon city, etc.)
 *
 * @module dynamicBackgroundService
 */

const sharp = require('sharp');

// =============================================================================
// BACKGROUND PRESETS
// =============================================================================

const BACKGROUND_PRESETS = {
    // Studio Backgrounds
    'studio-black': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#1a1a1a', '#000000'], positions: [0, 1] },
        particles: null,
        lighting: { vignette: 0.4, brightness: 1.0 }
    },
    'studio-gray': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#4a4a4a', '#1a1a1a'], positions: [0, 1] },
        particles: null,
        lighting: { vignette: 0.3, brightness: 1.1 }
    },
    'studio-white': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#ffffff', '#e0e0e0'], positions: [0, 1] },
        particles: null,
        lighting: { vignette: 0.2, brightness: 1.2 }
    },

    // Dramatic Backgrounds
    'dramatic-red': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#ff3333', '#8b0000', '#1a0000'], positions: [0, 0.5, 1] },
        particles: { type: 'sparks', density: 20, color: '#ff6600' },
        lighting: { vignette: 0.5, brightness: 1.0 }
    },
    'dramatic-blue': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#3366ff', '#001a66', '#000033'], positions: [0, 0.5, 1] },
        particles: { type: 'dust', density: 15, color: '#6699ff' },
        lighting: { vignette: 0.4, brightness: 1.1 }
    },
    'dramatic-gold': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#ffd700', '#b8860b', '#1a1400'], positions: [0, 0.5, 1] },
        particles: { type: 'sparkle', density: 25, color: '#ffff00' },
        lighting: { vignette: 0.3, brightness: 1.2 }
    },
    'dramatic-purple': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#9933ff', '#4b0082', '#1a0033'], positions: [0, 0.5, 1] },
        particles: { type: 'magic', density: 18, color: '#cc66ff' },
        lighting: { vignette: 0.45, brightness: 1.0 }
    },

    // Neon/Cyberpunk Backgrounds
    'neon-pink': {
        type: 'gradient',
        gradient: { type: 'linear', angle: 135, colors: ['#ff00ff', '#ff0066', '#330033'], positions: [0, 0.5, 1] },
        particles: { type: 'grid', density: 10, color: '#ff66ff' },
        lighting: { vignette: 0.5, brightness: 1.3, glow: 0.4 }
    },
    'neon-cyan': {
        type: 'gradient',
        gradient: { type: 'linear', angle: 45, colors: ['#00ffff', '#0099cc', '#003333'], positions: [0, 0.5, 1] },
        particles: { type: 'grid', density: 10, color: '#66ffff' },
        lighting: { vignette: 0.5, brightness: 1.3, glow: 0.4 }
    },
    'cyberpunk': {
        type: 'gradient',
        gradient: { type: 'linear', angle: 120, colors: ['#ff00ff', '#00ffff', '#000033'], positions: [0, 0.5, 1] },
        particles: { type: 'rain', density: 30, color: '#ffffff' },
        lighting: { vignette: 0.6, brightness: 1.2, glow: 0.5 }
    },

    // Nature Backgrounds
    'sunset': {
        type: 'gradient',
        gradient: { type: 'linear', angle: 180, colors: ['#ff7e5f', '#feb47b', '#1a0a00'], positions: [0, 0.4, 1] },
        particles: { type: 'dust', density: 10, color: '#ffcc00' },
        lighting: { vignette: 0.3, brightness: 1.2, warmth: 0.3 }
    },
    'ocean': {
        type: 'gradient',
        gradient: { type: 'linear', angle: 180, colors: ['#2193b0', '#6dd5ed', '#001a33'], positions: [0, 0.5, 1] },
        particles: { type: 'bubbles', density: 15, color: '#99ffff' },
        lighting: { vignette: 0.35, brightness: 1.1 }
    },
    'forest': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#228b22', '#006400', '#001a00'], positions: [0, 0.5, 1] },
        particles: { type: 'leaves', density: 12, color: '#90ee90' },
        lighting: { vignette: 0.4, brightness: 1.0 }
    },

    // Special Effects
    'fire': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#ff6600', '#ff0000', '#330000'], positions: [0, 0.5, 1] },
        particles: { type: 'flames', density: 35, color: '#ffcc00' },
        lighting: { vignette: 0.5, brightness: 1.3, glow: 0.6 }
    },
    'ice': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#e0ffff', '#87ceeb', '#001a33'], positions: [0, 0.5, 1] },
        particles: { type: 'snowflakes', density: 25, color: '#ffffff' },
        lighting: { vignette: 0.3, brightness: 1.4, coolness: 0.3 }
    },
    'matrix': {
        type: 'solid',
        color: '#000000',
        particles: { type: 'code', density: 50, color: '#00ff00' },
        lighting: { vignette: 0.6, brightness: 1.0, glow: 0.3 }
    },

    // Bokeh Backgrounds
    'bokeh-warm': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#2a1a0a', '#1a0a00'], positions: [0, 1] },
        particles: { type: 'bokeh', density: 40, colors: ['#ff9900', '#ffcc00', '#ff6600'] },
        lighting: { vignette: 0.4, brightness: 1.1 }
    },
    'bokeh-cool': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#0a1a2a', '#000a1a'], positions: [0, 1] },
        particles: { type: 'bokeh', density: 40, colors: ['#0099ff', '#00ccff', '#0066cc'] },
        lighting: { vignette: 0.4, brightness: 1.1 }
    },
    'bokeh-rainbow': {
        type: 'gradient',
        gradient: { type: 'radial', colors: ['#1a1a1a', '#0a0a0a'], positions: [0, 1] },
        particles: { type: 'bokeh', density: 50, colors: ['#ff0000', '#ff9900', '#ffff00', '#00ff00', '#0099ff', '#9900ff'] },
        lighting: { vignette: 0.35, brightness: 1.2 }
    }
};

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Interpolate between two colors
 */
function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
}

/**
 * Get color at position in gradient
 */
function getGradientColor(colors, positions, t) {
    // Find which segment we're in
    for (let i = 0; i < positions.length - 1; i++) {
        if (t >= positions[i] && t <= positions[i + 1]) {
            const segmentT = (t - positions[i]) / (positions[i + 1] - positions[i]);
            return lerpColor(colors[i], colors[i + 1], segmentT);
        }
    }
    return hexToRgb(colors[colors.length - 1]);
}

// =============================================================================
// BACKGROUND GENERATION
// =============================================================================

/**
 * Generate a radial gradient background
 */
async function generateRadialGradient(width, height, colors, positions) {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

    // Create raw pixel buffer
    const channels = 3;
    const buffer = Buffer.alloc(width * height * channels);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const t = Math.min(1, distance / maxRadius);

            const color = getGradientColor(colors, positions, t);
            const offset = (y * width + x) * channels;
            buffer[offset] = color.r;
            buffer[offset + 1] = color.g;
            buffer[offset + 2] = color.b;
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Generate a linear gradient background
 */
async function generateLinearGradient(width, height, angle, colors, positions) {
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const channels = 3;
    const buffer = Buffer.alloc(width * height * channels);

    // Calculate the gradient length based on angle
    const gradientLength = Math.abs(width * cos) + Math.abs(height * sin);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Project point onto gradient axis
            const centerX = x - width / 2;
            const centerY = y - height / 2;
            const projection = (centerX * cos + centerY * sin + gradientLength / 2) / gradientLength;
            const t = Math.max(0, Math.min(1, projection));

            const color = getGradientColor(colors, positions, t);
            const offset = (y * width + x) * channels;
            buffer[offset] = color.r;
            buffer[offset + 1] = color.g;
            buffer[offset + 2] = color.b;
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * Generate a solid color background
 */
async function generateSolidBackground(width, height, color) {
    const rgb = hexToRgb(color);
    return sharp({
        create: {
            width,
            height,
            channels: 3,
            background: rgb
        }
    }).png().toBuffer();
}

// =============================================================================
// PARTICLE SYSTEMS
// =============================================================================

/**
 * Generate particle overlay (sparks, dust, bokeh, etc.)
 */
async function generateParticleOverlay(width, height, particleConfig) {
    if (!particleConfig) return null;

    const { type, density, color, colors } = particleConfig;
    const particleColors = colors || [color];

    // Create RGBA buffer for transparency
    const channels = 4;
    const buffer = Buffer.alloc(width * height * channels);

    // Fill with transparent
    for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 0;
        buffer[i + 1] = 0;
        buffer[i + 2] = 0;
        buffer[i + 3] = 0;
    }

    // Generate particles based on type
    const numParticles = Math.floor((width * height * density) / 100000);

    for (let p = 0; p < numParticles; p++) {
        const particleColor = hexToRgb(particleColors[Math.floor(Math.random() * particleColors.length)]);
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);

        let size, alpha;

        switch (type) {
            case 'sparks':
                size = Math.floor(Math.random() * 3) + 1;
                alpha = Math.floor(Math.random() * 200) + 55;
                break;
            case 'dust':
                size = Math.floor(Math.random() * 2) + 1;
                alpha = Math.floor(Math.random() * 100) + 30;
                break;
            case 'bokeh':
                size = Math.floor(Math.random() * 40) + 10;
                alpha = Math.floor(Math.random() * 80) + 20;
                break;
            case 'sparkle':
                size = Math.floor(Math.random() * 4) + 1;
                alpha = Math.floor(Math.random() * 255);
                break;
            case 'magic':
                size = Math.floor(Math.random() * 5) + 2;
                alpha = Math.floor(Math.random() * 180) + 75;
                break;
            case 'snowflakes':
                size = Math.floor(Math.random() * 6) + 2;
                alpha = Math.floor(Math.random() * 150) + 105;
                break;
            case 'bubbles':
                size = Math.floor(Math.random() * 15) + 5;
                alpha = Math.floor(Math.random() * 60) + 20;
                break;
            case 'rain':
                size = 1;
                alpha = Math.floor(Math.random() * 100) + 50;
                // Draw vertical line for rain
                for (let ry = 0; ry < 20 && (y + ry) < height; ry++) {
                    const offset = ((y + ry) * width + x) * channels;
                    if (offset >= 0 && offset < buffer.length - 3) {
                        buffer[offset] = particleColor.r;
                        buffer[offset + 1] = particleColor.g;
                        buffer[offset + 2] = particleColor.b;
                        buffer[offset + 3] = alpha;
                    }
                }
                continue;
            case 'grid':
                // Grid lines for cyberpunk effect
                if (x % 50 === 0 || y % 50 === 0) {
                    const offset = (y * width + x) * channels;
                    buffer[offset] = particleColor.r;
                    buffer[offset + 1] = particleColor.g;
                    buffer[offset + 2] = particleColor.b;
                    buffer[offset + 3] = 40;
                }
                continue;
            case 'code':
                // Matrix-style falling code
                size = 1;
                alpha = Math.floor(Math.random() * 200) + 55;
                for (let cy = 0; cy < 10 && (y + cy) < height; cy++) {
                    const fadeAlpha = Math.floor(alpha * (1 - cy / 10));
                    const offset = ((y + cy) * width + x) * channels;
                    if (offset >= 0 && offset < buffer.length - 3) {
                        buffer[offset] = particleColor.r;
                        buffer[offset + 1] = particleColor.g;
                        buffer[offset + 2] = particleColor.b;
                        buffer[offset + 3] = fadeAlpha;
                    }
                }
                continue;
            case 'flames':
                size = Math.floor(Math.random() * 8) + 3;
                alpha = Math.floor(Math.random() * 150) + 105;
                break;
            case 'leaves':
                size = Math.floor(Math.random() * 10) + 5;
                alpha = Math.floor(Math.random() * 100) + 50;
                break;
            default:
                size = 2;
                alpha = 100;
        }

        // Draw circular particle
        for (let dy = -size; dy <= size; dy++) {
            for (let dx = -size; dx <= size; dx++) {
                const px = x + dx;
                const py = y + dy;
                if (px >= 0 && px < width && py >= 0 && py < height) {
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= size) {
                        // Soft edge falloff
                        const falloff = type === 'bokeh' ?
                            (1 - (distance / size)) * 0.3 + 0.7 * (distance > size * 0.8 ? 1 : 0) : // Ring for bokeh
                            1 - (distance / size);

                        const offset = (py * width + px) * channels;
                        const particleAlpha = Math.floor(alpha * falloff);

                        // Blend with existing
                        const existingAlpha = buffer[offset + 3];
                        if (particleAlpha > existingAlpha) {
                            buffer[offset] = particleColor.r;
                            buffer[offset + 1] = particleColor.g;
                            buffer[offset + 2] = particleColor.b;
                            buffer[offset + 3] = particleAlpha;
                        }
                    }
                }
            }
        }
    }

    return sharp(buffer, { raw: { width, height, channels } }).png().toBuffer();
}

// =============================================================================
// MAIN EXPORT FUNCTIONS
// =============================================================================

/**
 * Generate dynamic background based on preset or custom config
 *
 * @param {string|object} preset - Preset name or custom config
 * @param {number} width - Output width
 * @param {number} height - Output height
 * @returns {Promise<Buffer>} Background image buffer
 */
async function generateDynamicBackground(preset, width = 1920, height = 1080) {
    let config;

    if (typeof preset === 'string') {
        config = BACKGROUND_PRESETS[preset];
        if (!config) {
            console.warn(`[DynamicBG] Unknown preset: ${preset}, using studio-black`);
            config = BACKGROUND_PRESETS['studio-black'];
        }
    } else {
        config = preset;
    }

    // Generate base background
    let background;
    if (config.type === 'gradient') {
        if (config.gradient.type === 'radial') {
            background = await generateRadialGradient(
                width, height,
                config.gradient.colors,
                config.gradient.positions
            );
        } else {
            background = await generateLinearGradient(
                width, height,
                config.gradient.angle || 0,
                config.gradient.colors,
                config.gradient.positions
            );
        }
    } else {
        background = await generateSolidBackground(width, height, config.color || '#000000');
    }

    // Generate and composite particles
    if (config.particles) {
        const particles = await generateParticleOverlay(width, height, config.particles);
        if (particles) {
            background = await sharp(background)
                .composite([{ input: particles, blend: 'screen' }])
                .png()
                .toBuffer();
        }
    }

    // Apply lighting effects
    if (config.lighting) {
        let sharpInstance = sharp(background);

        // Brightness adjustment
        if (config.lighting.brightness && config.lighting.brightness !== 1.0) {
            sharpInstance = sharpInstance.modulate({ brightness: config.lighting.brightness });
        }

        // Vignette effect (darken edges)
        if (config.lighting.vignette && config.lighting.vignette > 0) {
            const vignette = await generateRadialGradient(
                width, height,
                ['#ffffff', '#000000'],
                [0.3, 1]
            );

            const vignetteIntensity = config.lighting.vignette;
            const vignetteBuffer = await sharp(vignette)
                .modulate({ brightness: 1 + vignetteIntensity })
                .png()
                .toBuffer();

            background = await sharpInstance.png().toBuffer();
            background = await sharp(background)
                .composite([{ input: vignetteBuffer, blend: 'multiply' }])
                .png()
                .toBuffer();
        } else {
            background = await sharpInstance.png().toBuffer();
        }
    }

    return background;
}

/**
 * Get prompt enhancement for background generation
 *
 * @param {string} preset - Background preset name
 * @returns {string} Prompt enhancement text
 */
function getBackgroundPromptEnhancement(preset) {
    const enhancements = {
        'studio-black': 'professional dark studio background, perfect lighting, high-end photography',
        'studio-gray': 'professional gray studio background, soft lighting, corporate photography',
        'studio-white': 'clean white studio background, bright even lighting, product photography style',
        'dramatic-red': 'dramatic red lighting, intense mood, cinematic, action movie poster style',
        'dramatic-blue': 'dramatic blue lighting, cool tones, mysterious atmosphere, thriller style',
        'dramatic-gold': 'luxurious golden lighting, wealth and success, premium quality, award show',
        'dramatic-purple': 'mystical purple lighting, magical atmosphere, fantasy style',
        'neon-pink': 'neon pink cyberpunk lighting, futuristic, synthwave aesthetic',
        'neon-cyan': 'neon cyan cyberpunk lighting, futuristic, tech aesthetic',
        'cyberpunk': 'cyberpunk neon lighting, rain, futuristic city, blade runner style',
        'sunset': 'golden hour sunset lighting, warm tones, cinematic outdoor photography',
        'ocean': 'underwater blue lighting, aquatic atmosphere, deep sea',
        'forest': 'natural forest lighting, green tones, nature photography',
        'fire': 'dramatic fire lighting, flames, intense heat, action movie',
        'ice': 'cold ice lighting, frozen atmosphere, winter, blue tones',
        'matrix': 'matrix digital rain, code, green on black, hacker aesthetic',
        'bokeh-warm': 'warm bokeh background, blurred lights, romantic atmosphere',
        'bokeh-cool': 'cool bokeh background, blurred city lights, night photography',
        'bokeh-rainbow': 'colorful bokeh background, party lights, festive atmosphere'
    };

    return enhancements[preset] || 'professional studio lighting';
}

/**
 * Get list of available presets
 */
function getAvailablePresets() {
    return Object.keys(BACKGROUND_PRESETS);
}

/**
 * Get preset configuration
 */
function getPresetConfig(preset) {
    return BACKGROUND_PRESETS[preset] || null;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    generateDynamicBackground,
    getBackgroundPromptEnhancement,
    getAvailablePresets,
    getPresetConfig,
    BACKGROUND_PRESETS
};
