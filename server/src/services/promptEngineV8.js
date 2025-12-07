/**
 * ============================================================================
 * ThumbnailBuilder V8 — Prompt Engine
 * ============================================================================
 *
 * Advanced prompt generation with:
 * - Subject positioning (9-position grid actually works)
 * - Subject scale control
 * - Outfit/clothing customization
 * - Viral thumbnail heuristics baked in
 * - Photorealism enforcement
 * - Glassy Mode aesthetic triggers
 */

// =============================================================================
// VIRAL THUMBNAIL SYSTEM PROMPT
// =============================================================================

const VIRAL_THUMBNAIL_SYSTEM_PROMPT = `
You are a YouTube thumbnail creator with 15 years of experience working ONLY with the biggest creators (MrBeast, MKBHD, Hormozi, Peter McKinnon, etc.).

VIRAL THUMBNAIL RULES (ALWAYS ENFORCE):

1. FACE IS KING
   - Human face must be the PRIMARY focal point whenever a subject is requested
   - Face should express CLEAR, EXAGGERATED emotion (shock, excitement, anger, joy)
   - Eyes must be visible and engaging - they should "pop"
   - Face should fill 25-40% of the frame unless explicitly asked for wide shot

2. TEXT IS SUPPORT, NOT THE STAR
   - Maximum 3-5 words, NEVER more
   - Text should COMPLEMENT the title, not repeat it
   - Text must be instantly readable at mobile size (168x94 pixels)
   - High-contrast colors only - white on dark, dark on light

3. CLEAN COMPOSITION
   - Maximum 1-2 supporting elements (logo, chart, object)
   - NO clutter - every element must earn its place
   - Rule of thirds for subject placement
   - Clear visual hierarchy: Face > Text > Supporting elements

4. PHOTOREALISM IS NON-NEGOTIABLE
   - Subject must look like a REAL PERSON photographed with a professional camera
   - NO cartoon outlines, NO illustration style, NO 3D render look
   - Skin, clothing, and hair must have realistic texture and lighting
   - Hands must have correct anatomy (5 fingers, proper proportions)

5. PROFESSIONAL POST-PROCESSING LOOK
   - Should look like professional Photoshop compositing
   - Soft edge lighting, gentle shadows, realistic color grading
   - NO heavy filters, NO extreme saturation, NO posterization
   - Subject should have natural rim lighting for separation, NOT white cartoon outlines

6. AVOID AI ARTIFACTS AT ALL COSTS
   - No warped hands or extra fingers
   - No melted or distorted text on clothing
   - No impossible clothing seams or fabric physics
   - No uncanny valley facial features
   - No blurry or smeared backgrounds behind subject

GLOBAL PREMIUM THUMBNAIL REQUIREMENTS (MUST ALWAYS BE TRUE):
- Remove all subject outlines/halos/glows; integrate the subject naturally with scene-matched shadows and grading.
- Never place logos or text over the subject's face. Protect eyes and mouth with generous safe margins.
- Only render the user-provided hook text. Keep it to 3-6 words per line, bold clean sans-serif, one outline OR one subtle shadow (never messy double strokes or glows).
- Place text in available negative space opposite the subject (Template A: subject right/text left, Template B: subject left/text right). Ensure text stays fully inside 16:9 safe areas and out of YouTube UI crops.
- Background supports the story but must not overpower subject or text. Darken/blur behind text if busy.
- Remove stray lines, boxes, bars, or UI artifacts that are not explicitly requested.
- Deliver crisp 1920x1080 output with sharp edges and clean anti-aliasing suitable for mobile viewing.
`;

// =============================================================================
// SUBJECT POSITION MAPPING
// =============================================================================

/**
 * Maps 9-position grid to detailed prompt instructions
 */
