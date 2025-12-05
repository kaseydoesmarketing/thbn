var axios = require('axios');
var config = require('../config/nano');

/**
 * Google Gemini Image Generation Client
 * "Nano Banana" is the community nickname for Gemini's image generation models
 *
 * Available Image Generation Models (Dec 2025):
 * - gemini-2.5-flash-image: Latest stable image gen model (RECOMMENDED)
 * - gemini-2.0-flash-preview-image-generation: Previous stable
 * - gemini-2.0-flash-exp: Experimental (confirmed working)
 * - gemini-3-pro-image-preview: Newest preview model
 *
 * Rate Limits (Free Tier): ~10-20 RPM, ~100 RPD
 * Rate Limits (Paid Tier): ~500 RPM, ~2000 RPD
 */
class GeminiImageClient {
    constructor() {
        this.apiKey = config.nanoBanana.apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

        // Primary model: gemini-2.5-flash-image (latest stable for image generation)
        // Fallback: gemini-2.0-flash-exp (confirmed working)
        // Set GEMINI_MODEL env var to override
        this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
        this.timeout = config.nanoBanana.timeout || 120000; // 2 min timeout for image gen

        // Fallback model if primary fails
        this.useFallback = false;
        this.fallbackModel = 'gemini-2.0-flash-exp';

        // Rate limiting for image models:
        // Free tier: ~10-20 RPM, ~100 RPD
        // Paid tier: ~500 RPM, ~2000 RPD
        // Using 4 second interval to stay safe (~15 RPM)
        this.requestQueue = [];
        this.lastRequestTime = 0;
        this.minRequestInterval = 4000; // 4 seconds between requests (~15 RPM safe)
    }

    /**
     * Wait for rate limit before making request
     */
    async waitForRateLimit() {
        var now = Date.now();
        var timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            var waitTime = this.minRequestInterval - timeSinceLastRequest;
            console.log('[Gemini] Rate limit: waiting ' + (waitTime / 1000) + 's before next request');
            await new Promise(function(resolve) { setTimeout(resolve, waitTime); });
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Exponential backoff retry wrapper
     */
    async withRetry(fn, maxAttempts, baseDelay) {
        maxAttempts = maxAttempts || 3;
        baseDelay = baseDelay || 1000;

        var lastError;

        for (var attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                var isRetryable = error.response &&
                    (error.response.status === 429 || error.response.status >= 500);

                if (!isRetryable || attempt === maxAttempts) {
                    throw error;
                }

                // Exponential backoff with jitter
                var delay = baseDelay * Math.pow(2, attempt - 1);
                var jitter = Math.random() * 1000;
                var totalDelay = delay + jitter;

                console.log('[Gemini] Request failed (attempt ' + attempt + '/' + maxAttempts + '), retrying in ' + Math.round(totalDelay / 1000) + 's...');
                await new Promise(function(resolve) { setTimeout(resolve, totalDelay); });
            }
        }

        throw lastError;
    }

