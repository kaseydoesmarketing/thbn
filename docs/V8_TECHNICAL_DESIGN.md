# ThumbnailBuilder V8 Technical Design Document

## Executive Summary

V8 transforms ThumbnailBuilder from a basic AI thumbnail generator into a **professional-grade thumbnail creation system** with:
- Smart text placement with WCAG contrast guarantees
- Functional subject positioning that actually works
- Clothing/outfit customization
- Subject-background separation for photorealistic compositing
- "Glassy Mode" cinematic polish
- Real-time heuristics checklist

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THUMBNAILBUILDER V8 PIPELINE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │   Frontend   │───▶│   API Layer  │───▶│      Generation Pipeline      │  │
│  │  create-v3   │    │  /api/gen    │    │                                │  │
│  └──────────────┘    └──────────────┘    │  1. promptEngineV8.js          │  │
│        │                    │            │     - Subject positioning       │  │
│        │                    │            │     - Outfit instructions       │  │
│        ▼                    ▼            │     - Glassy mode prompts       │  │
│  ┌──────────────┐    ┌──────────────┐    │                                │  │
│  │  New Controls │    │  New Fields  │    │  2. Gemini API                 │  │
│  │  - Text Pos   │    │  - textPos   │    │     - Generate base image      │  │
│  │  - Outfit     │    │  - outfit    │    │                                │  │
│  │  - Glassy     │    │  - glassy    │    │  3. textLayoutEngineV8.js     │  │
│  │  - Exposure   │    │  - exposure  │    │     - Safe zone detection      │  │
│  └──────────────┘    └──────────────┘    │     - Contrast analysis        │  │
│                                          │     - Auto color selection      │  │
│                                          │                                │  │
│                                          │  4. separationService.js       │  │
│                                          │     - Subject detection         │  │
│                                          │     - Background analysis       │  │
│                                          │     - Rim light/glow injection  │  │
│                                          │                                │  │
│                                          │  5. glassyModeService.js       │  │
│                                          │     - Bloom effects             │  │
│                                          │     - Reflections               │  │
│                                          │     - Cinematic vignette        │  │
│                                          └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. TEXT PLACEMENT ENGINE

### 1.1 Safe Zones Definition

```javascript
// textLayoutEngineV8.js
const YOUTUBE_SAFE_ZONES = {
    // YouTube UI elements to AVOID
    dangerZones: {
        timestamp: { x: [1680, 1920], y: [980, 1080] },      // Bottom-right duration
        watchLater: { x: [0, 120], y: [980, 1080] },         // Bottom-left icons
        addToQueue: { x: [1800, 1920], y: [0, 100] },        // Top-right badge
        channelLogo: { x: [0, 200], y: [0, 150] }            // Top-left overlay
    },

    // Safe text areas
    safeZones: {
        primary: { x: [100, 1400], y: [100, 850] },          // Main safe area
        secondary: { x: [100, 1820], y: [200, 750] }         // Extended safe area
    },

    // Text should occupy 10-15% of canvas
    textBudget: {
        minArea: 0.10,  // 10% minimum
        maxArea: 0.15,  // 15% maximum
        maxWords: 5
    }
};
```

### 1.2 Text Position Modes

```javascript
const TEXT_POSITION_MODES = {
    AUTO: 'auto',           // Algorithm chooses best position
    MANUAL: 'manual',       // 3x3 grid selection
    FREE: 'free'            // Drag anywhere (clamped to safe zones)
};

// Manual grid positions (9 cells)
const MANUAL_POSITIONS = {
    'top-left':      { x: 0.15, y: 0.15, anchor: 'start' },
    'top-center':    { x: 0.50, y: 0.15, anchor: 'middle' },
    'top-right':     { x: 0.85, y: 0.15, anchor: 'end' },
    'middle-left':   { x: 0.15, y: 0.50, anchor: 'start' },
    'middle-center': { x: 0.50, y: 0.50, anchor: 'middle' },
    'middle-right':  { x: 0.85, y: 0.50, anchor: 'end' },
    'bottom-left':   { x: 0.15, y: 0.80, anchor: 'start' },
    'bottom-center': { x: 0.50, y: 0.80, anchor: 'middle' },
    'bottom-right':  { x: 0.70, y: 0.80, anchor: 'end' }     // Shifted to avoid timestamp
};
```