const SUBJECT_POSITION_MAP = {
    'top-left': {
        prompt: 'Position the subject in the UPPER-LEFT quadrant of the frame. Subject\'s head should align with the top-left rule-of-thirds intersection.',
        composition: 'Leave the right side and bottom portion of the frame open for text, graphics, or negative space.',
        framing: 'Close-up from chest/shoulders up, face clearly visible and dominant.',
        eyeline: 'Subject looking slightly toward camera-right (toward the open space).'
    },
    'top-center': {
        prompt: 'Position the subject CENTERED horizontally in the UPPER portion of the frame. Subject\'s head near the top third line.',
        composition: 'Leave the bottom third of the frame for text overlay or supporting elements.',
        framing: 'Head and shoulders visible, face centered and prominent.',
        eyeline: 'Subject looking directly at camera (front-facing).'
    },
    'top-right': {
        prompt: 'Position the subject in the UPPER-RIGHT quadrant of the frame. Subject\'s head should align with the top-right rule-of-thirds intersection.',
        composition: 'Leave the left side and bottom portion open for text and graphics.',
        framing: 'Close-up from chest/shoulders up, face clearly visible.',
        eyeline: 'Subject looking slightly toward camera-left (toward the open space).'
    },
    'middle-left': {
        prompt: 'Position the subject on the LEFT vertical third line (rule of thirds). Subject centered vertically in the frame.',
        composition: 'The right two-thirds of the frame is available for text, supporting imagery, or dramatic negative space.',
        framing: 'Standard YouTube thumbnail framing - face dominant, from mid-chest up.',
        eyeline: 'Subject facing camera but can look slightly right toward the open composition area.'
    },
    'middle-center': {
        prompt: 'Position the subject DEAD CENTER in the frame with equal margins on all sides.',
        composition: 'Symmetric composition. Text will need to wrap around the subject or appear at top/bottom edges.',
        framing: 'Face is the absolute focal point. Close framing from shoulders up.',
        eyeline: 'Subject looking directly at camera, commanding attention.'
    },
    'middle-right': {
        prompt: 'Position the subject on the RIGHT vertical third line (rule of thirds). Subject centered vertically in the frame.',
        composition: 'The left two-thirds of the frame is available for text, charts, or supporting imagery.',
        framing: 'Standard YouTube thumbnail framing - face dominant, from mid-chest up.',
        eyeline: 'Subject facing camera but can look slightly left toward the open composition area.'
    },
    'bottom-left': {
        prompt: 'Position the subject in the LOWER-LEFT quadrant. Subject\'s face near the bottom-left rule-of-thirds intersection.',
        composition: 'Upper portion and right side open for dramatic text or imagery.',
        framing: 'Closer framing acceptable, face very prominent.',
        eyeline: 'Subject can look upward toward the open space for dynamic effect.'
    },
    'bottom-center': {
        prompt: 'Position the subject in the LOWER-CENTER of the frame. Face in the bottom third.',
        composition: 'Upper two-thirds available for text, logos, or dramatic imagery above the subject.',
        framing: 'Tight framing on face and upper chest.',
        eyeline: 'Subject looking at camera or slightly upward.'
    },
    'bottom-right': {
        prompt: 'Position the subject in the LOWER-RIGHT quadrant. Subject\'s face near the bottom-right rule-of-thirds intersection.',
        composition: 'Upper portion and left side open for text and graphics.',
        framing: 'Closer framing, face prominent.',
        eyeline: 'Subject can look upward/left toward the open space.'
    }
};

// =============================================================================
// SUBJECT SCALE MAPPING
// =============================================================================

/**
 * Maps scale slider (50-150%) to framing instructions
 */
