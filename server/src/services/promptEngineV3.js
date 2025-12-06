/**
 * Prompt Engine V3 - CINEMATIC THUMBNAIL GENERATION
 *
 * MISSION: Generate production-quality YouTube thumbnails with:
 * - GUARANTEED front-facing subjects with direct eye contact
 * - SAFE COMPOSITION with proper margins for text/logos
 * - BRAND LOGO handling with designated zones
 * - CINEMATIC quality lighting and depth
 * - ARCHETYPE-BASED templates for different content types
 *
 * VERSION HISTORY:
 * V1: Basic prompt generation with niche templates
 * V2: Added compositing rules and background quality tiers
 * V3: Cinematic composition enforcement, front-facing guarantees, logo handling
 *
 * @module promptEngineV3
 * @author BUILD-ENGINE-PRIME
 */

const {
    getCompositingInstructions,
    getDefaultCompositingMode
} = require('../config/compositingRules');

const {
    getBackgroundPrompt,
    getDefaultTier,
    BACKGROUND_TIERS,
    NICHE_BACKGROUNDS
} = require('../config/backgroundQuality');

// Import V2 engine for backward compatibility
const V2Engine = require('./promptEngine');

// ============================================================================
// V3 COMPOSITION ENFORCEMENT CONSTANTS
// ============================================================================

/**
 * SAFE ZONE SPECIFICATIONS
 * Defines margins and zones where elements must stay within frame
 */
const SAFE_ZONES = {
    /**
     * Text safe zone - 10% margin on all sides
     * Text must be FULLY within this zone to avoid cropping
     */
    text: {
        marginPercent: 10,
        promptInstruction: 'All text must be positioned with at least 10% margin from all edges of the frame. No text should touch or extend beyond the frame boundaries.'
    },

    /**
     * Subject safe zone - ensures subject is not cropped awkwardly
     */
    subject: {
        marginTop: 5,      // 5% from top
        marginBottom: 0,   // Can extend to bottom
        marginSides: 8,    // 8% from sides
        promptInstruction: 'Subject head must have at least 5% clearance from top of frame. Subject should not be cropped at awkward points (mid-torso, mid-arm).'
    },

    /**
     * Logo safe zone - designated area for brand logos
     * Default: top-right cluster
     */
    logo: {
        defaultPosition: 'top-right',
        marginFromEdge: 5,      // 5% from edges
        maxSizePercent: 15,     // Max 15% of frame width
        promptInstruction: 'Brand logos must be positioned in the top-right corner with 5% margin from edges. Logos must be FULLY visible, not cropped, max 15% of frame width.'
    }
};

/**
 * FRONT-FACING SUBJECT ENFORCEMENT
 * Critical instructions to ensure subject faces camera directly
 */
const FRONT_FACING_ENFORCEMENT = {
    /**
     * Core front-facing requirements
     * These are NON-NEGOTIABLE for thumbnail quality
     */
    core: `
SUBJECT ORIENTATION (CRITICAL - NON-NEGOTIABLE):
- Subject MUST be facing DIRECTLY toward the camera (front-facing, NOT profile or 3/4 view)
- Head and upper torso must be FULLY visible within frame (no awkward cropping at neck/chest)
- DIRECT EYE CONTACT with the viewer - eyes looking straight into camera lens
- Face angle: 0-15 degrees maximum deviation from front-facing (no side profiles)
- Expression must be CLEARLY READABLE at thumbnail size (168x94 pixels)`,

    /**
     * Depth of field instructions for subject sharpness
     */
    depthOfField: `
DEPTH OF FIELD & FOCUS:
- Subject face and eyes: TACK SHARP, critical focus point
- Subject torso: Sharp to slightly soft acceptable
- Background: Soft bokeh blur (f/2.8 - f/4 equivalent)
- Foreground elements: Can have slight blur for depth
- NO motion blur on subject face`,

    /**
     * Head and body framing
     */
    framing: `
SUBJECT FRAMING:
- Full head visible with 5-10% headroom above
- Shoulders and upper chest visible (minimum)
- Subject positioned on rule-of-thirds vertical line (left or right third)
- Face at eye-level or slightly below center (natural, engaging angle)
- NO tilted or Dutch angle compositions`
};

/**
 * PROFESSIONAL LIGHTING SETUP
 * Three-point lighting standard for cinematic quality
 */