### 1.3 Auto-Layout Algorithm

```javascript
async function calculateOptimalTextPosition(imageBuffer, options) {
    const { text, subjectBounds, logoBounds } = options;

    // 1. Detect subject bounding box (face + torso)
    const subjectArea = await detectSubjectArea(imageBuffer);

    // 2. Calculate available zones
    const availableZones = SAFE_ZONES.primary.filter(zone =>
        !intersects(zone, subjectArea) &&
        !intersects(zone, YOUTUBE_SAFE_ZONES.dangerZones.timestamp) &&
        !intersects(zone, logoBounds)
    );

    // 3. Apply rule of thirds preference
    const ruleOfThirdsZones = availableZones.filter(zone =>
        isOnThirdLine(zone) || isOnThirdIntersection(zone)
    );

    // 4. Sample background colors in candidate zones
    const zonesWithContrast = await Promise.all(
        ruleOfThirdsZones.map(async zone => ({
            ...zone,
            bgColor: await sampleAverageColor(imageBuffer, zone),
            contrast: calculateContrast(zone.bgColor, options.textColor)
        }))
    );

    // 5. Select zone with best contrast
    const optimalZone = zonesWithContrast
        .filter(z => z.contrast >= 3.0)  // WCAG minimum
        .sort((a, b) => b.contrast - a.contrast)[0];

    return optimalZone || fallbackPosition(subjectArea);
}
```

### 1.4 Contrast Engine

```javascript
// WCAG contrast requirements
const CONTRAST_REQUIREMENTS = {
    MINIMUM: 3.0,       // Large text minimum (WCAG AA)
    TARGET: 4.5,        // Normal text target (WCAG AA)
    ENHANCED: 7.0       // Enhanced (WCAG AAA)
};

// Text color palette (limited for brand consistency)
const TEXT_PALETTE = {
    primary: ['#FFFFFF', '#000000'],
    accents: ['#FF5500', '#FFD700', '#00D68F'],  // Brand colors
    neutrals: ['#F5F5F5', '#1A1A1A', '#333333']
};

async function selectOptimalTextColor(imageBuffer, textBounds) {
    // 1. Sample background colors under text area
    const bgSamples = await sampleColorGrid(imageBuffer, textBounds, 9);
    const avgBgColor = averageColor(bgSamples);
    const bgLuminance = relativeLuminance(avgBgColor);

    // 2. Calculate contrast for each palette color
    const colorScores = TEXT_PALETTE.primary.concat(TEXT_PALETTE.accents)
        .map(color => ({
            color,
            contrast: contrastRatio(color, avgBgColor)
        }))
        .sort((a, b) => b.contrast - a.contrast);

    // 3. Select best color meeting minimum contrast
    const selected = colorScores.find(c => c.contrast >= CONTRAST_REQUIREMENTS.TARGET)
        || colorScores[0];

    // 4. Determine if backing/outline is needed
    const needsBacking = bgSamples.some(s =>
        contrastRatio(selected.color, s) < CONTRAST_REQUIREMENTS.MINIMUM
    );

    return {
        textColor: selected.color,
        contrast: selected.contrast,
        needsBacking,
        backingType: needsBacking ? selectBackingType(bgLuminance) : null
    };
}

function selectBackingType(bgLuminance) {
    if (bgLuminance > 0.5) {
        // Light background - use dark stroke
        return { type: 'stroke', color: 'rgba(0,0,0,0.7)', width: 4 };
    } else {
        // Dark background - use light glow or white stroke
        return { type: 'stroke', color: 'rgba(255,255,255,0.5)', width: 3 };
    }
}
```

