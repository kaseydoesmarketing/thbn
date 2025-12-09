/**
 * Emotion Detection & Expression Amplifier - Tier 3
 *
 * Detects and amplifies facial expressions for viral thumbnails
 * - Emotion-based prompt enhancement
 * - Expression amplification presets
 * - Emotion-to-color mapping
 * - Expression guidelines for subjects
 * - Viral expression recommendations
 *
 * @module emotionExpressionService
 */

const sharp = require('sharp');

// =============================================================================
// EMOTION DEFINITIONS
// =============================================================================

const EMOTIONS = {
    'surprised': {
        name: 'Surprised',
        description: 'Wide eyes, raised eyebrows, open mouth',
        viralScore: 95,
        promptKeywords: ['shocked expression', 'wide eyes', 'jaw dropped', 'amazed face', 'disbelief'],
        amplificationTips: ['Exaggerate eye wideness', 'Open mouth wider', 'Raise eyebrows higher'],
        colorAssociation: ['#ffff00', '#ff6600'], // Yellow, Orange
        textStyle: 'mrbeast',
        backgroundColor: 'dramatic-gold'
    },
    'excited': {
        name: 'Excited',
        description: 'Big smile, bright eyes, energetic pose',
        viralScore: 90,
        promptKeywords: ['excited expression', 'huge smile', 'bright eyes', 'energetic', 'enthusiastic face'],
        amplificationTips: ['Maximize smile width', 'Add eye sparkle', 'Show teeth'],
        colorAssociation: ['#ff0066', '#ffcc00'], // Pink, Gold
        textStyle: 'mrbeast',
        backgroundColor: 'neon-pink'
    },
    'angry': {
        name: 'Angry',
        description: 'Furrowed brows, intense stare, clenched jaw',
        viralScore: 85,
        promptKeywords: ['angry expression', 'furrowed brows', 'intense glare', 'fierce look', 'determined face'],
        amplificationTips: ['Deepen brow furrow', 'Intensify eye contact', 'Clench jaw visibly'],
        colorAssociation: ['#ff0000', '#990000'], // Red, Dark Red
        textStyle: 'mrbeast-red',
        backgroundColor: 'dramatic-red'
    },
    'scared': {
        name: 'Scared',
        description: 'Wide eyes, tense expression, pulling back',
        viralScore: 88,
        promptKeywords: ['scared expression', 'fearful eyes', 'tense face', 'frightened look', 'horror expression'],
        amplificationTips: ['Widen eyes dramatically', 'Show whites of eyes', 'Tense facial muscles'],
        colorAssociation: ['#6600cc', '#000033'], // Purple, Dark Blue
        textStyle: 'dramatic-purple',
        backgroundColor: 'dramatic-purple'
    },
    'disgusted': {
        name: 'Disgusted',
        description: 'Wrinkled nose, pulled back lips, squinted eyes',
        viralScore: 82,
        promptKeywords: ['disgusted expression', 'wrinkled nose', 'repulsed face', 'grossed out', 'eww face'],
        amplificationTips: ['Wrinkle nose more', 'Pull upper lip', 'Squint eyes partially'],
        colorAssociation: ['#66cc00', '#336600'], // Lime, Green
        textStyle: 'gaming-toxic',
        backgroundColor: 'forest'
    },
    'sad': {
        name: 'Sad',
        description: 'Downturned mouth, droopy eyes, vulnerable look',
        viralScore: 75,
        promptKeywords: ['sad expression', 'tearful eyes', 'downcast look', 'emotional face', 'hurt expression'],
        amplificationTips: ['Downturn mouth corners', 'Add eye moisture effect', 'Droop shoulders'],
        colorAssociation: ['#0066cc', '#003366'], // Blue shades
        textStyle: 'dramatic-blue',
        backgroundColor: 'dramatic-blue'
    },
    'happy': {
        name: 'Happy',
        description: 'Genuine smile, crinkled eyes, relaxed face',
        viralScore: 80,
        promptKeywords: ['happy expression', 'genuine smile', 'joyful face', 'warm expression', 'friendly look'],
        amplificationTips: ['Show teeth in smile', 'Crinkle eye corners', 'Relax forehead'],
        colorAssociation: ['#ffcc00', '#ff9900'], // Yellow, Orange
        textStyle: 'classic-yellow',
        backgroundColor: 'sunset'
    },
    'confident': {
        name: 'Confident',
        description: 'Slight smirk, direct gaze, raised chin',
        viralScore: 85,
        promptKeywords: ['confident expression', 'power pose', 'smirk', 'assertive look', 'boss energy'],
        amplificationTips: ['Slight head tilt up', 'One eyebrow slightly raised', 'Knowing smile'],
        colorAssociation: ['#ffd700', '#333333'], // Gold, Dark
        textStyle: '3d-gold',
        backgroundColor: 'dramatic-gold'
    },
    'mysterious': {
        name: 'Mysterious',
        description: 'Intense gaze, slight squint, enigmatic expression',
        viralScore: 78,
        promptKeywords: ['mysterious expression', 'intense gaze', 'enigmatic look', 'intriguing face', 'cryptic expression'],
        amplificationTips: ['Narrow eyes slightly', 'Subtle smile', 'Shadow half of face'],
        colorAssociation: ['#9900cc', '#330066'], // Purple shades
        textStyle: 'neon-purple',
        backgroundColor: 'cyberpunk'
    },
    'thinking': {
        name: 'Thinking',
        description: 'Furrowed brow, looking away/up, hand on chin',
        viralScore: 72,
        promptKeywords: ['thinking expression', 'contemplative look', 'pondering face', 'curious expression', 'questioning look'],
        amplificationTips: ['Touch chin or temple', 'Look up and to the side', 'Furrow brow slightly'],
        colorAssociation: ['#0099cc', '#006699'], // Teal shades
        textStyle: 'chrome',
        backgroundColor: 'studio-gray'
    }
};

