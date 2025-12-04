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

    // State
    const state = {
        faceImages: [],
        videoUrl: '',
        style: '',
        brief: '',
        niche: '',
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
            if (content.id === \`step-\${currentStep}\`) {
                content.classList.add('active');
            }
        });

        // Update Right Panel
        panels.forEach(panel => {
            panel.classList.add('hidden');
            if (panel.id === \`panel-step-\${currentStep}\`) {
                panel.classList.remove('hidden');
            }
        });

        // Update Buttons
        btnBack.disabled = currentStep === 1;
        
        if (currentStep === totalSteps) {
            btnNext.textContent = 'Finish & Export';
        } else if (currentStep === 1) {
            btnNext.textContent = 'Save Face & Continue';
        } else if (currentStep === 2) {
            btnNext.textContent = 'Use This Video & Continue';
        } else if (currentStep === 3) {
            btnNext.textContent = 'Lock in Style & Continue';
        } else if (currentStep === 4) {
            btnNext.textContent = 'Generate Thumbnails';
        } else {
            btnNext.textContent = 'Continue';
        }
    }

    // --- API ACTIONS ---

    async function generateThumbnails() {
        btnNext.textContent = 'Generating...';
        btnNext.disabled = true;

        // Get brief from textarea
        const briefInput = document.querySelector('.brief-input');
        if (briefInput) {
            state.brief = briefInput.value;
        }

        // Get selected niche
        const activeNiche = document.querySelector('.niche-card.active');
        if (activeNiche) {
            state.niche = activeNiche.textContent.trim();
        }

        // Get selected style
        const activeStyle = document.querySelector('.style-card.active h4');
        if (activeStyle) {
            state.style = activeStyle.textContent.trim().toLowerCase().replace(' ', '-');
        }

        try {
            // 1. Start Job
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    brief: state.brief || 'Professional YouTube thumbnail',
                    niche: state.niche,
                    style: state.style || 'photorealistic',
                    videoUrl: state.videoUrl
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
            const res = await fetch(\`/api/jobs/\${jobId}\`);
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

    function renderThumbnails(variants) {
        const grid = document.querySelector('.thumbnails-grid');
        grid.innerHTML = variants.map(v => \`
            <div class="thumb-card">
                <img src="\${v.url}" style="width:100%; height:180px; object-fit:cover;">
                <div class="thumb-actions">
                    <span>\${v.label}</span>
                    <i class="far fa-star"></i>
                </div>
            </div>
        \`).join('');
    }

    // --- EVENT LISTENERS ---

    btnNext.addEventListener('click', async () => {
        if (currentStep === 4) {
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

    // Initialize
    updateUI();
});