---

## 2. SUBJECT POSITIONING SYSTEM

### 2.1 Position Mapping

```javascript
// Map 9-position grid to prompt instructions
const SUBJECT_POSITION_MAP = {
    'top-left': {
        prompt: 'Position subject in upper-left quadrant of frame. Head in top-left third intersection.',
        composition: 'Leave right side and bottom for text/graphics.',
        framing: 'Close-up from chest up, looking toward camera.'
    },
    'top-center': {
        prompt: 'Position subject centered horizontally, in upper portion of frame.',
        composition: 'Leave bottom third for text overlay.',
        framing: 'Head and shoulders visible, centered.'
    },
    'middle-left': {
        prompt: 'Position subject on left vertical third line (rule of thirds).',
        composition: 'Right two-thirds available for text and supporting elements.',
        framing: 'Standard YouTube thumbnail framing - face dominant.'
    },
    'middle-center': {
        prompt: 'Center subject in frame with equal margins.',
        composition: 'Text will wrap around subject or overlay at top/bottom.',
        framing: 'Symmetric composition, face as focal point.'
    },
    'middle-right': {
        prompt: 'Position subject on right vertical third line.',
        composition: 'Left side available for text and graphics.',
        framing: 'Subject looking slightly left toward text area.'
    },
    // ... (all 9 positions defined)
};

// Scale mapping (50-150% slider)
const SUBJECT_SCALE_MAP = {
    50:  { fillPercent: 30, framing: 'Full body or wide shot, subject smaller in frame.' },
    75:  { fillPercent: 45, framing: 'Mid-shot from waist up.' },
    100: { fillPercent: 60, framing: 'Standard close-up, head and shoulders.' },
    125: { fillPercent: 75, framing: 'Tight close-up, face fills most of frame.' },
    150: { fillPercent: 85, framing: 'Extreme close-up, face dominant, may crop top of head.' }
};
```

### 2.2 Prompt Integration

```javascript
// promptEngineV8.js
function buildSubjectPositioningPrompt(position, scale) {
    const posConfig = SUBJECT_POSITION_MAP[position] || SUBJECT_POSITION_MAP['middle-center'];
    const scaleConfig = SUBJECT_SCALE_MAP[scale] || SUBJECT_SCALE_MAP[100];

    return `
SUBJECT POSITIONING (CRITICAL):
- ${posConfig.prompt}
- ${posConfig.framing}
- Subject should fill approximately ${scaleConfig.fillPercent}% of frame height.
- ${scaleConfig.framing}

COMPOSITION GUIDANCE:
- ${posConfig.composition}
- Maintain rule-of-thirds alignment for professional look.
- Subject's eyes should be at or slightly above horizontal center.
`;
}
```

---

## 3. SUBJECT SEPARATION SERVICE

### 3.1 Separation Detection

```javascript
// separationService.js
async function analyzeSubjectSeparation(imageBuffer) {
    // 1. Detect subject mask using edge detection + color clustering
    const subjectMask = await detectSubjectMask(imageBuffer);

    // 2. Extract subject colors (especially torso/clothing)
    const subjectColors = await extractDominantColors(imageBuffer, subjectMask);

    // 3. Extract background colors (especially area behind subject)
    const bgMask = invertMask(subjectMask);
    const bgColors = await extractDominantColors(imageBuffer, bgMask);

    // 4. Calculate separation score
    const separationScore = calculateColorSeparation(subjectColors, bgColors);

    return {
        score: separationScore,           // 0-100, higher = better separation
        needsEnhancement: separationScore < 40,
        subjectColors,
        bgColors,
        recommendations: generateSeparationRecommendations(separationScore, subjectColors, bgColors)
    };
}

function generateSeparationRecommendations(score, subjectColors, bgColors) {
    const recommendations = [];

    if (score < 40) {
        // Check if it's a brightness issue
        const subjectLum = averageLuminance(subjectColors);
        const bgLum = averageLuminance(bgColors);

        if (Math.abs(subjectLum - bgLum) < 0.2) {
            if (subjectLum > 0.5) {
                recommendations.push({ type: 'darken_bg', intensity: 0.3 });
            } else {
                recommendations.push({ type: 'lighten_subject', intensity: 0.2 });
            }
        }

        // Always recommend rim light for low separation
        recommendations.push({ type: 'rim_light', color: '#FFFFFF', intensity: 0.4 });
    }

    return recommendations;
}
```