// =============================================================================
// EXPRESSION AMPLIFICATION PRESETS
// =============================================================================

const AMPLIFICATION_PRESETS = {
    'subtle': {
        name: 'Subtle',
        description: 'Gentle enhancement of existing expression',
        intensity: 0.3,
        promptBoost: ['slightly exaggerated', 'enhanced'],
        imageEnhancements: { clarity: 0.2, sharpen: 0.15 }
    },
    'moderate': {
        name: 'Moderate',
        description: 'Noticeable but natural-looking amplification',
        intensity: 0.5,
        promptBoost: ['exaggerated', 'dramatic', 'intense'],
        imageEnhancements: { clarity: 0.3, sharpen: 0.2, pop: 0.15 }
    },
    'viral': {
        name: 'Viral',
        description: 'Maximum expression for viral thumbnails',
        intensity: 0.8,
        promptBoost: ['extremely exaggerated', 'over the top', 'maximum intensity', 'viral thumbnail style'],
        imageEnhancements: { clarity: 0.4, sharpen: 0.3, pop: 0.25, saturation: 1.15 }
    },
    'mrbeast': {
        name: 'MrBeast Style',
        description: 'Hyper-expressive YouTube style',
        intensity: 1.0,
        promptBoost: ['extremely exaggerated expression', 'jaw-dropping', 'eyes popping out', 'cartoonish intensity', 'MrBeast thumbnail style'],
        imageEnhancements: { clarity: 0.5, sharpen: 0.35, pop: 0.35, saturation: 1.2, warmth: 0.1 }
    }
};

// =============================================================================
// VIRAL EXPRESSION RECOMMENDATIONS
// =============================================================================

const VIRAL_EXPRESSIONS_BY_CONTENT = {
    'challenge': ['surprised', 'scared', 'excited'],
    'reaction': ['surprised', 'disgusted', 'angry', 'excited'],
    'tutorial': ['confident', 'happy', 'thinking'],
    'story': ['surprised', 'scared', 'sad', 'excited'],
    'review': ['surprised', 'disgusted', 'happy', 'thinking'],
    'news': ['surprised', 'angry', 'scared'],
    'comedy': ['surprised', 'happy', 'disgusted', 'excited'],
    'drama': ['angry', 'sad', 'scared', 'surprised'],
    'money': ['surprised', 'excited', 'confident'],
    'fitness': ['confident', 'excited', 'happy'],
    'gaming': ['excited', 'angry', 'surprised', 'scared'],
    'tech': ['surprised', 'excited', 'thinking', 'confident'],
    'food': ['happy', 'disgusted', 'surprised', 'excited'],
    'travel': ['excited', 'happy', 'surprised', 'mysterious']
};

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Get emotion details and recommendations
 *
 * @param {string} emotion - Emotion name
 * @returns {object} Emotion details
 */
function getEmotionDetails(emotion) {
    return EMOTIONS[emotion.toLowerCase()] || null;
}

/**
 * Get prompt enhancement for an emotion
 *
 * @param {string} emotion - Emotion name
 * @param {string} amplification - Amplification level
 * @returns {string} Prompt enhancement text
 */
function getEmotionPromptEnhancement(emotion, amplification = 'viral') {
    const emotionData = EMOTIONS[emotion.toLowerCase()];
    const ampData = AMPLIFICATION_PRESETS[amplification];

    if (!emotionData) {
        return 'expressive face, engaging expression';
    }

    const keywords = emotionData.promptKeywords.slice(0, 3).join(', ');
    const boost = ampData ? ampData.promptBoost.join(', ') : '';

    return `${keywords}, ${boost}`;
}

/**
 * Get recommended styling for an emotion
 *
 * @param {string} emotion - Emotion name
 * @returns {object} Styling recommendations
 */
function getEmotionStyling(emotion) {
    const emotionData = EMOTIONS[emotion.toLowerCase()];

    if (!emotionData) {
        return {
            textStyle: 'mrbeast',
            backgroundColor: 'studio-black',
            colors: ['#ffffff', '#ffdd00']
        };
    }

    return {
        textStyle: emotionData.textStyle,
        backgroundColor: emotionData.backgroundColor,
        colors: emotionData.colorAssociation
    };
}

