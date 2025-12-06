/**
 * ============================================================================
 * ThumbnailBuilder v3.0 - Premium UI Application
 * ============================================================================
 *
 * A production-grade vanilla JavaScript application for the ThumbnailBuilder
 * create page with comprehensive state management, API integration, and
 * premium UX patterns.
 */

(function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        API_BASE: '/api',
        MIN_FACES: 3,
        MAX_FACES: 10,
        MAX_TEXT_LENGTH: 30,
        TEXT_WARNING_LENGTH: 20,
        POLL_INTERVAL: 1500,
        MAX_LOGOS: 3,
        TOAST_DURATION: 4000,
        DEFAULT_VARIANT_COUNT: 4
    };

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================

    const state = {
        // Navigation
        currentStep: 1,
        totalSteps: 5,

        // Face uploads
        uploadedFaces: [],
        faceUploadQueue: [],

        // Style selections
        niche: 'reaction',
        expression: 'excited',
        creatorStyle: 'auto',

        // Content
        brief: '',
        thumbnailText: '',
        logos: [],
        logoPosition: 'top-left',

        // Controls
        fontSize: 100,
        subjectScale: 100,
        subjectPosition: 'middle-center',
        textOutline: false,
        showSafeFrame: false,
        variantCount: CONFIG.DEFAULT_VARIANT_COUNT,

        // Generation
        isGenerating: false,
        generationProgress: 0,
        currentJobId: null,
        variants: [],
        selectedVariantIndex: 0,

        // Export
        selectedExportOption: 'full'
    };

    // =========================================================================
    // THUMBNAIL LOADING CONTROLLER — Cinematic Glass Loading State
    // =========================================================================

    const ThumbnailLoading = {
        // State: 'idle' | 'generating' | 'success' | 'error' | 'cancelled'
        state: 'idle',
        totalVariants: 4,
        currentStepIndex: 0,
        messageInterval: null,
        errorMessage: '',

        // Progress messages that rotate during generation
        PROGRESS_MESSAGES: [
            'Analyzing your prompt...',
            'Composing the scene...',
            'Generating your face...',
            'Rendering background...',
            'Adding text overlay...',
            'Polishing final image...'
        ],

        // Message rotation interval (ms)
        MESSAGE_INTERVAL: 3000,

        /**
         * Initialize the loading component
         */
        init() {
            if (!DOM.loadingCancel || !DOM.loadingRetry) return;

            // Cancel button
            DOM.loadingCancel.addEventListener('click', () => {
                this.cancel();
            });

            // Retry button
            DOM.loadingRetry.addEventListener('click', () => {
                this.hide();
                startGeneration();
            });
        },

        /**
         * Show loading state with given configuration
         * @param {Object} options - { totalVariants: number }
         */
        show(options = {}) {
            this.totalVariants = options.totalVariants || 4;
            this.state = 'generating';
            this.currentStepIndex = 0;

            // Reset to generating view
            DOM.loadingGenerating.style.display = 'flex';
            DOM.loadingSuccess.style.display = 'none';
            DOM.loadingError.style.display = 'none';
            DOM.thumbnailLoading.classList.remove('thumbnail-loading--error', 'thumbnail-loading--success', 'fade-out');

            // Render variant indicators
            this.renderVariantDots();

            // Reset progress
            if (DOM.loadingProgressFill) {
                DOM.loadingProgressFill.style.width = '0%';
            }

            // Start message rotation
            this.startMessageRotation();

            // Show the loading overlay
            DOM.thumbnailLoading.classList.add('active');

            // Announce to screen readers
            DOM.thumbnailLoading.setAttribute('aria-label', `Generating ${this.totalVariants} thumbnails`);
        },

        /**
         * Hide loading state with optional crossfade animation
         */
        hide(animate = true) {
            this.stopMessageRotation();
            this.state = 'idle';

            if (animate) {
                DOM.thumbnailLoading.classList.add('fade-out');
                // After animation, fully hide
                setTimeout(() => {
                    DOM.thumbnailLoading.classList.remove('active', 'fade-out');
                }, 300);
            } else {
                DOM.thumbnailLoading.classList.remove('active');
            }
        },

        /**
         * Update progress
         * @param {number} percent - 0-100
         * @param {number} completedVariants - Number of completed thumbnails
         */
        updateProgress(percent, completedVariants = 0) {
            if (DOM.loadingProgressFill) {
                DOM.loadingProgressFill.style.width = `${percent}%`;
            }

            // Update variant dots
            const dots = DOM.loadingVariants.querySelectorAll('.thumbnail-loading__variant-dot');
            dots.forEach((dot, index) => {
                if (index < completedVariants) {
                    dot.classList.remove('active');
                    dot.classList.add('completed');
                } else if (index === completedVariants) {
                    dot.classList.add('active');
                    dot.classList.remove('completed');
                } else {
                    dot.classList.remove('active', 'completed');
                }
            });
        },

        /**
         * Show success state before transitioning to thumbnails
         */
        showSuccess() {
            this.stopMessageRotation();
            this.state = 'success';

            // Switch to success view
            DOM.loadingGenerating.style.display = 'none';
            DOM.loadingError.style.display = 'none';
            DOM.loadingSuccess.style.display = 'flex';
            DOM.thumbnailLoading.classList.add('thumbnail-loading--success');

            // Mark all variant dots as completed
            const dots = DOM.loadingVariants.querySelectorAll('.thumbnail-loading__variant-dot');
            dots.forEach(dot => {
                dot.classList.remove('active');
                dot.classList.add('completed');
            });

            // After brief pause, fade out and reveal thumbnails
            setTimeout(() => {
                this.hide(true);
                // Add reveal animation to preview image
                if (DOM.previewImage) {
                    DOM.previewImage.classList.add('reveal');
                    setTimeout(() => {
                        DOM.previewImage.classList.remove('reveal');
                    }, 450);
                }
            }, 1200);
        },

        /**
         * Show error state
         * @param {string} message - Error message to display
         */
        showError(message = 'Something went wrong. Please try again.') {
            this.stopMessageRotation();
            this.state = 'error';
            this.errorMessage = message;

            // Switch to error view
            DOM.loadingGenerating.style.display = 'none';
            DOM.loadingSuccess.style.display = 'none';
            DOM.loadingError.style.display = 'flex';
            DOM.thumbnailLoading.classList.add('thumbnail-loading--error');

            // Update error message
            if (DOM.loadingErrorMessage) {
                DOM.loadingErrorMessage.textContent = message;
            }
        },

        /**
         * Cancel generation
         */
        cancel() {
            this.state = 'cancelled';
            this.stopMessageRotation();
            this.hide(false);

            // Cancel the job if we have one
            if (state.currentJobId) {
                fetch(`${CONFIG.API_BASE}/jobs/${state.currentJobId}/cancel`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                }).catch(err => console.warn('Cancel request failed:', err));
            }

            state.isGenerating = false;
            resetGenerationUI();
            showToast('Generation cancelled', 'warning');
        },

        /**
         * Render variant indicator dots
         */
        renderVariantDots() {
            if (!DOM.loadingVariants) return;

            const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
            let html = '';

            for (let i = 0; i < this.totalVariants; i++) {
                const isFirst = i === 0;
                html += `<div class="thumbnail-loading__variant-dot${isFirst ? ' active' : ''}">${labels[i] || i + 1}</div>`;
            }

            DOM.loadingVariants.innerHTML = html;
        },

        /**
         * Start rotating through progress messages
         */
        startMessageRotation() {
            if (!DOM.loadingMessages) return;

            const messages = DOM.loadingMessages.querySelectorAll('.thumbnail-loading__message');
            if (messages.length === 0) return;

            // Reset all messages
            messages.forEach((msg, idx) => {
                msg.classList.remove('active', 'exiting');
                if (idx === 0) msg.classList.add('active');
            });

            this.currentStepIndex = 0;

            // Rotate messages
            this.messageInterval = setInterval(() => {
                const messages = DOM.loadingMessages.querySelectorAll('.thumbnail-loading__message');
                const current = messages[this.currentStepIndex];
                const nextIndex = (this.currentStepIndex + 1) % messages.length;
                const next = messages[nextIndex];

                // Exit current
                current.classList.add('exiting');
                current.classList.remove('active');

                // Enter next
                setTimeout(() => {
                    current.classList.remove('exiting');
                    next.classList.add('active');
                }, 200);

                this.currentStepIndex = nextIndex;
            }, this.MESSAGE_INTERVAL);
        },

        /**
         * Stop message rotation
         */
        stopMessageRotation() {
            if (this.messageInterval) {
                clearInterval(this.messageInterval);
                this.messageInterval = null;
            }
        }
    };

    // =========================================================================
    // DOM REFERENCES
    // =========================================================================

    const DOM = {};

    function cacheDOMReferences() {
        // Navigation
        DOM.steps = document.querySelectorAll('.step');
        DOM.stepPanels = document.querySelectorAll('.step-panel');
        DOM.rightPanels = document.querySelectorAll('.right-panel-section');
        DOM.btnNext = document.getElementById('btn-next');
        DOM.btnBack = document.getElementById('btn-back');

        // Face upload
        DOM.uploadZone = document.getElementById('upload-zone');
        DOM.faceInput = document.getElementById('face-input');
        DOM.faceGallery = document.getElementById('face-gallery');
        DOM.faceCount = document.getElementById('face-count');
        DOM.faceCountBar = document.getElementById('face-count-bar');
        DOM.faceCountText = document.getElementById('face-count-text');

        // Style selections
        DOM.nicheGrid = document.getElementById('niche-grid');
        DOM.expressionGrid = document.getElementById('expression-grid');
        DOM.creatorGrid = document.getElementById('creator-grid');

        // Content inputs
        DOM.briefInput = document.getElementById('brief-input');
        DOM.thumbnailText = document.getElementById('thumbnail-text');
        DOM.textCounter = document.getElementById('text-counter');
        DOM.textWarning = document.getElementById('text-warning');
        DOM.textPreview = document.getElementById('text-preview');

        // Logo
        DOM.logoGallery = document.getElementById('logo-gallery');
        DOM.logoInput = document.getElementById('logo-input');
        DOM.addLogoBtn = document.getElementById('add-logo-btn');
        DOM.logoPositions = document.getElementById('logo-positions');

        // Controls
        DOM.fontSizeSlider = document.getElementById('font-size-slider');
        DOM.fontSizeValue = document.getElementById('font-size-value');
        DOM.subjectScaleSlider = document.getElementById('subject-scale-slider');
        DOM.subjectScaleValue = document.getElementById('subject-scale-value');
        DOM.subjectPositionGrid = document.getElementById('subject-position-grid');
        DOM.outlineToggle = document.getElementById('outline-toggle');
        DOM.safeFrameToggle = document.getElementById('safe-frame-toggle');
        DOM.safeFrameOverlay = document.getElementById('safe-frame-overlay');
        DOM.variantCountSlider = document.getElementById('variant-count-slider');
        DOM.variantCountValue = document.getElementById('variant-count-value');

        // Preview
        DOM.previewFrame = document.getElementById('preview-frame');
        DOM.previewPlaceholder = document.getElementById('preview-placeholder');
        DOM.previewImage = document.getElementById('preview-image');
        DOM.variantStrip = document.getElementById('variant-strip');
        DOM.variantCountDisplay = document.getElementById('variant-count');

        // Generation
        DOM.btnGenerate = document.getElementById('btn-generate');
        DOM.generateInitial = document.getElementById('generate-initial');
        DOM.generateProgress = document.getElementById('generate-progress');
        DOM.generateResults = document.getElementById('generate-results');
        DOM.progressStatus = document.getElementById('progress-status');
        DOM.progressSubstatus = document.getElementById('progress-substatus');
        DOM.progressFill = document.getElementById('progress-fill');

        // Export
        DOM.exportImage = document.getElementById('export-image');
        DOM.exportOptions = document.querySelectorAll('.export-option');
        DOM.btnDownload = document.getElementById('btn-download');

        // Summaries
        DOM.summaryNiche = document.getElementById('summary-niche');
        DOM.summaryExpression = document.getElementById('summary-expression');
        DOM.summaryCreator = document.getElementById('summary-creator');
        DOM.summaryFaces = document.getElementById('summary-faces');
        DOM.summaryStyle = document.getElementById('summary-style');
        DOM.summaryText = document.getElementById('summary-text');
        DOM.summaryVariant = document.getElementById('summary-variant');

        // Toast
        DOM.toastContainer = document.getElementById('toast-container');

        // Thumbnail Loading Component
        DOM.thumbnailLoading = document.getElementById('thumbnail-loading');
        DOM.loadingGenerating = document.getElementById('loading-generating');
        DOM.loadingSuccess = document.getElementById('loading-success');
        DOM.loadingError = document.getElementById('loading-error');
        DOM.loadingMessages = document.getElementById('loading-messages');
        DOM.loadingVariants = document.getElementById('loading-variants');
        DOM.loadingProgressFill = document.getElementById('loading-progress-fill');
        DOM.loadingCancel = document.getElementById('loading-cancel');
        DOM.loadingRetry = document.getElementById('loading-retry');
        DOM.loadingErrorMessage = document.getElementById('loading-error-message');
    }

    // =========================================================================
    // AUTHENTICATION
    // =========================================================================

    function checkAuth() {
        const token = localStorage.getItem('tb_token');
        if (!token) {
            window.location.href = '/login.html';
            return false;
        }
        return true;
    }

    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('tb_token')
        };
    }

    function handleAuthError(response) {
        if (response.status === 401) {
            localStorage.removeItem('tb_token');
            window.location.href = '/login.html';
            return true;
        }
        return false;
    }

    // =========================================================================
    // NAVIGATION
    // =========================================================================

    function updateNavigation() {
        // Update stepper
        DOM.steps.forEach(step => {
            const stepNum = parseInt(step.dataset.step, 10);
            step.classList.remove('step--active', 'step--completed');

            if (stepNum === state.currentStep) {
                step.classList.add('step--active');
            } else if (stepNum < state.currentStep) {
                step.classList.add('step--completed');
            }
        });

        // Update step panels
        DOM.stepPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `panel-step-${state.currentStep}`) {
                panel.classList.add('active');
            }
        });

        // Update right panels
        DOM.rightPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `right-panel-${state.currentStep}`) {
                panel.classList.add('active');
            }
        });

        // Update navigation buttons
        DOM.btnBack.disabled = state.currentStep === 1;

        updateNextButtonText();
        updateSummaries();
    }

    function updateNextButtonText() {
        const texts = {
            1: 'Save & Continue',
            2: 'Confirm Style',
            3: 'Continue to Generate',
            4: 'View Export Options',
            5: 'Finish'
        };

        DOM.btnNext.innerHTML = `
            ${texts[state.currentStep]}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        `;
    }

    function goToStep(step) {
        if (step < 1 || step > state.totalSteps) return;

        // Validation before moving forward
        if (step > state.currentStep) {
            if (!validateCurrentStep()) return;
        }

        state.currentStep = step;
        updateNavigation();

        // Scroll to top of content
        document.querySelector('.main-content').scrollTop = 0;
    }

    function validateCurrentStep() {
        switch (state.currentStep) {
            case 1:
                if (state.uploadedFaces.length < CONFIG.MIN_FACES) {
                    showToast(`Please upload at least ${CONFIG.MIN_FACES} face photos`, 'error');
                    return false;
                }
                return true;
            case 2:
                return true;
            case 3:
                return true;
            case 4:
                if (state.variants.length === 0) {
                    showToast('Please generate thumbnails first', 'error');
                    return false;
                }
                return true;
            default:
                return true;
        }
    }

    function initNavigation() {
        // Step buttons
        DOM.steps.forEach(step => {
            step.addEventListener('click', () => {
                const targetStep = parseInt(step.dataset.step, 10);
                if (targetStep <= state.currentStep || targetStep === state.currentStep + 1) {
                    goToStep(targetStep);
                }
            });
        });

        // Next button
        DOM.btnNext.addEventListener('click', () => {
            if (state.currentStep < state.totalSteps) {
                goToStep(state.currentStep + 1);
            } else {
                handleExport();
            }
        });

        // Back button
        DOM.btnBack.addEventListener('click', () => {
            if (state.currentStep > 1) {
                goToStep(state.currentStep - 1);
            }
        });
    }

    // =========================================================================
    // FACE UPLOAD
    // =========================================================================

    function initFaceUpload() {
        // Click to upload
        DOM.uploadZone.addEventListener('click', () => {
            DOM.faceInput.click();
        });

        // File input change
        DOM.faceInput.addEventListener('change', (e) => {
            handleFaceFiles(e.target.files);
            DOM.faceInput.value = '';
        });

        // Drag and drop
        DOM.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            DOM.uploadZone.classList.add('dragging');
        });

        DOM.uploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            DOM.uploadZone.classList.remove('dragging');
        });

        DOM.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            DOM.uploadZone.classList.remove('dragging');
            handleFaceFiles(e.dataTransfer.files);
        });

        // Load existing faces
        loadExistingFaces();
    }

    function handleFaceFiles(files) {
        if (state.uploadedFaces.length >= CONFIG.MAX_FACES) {
            showToast(`Maximum ${CONFIG.MAX_FACES} faces allowed`, 'error');
            return;
        }

        Array.from(files).forEach(file => {
            if (!file.type.startsWith('image/')) {
                showToast('Please upload only image files', 'error');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showToast('File size must be under 10MB', 'error');
                return;
            }

            if (state.uploadedFaces.length >= CONFIG.MAX_FACES) {
                return;
            }

            const previewId = generateId();

            // Show preview immediately
            const reader = new FileReader();
            reader.onload = (e) => {
                addFaceCard(e.target.result, 'uploading', previewId);
                uploadFace(file, previewId);
            };
            reader.readAsDataURL(file);
        });
    }

    function addFaceCard(src, status, id) {
        const card = document.createElement('div');
        card.className = 'face-card';
        card.id = `face-${id}`;
        card.innerHTML = `
            <img class="face-card__image" src="${escapeHtml(src)}" alt="Face photo">
            <span class="face-card__status face-card__status--${status}">
                ${status === 'uploading' ? 'Uploading...' : status === 'good' ? 'Good' : 'Error'}
            </span>
            <button class="face-card__remove" data-id="${id}" aria-label="Remove face">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        card.querySelector('.face-card__remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFace(id);
        });

        DOM.faceGallery.appendChild(card);
        updateFaceCount();
    }

    function updateFaceCard(id, status) {
        const card = document.getElementById(`face-${id}`);
        if (!card) return;

        const statusEl = card.querySelector('.face-card__status');
        statusEl.className = `face-card__status face-card__status--${status}`;
        statusEl.textContent = status === 'good' ? 'Good' : 'Error';
    }

    async function uploadFace(file, previewId) {
        const formData = new FormData();
        formData.append('face', file);

        try {
            const response = await fetch(`${CONFIG.API_BASE}/faces/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('tb_token')
                },
                body: formData
            });

            if (handleAuthError(response)) return;

            const data = await response.json();

            if (response.ok) {
                updateFaceCard(previewId, 'good');
                state.uploadedFaces.push({
                    id: data.face?.id || previewId,
                    url: data.face?.url || '',
                    previewId: previewId
                });
                updateFaceCount();
            } else {
                updateFaceCard(previewId, 'error');
                showToast(data.error || 'Upload failed', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            updateFaceCard(previewId, 'error');
            showToast('Upload failed', 'error');
        }
    }

    function removeFace(id) {
        const card = document.getElementById(`face-${id}`);
        if (card) {
            card.remove();
        }

        state.uploadedFaces = state.uploadedFaces.filter(f =>
            f.id !== id && f.previewId !== id
        );
        updateFaceCount();
    }

    function updateFaceCount() {
        const count = state.uploadedFaces.length;

        if (count > 0) {
            DOM.faceCount.style.display = 'flex';
        } else {
            DOM.faceCount.style.display = 'none';
        }

        const percentage = Math.min((count / CONFIG.MIN_FACES) * 100, 100);
        DOM.faceCountBar.style.width = `${percentage}%`;

        if (count >= CONFIG.MIN_FACES) {
            DOM.faceCountBar.classList.add('complete');
            DOM.faceCountText.textContent = `${count}/${CONFIG.MAX_FACES} photos`;
        } else {
            DOM.faceCountBar.classList.remove('complete');
            DOM.faceCountText.textContent = `${count}/${CONFIG.MIN_FACES} minimum`;
        }

        // Update summary
        if (DOM.summaryFaces) {
            DOM.summaryFaces.textContent = `${count} uploaded`;
        }
    }

    async function loadExistingFaces() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/faces`, {
                headers: getAuthHeaders()
            });

            if (handleAuthError(response)) return;

            if (response.ok) {
                const data = await response.json();
                if (data.profile && data.profile.images) {
                    data.profile.images.forEach(img => {
                        const id = img.id || generateId();
                        addFaceCard(img.url, 'good', id);
                        state.uploadedFaces.push({
                            id: img.id,
                            url: img.url,
                            previewId: id
                        });
                    });
                    updateFaceCount();
                }
            }
        } catch (error) {
            console.error('Error loading faces:', error);
        }
    }

    // =========================================================================
    // STYLE SELECTION
    // =========================================================================

    function initStyleSelection() {
        // Niche selection
        const nicheCards = DOM.nicheGrid.querySelectorAll('.niche-card');
        nicheCards.forEach(card => {
            card.addEventListener('click', () => {
                nicheCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.niche = card.dataset.niche;
                updateSummaries();
                updateColorPreview();
            });
        });

        // Expression selection
        const expressionCards = DOM.expressionGrid.querySelectorAll('.expression-card');
        expressionCards.forEach(card => {
            card.addEventListener('click', () => {
                expressionCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.expression = card.dataset.expression;
                updateSummaries();
            });
        });

        // Creator style selection
        const creatorCards = DOM.creatorGrid.querySelectorAll('.creator-card');
        creatorCards.forEach(card => {
            card.addEventListener('click', () => {
                creatorCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.creatorStyle = card.dataset.style;
                updateSummaries();
            });
        });
    }

    function updateColorPreview() {
        const colorSchemes = {
            reaction: ['#FF5500', '#1A1A24', '#FFD700'],
            gaming: ['#00FF88', '#0D0D15', '#FF00FF'],
            tech: ['#00D4FF', '#0A0A12', '#FFFFFF'],
            finance: ['#00D68F', '#0F0F18', '#FFD700'],
            fitness: ['#FF3D71', '#121218', '#FF8800'],
            beauty: ['#FF69B4', '#1A1018', '#FFB6C1'],
            cooking: ['#FF6B35', '#1A1412', '#FFD700'],
            travel: ['#4ECDC4', '#0F1418', '#FF6B6B'],
            tutorial: ['#9D00FF', '#0D0D18', '#00D4FF'],
            podcast: ['#FFB800', '#151510', '#FF5500']
        };

        const colors = colorSchemes[state.niche] || colorSchemes.reaction;
        const preview = document.getElementById('color-preview');
        if (preview) {
            preview.innerHTML = colors.map(c =>
                `<div class="color-preview__swatch" style="background: ${c};"></div>`
            ).join('');
        }
    }

    // =========================================================================
    // CONTENT & TEXT
    // =========================================================================

    function initContentInputs() {
        // Brief textarea
        DOM.briefInput.addEventListener('input', (e) => {
            state.brief = e.target.value;
        });

        // Scene chips
        document.querySelectorAll('#scene-chips .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const appendText = chip.dataset.append;
                if (state.brief) {
                    state.brief += ', ' + appendText;
                } else {
                    state.brief = appendText;
                }
                DOM.briefInput.value = state.brief;
            });
        });

        // Thumbnail text
        DOM.thumbnailText.addEventListener('input', (e) => {
            state.thumbnailText = e.target.value;
            updateTextCounter();
            updateTextPreview();
            updateSummaries();
        });

        // Logo upload
        DOM.addLogoBtn.addEventListener('click', () => {
            if (state.logos.length >= CONFIG.MAX_LOGOS) {
                showToast(`Maximum ${CONFIG.MAX_LOGOS} logos allowed`, 'error');
                return;
            }
            DOM.logoInput.click();
        });

        DOM.logoInput.addEventListener('change', (e) => {
            handleLogoFile(e.target.files[0]);
            DOM.logoInput.value = '';
        });

        // Logo position presets
        document.querySelectorAll('.position-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.position-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.logoPosition = btn.dataset.position;
            });
        });
    }

    function updateTextCounter() {
        const length = state.thumbnailText.length;
        DOM.textCounter.textContent = `${length}/${CONFIG.MAX_TEXT_LENGTH}`;

        // Warning states
        DOM.textCounter.classList.remove('warning', 'error');
        if (length > CONFIG.TEXT_WARNING_LENGTH) {
            DOM.textCounter.classList.add('warning');
            DOM.textWarning.style.display = 'flex';
        } else {
            DOM.textWarning.style.display = 'none';
        }

        if (length >= CONFIG.MAX_TEXT_LENGTH) {
            DOM.textCounter.classList.add('error');
        }
    }

    function updateTextPreview() {
        if (state.thumbnailText) {
            DOM.textPreview.textContent = state.thumbnailText;
            DOM.textPreview.classList.add('visible');
        } else {
            DOM.textPreview.classList.remove('visible');
        }
    }

    function handleLogoFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please upload an image file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const logoId = generateId();
            state.logos.push({
                id: logoId,
                src: e.target.result
            });
            renderLogos();
            DOM.logoPositions.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }

    function renderLogos() {
        // Clear existing logos (except add button)
        DOM.logoGallery.querySelectorAll('.logo-card:not(.logo-card--add)').forEach(el => el.remove());

        state.logos.forEach(logo => {
            const card = document.createElement('div');
            card.className = 'logo-card';
            card.innerHTML = `<img src="${escapeHtml(logo.src)}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain;">`;
            card.addEventListener('click', () => {
                state.logos = state.logos.filter(l => l.id !== logo.id);
                renderLogos();
                if (state.logos.length === 0) {
                    DOM.logoPositions.style.display = 'none';
                }
            });
            DOM.logoGallery.insertBefore(card, DOM.addLogoBtn);
        });

        // Hide add button if max reached
        DOM.addLogoBtn.style.display = state.logos.length >= CONFIG.MAX_LOGOS ? 'none' : 'flex';
    }

    // =========================================================================
    // CONTROLS (RIGHT PANEL)
    // =========================================================================

    function initControls() {
        // Font size slider
        DOM.fontSizeSlider.addEventListener('input', (e) => {
            state.fontSize = parseInt(e.target.value, 10);
            DOM.fontSizeValue.textContent = `${state.fontSize}%`;
            updateTextPreviewStyle();
        });

        // Subject scale slider
        DOM.subjectScaleSlider.addEventListener('input', (e) => {
            state.subjectScale = parseInt(e.target.value, 10);
            DOM.subjectScaleValue.textContent = `${state.subjectScale}%`;
        });

        // Subject position grid
        DOM.subjectPositionGrid.querySelectorAll('.position-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.subjectPositionGrid.querySelectorAll('.position-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.subjectPosition = btn.dataset.position;
            });
        });

        // Outline toggle
        DOM.outlineToggle.addEventListener('change', (e) => {
            state.textOutline = e.target.checked;
            updateTextPreviewStyle();
        });

        // Safe frame toggle
        DOM.safeFrameToggle.addEventListener('change', (e) => {
            state.showSafeFrame = e.target.checked;
            if (state.showSafeFrame) {
                DOM.safeFrameOverlay.classList.add('visible');
            } else {
                DOM.safeFrameOverlay.classList.remove('visible');
            }
        });

        // Variant count slider
        DOM.variantCountSlider.addEventListener('input', (e) => {
            state.variantCount = parseInt(e.target.value, 10);
            DOM.variantCountValue.textContent = state.variantCount;
        });
    }

    function updateTextPreviewStyle() {
        const scale = state.fontSize / 100;
        DOM.textPreview.style.fontSize = `${56 * scale}px`;

        if (state.textOutline) {
            DOM.textPreview.style.webkitTextStroke = '2px black';
        } else {
            DOM.textPreview.style.webkitTextStroke = 'none';
        }
    }

    // =========================================================================
    // GENERATION
    // =========================================================================

    function initGeneration() {
        DOM.btnGenerate.addEventListener('click', startGeneration);
    }

    async function startGeneration() {
        if (state.isGenerating) return;

        // Validation
        if (state.uploadedFaces.length < CONFIG.MIN_FACES) {
            showToast(`Please upload at least ${CONFIG.MIN_FACES} face photos`, 'error');
            goToStep(1);
            return;
        }

        state.isGenerating = true;
        state.generationProgress = 0;

        // Update UI
        DOM.generateInitial.style.display = 'none';
        DOM.generateProgress.style.display = 'block';
        DOM.generateResults.style.display = 'none';
        DOM.progressFill.style.width = '0%';

        // Show cinematic glass loading overlay
        ThumbnailLoading.show({ totalVariants: state.variantCount });

        const progressMessages = [
            'Analyzing your photos...',
            'Building scene composition...',
            'Generating variants...',
            'Applying final touches...'
        ];

        let messageIndex = 0;
        const messageInterval = setInterval(() => {
            if (messageIndex < progressMessages.length) {
                DOM.progressSubstatus.textContent = progressMessages[messageIndex];
                messageIndex++;
            }
        }, 2000);

        try {
            // Prepare payload
            const payload = {
                brief: state.brief || 'Professional YouTube thumbnail',
                niche: state.niche,
                expression: state.expression,
                thumbnailText: state.thumbnailText,
                faceImages: state.uploadedFaces.map(f => f.url || f.id),
                creatorStyle: state.creatorStyle,
                variantCount: state.variantCount,
                // Additional options
                fontSize: state.fontSize,
                subjectScale: state.subjectScale,
                subjectPosition: state.subjectPosition,
                textOutline: state.textOutline
            };

            console.log('[ThumbnailBuilder] Generating with:', payload);

            const response = await fetch(`${CONFIG.API_BASE}/generate`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });

            if (handleAuthError(response)) {
                clearInterval(messageInterval);
                return;
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Generation failed');
            }

            state.currentJobId = data.jobId;
            DOM.progressStatus.textContent = 'Processing...';

            // Poll for results
            await pollJobStatus(data.jobId, messageInterval);

        } catch (error) {
            console.error('Generation error:', error);
            clearInterval(messageInterval);
            // Show error in cinematic loading overlay instead of just toast
            ThumbnailLoading.showError(error.message || 'Generation failed');
            resetGenerationUI();
        }
    }

    async function pollJobStatus(jobId, messageInterval) {
        const poll = async () => {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/jobs/${jobId}`, {
                    headers: getAuthHeaders()
                });

                if (handleAuthError(response)) {
                    clearInterval(messageInterval);
                    return;
                }

                const job = await response.json();

                // Update progress
                if (job.progress) {
                    state.generationProgress = job.progress;
                    DOM.progressFill.style.width = `${job.progress}%`;
                    // Update cinematic loading progress
                    const completedVariants = Math.floor(job.progress / (100 / state.variantCount));
                    ThumbnailLoading.updateProgress(job.progress, completedVariants);
                }

                if (job.status === 'completed') {
                    clearInterval(messageInterval);
                    handleGenerationComplete(job.variants);
                } else if (job.status === 'failed') {
                    clearInterval(messageInterval);
                    throw new Error(job.error || 'Generation failed');
                } else {
                    // Continue polling
                    setTimeout(poll, CONFIG.POLL_INTERVAL);
                }
            } catch (error) {
                clearInterval(messageInterval);
                console.error('Poll error:', error);
                // Show error in cinematic loading overlay
                ThumbnailLoading.showError(error.message || 'Generation failed');
                resetGenerationUI();
            }
        };

        poll();
    }

    function handleGenerationComplete(variants) {
        state.isGenerating = false;
        state.variants = variants || [];
        state.selectedVariantIndex = 0;

        DOM.generateProgress.style.display = 'none';
        DOM.generateResults.style.display = 'grid';

        renderVariants();
        renderVariantStrip();
        updatePreview();

        // Show success state in cinematic loading overlay (will auto-fade)
        ThumbnailLoading.showSuccess();

        showToast('Thumbnails generated successfully!', 'success');
    }

    function resetGenerationUI() {
        state.isGenerating = false;
        DOM.generateInitial.style.display = 'block';
        DOM.generateProgress.style.display = 'none';
        DOM.generateResults.style.display = 'none';
    }

    function renderVariants() {
        DOM.generateResults.innerHTML = '';

        state.variants.forEach((variant, index) => {
            const card = document.createElement('div');
            card.className = `variant-preview-card ${index === state.selectedVariantIndex ? 'selected' : ''}`;
            card.innerHTML = `
                <img class="variant-preview-card__image" src="${escapeHtml(variant.url)}" alt="Variant ${variant.label || index + 1}">
                <div class="variant-preview-card__footer">
                    <span class="variant-preview-card__label">Variant ${variant.label || String.fromCharCode(65 + index)}</span>
                    <button class="variant-preview-card__star ${variant.favorited ? 'favorited' : ''}" data-index="${index}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${variant.favorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                </div>
            `;

            card.addEventListener('click', () => selectVariant(index));

            card.querySelector('.variant-preview-card__star').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(index);
            });

            DOM.generateResults.appendChild(card);
        });
    }

    function renderVariantStrip() {
        if (state.variants.length === 0) {
            DOM.variantStrip.innerHTML = `
                <div class="variant-strip__empty">
                    <svg class="variant-strip__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M12 8v8M8 12h8"/>
                    </svg>
                    <span class="variant-strip__empty-text">Variants will appear here after generation</span>
                </div>
            `;
            DOM.variantCountDisplay.textContent = '0 variants';
            return;
        }

        DOM.variantStrip.innerHTML = '';
        DOM.variantCountDisplay.textContent = `${state.variants.length} variants`;

        state.variants.forEach((variant, index) => {
            const card = document.createElement('div');
            card.className = `variant-card ${index === state.selectedVariantIndex ? 'active' : ''}`;
            card.innerHTML = `
                <img class="variant-card__image" src="${escapeHtml(variant.url)}" alt="Variant ${variant.label || index + 1}">
                <div class="variant-card__actions">
                    <button class="variant-card__star ${variant.favorited ? 'favorited' : ''}" data-index="${index}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="${variant.favorited ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </button>
                </div>
                <span class="variant-card__label">${variant.label || String.fromCharCode(65 + index)}</span>
            `;

            card.addEventListener('click', () => selectVariant(index));

            card.querySelector('.variant-card__star').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(index);
            });

            DOM.variantStrip.appendChild(card);
        });
    }

    function selectVariant(index) {
        state.selectedVariantIndex = index;

        // Update variant cards
        document.querySelectorAll('.variant-preview-card').forEach((card, i) => {
            card.classList.toggle('selected', i === index);
        });

        document.querySelectorAll('.variant-card').forEach((card, i) => {
            card.classList.toggle('active', i === index);
        });

        updatePreview();
        updateSummaries();
    }

    function toggleFavorite(index) {
        state.variants[index].favorited = !state.variants[index].favorited;
        renderVariants();
        renderVariantStrip();
    }

    function updatePreview() {
        if (state.variants.length > 0) {
            const variant = state.variants[state.selectedVariantIndex];
            DOM.previewImage.src = variant.url;
            DOM.previewImage.style.display = 'block';
            DOM.previewPlaceholder.style.display = 'none';

            // Update export image
            DOM.exportImage.src = variant.url;
        } else {
            DOM.previewImage.style.display = 'none';
            DOM.previewPlaceholder.style.display = 'flex';
        }
    }

    // =========================================================================
    // EXPORT
    // =========================================================================

    function initExport() {
        // Export option selection
        DOM.exportOptions.forEach(option => {
            option.addEventListener('click', () => {
                DOM.exportOptions.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                state.selectedExportOption = option.dataset.export;
            });
        });

        // Download button
        DOM.btnDownload.addEventListener('click', handleExport);
    }

    async function handleExport() {
        const variant = state.variants[state.selectedVariantIndex];

        if (!variant || !variant.url) {
            showToast('No thumbnail selected', 'error');
            return;
        }

        switch (state.selectedExportOption) {
            case 'full':
                await downloadThumbnail(variant, 'full');
                break;
            case 'optimized':
                await downloadThumbnail(variant, 'optimized');
                break;
            case 'titletester':
                exportToTitleTester(variant);
                break;
        }
    }

    async function downloadThumbnail(variant, quality) {
        DOM.btnDownload.disabled = true;
        DOM.btnDownload.innerHTML = `
            <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            Downloading...
        `;

        try {
            const response = await fetch(variant.url);
            if (!response.ok) throw new Error('Failed to fetch image');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `thumbnail_${variant.label || 'A'}_${quality}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showToast('Download started!', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('Download failed', 'error');
        } finally {
            DOM.btnDownload.disabled = false;
            DOM.btnDownload.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PNG
            `;
        }
    }

    function exportToTitleTester(variant) {
        // Placeholder for TitleTesterPro integration
        showToast('TitleTesterPro integration coming soon!', 'info');
    }

    // =========================================================================
    // SUMMARIES
    // =========================================================================

    function updateSummaries() {
        // Style summary
        if (DOM.summaryNiche) {
            DOM.summaryNiche.textContent = capitalize(state.niche);
        }
        if (DOM.summaryExpression) {
            DOM.summaryExpression.textContent = capitalize(state.expression);
        }
        if (DOM.summaryCreator) {
            DOM.summaryCreator.textContent = state.creatorStyle === 'auto' ? 'Auto' : capitalize(state.creatorStyle);
        }

        // Generation summary
        if (DOM.summaryStyle) {
            DOM.summaryStyle.textContent = capitalize(state.niche);
        }
        if (DOM.summaryText) {
            DOM.summaryText.textContent = state.thumbnailText || 'Not set';
        }

        // Export summary
        if (DOM.summaryVariant && state.variants.length > 0) {
            const variant = state.variants[state.selectedVariantIndex];
            DOM.summaryVariant.textContent = variant?.label || String.fromCharCode(65 + state.selectedVariantIndex);
        }
    }

    // =========================================================================
    // TOAST NOTIFICATIONS
    // =========================================================================

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;

        const icons = {
            success: '<polyline points="20 6 9 17 4 12"/>',
            error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
            info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
        };

        toast.innerHTML = `
            <svg class="toast__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icons[type] || icons.info}
            </svg>
            <span class="toast__message">${escapeHtml(message)}</span>
            <button class="toast__close" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        toast.querySelector('.toast__close').addEventListener('click', () => {
            toast.remove();
        });

        DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, CONFIG.TOAST_DURATION);
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    function init() {
        if (!checkAuth()) return;

        cacheDOMReferences();
        initNavigation();
        initFaceUpload();
        initStyleSelection();
        initContentInputs();
        initControls();
        initGeneration();
        initExport();
        ThumbnailLoading.init();

        updateNavigation();
        updateColorPreview();

        console.log('[ThumbnailBuilder v3] Initialized');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose state for debugging
    window.tbState = state;

})();