### 3.2 Separation Enhancement

```javascript
async function enhanceSubjectSeparation(imageBuffer, analysis) {
    let enhanced = imageBuffer;

    for (const rec of analysis.recommendations) {
        switch (rec.type) {
            case 'rim_light':
                enhanced = await applyRimLight(enhanced, {
                    color: rec.color,
                    intensity: rec.intensity,
                    edgeWidth: 3
                });
                break;

            case 'darken_bg':
                enhanced = await darkenBackground(enhanced, {
                    intensity: rec.intensity,
                    preserveSubject: true
                });
                break;

            case 'lighten_subject':
                enhanced = await adjustSubjectExposure(enhanced, {
                    exposure: rec.intensity
                });
                break;

            case 'subtle_glow':
                enhanced = await applySubjectGlow(enhanced, {
                    color: rec.color,
                    radius: 5,
                    intensity: rec.intensity
                });
                break;
        }
    }

    return enhanced;
}
```

---

## 4. CLOTHING/OUTFIT SYSTEM

### 4.1 Outfit Configuration

```javascript
// outfitService.js
const OUTFIT_PRESETS = {
    'keep-original': {
        prompt: null,  // No clothing modification
        description: 'Keep the subject\'s original clothing'
    },
    'tech-hoodie': {
        prompt: 'Wearing a modern tech-style hoodie in dark gray or navy, clean minimalist design, high-quality fabric.',
        colorConstraints: ['#2D3436', '#1E3A5F', '#2C3E50'],
        contextMatch: ['tech', 'ai', 'startup', 'coding']
    },
    'streetwear': {
        prompt: 'Wearing trendy streetwear - oversized graphic tee or designer hoodie, contemporary urban style.',
        colorConstraints: ['#000000', '#FFFFFF', '#1A1A1A'],
        contextMatch: ['lifestyle', 'vlog', 'entertainment']
    },
    'business-casual': {
        prompt: 'Wearing a crisp button-down shirt, professional but approachable, modern fit.',
        colorConstraints: ['#FFFFFF', '#87CEEB', '#E6E6FA'],
        contextMatch: ['business', 'finance', 'consulting']
    },
    'full-suit': {
        prompt: 'Wearing a tailored business suit with tie, executive appearance, confident posture.',
        colorConstraints: ['#1A1A1A', '#2C3E50', '#1E3A5F'],
        contextMatch: ['corporate', 'luxury', 'authority']
    },
    'plain-tee': {
        prompt: 'Wearing a simple, well-fitted solid color t-shirt, clean and minimal.',
        colorConstraints: ['#FFFFFF', '#000000', '#2D3436', '#E74C3C'],
        contextMatch: ['fitness', 'casual', 'tutorial']
    }
};

function buildOutfitPrompt(outfitKey, customPrompt, dominantColor, bgAnalysis) {
    if (outfitKey === 'keep-original') return '';

    const preset = OUTFIT_PRESETS[outfitKey];
    let prompt = preset?.prompt || customPrompt;

    // Ensure outfit doesn't blend with background
    if (bgAnalysis) {
        const bgDominant = bgAnalysis.dominantColor;
        const safeColors = preset?.colorConstraints?.filter(c =>
            colorDistance(c, bgDominant) > 50
        );

        if (safeColors?.length > 0 && !dominantColor) {
            prompt += ` Outfit color: ${safeColors[0]}.`;
        }
    }

    if (dominantColor) {
        prompt += ` Primary outfit color: ${dominantColor}.`;
    }

    return `
