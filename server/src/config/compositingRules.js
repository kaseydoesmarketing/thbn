/**
 * Compositing Rules for Professional Thumbnails
 *
 * MISSION: TBUILDER-QUALITY-UPGRADE-V2
 *
 * This replaces the default "sticker effect" with professional compositing
 * that makes subjects look naturally integrated with backgrounds.
 *
 * KEY PRINCIPLE: By default, subjects should blend naturally with backgrounds.
 * The hard stroke/outline effect is now OPTIONAL, not default.
 */

const COMPOSITING_MODES = {
    /**
     * NATURAL (DEFAULT)
     * Subject blends seamlessly with background through:
     * - Color grading consistency
     * - Matched lighting direction
     * - Soft edge transitions
     * - Atmospheric integration
     */
    natural: {
        name: 'Natural Blend',
        description: 'Subject blends seamlessly with background - no visible cutout edge',
        promptInstructions: `CRITICAL COMPOSITING - NATURAL BLEND:
1. SEAMLESS INTEGRATION: The person must appear naturally IN the scene, not cut-and-pasted on top
2. EDGE TREATMENT: Soft, natural edge transitions - NO hard strokes or outlines
3. COLOR GRADING: Apply consistent color grading across BOTH subject and background
4. LIGHTING MATCH: Subject lighting direction MUST match the background light sources
5. ATMOSPHERIC DEPTH: Add subtle atmospheric haze/color between subject and background for depth
6. SHADOW GROUNDING: Cast subtle shadows from subject onto background elements
7. HAIR/EDGE DETAIL: Preserve natural hair flyaways and edge details - don't mask too tightly
8. The person should look like they were PHOTOGRAPHED in this scene, not composited`,
        edgeStyle: 'soft',
        hasStroke: false,
        hasGlow: false,
        colorMatch: true,
        shadowGrounding: true
    },

    /**
     * SUBTLE RIM
     * Light rim/edge lighting for separation without harsh strokes
     * Used when background is very busy and subject needs to pop
     */
    subtleRim: {
        name: 'Subtle Rim Light',
        description: 'Soft rim lighting for subject separation without hard outlines',
        promptInstructions: `COMPOSITING - SUBTLE RIM LIGHT:
1. NATURAL COMPOSITING: Subject integrated with scene through color grading
2. RIM LIGHTING: Add subtle rim/edge lighting (backlight) on subject for separation
3. NO HARD STROKES: Do NOT add colored strokes or outlines around the person
4. COLOR MATCH: Rim light color should match scene lighting (warm/cool)
5. EDGE GLOW: Soft luminous edge glow, 5-10px soft, NOT a hard line
6. The rim light should look like natural backlight from the scene`,
        edgeStyle: 'rim',
        hasStroke: false,
        hasGlow: true,
        glowSoftness: 'soft',
        colorMatch: true,
        shadowGrounding: true
    },

    /**
     * STICKER (OPTIONAL - Creator Style)
     * The classic YouTube "cutout" look with visible stroke
     * Only use when specifically requested or for certain creator styles
     */
    sticker: {
        name: 'Sticker/Cutout Effect',
        description: 'Hard stroke outline creating deliberate "pasted on" look',
        promptInstructions: `COMPOSITING - STICKER/CUTOUT STYLE:
1. CUTOUT EFFECT: Person should appear as a clean cutout placed on the background
2. COLORED STROKE: Add visible colored stroke (3-5px) around the entire person
3. OUTER GLOW: Add soft outer glow behind the person for dramatic separation
4. CRISP EDGES: Clean, sharp pen-tool quality edges on the cutout
5. This is an intentional "YouTube thumbnail" graphic design style`,
        edgeStyle: 'hard',
        hasStroke: true,
        strokeWidth: '3-5px',
        hasGlow: true,
        glowSoftness: 'medium',
        colorMatch: false,
        shadowGrounding: false
    },

    /**
     * DRAMATIC RIM (Creator styles like MrBeast)
     * Strong colored rim light for maximum pop
     * More intense than subtleRim but still no hard stroke
     */
    dramaticRim: {
        name: 'Dramatic Rim Light',
        description: 'Strong colored rim lighting for maximum subject separation',
        promptInstructions: `COMPOSITING - DRAMATIC RIM:
1. STRONG RIM LIGHTING: Bold colored rim/edge lighting on subject (15-25px soft glow)
2. NO HARD STROKES: Do NOT add hard stroke outlines - only soft glowing edges
3. COLOR CHOICE: Rim light in scene accent color (cyan, yellow, magenta, etc.)
4. BACKGROUND SEPARATION: High contrast between subject edges and background
5. PROFESSIONAL LOOK: Should look like professional studio photography with colored backlights`,
        edgeStyle: 'dramatic-rim',
        hasStroke: false,
        hasGlow: true,
        glowSoftness: 'medium-strong',
        colorMatch: true,
        shadowGrounding: true
    }
};