const CINEMATIC_LIGHTING = {
    /**
     * Standard three-point lighting setup
     */
    threePoint: `
PROFESSIONAL THREE-POINT LIGHTING:
- KEY LIGHT: Main light source from 45 degrees front-side, creating natural face modeling
- FILL LIGHT: Softer light from opposite side, ratio 2:1 to 4:1 with key
- RIM/BACK LIGHT: Edge lighting from behind subject, creating separation from background
- Hair light optional for additional dimension`,

    /**
     * Cinematic quality markers
     */
    cinematicMarkers: `
CINEMATIC QUALITY MARKERS:
- Visible light direction and shadow consistency
- Professional color temperature (warm key ~5000K or dramatic cool ~6500K)
- High dynamic range - deep shadows and bright highlights preserved
- Subtle lens effects acceptable (minor flare, natural vignette)
- Film-like color grading (teal/orange, or niche-appropriate palette)`,

    /**
     * Subject separation from background
     */
    separation: `
SUBJECT-BACKGROUND SEPARATION:
- Clear tonal separation between subject edges and background
- Rim light creating luminous edge (not harsh stroke)
- Background 2-3 stops darker or lighter than subject for contrast
- Atmospheric depth between subject and background layers`
};

/**
 * BRAND LOGO HANDLING SPECIFICATIONS
 * Rules for rendering and positioning brand logos
 */
const LOGO_HANDLING = {
    /**
     * Default logo zone specification
     */
    defaultZone: 'top-right',

    /**
     * Available logo positions with coordinates
     */
    positions: {
        'top-right': {
            anchor: 'top-right',
            offsetX: '5%',
            offsetY: '5%',
            promptHint: 'top-right corner, 5% margin from top and right edges'
        },
        'top-left': {
            anchor: 'top-left',
            offsetX: '5%',
            offsetY: '5%',
            promptHint: 'top-left corner, 5% margin from top and left edges'
        },
        'bottom-right': {
            anchor: 'bottom-right',
            offsetX: '5%',
            offsetY: '5%',
            promptHint: 'bottom-right corner, 5% margin from bottom and right edges'
        },
        'bottom-left': {
            anchor: 'bottom-left',
            offsetX: '5%',
            offsetY: '5%',
            promptHint: 'bottom-left corner, 5% margin from bottom and left edges'
        }
    },

    /**
     * Logo rendering quality instructions
     */
    renderingInstructions: `
BRAND LOGO RENDERING (IF LOGOS PRESENT):
- Logos must be 100% FULLY VISIBLE - absolutely NO cropping of any logo edge
- Maintain original logo aspect ratio - NO stretching or warping
- Logo size: 8-15% of frame width maximum
- High resolution rendering - crisp edges, no blur on logos
- Clear separation from subject - logos should not overlap face/body
- Consistent lighting on logos that matches scene
- Grouped together in designated zone (do not scatter across frame)`
};

// ============================================================================
// V3 ARCHETYPE TEMPLATES
// ============================================================================

/**
 * CONTENT ARCHETYPE TEMPLATES
 * Each archetype has specific composition, lighting, and mood requirements
 * These extend beyond simple niches to capture content PURPOSE
 */