CLOTHING REQUIREMENTS:
${prompt}
- Clothing must be photorealistic with proper fabric texture, folds, and seams.
- No AI artifacts on clothing (no warped logos, no melted text, no impossible seams).
- Outfit should complement, not compete with, the overall thumbnail composition.
`;
}
```

### 4.2 Context-Aware Outfit Selection

```javascript
function suggestOutfitForContext(videoTitle, niche, brief) {
    const context = `${videoTitle} ${niche} ${brief}`.toLowerCase();

    for (const [key, preset] of Object.entries(OUTFIT_PRESETS)) {
        if (preset.contextMatch?.some(keyword => context.includes(keyword))) {
            return {
                suggested: key,
                reason: `Matches "${preset.contextMatch.find(k => context.includes(k))}" context`
            };
        }
    }

    // Default based on niche
    const nicheDefaults = {
        'tech': 'tech-hoodie',
        'finance': 'business-casual',
        'gaming': 'streetwear',
        'fitness': 'plain-tee',
        'business': 'full-suit'
    };

    return {
        suggested: nicheDefaults[niche] || 'keep-original',
        reason: 'Default for niche'
    };
}
```

---

## 5. GLASSY MODE SERVICE

### 5.1 Glassy Effects Configuration

```javascript
// glassyModeService.js
const GLASSY_CONFIG = {
    bloom: {
        threshold: 200,      // Brightness threshold for bloom
        intensity: 0.3,      // Bloom intensity (0-1)
        radius: 15,          // Bloom blur radius
        targetElements: ['logos', 'highlights', 'text-glow']
    },
    reflections: {
        intensity: 0.15,     // Subtle light streaks
        angle: 45,           // Angle of light streaks
        length: 100          // Streak length in pixels
    },
    vignette: {
        intensity: 0.25,     // Edge darkening
        radius: 0.7,         // Vignette radius (0-1)
        softness: 0.4        // Edge softness
    },
    colorGrading: {
        shadows: { r: -5, g: -3, b: 2 },    // Slight blue in shadows
        highlights: { r: 5, g: 3, b: -2 }   // Slight warm highlights
    }
};

async function applyGlassyMode(imageBuffer, intensity = 0.5) {
    // Scale all effects by intensity slider (0-1)
    const scaledConfig = scaleConfig(GLASSY_CONFIG, intensity);

    let result = imageBuffer;

    // 1. Apply subtle bloom to bright areas
    result = await applyBloom(result, scaledConfig.bloom);

    // 2. Add light reflections/streaks (optional, based on intensity)
    if (intensity > 0.3) {
        result = await addLightStreaks(result, scaledConfig.reflections);
    }

    // 3. Apply cinematic vignette
    result = await applyVignette(result, scaledConfig.vignette);

    // 4. Color grading for cinematic look
    result = await applyColorGrading(result, scaledConfig.colorGrading);

    return result;
}
```

### 5.2 Scene-Adaptive Glassy Mode

```javascript
async function adaptGlassyToScene(imageBuffer, intensity) {
    // Analyze scene brightness
    const analysis = await analyzeSceneBrightness(imageBuffer);

    // Adjust for dark scenes
    if (analysis.averageLuminance < 0.3) {
        // Dark scene - reduce bloom, increase subtle highlights
        return applyGlassyMode(imageBuffer, intensity * 0.7);
    }

    // Adjust for bright scenes
    if (analysis.averageLuminance > 0.7) {
        // Bright scene - reduce vignette, careful with bloom
        return applyGlassyMode(imageBuffer, intensity * 0.8);
    }

    // Normal scene - full effect
    return applyGlassyMode(imageBuffer, intensity);
}
```

---

## 6. HEURISTICS CHECKLIST

### 6.1 Checklist Items