/**
 * Map creator styles to their preferred compositing mode
 * Can be overridden by user preference
 */
const CREATOR_COMPOSITING_DEFAULTS = {
    mrbeast: 'dramaticRim',      // MrBeast uses strong rim, but NOT hard strokes in pro shots
    hormozi: 'subtleRim',        // Clean, professional with subtle separation
    gadzhi: 'natural',           // Luxury aesthetic - seamless compositing
    magnates: 'subtleRim',       // Documentary style - cinematic rim lighting
    auto: 'natural'              // Default to natural for unknown styles
};

/**
 * Map niches to their default compositing mode
 */
const NICHE_COMPOSITING_DEFAULTS = {
    gaming: 'dramaticRim',       // Neon rim lights work great
    tech: 'subtleRim',           // Clean, professional separation
    finance: 'subtleRim',        // Professional, trustworthy
    beauty: 'natural',           // Seamless, natural beauty
    fitness: 'dramaticRim',      // Energy, intensity
    cooking: 'natural',          // Warm, natural integration
    travel: 'natural',           // Person in environment
    reaction: 'dramaticRim',     // Maximum pop
    podcast: 'subtleRim',        // Professional studio look
    tutorial: 'subtleRim'        // Clean, approachable
};

/**
 * Get compositing instructions for a prompt
 * @param {string} mode - Compositing mode key
 * @param {Object} options - Additional options
 * @returns {string} Prompt instructions for compositing
 */
function getCompositingInstructions(mode = 'natural', options = {}) {
    const compositingMode = COMPOSITING_MODES[mode] || COMPOSITING_MODES.natural;

    let instructions = compositingMode.promptInstructions;

    // Add niche-specific color hints
    if (options.glowColor && compositingMode.hasGlow) {
        instructions += `\nRIM/GLOW COLOR: Use ${options.glowColor} for edge lighting.`;
    }

    // Add face preservation instructions
    if (options.hasFace) {
        instructions += `\n\nFACE PRESERVATION (CRITICAL):
- Use the EXACT face from the reference photo - do NOT regenerate it
- Preserve skin tone, features, and expression exactly
- Apply same color grading to face as background
- Lighting on face must match scene direction`;
    }

    return instructions;
}

/**
 * Get the default compositing mode for a given context
 * @param {Object} options
 * @param {string} options.creatorStyle - Creator style key
 * @param {string} options.niche - Niche key
 * @param {string} options.userPreference - User's explicit preference
 * @returns {string} Compositing mode key
 */
function getDefaultCompositingMode(options = {}) {
    const { creatorStyle, niche, userPreference } = options;

    // User preference takes priority
    if (userPreference && COMPOSITING_MODES[userPreference]) {
        return userPreference;
    }

    // Creator style second priority
    if (creatorStyle && CREATOR_COMPOSITING_DEFAULTS[creatorStyle]) {
        return CREATOR_COMPOSITING_DEFAULTS[creatorStyle];
    }

    // Niche-based default
    if (niche && NICHE_COMPOSITING_DEFAULTS[niche]) {
        return NICHE_COMPOSITING_DEFAULTS[niche];
    }

    // Ultimate fallback: natural blend (no strokes)
    return 'natural';
}

/**
 * Get all available compositing modes for UI
 */
function getCompositingModes() {
    return Object.entries(COMPOSITING_MODES).map(([key, data]) => ({
        key,
        name: data.name,
        description: data.description,
        hasStroke: data.hasStroke
    }));
}

module.exports = {
    COMPOSITING_MODES,
    CREATOR_COMPOSITING_DEFAULTS,
    NICHE_COMPOSITING_DEFAULTS,
    getCompositingInstructions,
    getDefaultCompositingMode,
    getCompositingModes
};