const ARCHETYPE_TEMPLATES = {
    /**
     * REACTION Archetype
     * Subject reacting to big event/news with shocked or excited expression
     */
    reaction: {
        name: 'Reaction/Commentary',
        description: 'Subject reacting dramatically to news, events, or reveals',

        subjectRequirements: {
            expression: 'EXTREME emotional reaction - wide eyes, open mouth, raised eyebrows, genuine shock or excitement',
            pose: 'Hands up near face or gesture of surprise, leaning slightly forward or back',
            framing: 'Head and shoulders prominent, face takes 40-50% of frame width',
            position: 'Left third of frame (rule of thirds vertical line)'
        },

        backgroundRequirements: {
            style: 'Dark dramatic with color accent splashes',
            elements: ['abstract geometric shapes', 'color gradients', 'subtle energy effects'],
            lighting: 'Dramatic rim light in accent color (cyan, yellow, magenta)',
            depth: 'Simple but impactful - subject is the star'
        },

        lightingSetup: {
            key: 'Front-facing softbox for even face illumination',
            rim: 'Strong colored rim light (cyan or yellow) from behind',
            fill: 'Minimal fill for dramatic shadows',
            mood: 'High contrast, dramatic, attention-grabbing'
        },

        colorPalette: {
            primary: ['#FFFF00', '#00FFFF', '#FF00FF'],
            background: '#0A0A0A',
            accents: ['#FF0055', '#00FF00']
        },

        promptKeywords: 'reaction thumbnail, dramatic expression, shocked face, wide eyes, viral YouTube aesthetic, bold colors, maximum attention, high energy, direct eye contact'
    },

    /**
     * EXPLAINER Archetype
     * Subject confidently explaining a topic with authority
     */
    explainer: {
        name: 'Explainer/Educational',
        description: 'Subject as expert explaining complex topics with confidence',

        subjectRequirements: {
            expression: 'Confident, knowing look - slight smile, assured eyes, intelligent expression',
            pose: 'Professional stance, hands visible and gesturing confidently, open body language',
            framing: 'Head and torso, professional framing like a speaker or presenter',
            position: 'Left or center-left, with space for supporting graphics on right'
        },

        backgroundRequirements: {
            style: 'Professional studio or contextual environment',
            elements: ['subtle diagrams', 'topic-related icons', 'clean workspace'],
            lighting: 'Even, professional studio lighting',
            depth: 'Clean background with supporting visual elements'
        },

        lightingSetup: {
            key: 'Large softbox for even, flattering light',
            rim: 'Subtle white rim for subject separation',
            fill: 'Strong fill for approachable, trustworthy look',
            mood: 'Professional, trustworthy, authoritative'
        },

        colorPalette: {
            primary: ['#FFFFFF', '#4A90D9', '#2ECC71'],
            background: '#1A1A2E',
            accents: ['#F39C12', '#3498DB']
        },

        promptKeywords: 'expert explainer thumbnail, confident expression, professional presenter, educational content, trustworthy authority, clean composition, YouTube educator aesthetic'
    },

    /**
     * TUTORIAL Archetype
     * How-to style with clear educational focus and tools visible
     */
    tutorial: {
        name: 'Tutorial/How-To',
        description: 'Step-by-step educational content with clear visual hierarchy',

        subjectRequirements: {
            expression: 'Friendly, approachable, helpful - warm smile, inviting eyes',
            pose: 'Demonstrating or pointing to tools/elements, hands actively engaged',
            framing: 'Upper body with hands visible, space for text/graphics',
            position: 'Left side with tools/demo area visible'
        },

        backgroundRequirements: {
            style: 'Clean workspace, organized setup, relevant tools visible',
            elements: ['tools of the trade', 'organized workspace', 'screen or device if digital'],
            lighting: 'Bright, even lighting for clarity',
            depth: 'Shallow - keep focus on subject and tools'
        },

        lightingSetup: {
            key: 'Bright, even key light for clear visibility',
            rim: 'Minimal - not needed for educational content',
            fill: 'Strong fill for even illumination',
            mood: 'Bright, clear, educational'
        },

        colorPalette: {
            primary: ['#FFFFFF', '#4A90D9', '#2ECC71'],
            background: '#F5F5F5',
            accents: ['#E74C3C', '#F39C12']
        },

        promptKeywords: 'tutorial thumbnail, how-to style, educational, clear visual hierarchy, helpful expression, demonstration pose, tools visible, step-by-step, approachable teacher'
    },

    /**
     * DOCUMENTARY Archetype
     * Investigation style with dramatic, mysterious mood
     */
    documentary: {
        name: 'Documentary/Investigation',
        description: 'Dramatic investigative storytelling with mystery and intrigue',

        subjectRequirements: {
            expression: 'Intense, knowing gaze - serious, investigative look, slight frown',
            pose: 'Dramatic portrait, slightly angled but still front-facing, contemplative',
            framing: 'Dramatic close-up, face takes 50-60% of frame',
            position: 'Rule of thirds, can be more centered for documentary style'
        },

        backgroundRequirements: {
            style: 'Moody, cinematic, story-appropriate imagery',
            elements: ['documents', 'evidence boards', 'corporate buildings', 'dramatic locations'],
            lighting: 'Dramatic single-source with deep shadows',
            depth: 'Cinematic depth with story elements in background'
        },

        lightingSetup: {
            key: 'Hard directional light creating dramatic shadows',
            rim: 'Strong rim light in red or white',
            fill: 'Minimal fill for maximum drama',
            mood: 'Mysterious, investigative, cinematic'
        },

        colorPalette: {
            primary: ['#CC0000', '#FFFFFF'],
            background: '#0A0A0A',
            accents: ['#1A1A1A', '#8B0000']
        },

        promptKeywords: 'documentary thumbnail, investigative journalism, dramatic portrait, Netflix documentary style, moody lighting, mysterious, film grain, cinematic, story-driven, intriguing'
    },

    /**
     * CONSPIRACY/BREAKDOWN Archetype
     * Industry expose with dramatic lighting and corporate imagery
     */
    conspiracy: {
        name: 'Conspiracy/Industry Breakdown',
        description: 'Dramatic expose-style content revealing hidden truths',

        subjectRequirements: {
            expression: 'Knowing, revelatory - raised eyebrow, slight smirk, "I know something you dont"',
            pose: 'Leaning forward conspiratorially, or arms crossed with knowing look',
            framing: 'Dramatic angle, subject prominent with story elements',
            position: 'Off-center, with corporate/industry imagery behind'
        },

        backgroundRequirements: {
            style: 'Corporate, industrial, or government imagery with dramatic treatment',
            elements: ['corporate logos (treated dramatically)', 'money imagery', 'documents', 'red strings connecting'],
            lighting: 'Dramatic, almost sinister lighting',
            depth: 'Layered conspiracy-board aesthetic'
        },

        lightingSetup: {
            key: 'Harsh directional light from above or side',
            rim: 'Red or amber rim for ominous feel',
            fill: 'Very minimal for dramatic shadows on face',
            mood: 'Ominous, revealing, dramatic'
        },

        colorPalette: {
            primary: ['#FF0000', '#FFD700', '#FFFFFF'],
            background: '#000000',
            accents: ['#8B0000', '#1A1A1A']
        },

        promptKeywords: 'conspiracy thumbnail, industry expose, dramatic reveal, corporate scandal, knowing expression, red string connections, dramatic shadows, truth revealed, investigative'
    },

    /**
     * GAMING Archetype
     * Energetic, neon, action-packed gaming content
     */
    gaming: {
        name: 'Gaming/Esports',
        description: 'High-energy gaming content with neon aesthetics',

        subjectRequirements: {
            expression: 'Excited, competitive, intense - screaming, celebrating, or focused gaming face',
            pose: 'Dynamic action pose, hands up in victory or gaming stance',
            framing: 'Upper body, energetic framing with space for game elements',
            position: 'Left third with game imagery on right'
        },

        backgroundRequirements: {
            style: 'Neon-lit, cyberpunk, gaming setup aesthetic',
            elements: ['RGB lighting', 'game characters/elements', 'hexagonal patterns', 'holographic UI'],
            lighting: 'Multi-colored neon rim lights',
            depth: 'Layered with particle effects and energy'
        },

        lightingSetup: {
            key: 'Colored key light (cyan or magenta)',
            rim: 'Opposing color rim (magenta or cyan) for RGB effect',
            fill: 'Minimal - let the colors create drama',
            mood: 'High energy, competitive, exciting'
        },

        colorPalette: {
            primary: ['#00FFFF', '#FF00FF', '#00FF00'],
            background: '#0A0A0F',
            accents: ['#FF4500', '#39FF14', '#BF00FF']
        },

        promptKeywords: 'gaming thumbnail, esports energy, neon lights, RGB aesthetic, excited gamer, victory pose, competitive intensity, cyberpunk gaming, particle effects, high energy'
    },

    /**
     * FINANCE Archetype
     * Wealth aesthetic with gold/black authority
     */
    finance: {
        name: 'Finance/Wealth',
        description: 'Authoritative finance content with wealth indicators',

        subjectRequirements: {
            expression: 'Confident authority - knowing smirk, intense direct gaze, successful',
            pose: 'Power pose, arms crossed or hands clasped, business authority',
            framing: 'Professional portrait, head and shoulders with wealth elements',
            position: 'Left third with charts/money imagery on right'
        },

        backgroundRequirements: {
            style: 'Dark, luxurious with gold accents and wealth indicators',
            elements: ['stock charts (green up arrows)', 'gold bars/coins', 'money stacks', 'city skyline'],
            lighting: 'Professional with golden accents',
            depth: 'Layered with floating money/chart elements'
        },

        lightingSetup: {
            key: 'Professional studio lighting, warm tint',
            rim: 'Golden rim light for wealth aesthetic',
            fill: 'Strong fill for approachable yet authoritative look',
            mood: 'Wealthy, successful, authoritative'
        },

        colorPalette: {
            primary: ['#FFD700', '#00C853', '#FFFFFF'],
            background: '#0D0D0D',
            accents: ['#00FF00', '#1E3A5F']
        },

        promptKeywords: 'finance thumbnail, wealth aesthetic, gold accents, money imagery, confident authority, stock market, investment, business success, luxury, professional'
    }
};