```javascript
// heuristicsChecker.js
const THUMBNAIL_HEURISTICS = {
    faceDominant: {
        label: 'Face dominant?',
        check: async (image) => {
            const faceArea = await detectFaceArea(image);
            const imageArea = image.width * image.height;
            return (faceArea / imageArea) >= 0.15;  // Face should be 15%+ of image
        },
        weight: 'critical'
    },
    textReadable: {
        label: 'Text readable at small size?',
        check: async (image, textBounds, textColor) => {
            // Simulate 168x94 mobile size
            const scaled = await resizeImage(image, 168, 94);
            const textAreaScaled = scaleRect(textBounds, 168/1920, 94/1080);
            const contrast = await measureLocalContrast(scaled, textAreaScaled, textColor);
            return contrast >= 3.0;
        },
        weight: 'critical'
    },
    highContrast: {
        label: 'High contrast?',
        check: async (image, textBounds, textColor, bgColor) => {
            const contrast = contrastRatio(textColor, bgColor);
            return contrast >= 4.5;
        },
        weight: 'important'
    },
    subjectSeparated: {
        label: 'Subject separated from background?',
        check: async (image) => {
            const separation = await analyzeSubjectSeparation(image);
            return separation.score >= 40;
        },
        weight: 'important'
    },
    logosLegible: {
        label: 'Logos legible but secondary?',
        check: async (image, logoBounds) => {
            if (!logoBounds) return true;  // No logos = pass
            const logoArea = logoBounds.width * logoBounds.height;
            const imageArea = image.width * image.height;
            return (logoArea / imageArea) <= 0.08;  // Logos under 8% of image
        },
        weight: 'minor'
    }
};

async function runHeuristicsCheck(imageBuffer, metadata) {
    const results = {};
    let passCount = 0;
    let totalWeight = 0;

    for (const [key, heuristic] of Object.entries(THUMBNAIL_HEURISTICS)) {
        const passed = await heuristic.check(imageBuffer, ...getCheckParams(metadata, key));
        results[key] = {
            label: heuristic.label,
            passed,
            weight: heuristic.weight
        };

        const weightValue = { critical: 3, important: 2, minor: 1 }[heuristic.weight];
        totalWeight += weightValue;
        if (passed) passCount += weightValue;
    }

    return {
        results,
        score: Math.round((passCount / totalWeight) * 100),
        allPassed: Object.values(results).every(r => r.passed)
    };
}
```

---

## 7. API CHANGES

### 7.1 New Request Fields

```javascript
// POST /api/generate
{
    // Existing fields
    brief: string,
    niche: string,
    expression: string,
    thumbnailText: string,
    faceImages: string[],
    creatorStyle: string,
    variantCount: number,

    // NEW V8 fields
    textPosition: {
        mode: 'auto' | 'manual' | 'free',
        position: string,              // For manual: 'top-left', etc.
        coordinates: { x: number, y: number }  // For free mode
    },
    textColor: {
        mode: 'auto' | 'manual',
        color: string,                 // For manual: hex color
        outlineColor: string           // Optional outline color
    },
    subjectPosition: string,           // 9-position grid
    subjectScale: number,              // 50-150
    outfit: {
        mode: 'keep-original' | 'preset' | 'custom',
        preset: string,                // Preset key
        customPrompt: string,          // For custom mode
        dominantColor: string          // Optional color constraint
    },
    glassyMode: {
        enabled: boolean,
        intensity: number              // 0-1
    },
    subjectExposure: number            // -50 to +50 (relative adjustment)
}
```

### 7.2 New Response Fields

```javascript
// Response includes heuristics results
{
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    variants: [
        {
            id: string,
            url: string,
            label: string,
            heuristics: {
                score: number,
                results: {
                    faceDominant: { passed: boolean, label: string },
                    textReadable: { passed: boolean, label: string },
                    // ...
                }
            },
            metadata: {
                textPosition: { x: number, y: number },
                textColor: string,
                contrastRatio: number,
                separationScore: number
            }
        }
    ]
}
```