    /**
     * Creates a thumbnail generation job using Gemini API
     * Generates fewer variants to stay within rate limits
     */
    async createThumbnailJob(payload) {
        try {
            var prompt = payload.prompt;
            var style = payload.style_preset || 'photorealistic';

            // Build enhanced prompt for YouTube thumbnail
            var enhancedPrompt = this.buildThumbnailPrompt(prompt, style);

            console.log('[Gemini] Generating thumbnails with prompt:', enhancedPrompt.substring(0, 100) + '...');

            // Generate 2 variants to conserve daily image quota
            // Free: ~100/day, Paid: ~2000/day
            var variants = [];
            var numVariants = 2;

            for (var i = 0; i < numVariants; i++) {
                try {
                    console.log('[Gemini] Generating variant ' + (i + 1) + '/' + numVariants + '...');

                    var imageData = await this.generateSingleImage(enhancedPrompt, i);
                    if (imageData) {
                        variants.push({
                            variant_label: String.fromCharCode(65 + i), // A, B
                            image_data: imageData.data,
                            mime_type: imageData.mimeType
                        });
                        console.log('[Gemini] Successfully generated variant ' + String.fromCharCode(65 + i));
                    }
                } catch (variantError) {
                    console.error('[Gemini] Variant ' + (i + 1) + ' failed:', variantError.message);
                }
            }

            if (variants.length === 0) {
                throw new Error('Failed to generate any image variants. The API may be rate limited - please try again in a few minutes.');
            }

            console.log('[Gemini] Successfully generated ' + variants.length + ' variants');

            return {
                status: 'completed',
                variants: variants
            };

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Generate a single image using Gemini with rate limiting and retry
     * Automatically falls back to secondary model if primary fails with 400
     */
    async generateSingleImage(prompt, variantIndex) {
        var self = this;
        var currentModel = this.useFallback ? this.fallbackModel : this.model;

        try {
            return await this._generateWithModel(currentModel, prompt, variantIndex);
        } catch (error) {
            // If primary model fails with 400 (model not found), try fallback
            if (!this.useFallback && error.response && error.response.status === 400) {
                console.log('[Gemini] Primary model failed, switching to fallback: ' + this.fallbackModel);
                this.useFallback = true;
                return await this._generateWithModel(this.fallbackModel, prompt, variantIndex);
            }
            throw error;
        }
    }

    /**
     * Internal: Generate image with specific model
     */
    async _generateWithModel(modelName, prompt, variantIndex) {
        var self = this;

        return await this.withRetry(async function() {
            // Wait for rate limit
            await self.waitForRateLimit();

            var url = self.baseUrl + '/models/' + modelName + ':generateContent?key=' + self.apiKey;
            console.log('[Gemini] Using model: ' + modelName);

            // Add slight variation to prompt for different results
            var variations = [
                '',
                ', with a different composition and angle',
                ', with dramatic lighting',
                ', with vibrant colors'
            ];
            var variedPrompt = prompt + (variations[variantIndex] || '');

            var requestBody = {
                contents: [{
                    parts: [{
                        text: variedPrompt
                    }]
                }],
                generationConfig: {
                    responseModalities: ['image', 'text'],
                    responseMimeType: 'text/plain'
                }
            };

            var response = await axios.post(url, requestBody, {
                timeout: self.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Extract image from response
            var candidates = response.data.candidates || [];
            if (candidates.length > 0) {
                var parts = candidates[0].content?.parts || [];
                for (var j = 0; j < parts.length; j++) {
                    var part = parts[j];
                    if (part.inlineData) {
                        return {
                            data: part.inlineData.data,
                            mimeType: part.inlineData.mimeType || 'image/png'
                        };
                    }
                }
            }

            console.log('[Gemini] No image in response, got text instead');
            return null;
        }, 3, 5000); // 3 attempts, 5 second base delay
    }

    /**
     * Build an optimized prompt for YouTube thumbnails
     */
    buildThumbnailPrompt(userPrompt, style) {
        var styleModifiers = {
            'cinematic': 'cinematic lighting, dramatic shadows, movie poster quality',
            'vibrant': 'vibrant saturated colors, high energy, eye-catching',
            'minimal': 'clean minimalist design, simple composition, bold elements',
            'dramatic': 'intense dramatic lighting, high contrast, powerful composition',
            'photorealistic': 'photorealistic, ultra detailed, professional photography',
            'cartoon': 'cartoon style, bold outlines, colorful illustration',
            'gaming': 'gaming aesthetic, neon colors, dynamic action pose'
        };

        var styleText = styleModifiers[style] || styleModifiers['photorealistic'];

        var prompt = 'Generate a high-quality YouTube thumbnail image. ' +
            'Content: ' + userPrompt + '. ' +
            'Style: ' + styleText + '. ' +
            'Requirements: 16:9 aspect ratio (1280x720), attention-grabbing, ' +
            'professional quality, clear focal point, suitable for YouTube.';

        return prompt;
    }

    /**
     * Poll is not needed for Gemini - it returns results immediately
     */
    async pollJob(jobId) {
        return { status: 'completed' };
    }

    handleError(error) {
        if (error.response) {
            var status = error.response.status;
            var message = error.response.data?.error?.message || error.message;

            if (status === 400) {
                throw new Error('Gemini API Bad Request: ' + message);
            }
            if (status === 401 || status === 403) {
                throw new Error('Gemini API Key invalid or unauthorized. Please check your API key.');
            }
            if (status === 429) {
                throw new Error('Gemini API Rate Limit Exceeded. Please wait a minute and try again, or upgrade to a paid tier.');
            }
            if (status >= 500) {
                throw new Error('Gemini Service Unavailable. Please try again later.');
            }

            throw new Error('Gemini API Error (' + status + '): ' + message);
        } else if (error.request) {
            throw new Error('Gemini Network Error: Could not connect to API');
        } else {
            throw new Error('Gemini Client Error: ' + error.message);
        }
    }
}

module.exports = new GeminiImageClient();