// ============================================================================
// V3 PROMPT BUILDER FUNCTIONS
// ============================================================================

/**
 * Build a V3 CINEMATIC prompt with all composition enforcement
 * This is the MASTER function for V3 thumbnail generation
 *
 * @param {Object} options - Configuration options
 * @param {string} options.brief - User's content description
 * @param {string} options.archetype - Content archetype (reaction, explainer, tutorial, documentary, conspiracy, gaming, finance)
 * @param {string} [options.niche] - Fallback niche if archetype not specified
 * @param {string} [options.expression] - Expression override
 * @param {boolean} [options.hasFace=false] - Whether face reference is provided
 * @param {string} [options.thumbnailText] - Text to overlay (for composition planning)
 * @param {Object} [options.logos] - Logo configuration
 * @param {string[]} [options.logos.brandLogos] - Array of brand logo names to include
 * @param {string} [options.logos.position='top-right'] - Logo cluster position
 * @param {string} [options.additionalContext] - Extra context from user
 * @param {string} [options.creatorStyle] - Creator style for backward compatibility
 * @returns {string} Complete prompt for image generation
 */
function buildCinematicPrompt(options) {
    const {
        brief,
        archetype,
        niche = 'reaction',
        expression,
        hasFace = false,
        thumbnailText,
        logos = {},
        additionalContext,
        creatorStyle
    } = options;

    // Get archetype template (fall back to reaction if not specified)
    const archetypeKey = archetype || mapNicheToArchetype(niche);
    const archetypeTemplate = ARCHETYPE_TEMPLATES[archetypeKey] || ARCHETYPE_TEMPLATES.reaction;

    // Get background configuration
    const backgroundInstructions = getBackgroundPrompt(niche);

    // Get compositing mode
    const compositingMode = getDefaultCompositingMode({ niche, creatorStyle });
    const glowColor = getGlowColorForArchetype(archetypeKey);
    const compositingInstructions = getCompositingInstructions(compositingMode, {
        glowColor,
        hasFace
    });

    // Build the comprehensive V3 prompt
    let prompt = `Generate a PROFESSIONAL CINEMATIC YouTube thumbnail image.

=== CONTENT BRIEF ===
${brief}

=== ARCHETYPE: ${archetypeTemplate.name.toUpperCase()} ===
Style: ${archetypeTemplate.description}
Keywords: ${archetypeTemplate.promptKeywords}

${FRONT_FACING_ENFORCEMENT.core}

${FRONT_FACING_ENFORCEMENT.framing}

${FRONT_FACING_ENFORCEMENT.depthOfField}`;

    // Add face compositing instructions if face reference provided
    if (hasFace) {
        prompt += `

=== FACE COMPOSITING ===
${compositingInstructions}

SUBJECT EXPRESSION REQUIREMENTS:
${archetypeTemplate.subjectRequirements.expression}

SUBJECT POSE:
${archetypeTemplate.subjectRequirements.pose}

SUBJECT FRAMING:
${archetypeTemplate.subjectRequirements.framing}

SUBJECT POSITION:
${archetypeTemplate.subjectRequirements.position}`;
    } else {
        prompt += `

=== SUBJECT REQUIREMENTS ===
Expression: ${archetypeTemplate.subjectRequirements.expression}
Pose: ${archetypeTemplate.subjectRequirements.pose}
Framing: ${archetypeTemplate.subjectRequirements.framing}
Position: ${archetypeTemplate.subjectRequirements.position}`;
    }

    // Add professional lighting instructions
    prompt += `

=== CINEMATIC LIGHTING ===
${CINEMATIC_LIGHTING.threePoint}

ARCHETYPE-SPECIFIC LIGHTING:
- Key Light: ${archetypeTemplate.lightingSetup.key}
- Rim Light: ${archetypeTemplate.lightingSetup.rim}
- Fill Light: ${archetypeTemplate.lightingSetup.fill}
- Overall Mood: ${archetypeTemplate.lightingSetup.mood}

${CINEMATIC_LIGHTING.cinematicMarkers}

${CINEMATIC_LIGHTING.separation}`;

    // Add background requirements
    prompt += `

=== BACKGROUND ===
${backgroundInstructions}

ARCHETYPE-SPECIFIC BACKGROUND:
- Style: ${archetypeTemplate.backgroundRequirements.style}
- Elements: ${archetypeTemplate.backgroundRequirements.elements.join(', ')}
- Lighting: ${archetypeTemplate.backgroundRequirements.lighting}
- Depth: ${archetypeTemplate.backgroundRequirements.depth}

COLOR PALETTE:
- Primary Colors: ${archetypeTemplate.colorPalette.primary.join(', ')}
- Background: ${archetypeTemplate.colorPalette.background}
- Accents: ${archetypeTemplate.colorPalette.accents.join(', ')}`;

    // Add safe zone instructions for text
    if (thumbnailText) {
        prompt += `

=== TEXT SAFE ZONE ===
${SAFE_ZONES.text.promptInstruction}

COMPOSITION FOR TEXT OVERLAY:
- Reserve the RIGHT 35-45% of the frame for text placement
- Background in text zone should be darker/simpler for readability
- Do NOT place important visual elements where text will go
- Text zone should have clean, uncluttered background`;
    }

    // Add logo handling instructions if logos specified
    if (logos.brandLogos && logos.brandLogos.length > 0) {
        const logoPosition = logos.position || LOGO_HANDLING.defaultZone;
        const positionConfig = LOGO_HANDLING.positions[logoPosition];

        prompt += `

=== BRAND LOGO ZONE ===
${LOGO_HANDLING.renderingInstructions}

LOGO PLACEMENT:
- Position: ${positionConfig.promptHint}
- Logos to include: ${logos.brandLogos.join(', ')}
- Group all logos together in a clean cluster
- Ensure logos do NOT overlap with subject face or text zone`;
    }

    // Add composition and safe zone enforcement
    prompt += `

=== SAFE COMPOSITION ENFORCEMENT ===
${SAFE_ZONES.subject.promptInstruction}

RULE OF THIRDS COMPOSITION:
- Subject positioned on left vertical third line
- Eyes on upper horizontal third line
- Intentional 60/40 asymmetric balance (NOT centered)
- Z-pattern eye flow guiding from subject to text area
- Clean visual hierarchy: Subject > Text Zone > Background

MOBILE THUMBNAIL TEST:
- This must be clearly readable at 168x94 pixels (mobile thumbnail size)
- Face and expression must be instantly recognizable
- High contrast between all major elements
- No small details that disappear at thumbnail scale`;

    // Add quality requirements
    prompt += `

=== PROFESSIONAL QUALITY REQUIREMENTS ===
TECHNICAL SPECIFICATIONS:
- Aspect Ratio: 16:9 (1280x720 pixels)
- Quality: 8K detail level, ultra sharp on subject
- Color Depth: High dynamic range, rich saturated colors
- Noise: Subtle film grain acceptable, no digital noise

ANTI-AI DETECTION:
- Intentional asymmetry in composition (human-designed feel)
- Natural lighting falloff and shadow transitions
- Realistic skin texture (no plastic/AI smoothing)
- Professional photo retouching quality
- Must look like $100+ designer thumbnail, NOT AI-generated

=== CRITICAL NEGATIVE PROMPT (DO NOT INCLUDE) ===
- NO side profile views - subject MUST face camera
- NO cropped heads or awkward body cropping
- NO text rendered in the image (text added separately)
- NO blurry subject or soft focus on face
- NO centered symmetrical composition
- NO flat, single-layer backgrounds
- NO hard stroke outlines around subject (unless sticker style requested)
- NO watermarks or signatures
- NO unrealistic skin smoothing
- NO generic stock photo aesthetic`;

    // Add additional context if provided
    if (additionalContext) {
        prompt += `

=== ADDITIONAL CONTEXT ===
${additionalContext}`;
    }

    return prompt;
}