---

## 8. FRONTEND CONTROLS

### 8.1 Right Panel Structure

```html
<!-- Subject & Style Section (NEW) -->
<div class="control-section" id="subject-style-section">
    <h3 class="section-title">Subject & Style</h3>

    <!-- Subject Position (existing, now functional) -->
    <div class="control-group">
        <label>Subject Position</label>
        <div class="position-grid" id="subject-position-grid">
            <!-- 3x3 grid buttons -->
        </div>
    </div>

    <!-- Subject Scale (existing) -->
    <div class="control-group">
        <label>Subject Scale</label>
        <input type="range" id="subject-scale" min="50" max="150" value="100">
    </div>

    <!-- Subject Exposure (NEW) -->
    <div class="control-group">
        <label>Subject Exposure</label>
        <input type="range" id="subject-exposure" min="-50" max="50" value="0">
    </div>

    <!-- Outfit Controls (NEW) -->
    <div class="control-group">
        <label>Subject Outfit</label>
        <div class="outfit-toggle">
            <button data-mode="keep">Keep Original</button>
            <button data-mode="change">Change Clothing</button>
        </div>
        <div class="outfit-presets" id="outfit-presets" style="display:none;">
            <button data-preset="tech-hoodie">Tech Hoodie</button>
            <button data-preset="streetwear">Streetwear</button>
            <button data-preset="business-casual">Business Casual</button>
            <button data-preset="full-suit">Full Suit</button>
            <button data-preset="plain-tee">Plain Tee</button>
        </div>
        <input type="text" id="custom-outfit" placeholder="Custom outfit description...">
        <input type="color" id="outfit-color" title="Dominant outfit color">
    </div>

    <!-- Glassy Mode (NEW) -->
    <div class="control-group">
        <label>Glassy Mode</label>
        <div class="toggle-with-slider">
            <input type="checkbox" id="glassy-enabled">
            <input type="range" id="glassy-intensity" min="0" max="100" value="50" disabled>
        </div>
    </div>
</div>

<!-- Text Position Section (NEW) -->
<div class="control-section" id="text-position-section">
    <h3 class="section-title">Text Position</h3>

    <div class="position-mode-toggle">
        <button data-mode="auto" class="active">Auto</button>
        <button data-mode="manual">Manual</button>
        <button data-mode="free">Free</button>
    </div>

    <!-- Manual grid (shown when manual selected) -->
    <div class="text-position-grid" id="text-position-grid" style="display:none;">
        <!-- 3x3 grid -->
    </div>

    <!-- Contrast indicator -->
    <div class="contrast-indicator" id="contrast-indicator">
        <span class="contrast-value">4.5:1</span>
        <span class="contrast-status good">Good contrast</span>
    </div>

    <!-- Manual color pickers -->
    <div class="color-pickers" style="display:none;">
        <label>Text Color</label>
        <input type="color" id="text-color" value="#FFFFFF">
        <label>Outline Color</label>
        <input type="color" id="outline-color" value="#000000">
    </div>
</div>
```

### 8.2 Heuristics Checklist Overlay

```html
<!-- Toggleable checklist overlay on preview -->
<div class="heuristics-overlay" id="heuristics-overlay">
    <button class="toggle-btn" id="toggle-heuristics">
        <svg><!-- checklist icon --></svg>
    </button>

    <div class="checklist" id="heuristics-checklist">
        <div class="checklist-item" data-check="faceDominant">
            <span class="status"></span>
            <span class="label">Face dominant?</span>
        </div>
        <div class="checklist-item" data-check="textReadable">
            <span class="status"></span>
            <span class="label">Text readable at small size?</span>
        </div>
        <div class="checklist-item" data-check="highContrast">
            <span class="status"></span>
            <span class="label">High contrast?</span>
        </div>
        <div class="checklist-item" data-check="subjectSeparated">
            <span class="status"></span>
            <span class="label">Subject separated?</span>
        </div>
        <div class="checklist-item" data-check="logosLegible">
            <span class="status"></span>
            <span class="label">Logos legible but secondary?</span>
        </div>

        <div class="checklist-score">
            Score: <span id="heuristics-score">0</span>/100
        </div>
    </div>
</div>
```