const SUBJECT_SCALE_MAP = {
    50: {
        fillPercent: 30,
        framing: 'WIDE SHOT: Full body or environmental shot. Subject is smaller in the frame with significant environment visible.',
        emphasis: 'Context and environment are important. Subject shares attention with surroundings.'
    },
    60: {
        fillPercent: 40,
        framing: 'MEDIUM-WIDE: Three-quarter body shot. Subject from knees up visible.',
        emphasis: 'Balance between subject and environment.'
    },
    75: {
        fillPercent: 50,
        framing: 'MEDIUM SHOT: Waist-up framing. Standard conversational distance.',
        emphasis: 'Subject is clearly the focus but with breathing room.'
    },
    85: {
        fillPercent: 55,
        framing: 'MEDIUM CLOSE-UP: Chest and above visible. Getting more intimate.',
        emphasis: 'Face begins to dominate but torso/clothing still visible.'
    },
    100: {
        fillPercent: 65,
        framing: 'STANDARD CLOSE-UP: Head and shoulders visible. Classic YouTube thumbnail framing.',
        emphasis: 'Face is dominant focal point. This is the default viral thumbnail look.'
    },
    115: {
        fillPercent: 75,
        framing: 'TIGHT CLOSE-UP: Face fills most of the frame. Shoulders barely visible.',
        emphasis: 'Extreme focus on facial expression. High emotional impact.'
    },
    125: {
        fillPercent: 80,
        framing: 'VERY TIGHT: Face dominant, may crop top of head or chin slightly.',
        emphasis: 'Maximum emotional impact. MrBeast-style extreme expressions.'
    },
    150: {
        fillPercent: 90,
        framing: 'EXTREME CLOSE-UP: Face fills nearly the entire frame. Deliberate cropping.',
        emphasis: 'Eyes and expression are everything. Ultra-dramatic.'
    }
};

/**
 * Get scale config for any value 50-150
 */
function getScaleConfig(scale) {
    const scaleKeys = Object.keys(SUBJECT_SCALE_MAP).map(Number).sort((a, b) => a - b);

    // Find closest key
    let closest = scaleKeys[0];
    for (const key of scaleKeys) {
        if (Math.abs(key - scale) < Math.abs(closest - scale)) {
            closest = key;
        }
    }

    return SUBJECT_SCALE_MAP[closest];
}

// =============================================================================
// OUTFIT/CLOTHING PRESETS
// =============================================================================

const OUTFIT_PRESETS = {
    'keep-original': {
        prompt: null,
        description: 'Keep the subject\'s original clothing from reference images'
    },
    'tech-hoodie': {
        prompt: 'Wearing a modern, high-quality tech-style hoodie in dark charcoal gray or navy blue. Clean minimalist design, premium fabric texture, no visible logos. The hoodie should look like something a Silicon Valley founder would wear.',
        colorOptions: ['#2D3436', '#1E3A5F', '#2C3E50', '#34495E'],
        contextMatch: ['tech', 'ai', 'startup', 'coding', 'software', 'saas']
    },
    'streetwear': {
        prompt: 'Wearing trendy contemporary streetwear - an oversized premium graphic tee or designer hoodie. Urban fashion aesthetic, expensive but understated.',
        colorOptions: ['#000000', '#FFFFFF', '#1A1A1A', '#2C2C2C'],
        contextMatch: ['lifestyle', 'vlog', 'entertainment', 'culture', 'music']
    },
    'business-casual': {
        prompt: 'Wearing a crisp, well-fitted button-down shirt in a professional but approachable color. Modern slim fit, high-quality cotton, no tie.',
        colorOptions: ['#FFFFFF', '#E8F4F8', '#F5F5F5', '#87CEEB'],
        contextMatch: ['business', 'finance', 'consulting', 'marketing', 'real-estate']
    },
    'full-suit': {
        prompt: 'Wearing a perfectly tailored dark business suit with a silk tie. Executive presence, powerful posture. The suit should look like it cost $2000+.',
        colorOptions: ['#1A1A1A', '#2C3E50', '#1E3A5F', '#000000'],
        contextMatch: ['corporate', 'luxury', 'authority', 'investing', 'wealth']
    },
    'plain-tee': {
        prompt: 'Wearing a simple, perfectly fitted solid-color t-shirt. Clean, minimal, showing good physique. Premium cotton quality.',
        colorOptions: ['#FFFFFF', '#000000', '#2D3436', '#E74C3C', '#3498DB'],
        contextMatch: ['fitness', 'casual', 'tutorial', 'how-to', 'diy']
    },
    'athletic': {
        prompt: 'Wearing premium athletic/performance wear. Fitted moisture-wicking shirt or sleek athletic jacket. Nike/Lululemon quality.',
        colorOptions: ['#000000', '#1A1A1A', '#E74C3C', '#2ECC71'],
        contextMatch: ['fitness', 'sports', 'workout', 'health', 'running']
    }
};

