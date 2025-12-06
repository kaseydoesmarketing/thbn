# ThumbnailBuilder V3 Upgrade Guide

## Overview

ThumbnailBuilder V3 is a comprehensive upgrade focused on **cinematic quality output** and **premium UX**. This guide covers all new features, how to use them, and how to add new configurations.

---

## What's New in V3

### 1. Text Auto-Fit System
**Problem Solved**: Text is NEVER cropped anymore.

The new `textAutoFitService.js` guarantees:
- Text stays within safe zones (90px margins on desktop, 160px on mobile)
- Automatic font size reduction for long text
- Smart word wrapping (max 3 lines)
- Avoids YouTube duration overlay zone (bottom-right)

### 2. Cinematic Prompt Engine
**Problem Solved**: Consistent front-facing subjects and proper composition.

The new `promptEngineV3.js` enforces:
- Front-facing subject (0-15 degree max deviation)
- Direct eye contact with viewer
- Professional three-point lighting
- Rule-of-thirds composition
- 7 archetype templates for different content types

### 3. Logo Positioning System
**Problem Solved**: Brand logos never cropped or misaligned.

The new `logoPositioningService.js` provides:
- Predefined position presets (topRight, topLeft, clusters)
- Automatic sizing for single or multiple logos
- Collision detection (avoids subject and text)
- Grid alignment for multiple logos

### 4. Premium Glassy UI
**Problem Solved**: Disjointed workflow and dated appearance.

The new `create-v3.html` features:
- Premium glassmorphism design
- Live preview with safe-frame overlay
- Real-time text overflow warnings
- Intuitive 5-step workflow
- Right-panel controls always visible

---

## File Structure

```
/Users/kvimedia/thumbnailbuilder/
├── create-v3.html              # NEW: Premium V3 UI
├── app-v3.js                   # NEW: V3 frontend controller
├── design-system.css           # NEW: Premium design tokens
├── server/
│   └── src/
│       ├── services/
│       │   ├── textAutoFitService.js      # NEW: Text auto-fit
│       │   ├── promptEngineV3.js          # NEW: Cinematic prompts
│       │   ├── logoPositioningService.js  # NEW: Logo positioning
│       │   ├── textOverlayService.js      # EXISTING: Enhanced
│       │   └── promptEngine.js            # EXISTING: V2 fallback
│       └── workers/
│           ├── thumbnailWorkerV3.js       # NEW: V3 pipeline
│           └── thumbnailWorker.js         # EXISTING: V2 fallback
└── tests/
    ├── unit/
    │   ├── textAutoFitService.test.js     # 76 tests
    │   └── logoPositioningService.test.js # 61 tests
    └── e2e/
        ├── setup.js                       # Test configuration
        └── thumbnailGeneration.test.js    # 59 tests
```

---

## How to Use V3

### Enable V3 Pipeline

The V3 worker is enabled by default. To disable:
```bash
export DISABLE_V3_PIPELINE=true
```

### Use V3 UI

Access the new UI at:
```
https://your-domain.com/create-v3.html
```

### API Changes

The `/api/generate` endpoint now accepts additional V3 options:

```javascript
POST /api/generate
{
    "brief": "The dark truth about streaming wars",
    "niche": "tech",
    "expression": "shocked",
    "thumbnailText": "EXPOSED",
    "faceImages": ["url1", "url2"],

    // V3 Options
    "archetype": "conspiracy",      // Optional: Override auto-detection
    "logos": {                      // Optional: Brand logos
        "brandLogos": ["Netflix", "HBO"],
        "position": "topRight"
    },
    "useV3": true                   // Optional: Force V3 (default: true)
}
```

---

## Archetype Templates

V3 includes 7 archetype templates optimized for different content:

| Archetype | Best For | Key Features |
|-----------|----------|--------------|
| `reaction` | News reactions, reveals | Shocked expression, dramatic rim light |
| `explainer` | Educational, tech reviews | Confident authority, professional lighting |
| `tutorial` | How-to guides | Friendly, bright lighting, tools visible |
| `documentary` | Investigations, stories | Intense gaze, moody atmosphere |
| `conspiracy` | Industry exposes | Knowing smirk, ominous lighting |
| `gaming` | Gaming content | Neon RGB, cyberpunk aesthetic |
| `finance` | Wealth, business | Gold accents, authority pose |

### Auto-Detection from Niche

```javascript
const NICHE_TO_ARCHETYPE = {
    reaction: 'reaction',
    gaming: 'gaming',
    tech: 'explainer',
    finance: 'finance',
    fitness: 'explainer',
    beauty: 'tutorial',
    cooking: 'tutorial',
    travel: 'documentary',
    tutorial: 'tutorial',
    podcast: 'documentary'
};
```

---

## Text Configuration

### Safe Zones

```javascript
const SAFE_ZONES = {
    desktop: { marginX: 90, marginY: 50 },
    mobile: { marginX: 160, marginY: 90 }
};

const YOUTUBE_DURATION_ZONE = {
    x: 1750, y: 1000, width: 170, height: 80
};
```

### Text Positions

```javascript
const POSITIONS = {
    topLeft: { x: 80, y: 120, anchor: 'start' },
    topCenter: { x: 960, y: 120, anchor: 'middle' },
    topRight: { x: 1840, y: 120, anchor: 'end' },
    rightCenter: { x: 1840, y: 540, anchor: 'end' },  // DEFAULT
    bottomLeft: { x: 80, y: 960, anchor: 'start' },
    center: { x: 960, y: 540, anchor: 'middle' }
};
```

