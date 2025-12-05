/**
 * Prompt Engine for YouTube Thumbnails
 * MASTER SYSTEM - Emulates top creator styles perfectly
 *
 * CREATOR STYLES MASTERED:
 * - MrBeast: Bold colors, Obelix Pro font, exaggerated emotions, $$ imagery
 * - Alex Hormozi: Montserrat Black, yellow/white/black, confident authority
 * - Iman Gadzhi: Minimalist luxury, clean gradients, sophisticated
 * - Magnates Media: Documentary dramatic, red/black, cinematic moody
 *
 * ANTI-AI DETECTION:
 * - Intentional asymmetry (60/40 not 50/50)
 * - Human-like imperfections in composition
 * - Professional Photoshop techniques (not AI smoothness)
 * - Real photography lighting patterns
 *
 * COMPOSITING (Updated V2):
 * - Default: Natural blending (NO hard strokes by default)
 * - Optional: Sticker/cutout effect when explicitly requested
 * - See: ../config/compositingRules.js for full specifications
 */

const {
    getCompositingInstructions,
    getDefaultCompositingMode
} = require('../config/compositingRules');

// ============================================================================
// CREATOR STYLE TEMPLATES - Locked-in exact specifications
// ============================================================================

const CREATOR_STYLES = {
    mrbeast: {
        name: 'MrBeast Style',
        description: 'Maximum viral impact - bold, exaggerated, high-energy',
        colors: {
            primary: '#FFFF00',      // Bright yellow (signature)
            secondary: '#FF0000',    // Intense red
            accent: '#00BFFF',       // Electric blue
            text: '#FFFFFF',         // White text
            stroke: '#000000',       // Black stroke
            background: '#1A1A1A'    // Dark background
        },
        font: {
            family: 'Obelix Pro, Impact, Arial Black',
            weight: 900,
            size: 180,               // MASSIVE text
            strokeWidth: 18,         // THICK black stroke
            shadow: { dx: 12, dy: 12, blur: 0, color: 'rgba(0,0,0,1)' }
        },
        face: {
            expression: 'EXTREME shock or excitement - wide eyes, open mouth, raised eyebrows',
            placement: 'left 40%',
            size: '45% of frame',
            cutoutStroke: 'white 6px',
            outerGlow: 'yellow/cyan 30px blur'
        },
        composition: {
            textPosition: 'right center',
            textWords: '1-3 words MAX',
            background: 'solid dark or dramatic scene',
            props: 'money, cars, challenges, extreme items'
        },
        promptKeywords: 'MrBeast YouTube thumbnail style, EXTREME expression, jaw-dropped shocked face, bold saturated colors, massive money pile, dramatic lighting, viral thumbnail aesthetic, professional photography quality, high contrast, attention-grabbing, white stroke cutout around person'
    },

    hormozi: {
        name: 'Alex Hormozi Style',
        description: 'Business authority - ALL CAPS, yellow #F7C204, confident, clean',
        colors: {
            primary: '#F7C204',      // EXACT Hormozi yellow (research-verified)
            secondary: '#02FB23',    // EXACT Hormozi green (research-verified)
            accent: '#FF0000',       // Red accent
            text: '#FFFFFF',         // White OR Yellow text
            textAlt: '#F7C204',      // Yellow text alternative
            stroke: '#000000',       // Black stroke
            background: '#0A0A0A'    // Pure dark
        },
        font: {
            family: 'Montserrat Black, The Bold Font, Impact',
            weight: 900,             // BLACK weight (research: Montserrat 900)
            size: 140,
            strokeWidth: 12,
            shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
            textCase: 'uppercase'    // ALL CAPS (research-backed)
        },
        face: {
            expression: 'confident knowing look, slight smirk, intense direct eye contact, authoritative',
            placement: 'left 35%',
            size: '40% of frame',
            cutoutStroke: 'white or yellow 4px',
            outerGlow: 'subtle warm 15px'
        },
        composition: {
            textPosition: 'right side',
            textWords: '2-4 words ALL CAPS, creates intrigue',
            background: 'dark gradient, gym equipment, office, wealth indicators',
            props: 'business elements, charts going up, dollar signs',
            rule: 'NO title text duplicated on thumbnail - text COMPLEMENTS title'
        },
        promptKeywords: 'Alex Hormozi YouTube thumbnail style, confident business leader pose, dark moody background, professional studio lighting, high contrast, yellow #F7C204 and white accents on black, authoritative presence, gym owner entrepreneur aesthetic, clean ONE THING focused composition, wealth and success imagery, reduced clutter'
    },

    gadzhi: {
        name: 'Iman Gadzhi Style',
        description: 'Luxury minimalist - WHITE TEXT ONLY, lowercase, sophisticated',
        colors: {
            primary: '#FFFFFF',      // WHITE ONLY (research-backed)
            secondary: '#FFFFFF',    // WHITE ONLY - NO gold text
            accent: '#1A1A1A',       // Deep black
            text: '#FFFFFF',         // WHITE text ONLY
            stroke: '#000000',       // Black stroke only
            background: '#0A0A0A'    // Pure dark minimalist
        },
        font: {
            family: 'Montserrat Light, Montserrat, Helvetica Neue',
            weight: 300,             // LIGHT weight (research: Montserrat Light)
            weightBold: 700,         // Bold weight for emphasis
            size: 100,               // Smaller, elegant
            strokeWidth: 4,          // Subtle stroke
            shadow: { dx: 4, dy: 4, blur: 0, color: 'rgba(0,0,0,0.8)' },
            textCase: 'lowercase'    // CRITICAL: lowercase (rare, premium feel)
        },
        face: {
            expression: 'calm confident, successful, subtle knowing smile, relaxed affluent',
            placement: 'center-left 35%',
            size: '35-40% of frame',
            cutoutStroke: 'subtle white 2px',
            outerGlow: 'soft white 8px'  // White glow, NOT gold
        },
        composition: {
            textPosition: 'right or bottom',
            textWords: '2-4 words, provocative lowercase',
            background: 'pure dark gradient, Dubai skyline silhouette, private jets, luxury minimalist',
            props: 'luxury lifestyle, travel, success symbols, clean aesthetic'
        },
        promptKeywords: 'Iman Gadzhi YouTube thumbnail style, young entrepreneur luxury aesthetic, MINIMALIST clean design, dark sophisticated background, NO colorful text - WHITE ONLY, Dubai lifestyle, private jet yacht imagery, aspirational wealth, clean elegant typography lowercase, professional photography, pure dark gradient background, premium sophisticated feel'
    },

    magnates: {
        name: 'Magnates Media Style',
        description: 'Documentary cinematic - Impact/Bebas Neue, red/black, story-driven',
        colors: {
            primary: '#CC0000',      // Documentary red (research-backed)
            secondary: '#FFFFFF',    // White
            accent: '#000000',       // Black (red/black palette)
            text: '#FFFFFF',         // White text
            textAlt: '#CC0000',      // Red text for emphasis
            stroke: '#000000',       // Black stroke
            background: '#0A0A0A'    // Cinematic dark
        },
        font: {
            family: 'Impact, Bebas Neue, Oswald',  // Tall narrow fonts (movie-poster feel)
            weight: 900,
            size: 130,
            strokeWidth: 10,
            shadow: { dx: 8, dy: 8, blur: 0, color: 'rgba(0,0,0,1)' },
            textCase: 'uppercase'    // ALL CAPS documentary style
        },
        face: {
            expression: 'dramatic portrait, intense gaze, story subject, documentary subject',
            placement: 'center or rule of thirds',
            size: '50-60% of frame (dramatic close-up)',
            cutoutStroke: 'red or white 4px',
            outerGlow: 'red dramatic 20px'
        },
        composition: {
            textPosition: 'top or bottom dramatic',
            textWords: '3-6 words, story hook, foreshadow the story',
            background: 'film grain, shallow depth of field, directional dramatic lighting',
            props: 'documents, money, corporate logos, dramatic scenes',
            style: 'curiosity-generating, tease documentary content'
        },
        promptKeywords: 'Magnates Media documentary thumbnail style, dramatic CINEMATIC lighting, moody dark atmosphere, red and black color scheme, investigative journalism aesthetic, corporate scandal imagery, dramatic portrait lighting, Netflix documentary style, high contrast shadows, story-driven composition, mysterious intriguing mood, film grain texture, shallow depth of field, directional light source'
    }
};

