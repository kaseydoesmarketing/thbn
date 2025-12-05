/**
 * Prompt Engine for YouTube Thumbnails
 * Implements the comprehensive STYLE_REFERENCE.md system
 *
 * This engine generates professional-quality prompts based on:
 * - Niche-specific templates (Gaming, Tech, Finance, Beauty, Fitness, Cooking, Travel)
 * - Expression library (Shocked, Excited, Curious, Angry, Fear, Disgusted)
 * - Lighting techniques (Rim light, High key, Low key, Neon)
 * - Composition rules (Rule of thirds, 60/40 split, Visual hierarchy)
 */

// ============================================================================
// NICHE TEMPLATES - From STYLE_REFERENCE.md Section "Niche-Specific Templates"
// ============================================================================

const NICHE_TEMPLATES = {
    gaming: {
        name: 'Gaming',
        colors: {
            primary: ['#00D4FF', '#FF0080', '#00FF41', '#BF00FF'],
            accent: ['#FF4500', '#39FF14', '#FFE135'],
            background: '#0A0A0F'
        },
        promptBase: 'YouTube gaming thumbnail, 16:9 aspect ratio, dramatic low key lighting with neon cyan and magenta rim lights, dark background with game elements, neon color palette with electric blue and hot pink, high contrast, chromatic aberration effect, glitch effects, particle effects, cyberpunk aesthetic, gaming style, bold composition',
        styleNotes: 'Dark backgrounds with neon accents, glow/bloom effects, high saturation',
        lightingKeywords: 'neon colored lighting, cyberpunk glow, colored rim lights, edge lit',
        compositionHint: 'Dynamic action pose, game UI elements floating, intense energy'
    },

    tech: {
        name: 'Tech Review',
        colors: {
            primary: ['#FF0000', '#FFFFFF', '#000000', '#1A1A1A'],
            accent: ['#0066FF', '#C0C0C0'],
            background: '#000000'
        },
        promptBase: 'YouTube tech thumbnail, 16:9 aspect ratio, clean studio lighting with soft shadows, minimalist dark gray to black gradient background, sleek modern aesthetic, high contrast with red accent details, professional product photography style, clean negative space, premium tech review aesthetic, MKBHD inspired composition',
        styleNotes: 'Minimalist, clean aesthetic, matte finishes, subtle gradients',
        lightingKeywords: 'soft studio lighting, subtle shadows, professional lighting setup',
        compositionHint: 'Product as hero element, clean lines, sophisticated'
    },

    finance: {
        name: 'Finance/Money',
        colors: {
            primary: ['#00C853', '#FFD700', '#0D0D0D', '#1E3A5F'],
            accent: ['#00FF00', '#FF0000', '#808080'],
            background: '#0D0D0D'
        },
        promptBase: 'YouTube finance thumbnail, 16:9 aspect ratio, professional studio lighting, dark blue to black gradient background, money green and gold accents, cash and coins imagery floating, professional business aesthetic, high contrast with metallic gold highlights, wealth and success visual style, charts and graphs as subtle background elements',
        styleNotes: 'Green = profit, Gold = premium, Professional trustworthy aesthetic',
        lightingKeywords: 'professional business lighting, subtle rim light, clean illumination',
        compositionHint: 'Money imagery, confident pose, success indicators'
    },

    beauty: {
        name: 'Beauty/Lifestyle',
        colors: {
            primary: ['#FFB6C1', '#E8A87C', '#FFDAB9', '#FFFDD0'],
            accent: ['#FF7F50', '#DCAE96', '#F7E7CE'],
            background: '#FFF5EE'
        },
        promptBase: 'YouTube beauty thumbnail, 16:9 aspect ratio, high key beauty lighting with soft diffused light, soft pink and rose gold gradient background, warm color palette with blush and cream tones, ethereal glow effect, soft focus edges, beauty photography style, fresh clean aesthetic, professional beauty tutorial look, glowing skin',
        styleNotes: 'Soft warm colors, pastel backgrounds, glowing skin effects',
        lightingKeywords: 'high key lighting, soft diffused light, beauty lighting, fresh airy feel',
        compositionHint: 'Close-up face, products floating, clean aesthetic'
    },

    fitness: {
        name: 'Fitness/Sports',
        colors: {
            primary: ['#FF0000', '#FF6B00', '#FFD000', '#1A1A1A'],
            accent: ['#00BFFF', '#00FF00', '#DC143C'],
            background: '#1A1A1A'
        },
        promptBase: 'YouTube fitness thumbnail, 16:9 aspect ratio, dramatic side lighting with hard shadows, dark gym background with motion blur, intense color palette with red and orange energy, sweat droplets visible, high contrast dramatic lighting, action sports photography style, powerful intense aesthetic, athletic dynamic pose',
        styleNotes: 'High contrast, dramatic lighting, motion blur, intensity',
        lightingKeywords: 'dramatic side lighting, hard shadows, intensity lighting, sweat glistening',
        compositionHint: 'Athletic pose, muscles defined, powerful energy'
    },

    cooking: {
        name: 'Cooking/Food',
        colors: {
            primary: ['#C41E3A', '#FF8C00', '#FFFACD', '#228B22'],
            accent: ['#FFE4B5', '#FF6347', '#2E8B57'],
            background: '#8B4513'
        },
        promptBase: 'YouTube cooking thumbnail, 16:9 aspect ratio, warm golden hour food photography lighting, rustic wood or marble background, appetizing color palette with warm oranges and reds, steam rising from food, shallow depth of field with bokeh, professional food photography style, mouth-watering presentation, cookbook cover quality',
        styleNotes: 'Warm colors, steam effects, rustic textures, appetizing',
        lightingKeywords: 'warm golden hour lighting, food photography lighting, appetizing warm tones',
        compositionHint: 'Close-up food shot, steam visible, rustic setting'
    },

    travel: {
        name: 'Travel/Vlog',
        colors: {
            primary: ['#87CEEB', '#20B2AA', '#FF7F50', '#228B22'],
            accent: ['#FFD700', '#FF69B4', '#000080'],
            background: '#87CEEB'
        },
        promptBase: 'YouTube travel thumbnail, 16:9 aspect ratio, stunning landscape with golden hour lighting, vibrant saturated colors with enhanced sky, adventure travel photography style, epic wide angle composition, lens flare and atmospheric haze, wanderlust aesthetic, National Geographic quality, destination text space',
        styleNotes: 'Vibrant saturated landscapes, golden hour, turquoise water',
        lightingKeywords: 'golden hour lighting, sunset glow, natural light, cinematic',
        compositionHint: 'Person in scene for scale, epic landscape, destination visible'
    },

    reaction: {
        name: 'Reaction/Commentary',
        colors: {
            primary: ['#FF0055', '#FFFF00', '#000000', '#FFFFFF'],
            accent: ['#00FF00', '#FF00FF', '#00FFFF'],
            background: '#1A1A2E'
        },
        promptBase: 'YouTube reaction thumbnail, 16:9 aspect ratio, dramatic rim lighting with edge glow, dark studio background with colorful accents, high contrast bold composition, expressive face prominently featured, attention-grabbing saturated colors, professional YouTube creator aesthetic, viral thumbnail style',
        styleNotes: 'Maximum attention, bold colors, expressive face central',
        lightingKeywords: 'rim lighting, edge glow, dramatic backlight, subject separation',
        compositionHint: 'Face fills 40-50% of frame, bold expression, minimal background'
    },

    podcast: {
        name: 'Podcast/Interview',
        colors: {
            primary: ['#2D2D2D', '#FFFFFF', '#FFD700', '#1E90FF'],
            accent: ['#FF6B6B', '#4ECDC4', '#95E1D3'],
            background: '#1A1A1A'
        },
        promptBase: 'YouTube podcast thumbnail, 16:9 aspect ratio, professional studio lighting with subtle rim light, clean dark studio background, professional interview setup aesthetic, confident pose, microphone or podcast equipment visible, premium quality, clean sophisticated composition',
        styleNotes: 'Professional, clean, sophisticated, studio quality',
        lightingKeywords: 'studio lighting, soft rim light, professional setup',
        compositionHint: 'Host portrait, clean background, professional aesthetic'
    },

    tutorial: {
        name: 'Tutorial/Educational',
        colors: {
            primary: ['#4A90D9', '#FFFFFF', '#2ECC71', '#1A1A1A'],
            accent: ['#F39C12', '#E74C3C', '#9B59B6'],
            background: '#FFFFFF'
        },
        promptBase: 'YouTube tutorial thumbnail, 16:9 aspect ratio, clean bright lighting, modern clean background with subtle gradient, educational aesthetic, clear visual hierarchy, professional instructor look, helpful approachable expression, clean composition with space for text',
        styleNotes: 'Clean, bright, educational, approachable',
        lightingKeywords: 'bright even lighting, clean shadows, professional',
        compositionHint: 'Instructor visible, space for text/diagrams, clean layout'
    }
};

