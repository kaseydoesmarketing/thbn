/**
 * Background Quality Specifications
 *
 * MISSION: TBUILDER-QUALITY-UPGRADE-V2 - BACKGROUND_QUALITY_UPGRADE
 *
 * Defines premium background tiers with depth, atmosphere, and visual richness.
 * These specifications ensure backgrounds are not flat or generic, but have
 * the layered, professional quality of $50-$100 designer thumbnails.
 */

// ============================================================================
// BACKGROUND QUALITY TIERS
// ============================================================================

const BACKGROUND_TIERS = {
    /**
     * BASIC
     * Simple gradients or solid colors
     * For clean, minimalist thumbnails (Gadzhi style)
     */
    basic: {
        name: 'Basic',
        description: 'Clean gradients and solid backgrounds',
        promptInstructions: `BACKGROUND STYLE - CLEAN MINIMALIST:
- Simple dark gradient background (black to dark gray)
- Subtle color tint matching the niche palette
- NO busy patterns or competing elements
- Clean negative space for text
- Slight vignette for depth`,
        layerCount: 1,
        complexity: 'low',
        bestFor: ['luxury', 'beauty', 'tutorial']
    },

    /**
     * PRO (DEFAULT)
     * Multi-layered backgrounds with atmospheric effects
     * Standard for most thumbnails
     */
    pro: {
        name: 'Professional',
        description: 'Layered backgrounds with depth and atmosphere',
        promptInstructions: `BACKGROUND STYLE - PROFESSIONAL LAYERED:
- MULTIPLE DEPTH LAYERS: Distinct background, midground, and foreground elements
- ATMOSPHERIC EFFECTS: Subtle fog, haze, or particle effects for depth
- LIGHTING GRADIENT: Visible light source creating natural falloff
- BOKEH/BLUR: Background elements slightly blurred for subject focus
- COLOR RICHNESS: Deep, saturated colors with slight color variations
- TEXTURE: Subtle grain or texture to avoid AI-smooth look
- VIGNETTE: Dark edges drawing eye to center`,
        layerCount: 3,
        complexity: 'medium',
        bestFor: ['tech', 'finance', 'fitness', 'cooking', 'podcast']
    },

    /**
     * CINEMATIC
     * Film-quality backgrounds with dramatic lighting
     * For maximum impact thumbnails
     */
    cinematic: {
        name: 'Cinematic',
        description: 'Film-quality dramatic backgrounds',
        promptInstructions: `BACKGROUND STYLE - CINEMATIC EPIC:
- DRAMATIC LIGHTING: Strong directional light with deep shadows
- VOLUMETRIC EFFECTS: Light rays, god rays, or atmospheric beams
- MULTIPLE DEPTH LAYERS: Rich foreground, detailed midground, expansive background
- LENS EFFECTS: Subtle lens flares, light leaks, chromatic aberration
- PARTICLE EFFECTS: Dust, embers, sparks, or floating particles
- COLOR GRADING: Film-like color grade (teal/orange, or niche-specific)
- MOTION BLUR: Subtle motion blur on background elements for energy
- ENVIRONMENTAL DETAIL: Rich textures and environmental storytelling
- ANAMORPHIC FEEL: Wide cinematic composition with letterbox-ready framing`,
        layerCount: 5,
        complexity: 'high',
        bestFor: ['gaming', 'reaction', 'documentary', 'travel', 'entertainment']
    }
};

// ============================================================================
// NICHE-SPECIFIC BACKGROUND TEMPLATES
// ============================================================================

