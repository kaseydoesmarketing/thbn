const axios = require('axios');
const config = require('../config/nano');

class NanoBananaClient {
    constructor() {
        this.client = axios.create({
            baseURL: config.nanoBanana.baseUrl,
            timeout: config.nanoBanana.timeout,
            headers: {
                'Authorization': 'Bearer ' + config.nanoBanana.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Creates a thumbnail generation job.
     * @param {Object} payload - The job payload.
     * @param {string} payload.prompt - The text prompt.
     * @param {string[]} payload.face_images - URLs of face reference images.
     * @param {string} payload.style_preset - The style ID.
     * @returns {Promise<Object>} The job response (containing job_id).
     */
    async createThumbnailJob(payload) {
        try {
            console.log('[NanoBanana] Creating job with payload:', JSON.stringify({ ...payload, face_images: '[HIDDEN]' }));
            const response = await this.client.post('/thumbnails/generate', {
                ...payload,
                output_size: '1280x720',
                num_variants: 4
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Polls a job until completion or failure.
     * @param {string} jobId - The job ID to poll.
     * @returns {Promise<Object>} The completed job result.
     */
    async pollJob(jobId) {
        const maxAttempts = 30;
        const interval = 2000; // 2 seconds

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await this.client.get('/jobs/' + jobId);
                const status = response.data.status;

                if (status === 'completed') {
                    return response.data;
                } else if (status === 'failed') {
                    throw new Error(response.data.error || 'Job failed');
                }

                // Wait before next poll
                await new Promise(function(resolve) { setTimeout(resolve, interval); });
            } catch (error) {
                // If it's a 5xx error, we might want to retry polling.
                // If it's 4xx (not found), we throw.
                if (error.response && error.response.status >= 500) {
                    console.warn('[NanoBanana] Transient error polling job, retrying...');
                } else {
                    throw error;
                }
            }
        }
        throw new Error('Job polling timed out');
    }

    handleError(error) {
        if (error.response) {
            // Server responded with a status code outside 2xx
            var status = error.response.status;
            var message = error.response.data?.message || error.message;

            if (status === 401) throw new Error('Nano Banana API Key invalid');
            if (status === 429) throw new Error('Nano Banana Rate Limit Exceeded');
            if (status >= 500) throw new Error('Nano Banana Service Unavailable');

            throw new Error('Nano Banana API Error (' + status + '): ' + message);
        } else if (error.request) {
            // Request was made but no response received
            throw new Error('Nano Banana Network Error: No response received');
        } else {
            throw new Error('Nano Banana Client Error: ' + error.message);
        }
    }
}

module.exports = new NanoBananaClient();