// ============================================================================
// EXPRESSION LIBRARY - From STYLE_REFERENCE.md Section "Expression Library"
// ============================================================================

const EXPRESSIONS = {
    shocked: {
        name: 'Shocked/Surprise',
        keywords: 'shocked expression, wide eyes, open mouth in O shape, raised eyebrows high, surprised face, dramatic reaction, jaw dropped',
        intensity: 8,
        bestFor: ['Reveals', 'Unboxings', 'Unexpected results', 'Fails']
    },

    excited: {
        name: 'Excited/Joy',
        keywords: 'excited expression, big genuine smile showing teeth, bright happy eyes slightly squinted from smiling, enthusiastic face, joyful, celebrating, thumbs up energy',
        intensity: 7,
        bestFor: ['Positive reviews', 'Successes', 'Tutorials', 'Good news']
    },

    curious: {
        name: 'Curious/Intrigue',
        keywords: 'curious expression, one raised eyebrow, slight smirk, intrigued questioning look, head tilted slightly, chin stroking pose, investigative look',
        intensity: 5,
        bestFor: ['Mystery content', 'Investigations', 'Comparisons', 'Reviews']
    },

    angry: {
        name: 'Angry/Frustrated',
        keywords: 'angry expression, furrowed brows in V-shape, narrowed intense eyes, clenched teeth or frown, frustrated face, tense forward pose, pointing accusingly',
        intensity: 7,
        bestFor: ['Rants', 'Bad reviews', 'Controversy', 'Warnings']
    },

    fear: {
        name: 'Fear/Worry',
        keywords: 'scared expression, wide fearful eyes, eyebrows raised and pulled together, slightly open tense mouth, worried face, pulling away pose, defensive hands',
        intensity: 6,
        bestFor: ['Horror content', 'Warnings', 'Scary stories', 'Suspense']
    },

    disgusted: {
        name: 'Disgust/Disapproval',
        keywords: 'disgusted expression, wrinkled nose, curled lip, squinted disapproving eyes, grimace face, pulling back pose, pushing away gesture',
        intensity: 6,
        bestFor: ['Bad taste tests', 'Exposing scams', 'Negative reactions']
    },

    confident: {
        name: 'Confident/Knowing',
        keywords: 'confident expression, slight knowing smile, relaxed assured eyes, subtle smirk, professional composed look, arms crossed or hands on hips',
        intensity: 5,
        bestFor: ['Finance', 'Business', 'Expert content', 'Tips']
    },

    determined: {
        name: 'Determined/Intense',
        keywords: 'determined expression, focused intense eyes, set jaw, serious concentrated look, powerful stance, ready for action pose',
        intensity: 7,
        bestFor: ['Fitness', 'Challenges', 'Motivation', 'Sports']
    }
};