/**
 * Get recommended expressions for content type
 *
 * @param {string} contentType - Type of content
 * @returns {Array} Recommended emotions ranked by effectiveness
 */
function getRecommendedExpressions(contentType) {
    const recommended = VIRAL_EXPRESSIONS_BY_CONTENT[contentType.toLowerCase()];

    if (!recommended) {
        // Default recommendations
        return ['surprised', 'excited', 'confident'];
    }

    return recommended.map(emotion => ({
        emotion,
        ...EMOTIONS[emotion]
    }));
}

/**
 * Rank emotions by viral potential
 *
 * @returns {Array} Emotions sorted by viral score
 */
function getEmotionsByViralScore() {
    return Object.entries(EMOTIONS)
        .map(([key, value]) => ({
            id: key,
            ...value
        }))
        .sort((a, b) => b.viralScore - a.viralScore);
}

/**
 * Generate expression coaching tips
 *
 * @param {string} emotion - Target emotion
 * @returns {object} Coaching tips for subject
 */
function getExpressionCoaching(emotion) {
    const emotionData = EMOTIONS[emotion.toLowerCase()];

    if (!emotionData) {
        return {
            emotion: 'engaging',
            tips: [
                'Look directly at camera',
                'Show genuine emotion',
                'Exaggerate slightly more than feels natural'
            ]
        };
    }

    return {
        emotion: emotionData.name,
        description: emotionData.description,
        tips: emotionData.amplificationTips,
        examples: [
            `Imagine you just ${getEmotionScenario(emotion)}`,
            'Think of a time you felt this way intensely',
            'Exaggerate 20% more than feels comfortable'
        ]
    };
}

/**
 * Get scenario prompt for emotion
 */
function getEmotionScenario(emotion) {
    const scenarios = {
        'surprised': 'won $1 million',
        'excited': 'met your idol',
        'angry': 'discovered betrayal',
        'scared': 'saw a ghost',
        'disgusted': 'smelled something terrible',
        'sad': 'lost something precious',
        'happy': 'received amazing news',
        'confident': 'achieved your biggest goal',
        'mysterious': 'have a secret to share',
        'thinking': 'solving a puzzle'
    };

    return scenarios[emotion] || 'experienced something intense';
}

/**
 * Get image enhancement settings for emotion amplification
 *
 * @param {string} amplification - Amplification level
 * @returns {object} Image enhancement settings
 */
function getAmplificationEnhancements(amplification = 'viral') {
    const ampData = AMPLIFICATION_PRESETS[amplification];
    return ampData ? ampData.imageEnhancements : AMPLIFICATION_PRESETS['moderate'].imageEnhancements;
}

/**
 * Analyze image brightness/contrast to suggest expression visibility
 *
 * @param {Buffer} imageBuffer - Image to analyze
 * @returns {Promise<object>} Visibility analysis
 */
async function analyzeExpressionVisibility(imageBuffer) {
    try {
        const stats = await sharp(imageBuffer).stats();
        const metadata = await sharp(imageBuffer).metadata();

        const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / 3;
        const contrast = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / 3;

        let visibility = 'good';
        let suggestions = [];

        if (avgBrightness < 60) {
            visibility = 'poor';
            suggestions.push('Image is too dark - expression may not be visible');
        } else if (avgBrightness > 200) {
            visibility = 'poor';
            suggestions.push('Image is overexposed - expression details may be lost');
        }

        if (contrast < 30) {
            visibility = visibility === 'poor' ? 'very poor' : 'moderate';
            suggestions.push('Low contrast - expression may lack impact');
        }

        if (metadata.width < 400 || metadata.height < 400) {
            suggestions.push('Small source image - use maximum amplification');
        }

        return {
            visibility,
            brightness: Math.round(avgBrightness),
            contrast: Math.round(contrast),
            suggestions,
            recommendedAmplification: visibility === 'poor' ? 'mrbeast' : 'viral'
        };
    } catch (error) {
        return {
            visibility: 'unknown',
            suggestions: ['Could not analyze image'],
            recommendedAmplification: 'viral'
        };
    }
}

/**
 * Get all available emotions
 */
function getAvailableEmotions() {
    return Object.entries(EMOTIONS).map(([key, value]) => ({
        id: key,
        name: value.name,
        description: value.description,
        viralScore: value.viralScore
    }));
}

/**
 * Get all amplification presets
 */
function getAmplificationPresets() {
    return Object.entries(AMPLIFICATION_PRESETS).map(([key, value]) => ({
        id: key,
        name: value.name,
        description: value.description,
        intensity: value.intensity
    }));
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    getEmotionDetails,
    getEmotionPromptEnhancement,
    getEmotionStyling,
    getRecommendedExpressions,
    getEmotionsByViralScore,
    getExpressionCoaching,
    getAmplificationEnhancements,
    analyzeExpressionVisibility,
    getAvailableEmotions,
    getAmplificationPresets,
    EMOTIONS,
    AMPLIFICATION_PRESETS,
    VIRAL_EXPRESSIONS_BY_CONTENT
};
