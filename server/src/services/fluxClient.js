const axios = require('axios');

/**
 * Flux PuLID Client for Replicate
 * Generates images with face likeness preservation using FLUX + PuLID
 *
 * Model: zsxkib/flux-pulid (or bytedance/flux-pulid)
 * Cost: ~$0.03-0.05 per image
 *
 * Key advantage over Gemini: Generates images WITH the user's face
 * baked in, rather than generating a random face and swapping after.
 */
class FluxPulidClient {
    constructor() {
        this.apiToken = process.env.REPLICATE_API_TOKEN;
        this.baseUrl = 'https://api.replicate.com/v1';
        this.timeout = 180000; // 3 min timeout for generation

        // Model version - using zsxkib's flux-pulid
        // Alternative: bytedance/flux-pulid for official version
        this.modelVersion = process.env.FLUX_PULID_VERSION ||
            'zsxkib/flux-pulid:8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b';

        // Default generation settings optimized for YouTube thumbnails
        this.defaultSettings = {
            width: 1280,           // 16:9 for YouTube
            height: 720,
            num_steps: 20,         // Quality vs speed balance
            guidance_scale: 4,     // Text prompt influence
            id_weight: 1.2,        // Face likeness strength (0-3, higher = more similar)
            start_step: 0,         // 0-4 for highest fidelity
            true_cfg: 1,           // Use fake CFG for realism
            output_format: 'png',  // Best quality
            output_quality: 95
        };
    }

    /**
     * Check if the client is properly configured
     */
    isAvailable() {
        return !!this.apiToken;
    }

    /**
     * Generate thumbnail with face likeness
     * @param {Object} options
     * @param {string} options.faceImageUrl - Public URL to face reference image
     * @param {string} options.prompt - Generation prompt (from promptEngine)
     * @param {number} options.numVariants - Number of variants to generate (1-4)
     * @param {Object} options.settings - Optional override settings
     */
    async generateWithFace(options) {
        const { faceImageUrl, prompt, numVariants = 2, settings = {} } = options;

        if (!this.isAvailable()) {
            throw new Error('Flux PuLID client not configured. Set REPLICATE_API_TOKEN environment variable.');
        }

        if (!faceImageUrl) {
            throw new Error('Face image URL is required for face-preserving generation');
        }

        console.log('[FluxPuLID] Starting generation with face likeness preservation');
        console.log('[FluxPuLID] Face URL:', faceImageUrl.substring(0, 50) + '...');
        console.log('[FluxPuLID] Prompt:', prompt.substring(0, 100) + '...');

        const mergedSettings = { ...this.defaultSettings, ...settings };

        // Generate variants sequentially (Replicate doesn't support batch in single call)
        const variants = [];

        for (let i = 0; i < Math.min(numVariants, 4); i++) {
            console.log(`[FluxPuLID] Generating variant ${i + 1}/${numVariants}...`);

            try {
                // Add variation to prompt for diversity
                const variedPrompt = this.addVariation(prompt, i);

                const imageUrl = await this.createPrediction({
                    main_face_image: faceImageUrl,
                    prompt: variedPrompt,
                    negative_prompt: this.buildNegativePrompt(),
                    num_outputs: 1,
                    width: mergedSettings.width,
                    height: mergedSettings.height,
                    num_steps: mergedSettings.num_steps,
                    guidance_scale: mergedSettings.guidance_scale,
                    id_weight: mergedSettings.id_weight,
                    start_step: mergedSettings.start_step,
                    true_cfg: mergedSettings.true_cfg,
                    output_format: mergedSettings.output_format,
                    output_quality: mergedSettings.output_quality,
                    seed: settings.seed ? settings.seed + i : undefined
                });

                if (imageUrl) {
                    // Download the generated image
                    const imageData = await this.downloadImage(imageUrl);

                    variants.push({
                        variant_label: String.fromCharCode(65 + i), // A, B, C, D
                        image_data: imageData.data,
                        mime_type: imageData.mimeType,
                        source_url: imageUrl
                    });

                    console.log(`[FluxPuLID] Successfully generated variant ${String.fromCharCode(65 + i)}`);
                }
            } catch (variantError) {
                console.error(`[FluxPuLID] Variant ${i + 1} failed:`, variantError.message);
                // Continue with other variants
            }
        }

        if (variants.length === 0) {
            throw new Error('Failed to generate any image variants with Flux PuLID');
        }

        console.log(`[FluxPuLID] Successfully generated ${variants.length} variants`);

        return {
            status: 'completed',
            variants: variants
        };
    }

