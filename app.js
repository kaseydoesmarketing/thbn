document.addEventListener('DOMContentLoaded', () => {
    // Auth check - redirect to login if no token
    const token = localStorage.getItem('tb_token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    const steps = document.querySelectorAll('.step-item');
    const contents = document.querySelectorAll('.step-content');
    const panels = document.querySelectorAll('.panel-content');
    const btnNext = document.getElementById('btn-next');
    const btnBack = document.getElementById('btn-back');

    let currentStep = 1;
    const totalSteps = steps.length;
    let currentJobId = null;

    // Auth helper
    function authHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('tb_token')
        };
    }

    // State - v2.0: Added expression and thumbnailText
    const state = {
        faceImages: [],
        brief: '',
        niche: 'reaction',
        expression: 'excited',
        thumbnailText: '',
        variants: []
    };

    function updateUI() {
        // Update Stepper
        steps.forEach(step => {
            const stepNum = parseInt(step.dataset.step);
            if (stepNum === currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // Update Content
        contents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `step-${currentStep}`) {
                content.classList.add('active');
            }
        });

        // Update Right Panel
        panels.forEach(panel => {
            panel.classList.add('hidden');
            if (panel.id === `panel-step-${currentStep}`) {
                panel.classList.remove('hidden');
            }
        });

        // Update Buttons - v2.0: 5 steps (Face → Style → Brief → Thumbnails → Export)
        btnBack.disabled = currentStep === 1;

        if (currentStep === totalSteps) {
            btnNext.textContent = 'Finish & Export';
        } else if (currentStep === 1) {
            btnNext.textContent = 'Save Face & Continue';
        } else if (currentStep === 2) {
            btnNext.textContent = 'Confirm Style & Continue';
        } else if (currentStep === 3) {
            btnNext.textContent = 'Generate Thumbnails';
        } else if (currentStep === 4) {
            btnNext.textContent = 'Export Selected';
        } else {
            btnNext.textContent = 'Continue';
        }
    }

    // --- API ACTIONS ---

    async function generateThumbnails() {
        btnNext.textContent = 'Generating...';
        btnNext.disabled = true;

        // v2.0: Collect all inputs from the new UI

        // Get brief from textarea
        const briefInput = document.getElementById('brief-input');
        if (briefInput) {
            state.brief = briefInput.value;
        }

        // Get thumbnail text
        const thumbnailTextInput = document.getElementById('thumbnail-text');
        if (thumbnailTextInput) {
            state.thumbnailText = thumbnailTextInput.value;
        }

        // Get selected niche (from data-niche attribute)
        const activeNiche = document.querySelector('.niche-card.active');
        if (activeNiche && activeNiche.dataset.niche) {
            state.niche = activeNiche.dataset.niche;
        }

        // Get selected expression (from data-expression attribute)
        const activeExpression = document.querySelector('.expression-card.active');
        if (activeExpression && activeExpression.dataset.expression) {
            state.expression = activeExpression.dataset.expression;
        }

        // Get face images from window.uploadedFaces if available
        if (window.uploadedFaces && window.uploadedFaces.length > 0) {
            state.faceImages = window.uploadedFaces.map(f => f.url || f.id);
        }

        console.log('[ThumbnailBuilder] Generating with:', {
            brief: state.brief,
            niche: state.niche,
            expression: state.expression,
            thumbnailText: state.thumbnailText,
            faceCount: state.faceImages.length
        });

        try {
            // 1. Start Job - v2.0 API with new fields
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    brief: state.brief || 'Professional YouTube thumbnail',
                    niche: state.niche || 'reaction',
                    expression: state.expression || 'excited',
                    thumbnailText: state.thumbnailText || '',
                    faceImages: state.faceImages
                })
            });

            if (res.status === 401) {
                localStorage.removeItem('tb_token');
                window.location.href = '/login.html';
                return;
            }

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Generation failed');
            }

            currentJobId = data.jobId;

            // 2. Poll
            await pollJob(currentJobId);

        } catch (err) {
            alert('Generation failed: ' + err.message);
            btnNext.disabled = false;
            btnNext.textContent = 'Generate Thumbnails';
        }
    }

    async function pollJob(jobId) {
        const interval = setInterval(async () => {
            const res = await fetch(`/api/jobs/${jobId}`, {
                headers: authHeaders()
            });
            const job = await res.json();

            if (job.status === 'completed') {
                clearInterval(interval);
                state.variants = job.variants;
                renderThumbnails(job.variants);
                currentStep++;
                updateUI();
                btnNext.disabled = false;
            } else if (job.status === 'failed') {
                clearInterval(interval);
                alert('Job failed');
                btnNext.disabled = false;
            }
        }, 1000);
    }

    // XSS prevention: escape HTML
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function renderThumbnails(variants) {
        const grid = document.querySelector('.thumbnails-grid');
        grid.innerHTML = ''; // Clear existing content

        variants.forEach(v => {
            const card = document.createElement('div');
            card.className = 'thumb-card';

            const img = document.createElement('img');
            img.src = v.url;
            img.style.cssText = 'width:100%; height:180px; object-fit:cover;';
            img.alt = 'Generated thumbnail';

            const actions = document.createElement('div');
            actions.className = 'thumb-actions';

            const label = document.createElement('span');
            label.textContent = v.label || 'Variant';

            const star = document.createElement('i');
            star.className = 'far fa-star';

            actions.appendChild(label);
            actions.appendChild(star);
            card.appendChild(img);
            card.appendChild(actions);
            grid.appendChild(card);
        });

        // Also populate export grid for step 5
        renderExportVariants();
    }

    // --- EVENT LISTENERS ---

    btnNext.addEventListener('click', async () => {
        // v2.0: Generation triggers on step 3 (Brief step)
        if (currentStep === 3) {
            // Generate Trigger
            await generateThumbnails();
        } else if (currentStep < totalSteps) {
            currentStep++;
            updateUI();
        }
    });

    btnBack.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateUI();
        }
    });

    // --- EXPORT FUNCTIONALITY ---

    let selectedVariantIndex = 0; // Track which variant is selected for export

    // Download PNG button handler
    function setupExportButtons() {
        const downloadBtn = document.getElementById('btn-download-png');
        const testBtn = document.getElementById('btn-export-tester');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadSelectedThumbnail);
        }

        if (testBtn) {
            testBtn.addEventListener('click', exportToTitleTester);
        }
    }

    function renderExportVariants() {
        const grid = document.getElementById('export-thumbnails-grid');
        if (!grid || !state.variants.length) return;

        grid.innerHTML = '';

        state.variants.forEach((v, index) => {
            const card = document.createElement('div');
            card.className = 'export-thumb-card' + (index === selectedVariantIndex ? ' selected' : '');
            card.dataset.index = index;

            const img = document.createElement('img');
            img.src = v.url;
            img.alt = `Variant ${v.label || index + 1}`;

            const label = document.createElement('div');
            label.className = 'export-thumb-label';
            label.textContent = v.label || `Variant ${index + 1}`;

            card.appendChild(img);
            card.appendChild(label);

            card.addEventListener('click', () => {
                selectedVariantIndex = index;
                // Update selection UI
                document.querySelectorAll('.export-thumb-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });

            grid.appendChild(card);
        });
    }

    async function downloadSelectedThumbnail() {
        const variant = state.variants[selectedVariantIndex];

        if (!variant || !variant.url) {
            alert('No thumbnail available to download. Please generate thumbnails first.');
            return;
        }

        const downloadBtn = document.getElementById('btn-download-png');
        if (downloadBtn) {
            downloadBtn.textContent = 'Downloading...';
            downloadBtn.disabled = true;
        }

        try {
            // Fetch the image as blob
            const response = await fetch(variant.url);
            if (!response.ok) throw new Error('Failed to fetch image');

            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `thumbnail_${variant.label || 'A'}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            console.log('[ThumbnailBuilder] Downloaded thumbnail:', variant.label);
        } catch (err) {
            console.error('[ThumbnailBuilder] Download failed:', err);
            alert('Download failed: ' + err.message);
        } finally {
            if (downloadBtn) {
                downloadBtn.textContent = 'Download PNG';
                downloadBtn.disabled = false;
            }
        }
    }

    function exportToTitleTester() {
        // Placeholder for Title Tester Pro integration
        alert('Title Tester Pro integration coming soon!');
    }

    // Update renderThumbnails to also populate export grid
    const originalRenderThumbnails = renderThumbnails;

    // Initialize
    setupExportButtons();
    updateUI();
});