// =============================================================================
// ARCHETYPE TEMPLATES (Enhanced from V3)
// =============================================================================

const ARCHETYPE_TEMPLATES = {
    'reaction': {
        composition: 'Subject on left third, reacting to content on right side of frame.',
        expression: 'EXAGGERATED emotional reaction - shock, disbelief, excitement, or outrage.',
        lighting: 'Bright, even lighting on face. Dramatic rim light for separation.',
        background: 'Abstract gradient or blurred content preview on right side.',
        mood: 'Energetic, attention-grabbing, viral potential.'
    },
    'tech': {
        composition: 'Clean, modern composition. Subject with subtle tech elements.',
        expression: 'Confident, knowledgeable, slightly excited about the topic.',
        lighting: 'Cool-toned lighting, subtle blue accent lights. Professional studio look.',
        background: 'Minimal dark gradient, subtle tech patterns, or clean office/studio.',
        mood: 'Professional, innovative, trustworthy.'
    },
    'gaming': {
        composition: 'Dynamic, energetic framing. Subject can be more animated.',
        expression: 'Intense focus, excitement, or competitive determination.',
        lighting: 'RGB-style colored lighting accents. Dramatic shadows.',
        background: 'Dark with neon accents, game imagery hints, or abstract gaming aesthetic.',
        mood: 'Exciting, competitive, immersive.'
    },
    'finance': {
        composition: 'Authoritative, professional positioning. Clean and trustworthy.',
        expression: 'Confident, knowing smile or serious expertise look.',
        lighting: 'Warm professional lighting. Slight gold tones.',
        background: 'Premium office, abstract wealth symbols, or clean gradient.',
        mood: 'Wealthy, successful, authoritative.'
    },
    'fitness': {
        composition: 'Dynamic, powerful positioning. Show strength and confidence.',
        expression: 'Determined, motivated, powerful.',
        lighting: 'Dramatic lighting that shows muscle definition if visible.',
        background: 'Gym environment blur, clean gradient, or motivational aesthetic.',
        mood: 'Motivating, powerful, aspirational.'
    },
    'lifestyle': {
        composition: 'Relatable, approachable framing. Lifestyle context if appropriate.',
        expression: 'Warm, genuine, relatable emotions.',
        lighting: 'Natural, flattering lighting. Golden hour quality.',
        background: 'Lifestyle context, beautiful location blur, or warm gradient.',
        mood: 'Aspirational, relatable, genuine.'
    },
    'educational': {
        composition: 'Clear, professional framing. Authority positioning.',
        expression: 'Engaging teacher energy - enthusiastic but trustworthy.',
        lighting: 'Bright, clear, professional lighting.',
        background: 'Clean studio, subtle educational context, or professional gradient.',
        mood: 'Educational, trustworthy, valuable.'
    }
};

// =============================================================================
// GLASSY MODE PROMPTS
// =============================================================================

const GLASSY_MODE_PROMPTS = {
    low: {
        instruction: 'Add subtle cinematic polish: gentle lens bloom on bright elements, very soft vignette around edges.',
        intensity: 0.3
    },
    medium: {
        instruction: 'Apply cinematic look: soft bloom on highlights and logos, gentle light streaks on reflective surfaces, subtle vignette pulling focus to subject.',
        intensity: 0.5
    },
    high: {
        instruction: 'Strong cinematic aesthetic: pronounced bloom effects on bright elements, visible light streaks and lens flares, dramatic vignette, premium color grading with lifted shadows.',
        intensity: 0.8
    }
};

// =============================================================================
// PROMPT BUILDING FUNCTIONS
// =============================================================================