    /**
     * Generate without face (falls back to standard Flux)
     * Used when user doesn't provide a face image
     */
    async generateWithoutFace(options) {
        const { prompt, numVariants = 2, settings = {} } = options;

        console.log('[FluxPuLID] Generating without face (standard mode)');

        const mergedSettings = { ...this.defaultSettings, ...settings };
        const variants = [];

        for (let i = 0; i < Math.min(numVariants, 4); i++) {
            try {
                const variedPrompt = this.addVariation(prompt, i);

                // Use flux-schnell for faster generation without face
                const imageUrl = await this.createPrediction({
                    prompt: variedPrompt,
                    negative_prompt: this.buildNegativePrompt(),
                    num_outputs: 1,
                    width: mergedSettings.width,
                    height: mergedSettings.height,
                    num_steps: mergedSettings.num_steps,
                    guidance_scale: mergedSettings.guidance_scale,
                    output_format: mergedSettings.output_format,
                    output_quality: mergedSettings.output_quality
                }, 'black-forest-labs/flux-schnell'); // Use schnell for no-face generation

                if (imageUrl) {
                    const imageData = await this.downloadImage(imageUrl);
                    variants.push({
                        variant_label: String.fromCharCode(65 + i),
                        image_data: imageData.data,
                        mime_type: imageData.mimeType,
                        source_url: imageUrl
                    });
                }
            } catch (err) {
                console.error(`[FluxPuLID] No-face variant ${i + 1} failed:`, err.message);
            }
        }

        return { status: 'completed', variants };
    }

    /**
     * Create a prediction on Replicate
     */
    async createPrediction(input, modelOverride) {
        const model = modelOverride || this.modelVersion;

        const response = await axios.post(
            `${this.baseUrl}/predictions`,
            {
                version: model.includes(':') ? model.split(':')[1] : model,
                input: input
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30s for creating prediction
            }
        );

        const prediction = response.data;
        console.log(`[FluxPuLID] Prediction created: ${prediction.id}`);

        // Poll for completion
        return await this.waitForCompletion(prediction.id);
    }

    /**
     * Poll prediction until complete
     */
    async waitForCompletion(predictionId, maxAttempts = 90, interval = 2000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await axios.get(
                `${this.baseUrl}/predictions/${predictionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`
                    },
                    timeout: 10000
                }
            );

            const prediction = response.data;

            if (prediction.status === 'succeeded') {
                // Output is an array of URLs
                const output = prediction.output;
                if (Array.isArray(output) && output.length > 0) {
                    return output[0];
                }
                throw new Error('Prediction succeeded but no output URL');
            }

            if (prediction.status === 'failed') {
                throw new Error(`Prediction failed: ${prediction.error || 'Unknown error'}`);
            }

            if (prediction.status === 'canceled') {
                throw new Error('Prediction was canceled');
            }

            // Still processing, wait and retry
            await new Promise(resolve => setTimeout(resolve, interval));

            if (attempt % 10 === 0) {
                console.log(`[FluxPuLID] Still processing... (${attempt * interval / 1000}s)`);
            }
        }

        throw new Error('Prediction timed out after ' + (maxAttempts * interval / 1000) + ' seconds');
    }

    /**
     * Download image and convert to base64
     */
    async downloadImage(url) {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 60000
        });

        const buffer = Buffer.from(response.data);
        const base64 = buffer.toString('base64');

        // Detect mime type from URL or content-type
        let mimeType = 'image/png';
        const contentType = response.headers['content-type'];
        if (contentType) {
            mimeType = contentType.split(';')[0];
        } else if (url.includes('.jpg') || url.includes('.jpeg')) {
            mimeType = 'image/jpeg';
        } else if (url.includes('.webp')) {
            mimeType = 'image/webp';
        }

        return {
            data: base64,
            mimeType: mimeType,
            buffer: buffer
        };
    }

    /**
     * Add variation to prompt for diverse outputs
     */
    addVariation(basePrompt, variantIndex) {
        const variations = [
            '', // First variant uses base prompt
            ', different angle, unique composition',
            ', dramatic lighting variation, cinematic',
            ', vibrant color grading, high energy'
        ];

        return basePrompt + (variations[variantIndex] || '');
    }

    /**
     * Build negative prompt for quality control
     */
    buildNegativePrompt() {
        return [
            'blurry',
            'low quality',
            'pixelated',
            'watermark',
            'deformed',
            'ugly',
            'bad anatomy',
            'bad hands',
            'missing fingers',
            'extra fingers',
            'mutated',
            'poorly drawn face',
            'mutation',
            'deformed iris',
            'duplicate',
            'morbid',
            'mutilated',
            'disfigured',
            'text',
            'logo',
            'signature'
        ].join(', ');
    }
}

module.exports = new FluxPulidClient();