/**
 * Build a simplified V3 prompt for quick generation
 * Uses archetype defaults with minimal customization
 *
 * @param {string} brief - Content description
 * @param {string} archetype - Content archetype
 * @param {boolean} hasFace - Whether face reference is provided
 * @returns {string} Simplified prompt
 */
function buildQuickCinematicPrompt(brief, archetype = 'reaction', hasFace = false) {
    return buildCinematicPrompt({
        brief,
        archetype,
        hasFace
    });
}

/**
 * Build a prompt specifically optimized for face consistency
 * Prioritizes front-facing requirements and face preservation
 *
 * @param {Object} options - Configuration options
 * @param {string} options.brief - Content description
 * @param {string} [options.archetype='reaction'] - Content archetype
 * @param {string} [options.expression] - Desired expression
 * @returns {string} Face-optimized prompt
 */
function buildFaceOptimizedPrompt(options) {
    const { brief, archetype = 'reaction', expression } = options;
    const archetypeTemplate = ARCHETYPE_TEMPLATES[archetype] || ARCHETYPE_TEMPLATES.reaction;

    const expressionText = expression || archetypeTemplate.subjectRequirements.expression;

    return `Generate a PROFESSIONAL YouTube thumbnail with PERFECT front-facing subject.

CONTENT: ${brief}

=== CRITICAL FACE REQUIREMENTS (HIGHEST PRIORITY) ===
${FRONT_FACING_ENFORCEMENT.core}

EXPRESSION REQUIRED:
${expressionText}

${FRONT_FACING_ENFORCEMENT.depthOfField}

=== FACE PRESERVATION ===
CRITICAL - USE REFERENCE FACE EXACTLY:
- Preserve EXACT facial features from reference photo
- Maintain skin tone, texture, and identifying features
- Apply expression while keeping face recognizable
- Match lighting on face to scene lighting direction
- NO AI regeneration of face - use reference face only

=== COMPOSITION ===
${FRONT_FACING_ENFORCEMENT.framing}

- Subject on LEFT third of frame (rule of thirds)
- Clean space on RIGHT for text overlay
- High contrast for thumbnail visibility
- Professional YouTube thumbnail aesthetic

=== LIGHTING ===
${archetypeTemplate.lightingSetup.key}
${archetypeTemplate.lightingSetup.rim}
Overall mood: ${archetypeTemplate.lightingSetup.mood}

TECHNICAL: 16:9 aspect ratio, 1280x720, 8K quality, sharp focus on face

=== DO NOT ===
- NO side profiles or 3/4 views
- NO cropped faces or awkward framing
- NO soft focus on face
- NO AI-regenerated faces
- NO text in image`;
}