// ============================================================================
// LIGHTING PRESETS - From STYLE_REFERENCE.md Section "Lighting Techniques"
// ============================================================================

const LIGHTING_PRESETS = {
    rim: {
        name: 'Rim Light (Edge Glow)',
        keywords: 'rim lit portrait, edge lighting, backlit glow, hair light, subject separation from dark background, glowing edge around subject, professional lighting',
        description: 'Subject pops from background with 3D dimensional effect'
    },

    highKey: {
        name: 'High Key',
        keywords: 'high key lighting, bright even light, soft minimal shadows, clean white background, beauty lighting setup, fresh airy feel',
        description: 'Bright, even lighting with minimal shadows'
    },

    lowKey: {
        name: 'Low Key',
        keywords: 'low key lighting, dramatic deep shadows, single light source, moody dark atmosphere, high contrast, cinematic dramatic',
        description: 'Dramatic, moody lighting with strong shadows'
    },

    neon: {
        name: 'Neon/Cyberpunk',
        keywords: 'neon colored lighting, cyberpunk glow, colored rim lights in cyan and magenta, electric blue and hot pink lights, gaming aesthetic lighting',
        description: 'Colorful neon accents on dark background'
    },

    golden: {
        name: 'Golden Hour',
        keywords: 'golden hour warm lighting, sunset glow, warm orange tones, cinematic natural light, beautiful soft shadows',
        description: 'Warm, cinematic, natural beauty'
    },

    studio: {
        name: 'Studio Professional',
        keywords: 'professional studio lighting, three-point lighting setup, soft key light, fill light, subtle rim light, controlled shadows',
        description: 'Clean, professional, controlled'
    }
};