// ============================================================================
// ANTI-AI DETECTION TECHNIQUES - Make thumbnails look human-designed
// ============================================================================

// ============================================================================
// PRO DESIGN SPECIFICATIONS - Based on research of thousands of viral thumbnails
// ============================================================================

const PRO_DESIGN_SPECS = {
    // Pixel dimensions
    dimensions: {
        width: 1280,
        height: 720,
        aspectRatio: '16:9'
    },

    // Face placement rules (backed by research)
    face: {
        coverageMin: 0.40,           // Face should cover 40%+ of thumbnail
        coverageOptimal: 0.45,       // 45% is optimal for viral
        positionHorizontal: 'left',  // Face on LEFT (MrBeast, Hormozi pattern)
        positionVertical: 0.33,      // Eyes on top third line (rule of thirds)
        eyeContact: true,            // Direct eye contact = +25% CTR
        expressionIntensity: 'high'  // Strong emotions outperform neutral
    },

    // Text rules
    text: {
        maxWords: 4,                 // 3-5 words MAX (shorter is better)
        position: 'right',           // Text on RIGHT (opposite of face)
        readableAtSize: 168,         // Must be readable at 168x94 thumbnail size
        strokeWidthMin: 8,           // Minimum stroke for visibility
        strokeWidthOptimal: 12,      // Optimal stroke width
        strokePosition: 'outside'    // Photoshop stroke position = outside
    },

    // Color psychology (high-performing colors)
    colors: {
        highCTR: ['#FF0000', '#FFFF00', '#00BFFF', '#FF00FF'],
        attention: ['#FFD700', '#00FF00', '#FF4500', '#00FFFF'],
        contrast: 'high',            // High contrast outperforms monotone
        background: 'dark'           // Dark backgrounds make subjects pop
    },

    // Timing
    viewerAttention: 1.8,            // 1.8 seconds to make impression
    scanPattern: 'Z-pattern'         // Eyes scan thumbnails in Z pattern
};