// ============================================================================
// V3 LOGO HANDLING FUNCTIONS
// ============================================================================

/**
 * Generate logo placement instructions for prompt
 *
 * @param {Object} logoConfig - Logo configuration
 * @param {string[]} logoConfig.logos - Array of logo names
 * @param {string} [logoConfig.position='top-right'] - Desired position
 * @param {string} [logoConfig.size='medium'] - Size preference (small, medium, large)
 * @returns {string} Logo placement instructions for prompt
 */
function getLogoPlacementInstructions(logoConfig) {
    const { logos = [], position = 'top-right', size = 'medium' } = logoConfig;

    if (!logos.length) return '';

    const positionConfig = LOGO_HANDLING.positions[position] || LOGO_HANDLING.positions['top-right'];

    const sizePercent = {
        small: '5-8%',
        medium: '8-12%',
        large: '12-15%'
    }[size] || '8-12%';

    return `
BRAND LOGOS TO INCLUDE:
${logos.map(logo => `- ${logo}`).join('\n')}

LOGO PLACEMENT:
- Position: ${positionConfig.promptHint}
- Size: ${sizePercent} of frame width each
- Arrangement: Clustered together, not scattered
- Quality: High resolution, crisp edges, NO blur
- Must be 100% fully visible - absolutely NO cropping
- Do NOT overlap with subject face or primary text zone`;
}

