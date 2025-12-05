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
     * @param {Object} payload - { prompt, style_preset, faceImages, useRawPrompt }
     * @param {Array} payload.faceImages - Optional array of {data: base64, mimeType: string}
     * @param {boolean} payload.useRawPrompt - If true, use prompt directly without wrapping (for promptEngine prompts)
     */
    async createThumbnailJob(payload) {
        try {
            var prompt = payload.prompt;
            var style = payload.style_preset || 'photorealistic';
            var faceImages = payload.faceImages || [];
            var useRawPrompt = payload.useRawPrompt !== false; // Default to TRUE - trust promptEngine

            // Use prompt directly if it's already professionally crafted (from promptEngine)
            // Only wrap if explicitly requested (legacy/simple prompts)
            var enhancedPrompt;
            if (useRawPrompt && prompt.length > 200) {
                // Prompt is already detailed from promptEngine - use it directly
                enhancedPrompt = prompt;
                console.log('[Gemini] Using RAW prompt from promptEngine (no wrapping)');
            } else {
                // Simple prompt - wrap it for better results
                enhancedPrompt = this.buildThumbnailPrompt(prompt, style, faceImages.length > 0);
                console.log('[Gemini] Wrapped simple prompt with quality modifiers');
            }

            console.log('[Gemini] Generating thumbnails with prompt:', enhancedPrompt.substring(0, 150) + '...');
            console.log('[Gemini] Prompt length:', enhancedPrompt.length, 'chars');
            if (faceImages.length > 0) {
                console.log('[Gemini] Including ' + faceImages.length + ' face reference images');
            }

            // Generate 2 variants to conserve daily image quota
            // Free: ~100/day, Paid: ~2000/day
            var variants = [];
            var numVariants = 2;

            for (var i = 0; i < numVariants; i++) {
                try {
                    console.log('[Gemini] Generating variant ' + (i + 1) + '/' + numVariants + '...');

                    var imageData = await this.generateSingleImage(enhancedPrompt, i, faceImages);
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
     * @param {string} prompt - Text prompt for generation
     * @param {number} variantIndex - Variant index for prompt variation
     * @param {Array} faceImages - Optional array of {data: base64, mimeType: string}
     */
    async generateSingleImage(prompt, variantIndex, faceImages) {
        var self = this;
        var currentModel = this.useFallback ? this.fallbackModel : this.model;
        faceImages = faceImages || [];

        try {
            return await this._generateWithModel(currentModel, prompt, variantIndex, faceImages);
        } catch (error) {
            // If primary model fails with 400 (model not found), try fallback
            if (!this.useFallback && error.response && error.response.status === 400) {
                console.log('[Gemini] Primary model failed, switching to fallback: ' + this.fallbackModel);
                this.useFallback = true;
                return await this._generateWithModel(this.fallbackModel, prompt, variantIndex, faceImages);
            }
            throw error;
        }
    }

    /**
     * Internal: Generate image with specific model
     * Supports multimodal input with face reference images
     * @param {string} modelName - Gemini model name
     * @param {string} prompt - Text prompt
     * @param {number} variantIndex - Variant index
     * @param {Array} faceImages - Array of {data: base64, mimeType: string}
     */
    async _generateWithModel(modelName, prompt, variantIndex, faceImages) {
        var self = this;
        faceImages = faceImages || [];

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

            // Build request parts - text prompt first, then any face images
            var parts = [{
                text: variedPrompt
            }];

            // Add face reference images as inline data
            if (faceImages.length > 0) {
                console.log('[Gemini] Adding ' + faceImages.length + ' face reference images to request');
                for (var i = 0; i < faceImages.length; i++) {
                    var faceImage = faceImages[i];
                    parts.push({
                        inlineData: {
                            mimeType: faceImage.mimeType,
                            data: faceImage.data
                        }
                    });
                }
            }

            var requestBody = {
                contents: [{
                    parts: parts
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
                },
                maxContentLength: 50 * 1024 * 1024, // 50MB max for multimodal
                maxBodyLength: 50 * 1024 * 1024
            });

            // Extract image from response
            var candidates = response.data.candidates || [];
            if (candidates.length > 0) {
                var responseParts = candidates[0].content?.parts || [];
                for (var j = 0; j < responseParts.length; j++) {
                    var part = responseParts[j];
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
     * @param {string} userPrompt - User's content description
     * @param {string} style - Style preset name
     * @param {boolean} hasFaceImages - Whether face reference images are included
     */
    buildThumbnailPrompt(userPrompt, style, hasFaceImages) {
        // Enhanced style modifiers with pro design elements
        var styleModifiers = {
            'cinematic': 'cinematic lighting, dramatic shadows, movie poster quality, high contrast',
            'vibrant': 'vibrant saturated colors, high energy, eye-catching, bold composition',
            'minimal': 'clean minimalist design, simple composition, bold elements, negative space',
            'dramatic': 'intense dramatic lighting, high contrast, powerful composition, rim lighting',
            'photorealistic': 'photorealistic, ultra detailed, professional photography, studio quality',
            'cartoon': 'cartoon style, bold outlines, colorful illustration, clean edges',
            'gaming': 'gaming aesthetic, neon cyan and magenta colors, dark background, edge glow, cyberpunk style',
            'modern': 'modern clean design, professional, high quality, subtle gradient background',
            'reaction': 'dramatic rim lighting, dark background, high contrast, face prominently featured, edge glow',
            'finance': 'professional lighting, dark blue/black gradient, gold and green accents, wealth aesthetic',
            'tech': 'clean studio lighting, minimalist dark background, red accents, MKBHD style',
            'fitness': 'dramatic side lighting, intense shadows, red/orange energy, powerful'
        };

        var styleText = styleModifiers[style] || styleModifiers['photorealistic'];

        // Get niche-specific glow color
        var glowColors = {
            'gaming': 'cyan/electric blue',
            'finance': 'gold/money green',
            'tech': 'white/silver',
            'fitness': 'red/orange',
            'reaction': 'bright yellow/white'
        };
        var glowColor = glowColors[style] || 'white/bright';

        var prompt = 'Generate a PROFESSIONAL YouTube thumbnail image. ' +
            'Content: ' + userPrompt + '. ' +
            'Style: ' + styleText + '. ';

        // Add PRO face compositing instructions if face images are provided
        if (hasFaceImages) {
            prompt += 'CRITICAL PROFESSIONAL DESIGN INSTRUCTIONS: ' +
                '1. COMPOSITE the person from the provided face photo - use their ACTUAL face exactly as shown, do NOT regenerate or modify it. ' +
                '2. CUT OUT EFFECT: The person must appear cleanly cut out with a crisp, professional edge - like a Photoshop cutout. ' +
                '3. COLORED STROKE/BORDER: Add a visible ' + glowColor + ' colored stroke/outline around the ENTIRE person creating a "sticker effect" that separates them dramatically from the background. ' +
                '4. OUTER GLOW: Add a soft ' + glowColor + ' outer glow/halo behind the person to make them pop off the background. ' +
                '5. PLACEMENT: Position person on the LEFT side, filling 35-45% of frame width. Face at eye-level. ' +
                '6. LIGHTING: Add rim lighting on person edges matching the ' + glowColor + ' glow color. ' +
                '7. TEXT SPACE: Keep the RIGHT 40-50% of frame clean for text overlay. ' +
                '8. The face features, skin tone, expression must be EXACTLY from the photo provided. ';
        }

        prompt += 'PROFESSIONAL REQUIREMENTS: ' +
            '16:9 aspect ratio (1280x720), ' +
            'HIGH CONTRAST that pops on YouTube white interface, ' +
            'works at small mobile thumbnail size, ' +
            'clean subject/background separation, ' +
            'dramatic professional lighting, ' +
            'viral thumbnail aesthetic, ' +
            'sharp focus, ultra high quality.';

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