const ANTI_AI_TECHNIQUES = {
    composition: [
        'intentional 60/40 asymmetric balance (NOT centered)',
        'slight rotation on text elements (-2 to 3 degrees)',
        'organic placement that feels hand-designed',
        'rule of thirds with subject on intersection points',
        'visual weight distributed naturally',
        'Z-pattern eye flow guiding to call-to-action'
    ],
    lighting: [
        'real photography rim light patterns',
        'natural shadow falloff (not AI-smooth)',
        'visible light source direction',
        'slight color temperature variation',
        'professional studio three-point lighting feel',
        'edge separation glow on subject'
    ],
    texture: [
        'subtle grain or noise in shadows',
        'sharp crisp edges on cutouts (Photoshop quality)',
        'natural skin texture preserved',
        'no AI smoothing or plastic look',
        'realistic cloth/hair detail',
        'professional photo retouching quality'
    ],
    human: [
        'authentic facial expression (not AI-generated face)',
        'real photograph composited professionally',
        'natural body language and pose',
        'genuine emotion that connects with viewer',
        'direct eye contact with camera',
        'expression matches video emotion'
    ],
    photoshop: [
        'clean pen tool cutout edges',
        'stroke applied OUTSIDE (not inside)',
        'layer style outer glow for separation',
        'drop shadow with realistic angle',
        'color grade matches background mood',
        'professional masking around hair'
    ]
};

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

    // Add face compositing instructions using new COMPOSITING RULES
    if (hasFace) {
        // Get appropriate compositing mode based on niche
        const compositingMode = getDefaultCompositingMode({ niche });
        const glowColor = getGlowColorForNiche(niche);
        const compositingInstructions = getCompositingInstructions(compositingMode, {
            glowColor,
            hasFace: true
        });

        prompt += `.

${compositingInstructions}

PLACEMENT:
- Position the person on the LEFT side of the frame, taking up 35-45% of the image width
- Face should be at eye-level, not too high or low
- Keep the right 40-50% of the frame relatively clean for text overlay`;
    }

    // Add PRO THUMBNAIL quality boosters
    prompt += `. PROFESSIONAL THUMBNAIL REQUIREMENTS:
- Ultra high quality, sharp focus, 8k details
- HIGH CONTRAST composition that pops on YouTube's white interface
- BOLD, attention-grabbing visual that works at small mobile thumbnail size (168x94 pixels)
- Clean separation between foreground subject and background
- Dramatic lighting with visible light sources and shadows
- Professional YouTube thumbnail aesthetic, viral potential`;

    return prompt;
}

/**
 * Get the niche-specific glow/stroke color for face cutout effect
 * These are the signature colors that make pro thumbnails pop
 */