// ============================================================================
// V3 HELPER FUNCTIONS
// ============================================================================

/**
 * Map a niche to the most appropriate archetype
 *
 * @param {string} niche - Content niche
 * @returns {string} Most appropriate archetype key
 */
function mapNicheToArchetype(niche) {
    const nicheToArchetype = {
        gaming: 'gaming',
        tech: 'explainer',
        finance: 'finance',
        beauty: 'tutorial',
        fitness: 'reaction',
        cooking: 'tutorial',
        travel: 'documentary',
        reaction: 'reaction',
        podcast: 'documentary',
        tutorial: 'tutorial',
        documentary: 'documentary',
        business: 'finance',
        entertainment: 'reaction'
    };

    return nicheToArchetype[niche] || 'reaction';
}

/**
 * Get the signature glow color for an archetype
 *
 * @param {string} archetype - Content archetype
 * @returns {string} Glow color description
 */
function getGlowColorForArchetype(archetype) {
    const glowColors = {
        reaction: 'bright yellow or cyan',
        explainer: 'clean white or subtle blue',
        tutorial: 'soft white or green',
        documentary: 'dramatic red or white',
        conspiracy: 'ominous red or amber',
        gaming: 'neon cyan and magenta',
        finance: 'golden or money green'
    };

    return glowColors[archetype] || 'white';
}

/**
 * Get all available archetypes for UI
 *
 * @returns {Array<Object>} Array of archetype configurations
 */
function getArchetypes() {
    return Object.entries(ARCHETYPE_TEMPLATES).map(([key, data]) => ({
        key,
        name: data.name,
        description: data.description,
        colorPalette: data.colorPalette
    }));
}

/**
 * Get archetype configuration by key
 *
 * @param {string} key - Archetype key
 * @returns {Object} Archetype configuration
 */
function getArchetype(key) {
    return ARCHETYPE_TEMPLATES[key] || ARCHETYPE_TEMPLATES.reaction;
}

/**
 * Get safe zone specifications
 *
 * @returns {Object} Safe zone configurations
 */