// ============================================================================
// COMPOSITION RULES - From STYLE_REFERENCE.md
// ============================================================================

const COMPOSITION_RULES = {
    // Subject should fill 35-50% of frame
    subjectSize: 'subject prominently featured filling 40% of frame',

    // 60/40 split avoids AI-looking symmetry
    asymmetry: 'intentional asymmetric composition with 60/40 visual weight distribution',

    // Visual hierarchy
    hierarchy: 'clear visual hierarchy with face as primary focus, supporting elements secondary',

    // Mobile legibility
    mobile: 'designed for mobile viewing at small size, high contrast, clear focal point'
};

// ============================================================================
// MAIN PROMPT BUILDER
// ============================================================================

/**
 * Build a professional thumbnail prompt
 * @param {Object} options
 * @param {string} options.brief - User's content description
 * @param {string} options.niche - Niche key (gaming, tech, finance, etc.)
 * @param {string} options.expression - Expression key (shocked, excited, etc.)
 * @param {boolean} options.hasFace - Whether face reference is provided
 * @param {string} options.lighting - Optional lighting override
 * @param {string} options.additionalContext - Extra context from user
 */
function buildProfessionalPrompt(options) {
    const {
        brief,
        niche = 'reaction',
        expression = 'excited',
        hasFace = false,
        lighting,
        additionalContext
    } = options;

    // Get niche template
    const nicheTemplate = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.reaction;

    // Get expression
    const expressionData = EXPRESSIONS[expression] || EXPRESSIONS.excited;

    // Get lighting (use niche default or override)
    const lightingPreset = lighting
        ? LIGHTING_PRESETS[lighting]
        : getLightingForNiche(niche);

    // Build the prompt
    let prompt = nicheTemplate.promptBase;

    // Add expression
    prompt += `, person with ${expressionData.keywords}`;

    // Add lighting
    prompt += `, ${lightingPreset.keywords}`;

    // Add composition rules
    prompt += `, ${COMPOSITION_RULES.subjectSize}`;
    prompt += `, ${COMPOSITION_RULES.asymmetry}`;

    // Add the user's specific content brief
    prompt += `. Scene content: ${brief}`;

    // Add additional context if provided
    if (additionalContext) {
        prompt += `. ${additionalContext}`;
    }

    // Add face compositing instructions for Gemini
    if (hasFace) {
        prompt += `. CRITICAL INSTRUCTION: Composite the person from the provided reference photo into this scene. Use their ACTUAL face photo - do NOT generate a new face. Place them on the left third of the frame. The person's face, skin tone, and features must be the EXACT photo provided, seamlessly composited onto the generated background. Match the lighting on the person to the scene lighting. The person should appear naturally placed in the environment, with their real photo preserved.`;
    }

    // Add quality boosters
    prompt += `. Ultra high quality, professional YouTube thumbnail, trending, viral potential, 8k details, sharp focus`;

    return prompt;
}