---

## 9. IMPROVE DESIGN FLOW

### 9.1 Style-Only Re-generation

```javascript
// POST /api/improve-design
{
    originalJobId: string,
    improvements: {
        enhanceSeparation: boolean,
        adjustContrast: boolean,
        applyGlassy: boolean,
        tweakClothingColor: boolean
    },
    glassyIntensity: number,
    exposureAdjustment: number
}

// This endpoint:
// 1. Retrieves the original generated image
// 2. Applies post-processing without regenerating
// 3. Returns improved version
```

---

## 10. VIRAL THUMBNAIL HEURISTICS IN PROMPTS

### 10.1 Base System Prompt

```javascript
const VIRAL_THUMBNAIL_SYSTEM_PROMPT = `
You are a YouTube thumbnail creator with 15 years of experience working ONLY with the biggest creators (MrBeast, MKBHD, Hormozi, etc.).

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
`;
```

---

## 11. FILE STRUCTURE (NEW/MODIFIED)

```
server/src/
├── services/
│   ├── textLayoutEngineV8.js      (NEW - Smart text positioning)
│   ├── contrastEngine.js          (NEW - WCAG contrast logic)
│   ├── separationService.js       (NEW - Subject-background separation)
│   ├── outfitService.js           (NEW - Clothing customization)
│   ├── glassyModeService.js       (NEW - Cinematic effects)
│   ├── heuristicsChecker.js       (NEW - Thumbnail scoring)
│   ├── promptEngineV8.js          (NEW - V8 prompt generation)
│   ├── textOverlayService.js      (MODIFIED - Integrate contrast engine)
│   └── promptEngineV3.js          (KEEP - Fallback)
├── workers/
│   ├── thumbnailWorkerV8.js       (NEW - V8 pipeline)
│   └── thumbnailWorkerV3.js       (KEEP - Fallback)
└── routes/
    └── thumbnail.js               (MODIFIED - New endpoints)

frontend/
├── create-v8.html                 (NEW - V8 UI)
├── app-v8.js                      (NEW - V8 controller)
└── design-system-v8.css           (NEW - V8 styles)
```

---

## 12. IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1)
- [ ] Create `textLayoutEngineV8.js` with safe zones and auto-positioning
- [ ] Create `contrastEngine.js` with WCAG compliance
- [ ] Modify `promptEngineV3.js` → `promptEngineV8.js` with subject positioning

### Phase 2: Advanced Features (Week 2)
- [ ] Create `separationService.js` for subject-background detection
- [ ] Create `outfitService.js` for clothing customization
- [ ] Create `glassyModeService.js` for cinematic effects

### Phase 3: Integration (Week 3)
- [ ] Create `thumbnailWorkerV8.js` integrating all services
- [ ] Create `heuristicsChecker.js` for thumbnail scoring
- [ ] Update API routes with new fields

### Phase 4: Frontend (Week 4)
- [ ] Create V8 UI with new controls
- [ ] Implement heuristics checklist overlay
- [ ] Add Improve Design flow

### Phase 5: QA & Polish (Week 5)
- [ ] A/B testing with reference thumbnails
- [ ] Performance optimization
- [ ] Documentation

---

## 13. SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| Text contrast | ≥3.0 for 100% | Automated check |
| Subject separation score | ≥40 for 90% | separationService analysis |
| Heuristics pass rate | ≥80% average | heuristicsChecker |
| Generation latency | <15s P95 | Monitoring |
| User satisfaction | 4.5+/5 rating | Feedback |

---

*Document Version: 1.0*
*Last Updated: December 6, 2025*
*Author: SYSTEM-ARCHITECT-PRIME*