function getGlowColorForNiche(niche) {
    const glowColors = {
        gaming: 'cyan/electric blue',      // Neon gaming aesthetic
        tech: 'white/silver',              // Clean tech look
        finance: 'gold/money green',       // Wealth indicators
        beauty: 'soft pink/rose gold',     // Beauty glow
        fitness: 'red/orange',             // Energy/intensity
        cooking: 'warm orange/golden',     // Appetizing warmth
        travel: 'golden/sunset orange',    // Adventure glow
        reaction: 'bright yellow/white',   // Maximum attention
        podcast: 'white/subtle blue',      // Professional
        tutorial: 'blue/white'             // Educational trust
    };

    return glowColors[niche] || 'white/bright';
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

// ============================================================================
// CREATOR STYLE PROMPT BUILDER - Master level thumbnail generation
// ============================================================================

/**
 * Build a CREATOR-STYLE thumbnail prompt
 * Uses locked-in specifications from top YouTubers: MrBeast, Hormozi, Gadzhi, Magnates
 *
 * @param {Object} options
 * @param {string} options.brief - User's content description
 * @param {string} options.creatorStyle - Creator style key (mrbeast, hormozi, gadzhi, magnates)
 * @param {string} options.niche - Fallback niche if no creator style specified
 * @param {string} options.expression - Expression override (otherwise uses creator default)
 * @param {boolean} options.hasFace - Whether face reference is provided
 * @param {string} options.additionalContext - Extra context from user
 */
function buildCreatorStylePrompt(options) {
    const {
        brief,
        creatorStyle,
        niche = 'reaction',
        expression,
        hasFace = false,
        additionalContext
    } = options;

    // Get creator style template (fall back to niche-based if not specified)
    const creator = CREATOR_STYLES[creatorStyle];

    if (!creator) {
        // No creator style specified, use enhanced niche-based prompt
        return buildProfessionalPrompt(options);
    }

    // Build the master-level prompt using creator specifications
    let prompt = `Generate a PROFESSIONAL YouTube thumbnail in the exact style of ${creator.name}.

CREATOR STYLE SPECIFICATIONS:
${creator.promptKeywords}

COLOR PALETTE (EXACT):
- Primary: ${creator.colors.primary}
- Secondary: ${creator.colors.secondary}
- Text: ${creator.colors.text} with ${creator.colors.stroke} stroke
- Background: ${creator.colors.background}

FONT STYLE:
- Family: ${creator.font.family}
- Weight: ${creator.font.weight}
- Size: MASSIVE ${creator.font.size}pt equivalent
- Stroke: ${creator.font.strokeWidth}px black outline
- Shadow: ${creator.font.shadow.dx}px ${creator.font.shadow.dy}px hard drop shadow (NO BLUR)

COMPOSITION:
- Text position: ${creator.composition.textPosition}
- Text length: ${creator.composition.textWords}
- Background style: ${creator.composition.background}
- Props/elements: ${creator.composition.props}

CONTENT BRIEF: ${brief}`;

    // Add expression - use creator default or override
    const expressionText = expression
        ? (EXPRESSIONS[expression]?.keywords || creator.face.expression)
        : creator.face.expression;
    prompt += `

EXPRESSION: ${expressionText}`;

    // Add face compositing with CREATOR-SPECIFIC styling (using compositing rules)
    if (hasFace) {
        // Get compositing mode for this creator style
        const compositingMode = getDefaultCompositingMode({ creatorStyle });
        const glowColor = getGlowColorForNiche(niche);
        const compositingInstructions = getCompositingInstructions(compositingMode, {
            glowColor,
            hasFace: true
        });

        prompt += `

FACE COMPOSITING (${creator.name} Style):
${compositingInstructions}

PLACEMENT: ${creator.face.placement} of frame
SIZE: Person should fill ${creator.face.size}`;
    }

    // Add ANTI-AI TECHNIQUES to make it look human-designed
    prompt += `

ANTI-AI DETECTION (CRITICAL - Make it look HUMAN-DESIGNED, not AI):
COMPOSITION: ${ANTI_AI_TECHNIQUES.composition.join(', ')}
LIGHTING: ${ANTI_AI_TECHNIQUES.lighting.join(', ')}
TEXTURE: ${ANTI_AI_TECHNIQUES.texture.join(', ')}
HUMAN ELEMENTS: ${ANTI_AI_TECHNIQUES.human.join(', ')}`;

    // Add additional context
    if (additionalContext) {
        prompt += `

ADDITIONAL CONTEXT: ${additionalContext}`;
    }

    // Final quality requirements
    prompt += `

PROFESSIONAL REQUIREMENTS:
- 16:9 aspect ratio (1280x720)
- Ultra high quality, sharp focus
- HIGH CONTRAST that pops on YouTube's white interface
- Works at small mobile thumbnail size (168x94 pixels)
- Looks like it was designed by a professional designer, NOT AI
- Viral thumbnail aesthetic with proven click-through patterns`;

    return prompt;
}

/**
 * Get creator style text configuration for textOverlayService
 * Returns the EXACT font/color settings for each creator style
 */
function getCreatorTextStyle(creatorStyle) {
    const creator = CREATOR_STYLES[creatorStyle];

    if (!creator) {
        // Return default viral style
        return {
            fontFamily: 'Impact, Arial Black, sans-serif',
            fontWeight: 900,
            fontSize: 160,
            fill: '#FFFF00',
            stroke: '#000000',
            strokeWidth: 14,
            shadow: { dx: 10, dy: 10, blur: 0, color: 'rgba(0,0,0,1)' },
            glow: null
        };
    }

    return {
        fontFamily: creator.font.family,
        fontWeight: creator.font.weight,
        fontSize: creator.font.size,
        fill: creator.colors.text,
        stroke: creator.colors.stroke,
        strokeWidth: creator.font.strokeWidth,
        shadow: creator.font.shadow,
        glow: creatorStyle === 'mrbeast' ? { blur: 15, color: creator.colors.primary } : null
    };
}

/**
 * Get all available creator styles
 */
function getCreatorStyles() {
    return Object.entries(CREATOR_STYLES).map(([key, data]) => ({
        key,
        name: data.name,
        description: data.description,
        colors: data.colors
    }));
}

/**
 * BUILD DIRECT PROMPT - For detailed user prompts
 * When user provides specific composition/scene instructions, USE THEM DIRECTLY
 * Only add quality boosters at the end - DON'T override their vision
 *
 * This matches how the user gets great results typing directly into Gemini
 */
function buildDirectPrompt(brief, options = {}) {
    const { hasFace, niche, expression, thumbnailText } = options;

    // Get niche-specific visual elements
    const glowColor = getGlowColorForNiche(niche || 'tech');
    const nicheTemplate = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.tech;

    // Start with the user's EXACT prompt as the primary instruction
    let prompt = `Generate a professional YouTube thumbnail image.

${brief}

VISUAL STYLE & QUALITY:
- Professional graphic design quality (Photoshop-level compositing)
- ${nicheTemplate.lightingKeywords}
- High contrast that pops on YouTube's white interface
- Multiple depth layers: detailed background, midground elements, foreground subject
- Rich color saturation with ${nicheTemplate.colors.primary.join ? nicheTemplate.colors.primary.slice(0,2).join(', ') : 'vibrant colors'}
- Circuit board patterns, tech elements, or thematic graphics where appropriate
- Professional brand logos/icons if relevant to the content
- Lens flares, particle effects, and atmospheric lighting for depth`;

    // Face compositing - but DON'T override user's positioning if they specified it
    if (hasFace) {
        const hasPositionInBrief = brief.toLowerCase().includes('center') ||
            brief.toLowerCase().includes('left') ||
            brief.toLowerCase().includes('right');

        // Use natural compositing by default (no hard strokes)
        const compositingMode = getDefaultCompositingMode({ niche });
        const compositingInstructions = getCompositingInstructions(compositingMode, {
            glowColor,
            hasFace: true
        });

        prompt += `

PERSON/FACE COMPOSITING:
${compositingInstructions}`;

        // Only add position guidance if user didn't specify
        if (!hasPositionInBrief) {
            prompt += `
- Position person taking up 35-45% of frame with space for text`;
        }
    }

    // Quality requirements at the END (don't override user's scene)
    prompt += `

PROFESSIONAL REQUIREMENTS:
- 16:9 aspect ratio (1280x720)
- 8K quality, ultra sharp details
- Designed to look human-made, not AI-generated
- Works at small mobile thumbnail size (168x94px)
- Viral YouTube thumbnail aesthetic`;

    return prompt;
}

/**
 * Auto-select the best creator style for a given niche
 * Maps niches to the creator style that fits best
 */
function getCreatorStyleForNiche(niche) {
    const nicheToCreator = {
        gaming: 'mrbeast',        // High energy, viral
        tech: 'hormozi',          // Clean, professional
        finance: 'hormozi',       // Business authority
        beauty: 'gadzhi',         // Luxury aesthetic
        fitness: 'hormozi',       // Confidence, results
        cooking: 'mrbeast',       // Vibrant, exciting
        travel: 'gadzhi',         // Aspirational luxury
        reaction: 'mrbeast',      // Maximum attention
        podcast: 'magnates',      // Documentary feel
        tutorial: 'hormozi',      // Professional trust
        business: 'hormozi',      // Authority
        luxury: 'gadzhi',         // Sophisticated
        documentary: 'magnates',  // Cinematic
        entertainment: 'mrbeast'  // Viral energy
    };

    return nicheToCreator[niche] || 'mrbeast';
}

/**
 * Build the ULTIMATE prompt combining creator style + niche specifics
 * This is the MASTER function for production use
 *
 * BASED ON GOOGLE'S OFFICIAL GEMINI PROMPTING GUIDANCE:
 * 1. Describe the scene narratively, don't just list keywords
 * 2. Use photographic language (lens specs, camera angles, lighting)
 * 3. Be hyper-specific for more control
 * 4. Provide context about the image's purpose
 *
 * KEY INSIGHT: When user provides DETAILED prompts with specific scene descriptions,
 * we should TRUST their prompt and add quality modifiers - NOT override with templates.
 */
function buildUltimatePrompt(options) {
    const {
        brief,
        creatorStyle,
        niche = 'reaction',
        expression,
        hasFace = false,
        thumbnailText,
        additionalContext
    } = options;

    // DETECT if user provided a DETAILED, SPECIFIC prompt
    // These indicate the user knows exactly what they want - DON'T override
    const specificCompositionWords = [
        'centered', 'left side', 'right side', 'background', 'foreground',
        'show ', 'display', 'featuring', 'with a ', 'behind', 'in front',
        'on the left', 'on the right', 'at the top', 'at the bottom',
        'frame', 'composition', 'scene shows', 'image shows'
    ];

    const isDetailedPrompt = brief.length > 100 &&
        specificCompositionWords.some(word => brief.toLowerCase().includes(word));

    // If user has a detailed, specific prompt - USE IT DIRECTLY with quality boosters
    if (isDetailedPrompt) {
        return buildDirectPrompt(brief, { hasFace, niche, expression, thumbnailText });
    }

    // Otherwise, use the full template system for simple briefs
    // Determine creator style: use specified or auto-select based on niche
    // IMPORTANT: 'auto' means auto-select, not a literal style key
    const effectiveCreatorStyle = (!creatorStyle || creatorStyle === 'auto')
        ? getCreatorStyleForNiche(niche)
        : creatorStyle;
    const creator = CREATOR_STYLES[effectiveCreatorStyle];
    const nicheTemplate = NICHE_TEMPLATES[niche] || NICHE_TEMPLATES.reaction;

    // Get expression data
    const expressionData = expression
        ? (EXPRESSIONS[expression] || EXPRESSIONS.excited)
        : EXPRESSIONS.excited;

    // Get niche-specific visual elements
    const glowColor = getGlowColorForNiche(niche);

    // PROFESSIONAL PHOTOGRAPHY SPECS (based on Google's guidance)
    const photographySpecs = {
        gaming: 'shot with wide-angle lens, dramatic low angle, neon-lit environment, volumetric fog',
        tech: 'shot with 50mm lens, eye-level angle, clean studio environment, softbox lighting',
        finance: 'shot with 85mm portrait lens, slight low angle for authority, professional studio',
        beauty: 'shot with 85mm portrait lens, soft beauty dish lighting, high-key environment',
        fitness: 'shot with 35mm lens, dynamic angle, dramatic side lighting, gym environment',
        cooking: 'shot with 50mm lens, overhead angle option, warm golden lighting, kitchen environment',
        travel: 'shot with wide-angle lens, cinematic composition, golden hour lighting',
        reaction: 'shot with 50mm lens, eye-level engaging angle, dramatic rim lighting, dark studio',
        podcast: 'shot with 85mm lens, professional interview angle, three-point lighting setup',
        tutorial: 'shot with 50mm lens, friendly angle, bright even lighting, clean background'
    };
    const photoSpec = photographySpecs[niche] || photographySpecs.reaction;

    // BUILD NARRATIVE PROMPT (Google recommends descriptive paragraphs, not keyword lists)
    let prompt = `Create a professional YouTube thumbnail image in the style of ${creator.name}.

SCENE DESCRIPTION:
Imagine a high-impact YouTube thumbnail designed to maximize click-through rate. The scene shows ${brief}. The overall mood is ${nicheTemplate.styleNotes || 'dramatic and attention-grabbing'}. This thumbnail must look like it was designed by a professional graphic designer, not AI-generated.

PHOTOGRAPHY & CAMERA:
This image is ${photoSpec}. The composition follows the rule of thirds with the main subject positioned on the left third of the frame. There is intentional negative space on the right side for text overlay. The depth of field creates separation between the subject and background.

LIGHTING & ATMOSPHERE:
${nicheTemplate.lightingKeywords}. The lighting creates dramatic shadows and highlights that give the image depth and dimension. There are visible rim lights in ${glowColor} color creating edge separation. The overall contrast is high - this thumbnail must pop on YouTube's white interface.

COLOR PALETTE:
Primary colors: ${creator.colors.primary}, ${creator.colors.secondary}. Background: ${creator.colors.background}. The colors are saturated and vibrant, designed to catch attention in a crowded YouTube feed.`;

    // Face compositing with DETAILED narrative instructions (using V2 compositing rules)
    if (hasFace) {
        // Get compositing mode based on context
        const compositingMode = getDefaultCompositingMode({ creatorStyle: effectiveCreatorStyle, niche });
        const compositingInstructions = getCompositingInstructions(compositingMode, {
            glowColor,
            hasFace: true
        });

        prompt += `

PERSON IN THE IMAGE:
The person from the reference photo is prominently featured, taking up 40-45% of the left side of the frame. Their face shows a ${expressionData.keywords} expression.

${compositingInstructions}

The person's lighting matches the scene - there are no harsh mismatches between the subject and background lighting.`;
    } else {
        prompt += `

The scene should feature ${expressionData.keywords} mood and energy. The composition has clear visual hierarchy with the main subject prominently featured.`;
    }

    // Visual effects and depth layers
    prompt += `

VISUAL EFFECTS & DEPTH:
This thumbnail has multiple visual layers creating depth:
- Background layer: ${nicheTemplate.compositionHint || 'relevant themed background with subtle motion blur or bokeh'}
- Midground layer: Supporting visual elements, icons, or graphics related to ${brief}
- Foreground layer: Main subject with dramatic lighting and glow effects
Add subtle visual effects like: lens flares, light leaks, particle effects, or atmospheric haze where appropriate for the ${niche} style.`;

    // Text space (text will be added by textOverlayService)
    if (thumbnailText) {
        prompt += `

TEXT SPACE:
The right 40-50% of the image has clean negative space suitable for bold text overlay. The background in this area should be darker or simpler to ensure text readability. Do not place important visual elements in this zone.`;
    }

    // Anti-AI quality requirements
    prompt += `

PROFESSIONAL QUALITY REQUIREMENTS:
- This must look like a thumbnail created by a professional designer using Photoshop, NOT AI-generated
- Intentional asymmetric composition (60/40 balance, not centered)
- Natural imperfections in lighting and shadows (not too smooth or perfect)
- High contrast that works at small thumbnail size (168x94 pixels on mobile)
- Sharp details in the subject, with appropriate depth of field blur elsewhere
- 16:9 aspect ratio (1280x720 pixels)
- 8K quality fine details, professional photo retouching quality
- The image should have the polished look of a thumbnail that would get millions of views`;

    // Additional context
    if (additionalContext) {
        prompt += `

ADDITIONAL CONTEXT: ${additionalContext}`;
    }

    return prompt;
}

module.exports = {
    buildProfessionalPrompt,
    buildCreatorStylePrompt,
    buildUltimatePrompt,
    buildDirectPrompt,
    getNiches,
    getExpressions,
    getTextStyleForNiche,
    getCreatorTextStyle,
    getCreatorStyles,
    getCreatorStyleForNiche,
    NICHE_TEMPLATES,
    EXPRESSIONS,
    LIGHTING_PRESETS,
    COMPOSITION_RULES,
    CREATOR_STYLES,
    ANTI_AI_TECHNIQUES,
    PRO_DESIGN_SPECS
};
