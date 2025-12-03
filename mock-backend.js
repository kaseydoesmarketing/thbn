/**
 * MOCK BACKEND - For Prototype Verification Only
 * This script intercepts fetch calls to simulate a real backend.
 */

console.log('Mock Backend Initialized');

const MOCK_DELAY = 1500;

// Mock Data Store
const store = {
    jobs: {},
    faces: []
};

// Override fetch
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
    console.log(\`[MockAPI] \${options.method || 'GET'} \${url}\`, options.body);

    await new Promise(r => setTimeout(r, MOCK_DELAY));

    // 1. Upload Face
    if (url.includes('/api/faces') && options.method === 'POST') {
        return new Response(JSON.stringify({ success: true, id: 'face_' + Date.now() }));
    }

    // 2. Generate Thumbnails
    if (url.includes('/api/generate') && options.method === 'POST') {
        const jobId = 'job_' + Date.now();
        store.jobs[jobId] = { status: 'processing' };
        
        // Simulate background processing
        setTimeout(() => {
            store.jobs[jobId] = {
                status: 'completed',
                variants: [
                    { id: 'v1', label: 'v1', url: 'https://via.placeholder.com/1280x720/111/fff?text=Variant+1' },
                    { id: 'v2', label: 'v2', url: 'https://via.placeholder.com/1280x720/222/fff?text=Variant+2' },
                    { id: 'v3', label: 'v3', url: 'https://via.placeholder.com/1280x720/333/fff?text=Variant+3' },
                    { id: 'v4', label: 'v4', url: 'https://via.placeholder.com/1280x720/444/fff?text=Variant+4' }
                ]
            };
        }, 3000);

        return new Response(JSON.stringify({ success: true, jobId, status: 'processing' }));
    }

    // 3. Poll Job
    if (url.includes('/api/jobs/')) {
        const jobId = url.split('/').pop();
        const job = store.jobs[jobId] || { status: 'processing' };
        return new Response(JSON.stringify(job));
    }

    // Fallback to original fetch (for images etc)
    return originalFetch(url, options);
};