/**
 * Get the best lighting preset for a niche
 */
function getLightingForNiche(niche) {
    const nicheToLighting = {
        gaming: LIGHTING_PRESETS.neon,
        tech: LIGHTING_PRESETS.studio,
        finance: LIGHTING_PRESETS.studio,
        beauty: LIGHTING_PRESETS.highKey,
        fitness: LIGHTING_PRESETS.lowKey,
        cooking: LIGHTING_PRESETS.golden,
        travel: LIGHTING_PRESETS.golden,
        reaction: LIGHTING_PRESETS.rim,
        podcast: LIGHTING_PRESETS.studio,
        tutorial: LIGHTING_PRESETS.highKey
    };

    return nicheToLighting[niche] || LIGHTING_PRESETS.rim;
}

/**
 * Get all available niches
 */
function getNiches() {
    return Object.entries(NICHE_TEMPLATES).map(([key, data]) => ({
        key,
        name: data.name,
        colors: data.colors
    }));
}

/**
 * Get all available expressions
 */
function getExpressions() {
    return Object.entries(EXPRESSIONS).map(([key, data]) => ({
        key,
        name: data.name,
        intensity: data.intensity,
        bestFor: data.bestFor
    }));
}

/**
 * Get niche-specific text styling recommendations
 */
function getTextStyleForNiche(niche) {
    const nicheData = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.reaction;

    // Default text style recommendations based on niche
    const textStyles = {
        gaming: {
            fontFamily: 'Impact, Bungee',
            primaryColor: '#00FFFF',
            strokeColor: '#000000',
            strokeWidth: 8,
            shadow: true,
            glow: true,
            glowColor: '#00D4FF'
        },
        tech: {
            fontFamily: 'Montserrat, Helvetica Neue',
            primaryColor: '#FFFFFF',
            strokeColor: '#000000',
            strokeWidth: 6,
            shadow: true,
            glow: false
        },
        finance: {
            fontFamily: 'Montserrat Black, Impact',
            primaryColor: '#FFD700',
            strokeColor: '#000000',
            strokeWidth: 8,
            shadow: true,
            glow: false
        },
        beauty: {
            fontFamily: 'Playfair Display, Georgia',
            primaryColor: '#FFFFFF',
            strokeColor: '#FFB6C1',
            strokeWidth: 4,
            shadow: true,
            glow: true,
            glowColor: '#FFB6C1'
        },
        fitness: {
            fontFamily: 'Impact, Anton',
            primaryColor: '#FFFFFF',
            strokeColor: '#FF0000',
            strokeWidth: 8,
            shadow: true,
            glow: false
        },
        cooking: {
            fontFamily: 'Playfair Display, Georgia',
            primaryColor: '#FFFFFF',
            strokeColor: '#8B4513',
            strokeWidth: 6,
            shadow: true,
            glow: false
        },
        travel: {
            fontFamily: 'Bebas Neue, Impact',
            primaryColor: '#FFD700',
            strokeColor: '#000000',
            strokeWidth: 8,
            shadow: true,
            glow: false
        },
        reaction: {
            fontFamily: 'Impact, Arial Black',
            primaryColor: '#FFFF00',
            strokeColor: '#000000',
            strokeWidth: 10,
            shadow: true,
            glow: false
        },
        podcast: {
            fontFamily: 'Montserrat, Helvetica',
            primaryColor: '#FFFFFF',
            strokeColor: '#000000',
            strokeWidth: 6,
            shadow: true,
            glow: false
        },
        tutorial: {
            fontFamily: 'Montserrat, Arial',
            primaryColor: '#FFFFFF',
            strokeColor: '#4A90D9',
            strokeWidth: 6,
            shadow: true,
            glow: false
        }
    };

    return textStyles[niche] || textStyles.reaction;
}

module.exports = {
    buildProfessionalPrompt,
    getNiches,
    getExpressions,
    getTextStyleForNiche,
    NICHE_TEMPLATES,
    EXPRESSIONS,
    LIGHTING_PRESETS,
    COMPOSITION_RULES
};
