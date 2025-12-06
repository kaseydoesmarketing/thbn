/**
 * ThumbnailBuilder V8 - Frontend Application
 *
 * Handles:
 * - Subject Position (9-grid)
 * - Subject Scale
 * - Text Position (9-grid with auto mode)
 * - Outfit Presets + Custom + Color
 * - Glassy Mode Intensity
 * - Heuristics Overlay
 * - Safe Frame Toggle
 * - Generation & Export
 */

(function() {
    'use strict';

    // ==========================================================================
    // STATE
    // ==========================================================================

    const state = {
        currentStep: 1,
        faceImages: [],
        niche: 'reaction',
        expression: 'excited',
        creatorStyle: 'auto',
        brief: '',
        thumbnailText: '',

        // V8 Features
        subjectPosition: 'middle-left',
        subjectScale: 100,
        textPosition: 'auto',
        textAutoPosition: true,
        outfit: 'tech-hoodie',
        customOutfit: '',
        outfitColor: '#000000',
        keepOriginalOutfit: false,
        glassyIntensity: 50,
        showSafeFrame: false,
        showHeuristics: false,

        // Generation
        variants: [],
        selectedVariant: null,
        isGenerating: false,
        jobId: null,

        // Heuristics results
        heuristics: {
            faceDominant: true,
            textReadable: true,
            highContrast: true,
            subjectSeparated: false,
            logosLegible: true,
            score: 85
        }
    };

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================

    const elements = {
        // Navigation
        steps: document.querySelectorAll('.step'),
        btnBack: document.getElementById('btn-back'),
        btnNext: document.getElementById('btn-next'),

        // Preview
        previewFrame: document.getElementById('preview-frame'),
        previewPlaceholder: document.getElementById('preview-placeholder'),
        previewImage: document.getElementById('preview-image'),
        safeFrameOverlay: document.getElementById('safe-frame-overlay'),

        // Heuristics
        heuristicsToggle: document.getElementById('heuristics-toggle'),
        heuristicsOverlay: document.getElementById('heuristics-overlay'),
        heuristicsScore: document.getElementById('heuristics-score'),

        // Subject Controls
        subjectPositionGrid: document.getElementById('subject-position-grid'),
        subjectScaleSlider: document.getElementById('subject-scale-slider'),
        subjectScaleValue: document.getElementById('subject-scale-value'),

        // Text Controls
        textPositionGrid: document.getElementById('text-position-grid'),
        textAutoPosition: document.getElementById('text-auto-position'),

        // Outfit Controls
        outfitPresets: document.getElementById('outfit-presets'),
        keepOriginalOutfit: document.getElementById('keep-original-outfit'),
        outfitCustom: document.getElementById('outfit-custom'),
        customOutfitInput: document.getElementById('custom-outfit-input'),
        outfitColors: document.querySelectorAll('.outfit-color'),

        // Glassy Mode
        glassyPresets: document.getElementById('glassy-presets'),
        glassyIntensitySlider: document.getElementById('glassy-intensity-slider'),
        glassyIntensityValue: document.getElementById('glassy-intensity-value'),

        // Toggles
        safeFrameToggle: document.getElementById('safe-frame-toggle'),

        // Summary
        summaryPosition: document.getElementById('summary-position'),
        summaryOutfit: document.getElementById('summary-outfit'),
        summaryGlassy: document.getElementById('summary-glassy'),

        // Variants
        variantStrip: document.getElementById('variant-strip'),
        variantCount: document.getElementById('variant-count')
    };

    // ==========================================================================
    // UTILITY FUNCTIONS
    // ==========================================================================

    function formatPosition(position) {
        return position.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
    }

    function formatOutfit(outfit) {
        return outfit.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    function getGlassyLabel(intensity) {
        if (intensity === 0) return 'Off';
        if (intensity <= 25) return 'Subtle';
        if (intensity <= 50) return 'Balanced';
        if (intensity <= 75) return 'Cinematic';
        return 'Dramatic';
    }

    function updateSummary() {
        // Position summary
        elements.summaryPosition.textContent = `${formatPosition(state.subjectPosition)} @ ${state.subjectScale}%`;

        // Outfit summary
        if (state.keepOriginalOutfit) {
            elements.summaryOutfit.textContent = 'Keep Original';
        } else if (state.outfit === 'custom') {
            elements.summaryOutfit.textContent = state.customOutfit || 'Custom (not set)';
        } else {
            elements.summaryOutfit.textContent = `${formatOutfit(state.outfit)} (${state.outfitColor})`;
        }

        // Glassy summary
        elements.summaryGlassy.textContent = `${getGlassyLabel(state.glassyIntensity)} (${state.glassyIntensity}%)`;
    }

    // ==========================================================================
    // SUBJECT POSITION
    // ==========================================================================

    function initSubjectPosition() {
        const buttons = elements.subjectPositionGrid.querySelectorAll('.position-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.subjectPosition = btn.dataset.position;
                updateSummary();
                console.log('[V8] Subject position:', state.subjectPosition);
            });
        });
    }

    function initSubjectScale() {
        elements.subjectScaleSlider.addEventListener('input', (e) => {
            state.subjectScale = parseInt(e.target.value);
            elements.subjectScaleValue.textContent = `${state.subjectScale}%`;
            updateSummary();
        });
    }

    // ==========================================================================
    // TEXT POSITION
    // ==========================================================================

    function initTextPosition() {
        const buttons = elements.textPositionGrid.querySelectorAll('.position-btn');
        const autoCheckbox = elements.textAutoPosition;

        // Toggle auto mode
        autoCheckbox.addEventListener('change', (e) => {
            state.textAutoPosition = e.target.checked;
            elements.textPositionGrid.style.opacity = state.textAutoPosition ? '0.5' : '1';
            elements.textPositionGrid.style.pointerEvents = state.textAutoPosition ? 'none' : 'auto';
            state.textPosition = state.textAutoPosition ? 'auto' : state.textPosition;
            console.log('[V8] Text auto position:', state.textAutoPosition);
        });

        // Manual position selection
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (state.textAutoPosition) return;
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.textPosition = btn.dataset.position;
                console.log('[V8] Text position:', state.textPosition);
            });
        });
    }

    // ==========================================================================
    // OUTFIT CONTROLS
    // ==========================================================================

    function initOutfitControls() {
        const presets = elements.outfitPresets.querySelectorAll('.outfit-preset');

        // Keep original toggle
        elements.keepOriginalOutfit.addEventListener('change', (e) => {
            state.keepOriginalOutfit = e.target.checked;
            presets.forEach(p => p.classList.toggle('disabled', state.keepOriginalOutfit));
            elements.outfitCustom.classList.toggle('visible', false);
            updateSummary();
            console.log('[V8] Keep original outfit:', state.keepOriginalOutfit);
        });

        // Preset selection
        presets.forEach(preset => {
            preset.addEventListener('click', () => {
                if (state.keepOriginalOutfit) return;

                presets.forEach(p => p.classList.remove('selected'));
                preset.classList.add('selected');
                state.outfit = preset.dataset.outfit;

                // Show/hide custom input
                const isCustom = state.outfit === 'custom';
                elements.outfitCustom.classList.toggle('visible', isCustom);

                updateSummary();
                console.log('[V8] Outfit:', state.outfit);
            });
        });

        // Custom outfit input
        elements.customOutfitInput.addEventListener('input', (e) => {
            state.customOutfit = e.target.value;
            updateSummary();
        });

        // Color selection
        elements.outfitColors.forEach(colorBtn => {
            colorBtn.addEventListener('click', () => {
                elements.outfitColors.forEach(c => c.classList.remove('selected'));
                colorBtn.classList.add('selected');
                state.outfitColor = colorBtn.dataset.color;
                updateSummary();
                console.log('[V8] Outfit color:', state.outfitColor);
            });
        });
    }

    // ==========================================================================
    // GLASSY MODE
    // ==========================================================================

    function initGlassyMode() {
        const presets = elements.glassyPresets.querySelectorAll('.glassy-preset');

        // Preset buttons
        presets.forEach(preset => {
            preset.addEventListener('click', () => {
                const intensity = parseInt(preset.dataset.intensity);
                state.glassyIntensity = intensity;

                presets.forEach(p => p.classList.remove('selected'));
                preset.classList.add('selected');

                elements.glassyIntensitySlider.value = intensity;
                elements.glassyIntensityValue.textContent = `${intensity}%`;

                updateSummary();
                console.log('[V8] Glassy intensity:', state.glassyIntensity);
            });
        });

        // Slider
        elements.glassyIntensitySlider.addEventListener('input', (e) => {
            state.glassyIntensity = parseInt(e.target.value);
            elements.glassyIntensityValue.textContent = `${state.glassyIntensity}%`;

            // Update preset selection
            presets.forEach(p => {
                const presetIntensity = parseInt(p.dataset.intensity);
                p.classList.toggle('selected', presetIntensity === state.glassyIntensity);
            });

            updateSummary();
        });
    }

    // ==========================================================================
    // HEURISTICS OVERLAY
    // ==========================================================================

    function initHeuristics() {
        elements.heuristicsToggle.addEventListener('click', () => {
            state.showHeuristics = !state.showHeuristics;
            elements.heuristicsToggle.classList.toggle('active', state.showHeuristics);
            elements.heuristicsOverlay.classList.toggle('visible', state.showHeuristics);
        });
    }

    function updateHeuristicsDisplay(results) {
        if (!results) return;

        state.heuristics = results;

        // Update score
        const score = results.score || 0;
        elements.heuristicsScore.textContent = `${score}%`;
        elements.heuristicsScore.classList.remove('warning', 'error');
        if (score < 60) {
            elements.heuristicsScore.classList.add('error');
        } else if (score < 80) {
            elements.heuristicsScore.classList.add('warning');
        }

        // Update individual checks
        updateHeuristicItem('h-face', results.results?.faceDominant?.passed);
        updateHeuristicItem('h-text', results.results?.textReadable?.passed);
        updateHeuristicItem('h-contrast', results.results?.highContrast?.passed);
        updateHeuristicItem('h-separation', results.results?.subjectSeparated?.passed);
        updateHeuristicItem('h-logos', results.results?.logosLegible?.passed);
    }

    function updateHeuristicItem(id, passed) {
        const item = document.getElementById(id);
        if (!item) return;

        const icon = item.querySelector('.heuristics-item__icon');
        icon.classList.remove('pass', 'fail', 'warn');

        if (passed === true) {
            icon.classList.add('pass');
            icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        } else if (passed === false) {
            icon.classList.add('fail');
            icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
        } else {
            icon.classList.add('warn');
            icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
        }
    }

    // ==========================================================================
    // SAFE FRAME
    // ==========================================================================

    function initSafeFrame() {
        elements.safeFrameToggle.addEventListener('change', (e) => {
            state.showSafeFrame = e.target.checked;
            elements.safeFrameOverlay.classList.toggle('visible', state.showSafeFrame);
            console.log('[V8] Safe frame:', state.showSafeFrame);
        });
    }

    // ==========================================================================
    // NAVIGATION
    // ==========================================================================

    function initNavigation() {
        elements.btnNext.addEventListener('click', () => {
            if (state.currentStep < 5) {
                goToStep(state.currentStep + 1);
            } else {
                // Generate
                generateThumbnails();
            }
        });

        elements.btnBack.addEventListener('click', () => {
            if (state.currentStep > 1) {
                goToStep(state.currentStep - 1);
            }
        });

        elements.steps.forEach(step => {
            step.addEventListener('click', () => {
                const stepNum = parseInt(step.dataset.step);
                goToStep(stepNum);
            });
        });
    }

    function goToStep(stepNum) {
        state.currentStep = stepNum;

        // Update stepper
        elements.steps.forEach(step => {
            const num = parseInt(step.dataset.step);
            step.classList.toggle('step--active', num === stepNum);
        });

        // Update buttons
        elements.btnBack.disabled = stepNum === 1;
        elements.btnNext.textContent = stepNum === 5 ? 'Generate' : 'Continue';

        console.log('[V8] Step:', stepNum);
    }

    // ==========================================================================
    // GENERATION
    // ==========================================================================

    async function generateThumbnails() {
        if (state.isGenerating) return;

        state.isGenerating = true;
        elements.btnNext.disabled = true;
        elements.btnNext.textContent = 'Generating...';

        const payload = {
            brief: state.brief || 'Professional YouTube thumbnail',
            niche: state.niche,
            expression: state.expression,
            thumbnailText: state.thumbnailText,
            creatorStyle: state.creatorStyle,

            // V8 params
            subjectPosition: state.subjectPosition,
            subjectScale: state.subjectScale,
            textPosition: state.textAutoPosition ? 'auto' : state.textPosition,
            outfit: state.keepOriginalOutfit ? 'original' : state.outfit,
            customOutfit: state.customOutfit,
            outfitColor: state.outfitColor,
            keepOriginalOutfit: state.keepOriginalOutfit,
            glassyIntensity: state.glassyIntensity,

            // Use V8 pipeline
            useV8: true
        };

        console.log('[V8] Generating with payload:', payload);

        try {
            const response = await fetch('/api/thumbnails/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success && data.jobId) {
                state.jobId = data.jobId;
                pollJobStatus(data.jobId);
            } else {
                throw new Error(data.error || 'Generation failed');
            }

        } catch (error) {
            console.error('[V8] Generation error:', error);
            alert('Generation failed: ' + error.message);
            state.isGenerating = false;
            elements.btnNext.disabled = false;
            elements.btnNext.textContent = 'Generate';
        }
    }

    async function pollJobStatus(jobId) {
        const maxAttempts = 60;
        let attempts = 0;

        const poll = async () => {
            try {
                const response = await fetch(`/api/thumbnails/status/${jobId}`, {
                    headers: {
                        'Authorization': `Bearer ${getAuthToken()}`
                    }
                });

                const data = await response.json();

                if (data.status === 'completed') {
                    onGenerationComplete(data);
                    return;
                }

                if (data.status === 'failed') {
                    throw new Error(data.error || 'Generation failed');
                }

                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(poll, 2000);
                } else {
                    throw new Error('Generation timed out');
                }

            } catch (error) {
                console.error('[V8] Poll error:', error);
                state.isGenerating = false;
                elements.btnNext.disabled = false;
                elements.btnNext.textContent = 'Generate';
            }
        };

        poll();
    }

    function onGenerationComplete(data) {
        state.isGenerating = false;
        elements.btnNext.disabled = false;
        elements.btnNext.textContent = 'Generate';

        state.variants = data.variants || [];
        displayVariants(state.variants);

        // Update heuristics if available
        if (state.variants.length > 0 && state.variants[0].heuristics) {
            updateHeuristicsDisplay(state.variants[0].heuristics);
        }

        console.log('[V8] Generation complete:', state.variants.length, 'variants');
    }

    function displayVariants(variants) {
        if (!variants || variants.length === 0) {
            elements.variantStrip.innerHTML = '<div style="padding: var(--space-4); color: var(--color-text-tertiary); text-align: center; width: 100%;">No variants generated</div>';
            elements.variantCount.textContent = '0 variants';
            return;
        }

        elements.variantCount.textContent = `${variants.length} variants`;

        elements.variantStrip.innerHTML = variants.map((v, i) => `
            <div class="variant-card ${i === 0 ? 'active' : ''}" data-index="${i}" data-url="${v.url}">
                <img src="${v.url}" alt="Variant ${v.label}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
        `).join('');

        // Select first variant
        if (variants.length > 0) {
            selectVariant(0, variants[0].url);
        }

        // Add click handlers
        elements.variantStrip.querySelectorAll('.variant-card').forEach(card => {
            card.addEventListener('click', () => {
                const index = parseInt(card.dataset.index);
                const url = card.dataset.url;
                selectVariant(index, url);
            });
        });
    }

    function selectVariant(index, url) {
        state.selectedVariant = index;

        // Update UI
        elements.variantStrip.querySelectorAll('.variant-card').forEach((card, i) => {
            card.classList.toggle('active', i === index);
        });

        // Show in preview
        elements.previewPlaceholder.style.display = 'none';
        elements.previewImage.src = url;
        elements.previewImage.style.display = 'block';

        // Update heuristics if available
        if (state.variants[index] && state.variants[index].heuristics) {
            updateHeuristicsDisplay(state.variants[index].heuristics);
        }
    }

    // ==========================================================================
    // AUTH
    // ==========================================================================

    function getAuthToken() {
        return localStorage.getItem('tb_auth_token') || '';
    }

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================

    function init() {
        console.log('[V8] Initializing ThumbnailBuilder V8...');

        initSubjectPosition();
        initSubjectScale();
        initTextPosition();
        initOutfitControls();
        initGlassyMode();
        initHeuristics();
        initSafeFrame();
        initNavigation();

        updateSummary();

        console.log('[V8] Initialization complete');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