function getSafeZones() {
    return SAFE_ZONES;
}

/**
 * Get front-facing enforcement instructions
 * Can be used to add to custom prompts
 *
 * @returns {Object} Front-facing enforcement instructions
 */
function getFrontFacingEnforcement() {
    return FRONT_FACING_ENFORCEMENT;
}

/**
 * Get cinematic lighting instructions
 * Can be used to add to custom prompts
 *
 * @returns {Object} Cinematic lighting instructions
 */
function getCinematicLighting() {
    return CINEMATIC_LIGHTING;
}

// ============================================================================
// V3 BACKWARD COMPATIBILITY WRAPPER
// ============================================================================

/**
 * V3-enhanced version of buildUltimatePrompt
 * Wraps V2 functionality with V3 enhancements
 *
 * @param {Object} options - Same options as V2 buildUltimatePrompt
 * @returns {string} Enhanced prompt with V3 composition enforcement
 */
function buildUltimatePromptV3(options) {
    const {
        brief,
        creatorStyle,
        niche = 'reaction',
        expression,
        hasFace = false,
        thumbnailText,
        additionalContext
    } = options;

    // Check if user wants V3 cinematic style
    const useV3 = options.useV3 === true || options.cinematic === true;

    if (useV3) {
        // Use full V3 cinematic prompt
        return buildCinematicPrompt({
            brief,
            archetype: mapNicheToArchetype(niche),
            niche,
            expression,
            hasFace,
            thumbnailText,
            additionalContext,
            creatorStyle
        });
    }

    // Use V2 prompt with V3 front-facing enforcement added
    let prompt = V2Engine.buildUltimatePrompt(options);

    // Inject V3 front-facing enforcement if face is present
    if (hasFace) {
        const frontFacingInsertion = `
${FRONT_FACING_ENFORCEMENT.core}

${FRONT_FACING_ENFORCEMENT.depthOfField}
`;
        // Insert after the first section break
        const insertPoint = prompt.indexOf('SCENE DESCRIPTION:');
        if (insertPoint !== -1) {
            prompt = prompt.slice(0, insertPoint) +
                     '=== V3 FRONT-FACING ENFORCEMENT ===\n' +
                     frontFacingInsertion + '\n' +
                     prompt.slice(insertPoint);
        } else {
            // Fallback: prepend to prompt
            prompt = frontFacingInsertion + '\n' + prompt;
        }
    }

    return prompt;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // V3 Primary Functions
    buildCinematicPrompt,
    buildQuickCinematicPrompt,
    buildFaceOptimizedPrompt,

    // V3 Helper Functions
    getArchetypes,
    getArchetype,
    getSafeZones,
    getFrontFacingEnforcement,
    getCinematicLighting,
    getLogoPlacementInstructions,
    mapNicheToArchetype,
    getGlowColorForArchetype,

    // V3 Constants (for advanced customization)
    ARCHETYPE_TEMPLATES,
    SAFE_ZONES,
    FRONT_FACING_ENFORCEMENT,
    CINEMATIC_LIGHTING,
    LOGO_HANDLING,

    // Backward Compatibility (V2 wrapper)
    buildUltimatePromptV3,

    // Re-export V2 functions for full backward compatibility
    buildProfessionalPrompt: V2Engine.buildProfessionalPrompt,
    buildCreatorStylePrompt: V2Engine.buildCreatorStylePrompt,
    buildUltimatePrompt: V2Engine.buildUltimatePrompt,
    buildDirectPrompt: V2Engine.buildDirectPrompt,
    getNiches: V2Engine.getNiches,
    getExpressions: V2Engine.getExpressions,
    getTextStyleForNiche: V2Engine.getTextStyleForNiche,
    getCreatorTextStyle: V2Engine.getCreatorTextStyle,
    getCreatorStyles: V2Engine.getCreatorStyles,
    getCreatorStyleForNiche: V2Engine.getCreatorStyleForNiche,

    // Re-export V2 constants
    NICHE_TEMPLATES: V2Engine.NICHE_TEMPLATES,
    EXPRESSIONS: V2Engine.EXPRESSIONS,
    LIGHTING_PRESETS: V2Engine.LIGHTING_PRESETS,
    COMPOSITION_RULES: V2Engine.COMPOSITION_RULES,
    CREATOR_STYLES: V2Engine.CREATOR_STYLES,
    ANTI_AI_TECHNIQUES: V2Engine.ANTI_AI_TECHNIQUES,
    PRO_DESIGN_SPECS: V2Engine.PRO_DESIGN_SPECS
};