/**
 * Build subject positioning instructions
 */
function buildSubjectPositionPrompt(position, scale) {
    const posConfig = SUBJECT_POSITION_MAP[position] || SUBJECT_POSITION_MAP['middle-center'];
    const scaleConfig = getScaleConfig(scale);

    return `
SUBJECT POSITIONING (CRITICAL - FOLLOW EXACTLY):
${posConfig.prompt}
${posConfig.framing}
${posConfig.eyeline}

FRAMING SCALE:
${scaleConfig.framing}
Subject should fill approximately ${scaleConfig.fillPercent}% of the frame height.
${scaleConfig.emphasis}

COMPOSITION GUIDANCE:
${posConfig.composition}
Maintain rule-of-thirds alignment for professional look.
Subject's eyes should be at or slightly above the horizontal center line.
`;
}

/**
 * Build outfit/clothing instructions
 */
function buildOutfitPrompt(outfitConfig, bgAnalysis = null) {
    if (!outfitConfig || outfitConfig.mode === 'keep-original') {
        return '';
    }

    let prompt = '';

    if (outfitConfig.mode === 'preset' && outfitConfig.preset) {
        const preset = OUTFIT_PRESETS[outfitConfig.preset];
        if (preset && preset.prompt) {
            prompt = preset.prompt;

            // Add color constraint if provided
            if (outfitConfig.dominantColor) {
                prompt += ` Primary color: ${outfitConfig.dominantColor}.`;
            } else if (preset.colorOptions && bgAnalysis) {
                // Auto-select color that contrasts with background
                // This would need actual implementation with color distance calculation
                prompt += ` Outfit should contrast well with the background.`;
            }
        }
    } else if (outfitConfig.mode === 'custom' && outfitConfig.customPrompt) {
        prompt = outfitConfig.customPrompt;
        if (outfitConfig.dominantColor) {
            prompt += ` Primary color: ${outfitConfig.dominantColor}.`;
        }
    }

    if (!prompt) return '';

    return `
CLOTHING REQUIREMENTS:
${prompt}

CLOTHING QUALITY STANDARDS (NON-NEGOTIABLE):
- Clothing must be PHOTOREALISTIC with proper fabric texture, natural folds, and realistic seams
- NO AI artifacts on clothing (no warped logos, no melted text, no impossible physics)
- Fabric should have realistic light interaction (subtle highlights, proper shadows in folds)
- Outfit should complement the thumbnail composition, not compete with the subject's face
- Clothing colors must provide good separation from background (no camouflage effect)
`;
}

/**
 * Build archetype-specific prompt additions
 */
function buildArchetypePrompt(niche) {
    const archetype = ARCHETYPE_TEMPLATES[niche] || ARCHETYPE_TEMPLATES['lifestyle'];

    return `
VISUAL STYLE (${niche.toUpperCase()} ARCHETYPE):
- Composition: ${archetype.composition}
- Expression: ${archetype.expression}
- Lighting: ${archetype.lighting}
- Background: ${archetype.background}
- Overall Mood: ${archetype.mood}
`;
}

/**
 * Build glassy mode instructions
 */
function buildGlassyPrompt(glassyConfig) {
    if (!glassyConfig || !glassyConfig.enabled) {
        return '';
    }

    const intensity = glassyConfig.intensity || 0.5;
    let level = 'medium';
    if (intensity < 0.35) level = 'low';
    if (intensity > 0.65) level = 'high';

    const config = GLASSY_MODE_PROMPTS[level];

    return `
CINEMATIC "GLASSY" AESTHETIC:
${config.instruction}

IMPORTANT: Glassy effects must remain PHOTOREALISTIC:
- NO extreme HDR or posterization
- NO oversaturated halos or unrealistic glows
- Effects should enhance, not overpower the image
- Subject's face must remain clearly visible and natural
`;
}

/**
 * Build subject separation instructions
 */
