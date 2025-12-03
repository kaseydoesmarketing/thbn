var axios = require('axios');
var config = require('../config/nano');

/**
 * Google Gemini Image Generation Client
 * "Nano Banana" is the community nickname for Gemini's image generation models
 * Uses gemini-2.0-flash-exp for image generation
 */
class GeminiImageClient {
    constructor() {
        this.apiKey = config.nanoBanana.apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.model = 'gemini-2.0-flash-exp'; // Supports image generation
        this.timeout = config.nanoBanana.timeout || 60000;
    }

    /**
     * Creates a thumbnail generation job using Gemini API
     * @param {Object} payload - The job payload
     * @param {string} payload.prompt - The text prompt
     * @param {string[]} payload.face_images - URLs of face reference images (for context)
     * @param {string} payload.style_preset - The style ID
     * @returns {Promise<Object>} The generation result with image URLs
     */
    async createThumbnailJob(payload) {
        try {
            var prompt = payload.prompt;
            var style = payload.style_preset || 'photorealistic';

            // Build enhanced prompt for YouTube thumbnail
            var enhancedPrompt = this.buildThumbnailPrompt(prompt, style);

            console.log('[Gemini] Generating image with prompt:', enhancedPrompt.substring(0, 100) + '...');

            // Generate multiple variants (with rate limit handling)
            var variants = [];
            var numVariants = 4;
            var delayBetweenRequests = 2000; // 2 seconds between requests to avoid rate limits

            for (var i = 0; i < numVariants; i++) {
                try {
                    // Add delay between requests to avoid rate limits
                    if (i > 0) {
                        await new Promise(function(resolve) { setTimeout(resolve, delayBetweenRequests); });
                    }

                    var imageData = await this.generateSingleImage(enhancedPrompt, i);
                    if (imageData) {
                        variants.push({
                            variant_label: String.fromCharCode(65 + i), // A, B, C, D
                            image_data: imageData.data,
                            mime_type: imageData.mimeType
                        });
                        console.log('[Gemini] Generated variant ' + String.fromCharCode(65 + i));
                    }
                } catch (variantError) {
                    console.error('[Gemini] Variant ' + i + ' failed:', variantError.message);
                    // If rate limited, wait longer before next attempt
                    if (variantError.message && variantError.message.includes('429')) {
                        console.log('[Gemini] Rate limited, waiting 10 seconds...');
                        await new Promise(function(resolve) { setTimeout(resolve, 10000); });
                    }
                }
            }

            if (variants.length === 0) {
                throw new Error('Failed to generate any image variants');
            }

            return {
                status: 'completed',
                variants: variants
            };

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Generate a single image using Gemini
     */
    async generateSingleImage(prompt, variantIndex) {
        var url = this.baseUrl + '/models/' + this.model + ':generateContent?key=' + this.apiKey;

        // Add slight variation to prompt for different results
        var variations = [
            '',
            ' with dramatic lighting',
            ' with vibrant colors',
            ' with high contrast'
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
            timeout: this.timeout,
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

        return null;
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

        var prompt = 'Create a YouTube thumbnail image: ' + userPrompt + '. ' +
            'Style: ' + styleText + '. ' +
            'Requirements: 16:9 aspect ratio, attention-grabbing, high quality, ' +
            'suitable for YouTube thumbnail at 1280x720 resolution, ' +
            'clear focal point, professional quality.';

        return prompt;
    }

    /**
     * Poll is not needed for Gemini - it returns results immediately
     * This method is kept for API compatibility
     */
    async pollJob(jobId) {
        // Gemini returns results synchronously, no polling needed
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
                throw new Error('Gemini API Key invalid or unauthorized');
            }
            if (status === 429) {
                throw new Error('Gemini API Rate Limit Exceeded');
            }
            if (status >= 500) {
                throw new Error('Gemini Service Unavailable');
            }

            throw new Error('Gemini API Error (' + status + '): ' + message);
        } else if (error.request) {
            throw new Error('Gemini Network Error: No response received');
        } else {
            throw new Error('Gemini Client Error: ' + error.message);
        }
    }
}

module.exports = new GeminiImageClient();