const NICHE_BACKGROUNDS = {
    gaming: {
        defaultTier: 'cinematic',
        elements: [
            'neon-lit gaming setup environment',
            'RGB lighting effects',
            'game UI elements floating',
            'digital grid or hex patterns',
            'cyberpunk cityscape silhouette',
            'holographic displays'
        ],
        colors: 'electric blue, hot pink, neon green, purple',
        atmosphere: 'high-tech, energetic, cyberpunk',
        effects: 'chromatic aberration, glitch effects, scan lines, particle systems'
    },

    tech: {
        defaultTier: 'pro',
        elements: [
            'minimalist studio setup',
            'product on display',
            'subtle circuit patterns',
            'clean gradient backdrop',
            'floating tech icons',
            'premium surface (marble, concrete)'
        ],
        colors: 'white, black, red accent, silver',
        atmosphere: 'clean, premium, sophisticated',
        effects: 'soft reflections, subtle highlights, clean shadows'
    },

    finance: {
        defaultTier: 'pro',
        elements: [
            'stock charts in background',
            'currency symbols floating',
            'gold coins or bars',
            'city skyline silhouette',
            'office environment',
            'premium dark wood or marble'
        ],
        colors: 'money green, gold, navy blue, black',
        atmosphere: 'wealthy, successful, professional',
        effects: 'golden glow, subtle sparkle on gold elements'
    },

    beauty: {
        defaultTier: 'basic',
        elements: [
            'soft pink clouds',
            'floating flower petals',
            'smooth gradient',
            'beauty products arranged',
            'ring light reflections',
            'clean marble surface'
        ],
        colors: 'blush pink, rose gold, cream, white',
        atmosphere: 'soft, ethereal, feminine',
        effects: 'soft glow, dreamy blur, light bloom'
    },

    fitness: {
        defaultTier: 'pro',
        elements: [
            'gym equipment silhouettes',
            'dramatic side lighting',
            'sweat droplet effects',
            'motion blur energy',
            'dark industrial gym',
            'weight plates and dumbbells'
        ],
        colors: 'red, orange, black, white',
        atmosphere: 'intense, powerful, raw energy',
        effects: 'hard shadows, sweat glistening, action blur'
    },

    cooking: {
        defaultTier: 'pro',
        elements: [
            'rustic kitchen background',
            'rising steam',
            'ingredient splashes',
            'warm natural lighting',
            'wooden cutting boards',
            'copper pots and utensils'
        ],
        colors: 'warm orange, cream, brown, green',
        atmosphere: 'appetizing, homey, inviting',
        effects: 'steam rising, warm glow, shallow depth of field'
    },

    travel: {
        defaultTier: 'cinematic',
        elements: [
            'epic landscape vista',
            'golden hour sky',
            'destination landmarks',
            'adventure elements (maps, compass)',
            'dramatic clouds',
            'ocean or mountain views'
        ],
        colors: 'sunset orange, sky blue, turquoise, gold',
        atmosphere: 'adventurous, aspirational, epic',
        effects: 'golden hour glow, lens flares, atmospheric haze'
    },

    reaction: {
        defaultTier: 'cinematic',
        elements: [
            'dark dramatic background',
            'colorful accent lighting',
            'subtle geometric patterns',
            'gradient with color pops',
            'abstract shapes',
            'studio environment'
        ],
        colors: 'yellow, cyan, magenta, black',
        atmosphere: 'high energy, attention-grabbing, dramatic',
        effects: 'rim lighting, color splashes, glow effects'
    },

    podcast: {
        defaultTier: 'pro',
        elements: [
            'professional studio setup',
            'microphone in frame',
            'acoustic panels',
            'warm studio lighting',
            'subtle branding elements',
            'comfortable interview setting'
        ],
        colors: 'dark gray, warm white, accent color',
        atmosphere: 'professional, intimate, trustworthy',
        effects: 'soft studio lighting, subtle depth'
    },

    documentary: {
        defaultTier: 'cinematic',
        elements: [
            'film grain texture',
            'dramatic shadows',
            'documentary footage style',
            'archival elements',
            'moody atmospheric lighting',
            'investigation board aesthetic'
        ],
        colors: 'red, black, white, sepia tones',
        atmosphere: 'mysterious, investigative, dramatic',
        effects: 'film grain, vignette, dramatic lighting'
    },

    tutorial: {
        defaultTier: 'basic',
        elements: [
            'clean whiteboard or screen',
            'educational icons',
            'organized workspace',
            'bright even lighting',
            'diagrams or charts',
            'professional desk setup'
        ],
        colors: 'blue, white, green accent, gray',
        atmosphere: 'educational, approachable, clear',
        effects: 'bright lighting, clean shadows, minimal effects'
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get background prompt instructions for a niche
 * @param {string} niche - Content niche
 * @param {string} tierOverride - Optional tier override
 * @returns {string} Background prompt instructions
 */
function getBackgroundPrompt(niche, tierOverride = null) {
    const nicheConfig = NICHE_BACKGROUNDS[niche] || NICHE_BACKGROUNDS.reaction;
    const tier = tierOverride || nicheConfig.defaultTier;
    const tierConfig = BACKGROUND_TIERS[tier] || BACKGROUND_TIERS.pro;

    let prompt = tierConfig.promptInstructions;

    // Add niche-specific details
    prompt += `

NICHE-SPECIFIC ELEMENTS:
- Include elements like: ${nicheConfig.elements.slice(0, 4).join(', ')}
- Color palette: ${nicheConfig.colors}
- Atmosphere: ${nicheConfig.atmosphere}
- Visual effects: ${nicheConfig.effects}`;

    return prompt;
}

/**
 * Get the default background tier for a niche
 * @param {string} niche - Content niche
 * @returns {string} Tier key
 */
function getDefaultTier(niche) {
    const nicheConfig = NICHE_BACKGROUNDS[niche];
    return nicheConfig?.defaultTier || 'pro';
}

/**
 * Get all available background tiers
 * @returns {Array} Tier configurations
 */
function getBackgroundTiers() {
    return Object.entries(BACKGROUND_TIERS).map(([key, config]) => ({
        key,
        name: config.name,
        description: config.description,
        complexity: config.complexity,
        bestFor: config.bestFor
    }));
}

/**
 * Get background configuration for a niche
 * @param {string} niche - Content niche
 * @returns {Object} Background configuration
 */
function getNicheBackground(niche) {
    return NICHE_BACKGROUNDS[niche] || NICHE_BACKGROUNDS.reaction;
}

module.exports = {
    BACKGROUND_TIERS,
    NICHE_BACKGROUNDS,
    getBackgroundPrompt,
    getDefaultTier,
    getBackgroundTiers,
    getNicheBackground
};