function buildSeparationPrompt() {
    return `
SUBJECT-BACKGROUND SEPARATION (CRITICAL FOR READABILITY):
- Subject must be CLEARLY distinguishable from background at all sizes
- Use natural rim lighting or subtle edge glow for separation (NOT cartoon outlines)
- If subject's clothing is similar in tone to background, add subtle lighting difference
- Background behind subject should have enough contrast for figure-ground separation
- Avoid placing subject against backgrounds of similar color/brightness
- The separation should look like professional Photoshop compositing, NOT sticker cutout
`;
}

// =============================================================================
// MAIN PROMPT BUILDER
// =============================================================================

/**
 * Build the complete V8 cinematic prompt
 * @param {Object} options - Generation options
 * @returns {string} Complete prompt for image generation
 */
function buildCinematicPromptV8(options) {
    const {
        brief,
        niche = 'lifestyle',
        expression = 'confident',
        subjectPosition = 'middle-center',
        subjectScale = 100,
        outfit = null,
        glassy = null,
        creatorStyle = null
    } = options;

    // Build all prompt sections
    const sections = [
        // System context
        VIRAL_THUMBNAIL_SYSTEM_PROMPT,

        // User brief/concept
        `
THUMBNAIL CONCEPT:
${brief}

Create a photorealistic YouTube thumbnail based on this concept.
`,

        // Subject positioning
        buildSubjectPositionPrompt(subjectPosition, subjectScale),

        // Archetype styling
        buildArchetypePrompt(niche),

        // Expression override
        `
EXPRESSION:
Subject should display a clear ${expression} expression.
The emotion must be READABLE at small sizes - exaggerate slightly for thumbnail impact.
`,

        // Outfit if specified
        buildOutfitPrompt(outfit),

        // Subject separation
        buildSeparationPrompt(),

        // Glassy mode if enabled
        buildGlassyPrompt(glassy),

        // Final quality enforcement
        `
FINAL OUTPUT REQUIREMENTS:
1. Dimensions: Exactly 1920x1080 pixels (16:9 aspect ratio)
2. Subject: PHOTOREALISTIC human, NOT illustration, NOT 3D render
3. Quality: Professional photography quality, sharp focus on face
4. Composition: Clean, uncluttered, clear visual hierarchy
5. Readability: Must be compelling at both full size AND 168x94 mobile thumbnail size
6. Style: Professional, high-end, viral-worthy
`
    ];

    // Filter out empty sections and join
    return sections.filter(s => s && s.trim()).join('\n\n');
}

/**
 * Build a style-only refinement prompt (for "Improve Design" feature)
 */
function buildRefinementPrompt(options) {
    const {
        originalConcept,
        improvements = {}
    } = options;

    const sections = [
        `Refine this existing thumbnail while keeping the same subject and core composition.`,
        `Original concept: ${originalConcept}`,
        '',
        improvements.enhanceSeparation ? 'IMPROVE: Increase subject-background separation with better rim lighting and contrast.' : '',
        improvements.adjustContrast ? 'IMPROVE: Enhance overall contrast for better small-size readability.' : '',
        improvements.applyGlassy ? buildGlassyPrompt({ enabled: true, intensity: improvements.glassyIntensity || 0.5 }) : '',
        improvements.tweakClothingColor ? 'IMPROVE: Adjust clothing color to better contrast with background.' : '',
        '',
        'Keep the subject\'s face, pose, and core composition identical. Only apply the specified improvements.'
    ];

    return sections.filter(s => s).join('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    buildCinematicPromptV8,
    buildRefinementPrompt,
    buildSubjectPositionPrompt,
    buildOutfitPrompt,
    buildArchetypePrompt,
    buildGlassyPrompt,
    buildSeparationPrompt,
    getScaleConfig,
    SUBJECT_POSITION_MAP,
    SUBJECT_SCALE_MAP,
    OUTFIT_PRESETS,
    ARCHETYPE_TEMPLATES,
    GLASSY_MODE_PROMPTS,
    VIRAL_THUMBNAIL_SYSTEM_PROMPT
};