### Using Auto-Fit

```javascript
const { prepareTextOverlay } = require('./services/textAutoFitService');

const result = prepareTextOverlay(
    'YOUR THUMBNAIL TEXT HERE',
    {
        fontFamily: 'Impact',
        fontWeight: 900,
        strokeWidth: 20,
        shadow: { dx: 12, dy: 12 }
    },
    'rightCenter',
    { width: 1920, height: 1080 }
);

// Result:
// {
//     fontSize: 160,
//     lines: ['YOUR THUMBNAIL', 'TEXT HERE'],
//     x: 1700,
//     y: 450,
//     fits: true,
//     warnings: []
// }
```

---

## Logo Configuration

### Position Presets

```javascript
const LOGO_POSITIONS = {
    topRight: { x: 1840, y: 60, anchor: 'end' },
    topLeft: { x: 80, y: 60, anchor: 'start' },
    topRightCluster: [
        { x: 1840, y: 60 },
        { x: 1700, y: 60 },
        { x: 1560, y: 60 }
    ],
    // bottomRight AVOIDED (YouTube duration)
};
```

### Using Logo Service

```javascript
const { prepareLogoOverlay } = require('./services/logoPositioningService');

const result = prepareLogoOverlay({
    logos: [
        { name: 'Netflix', position: 'topRight' },
        { name: 'HBO', position: 'topRight' }
    ],
    canvas: { width: 1920, height: 1080 },
    subject: { bounds: { x: 100, y: 200, width: 600, height: 800 } },
    text: { bounds: { x: 900, y: 300, width: 900, height: 200 } }
});
```

---

## Adding New Archetype Templates

To add a new archetype, edit `promptEngineV3.js`:

```javascript
const ARCHETYPE_TEMPLATES = {
    // ... existing archetypes ...

    yourNewArchetype: {
        name: 'Your Archetype',
        description: 'Description for AI',
        subjectPosition: 'left-third',
        expression: 'default expression',
        lighting: {
            keyLight: '45 degrees front-left',
            fillLight: 'soft 3:1 ratio',
            rimLight: 'subtle separation'
        },
        background: {
            style: 'relevant background description',
            elements: ['element1', 'element2'],
            mood: 'mood description'
        },
        colorPalette: {
            primary: '#HEXCODE',
            secondary: '#HEXCODE',
            accent: '#HEXCODE'
        },
        textStyle: 'bold' // or 'minimal', 'gaming', etc.
    }
};
```

Then add the niche mapping:

```javascript
const NICHE_TO_ARCHETYPE = {
    // ... existing mappings ...
    yourNiche: 'yourNewArchetype'
};
```

---

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e

# Verbose E2E
npm run test:e2e:verbose
```

### Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| textAutoFitService | 76 | Text measurement, auto-fit, wrapping |
| logoPositioningService | 61 | Positioning, sizing, validation |
| E2E thumbnailGeneration | 59 | Full flow, API, safe zones |
| **Total** | **196** | |

---

## Deployment

### 1. Update Server Files

Copy V3 services to production:
```bash
scp server/src/services/textAutoFitService.js user@server:/opt/thumbnailbuilder/server/src/services/
scp server/src/services/promptEngineV3.js user@server:/opt/thumbnailbuilder/server/src/services/
scp server/src/services/logoPositioningService.js user@server:/opt/thumbnailbuilder/server/src/services/
scp server/src/workers/thumbnailWorkerV3.js user@server:/opt/thumbnailbuilder/server/src/workers/
```

### 2. Update Frontend Files

```bash
scp create-v3.html user@server:/opt/thumbnailbuilder/
scp app-v3.js user@server:/opt/thumbnailbuilder/
scp design-system.css user@server:/opt/thumbnailbuilder/
```

### 3. Rebuild Docker

```bash
docker-compose build --no-cache app worker
docker-compose up -d
```

### 4. Verify

```bash
curl -s http://localhost:3001/api/health
```

---

## Rollback

To rollback to V2:

```bash
export DISABLE_V3_PIPELINE=true
docker-compose restart app worker
```

The V3 worker automatically falls back to V2 on errors, so a full rollback is rarely needed.

---

## Troubleshooting

### Text Still Cropping

1. Check `SAFE_ZONES` constants match your canvas size
2. Verify `prepareTextOverlay` is being called before rendering
3. Check for `warnings` in the return value

### Subject Not Front-Facing

1. Verify using V3 prompts (`buildCinematicPrompt`)
2. Check archetype is appropriate for content
3. Try explicit `expression` parameter

### Logos Overlapping

1. Use `validateLogoPlacement` before rendering
2. Check `positions` array has correct coordinates
3. Reduce logo count or use `cluster` positions

### Debug Logging

Enable detailed logging:
```bash
export DEBUG_WORKER=true
```

---

## Support

For issues, check:
1. Worker logs: `docker logs thumbnailbuilder-worker`
2. API logs: `docker logs thumbnailbuilder-api`
3. Test results: `npm test`

---

*ThumbnailBuilder V3 - Cinematic UX Overhaul*
*Built with NEXUS Agents - December 2025*
