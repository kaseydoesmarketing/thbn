var axios = require('axios');

/**
 * Replicate Face Swap Client
 * Uses Easel AI's advanced-face-swap model for commercial-grade face swapping
 *
 * Two-step pipeline:
 * 1. Gemini 2.5 generates creative thumbnail with placeholder person
 * 2. This client swaps user's face onto the generated person
 *
 * Pricing: ~$0.04 per swap (25 for $1)
 */
class FaceSwapClient {
    constructor() {
        this.apiToken = process.env.REPLICATE_API_TOKEN;
        this.baseUrl = 'https://api.replicate.com/v1';
        this.modelVersion = '602d8c526aca9e5081f0515649ff8998e058cf7e6b9ff32717d25327f18c5145';
        this.timeout = 120000; // 2 min timeout for face swap

        if (!this.apiToken) {
            console.warn('[FaceSwap] WARNING: REPLICATE_API_TOKEN not set - face swap will be disabled');
        }
    }

    /**
     * Check if face swap is available (API token configured)
     */
    isAvailable() {
        return !!this.apiToken;
    }

    /**
     * Swap a face onto a target image
     * @param {Object} options
     * @param {string} options.targetImageUrl - URL of the generated thumbnail (with placeholder person)
     * @param {string} options.faceImageUrl - URL of the user's face reference image
     * @param {string} options.gender - 'male' or 'female' (optional, for better results)
     * @param {boolean} options.preserveUserHair - Whether to keep user's hairstyle (default: false)
     * @returns {Promise<string>} - URL of the face-swapped image
     */
    async swapFace(options) {
        if (!this.apiToken) {
            throw new Error('Face swap not available: REPLICATE_API_TOKEN not configured');
        }

        var targetImageUrl = options.targetImageUrl;
        var faceImageUrl = options.faceImageUrl;
        var gender = options.gender || 'a man';
        var preserveUserHair = options.preserveUserHair || false;

        // Normalize gender input
        if (gender === 'male' || gender === 'm') {
            gender = 'a man';
        } else if (gender === 'female' || gender === 'f') {
            gender = 'a woman';
        }

        console.log('[FaceSwap] Starting face swap...');
        console.log('[FaceSwap] Target image:', targetImageUrl.substring(0, 80) + '...');
        console.log('[FaceSwap] Face image:', faceImageUrl.substring(0, 80) + '...');

        try {
            // Create prediction
            var prediction = await this.createPrediction({
                target_image: targetImageUrl,
                swap_image: faceImageUrl,
                user_gender: gender,
                hair_source: preserveUserHair ? 'user' : 'target',
                upscale: true,
                detailer: false
            });

            console.log('[FaceSwap] Prediction created:', prediction.id);

            // Poll for completion
            var result = await this.waitForCompletion(prediction.id);

            if (result.status === 'succeeded' && result.output) {
                console.log('[FaceSwap] Face swap completed successfully');
                return result.output;
            } else {
                throw new Error('Face swap failed: ' + (result.error || 'Unknown error'));
            }

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Create a prediction on Replicate
     */
    async createPrediction(input) {
        var response = await axios.post(
            this.baseUrl + '/predictions',
            {
                version: this.modelVersion,
                input: input
            },
            {
                headers: {
                    'Authorization': 'Bearer ' + this.apiToken,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeout
            }
        );

        return response.data;
    }

    /**
     * Wait for prediction to complete
     */
    async waitForCompletion(predictionId, maxAttempts) {
        maxAttempts = maxAttempts || 60; // 60 attempts * 2s = 2 minutes max
        var attempts = 0;

        while (attempts < maxAttempts) {
            var response = await axios.get(
                this.baseUrl + '/predictions/' + predictionId,
                {
                    headers: {
                        'Authorization': 'Bearer ' + this.apiToken
                    },
                    timeout: 30000
                }
            );

            var prediction = response.data;

            if (prediction.status === 'succeeded') {
                return prediction;
            }

            if (prediction.status === 'failed' || prediction.status === 'canceled') {
                throw new Error('Prediction ' + prediction.status + ': ' + (prediction.error || 'No details'));
            }

            // Still processing, wait and retry
            console.log('[FaceSwap] Status: ' + prediction.status + ', waiting...');
            await new Promise(function(resolve) { setTimeout(resolve, 2000); });
            attempts++;
        }

        throw new Error('Face swap timed out after ' + maxAttempts + ' attempts');
    }

    /**
     * Swap faces for multiple variants
     * @param {Array} variants - Array of {image_data, variant_label, publicUrl}
     * @param {string} faceImageUrl - URL of user's face reference
     * @param {string} gender - User's gender for better results
     * @returns {Promise<Array>} - Updated variants with swapped faces
     */
    async swapFacesForVariants(variants, faceImageUrl, gender) {
        if (!this.isAvailable()) {
            console.log('[FaceSwap] Not available, returning original variants');
            return variants;
        }

        var self = this;
        var swappedVariants = [];

        for (var i = 0; i < variants.length; i++) {
            var variant = variants[i];

            try {
                console.log('[FaceSwap] Processing variant ' + variant.variant_label + '...');

                // Need public URL for the generated thumbnail
                if (!variant.publicUrl) {
                    console.log('[FaceSwap] Variant ' + variant.variant_label + ' has no public URL, skipping face swap');
                    swappedVariants.push(variant);
                    continue;
                }

                var swappedImageUrl = await self.swapFace({
                    targetImageUrl: variant.publicUrl,
                    faceImageUrl: faceImageUrl,
                    gender: gender
                });

                // Download the swapped image
                var imageResponse = await axios.get(swappedImageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000
                });

                var base64Data = Buffer.from(imageResponse.data).toString('base64');

                swappedVariants.push({
                    variant_label: variant.variant_label,
                    image_data: base64Data,
                    mime_type: 'image/png',
                    face_swapped: true
                });

                console.log('[FaceSwap] Variant ' + variant.variant_label + ' face swap complete');

            } catch (error) {
                console.error('[FaceSwap] Failed to swap face for variant ' + variant.variant_label + ':', error.message);
                // Keep original variant if face swap fails
                swappedVariants.push(variant);
            }
        }

        return swappedVariants;
    }

    handleError(error) {
        if (error.response) {
            var status = error.response.status;
            var message = error.response.data?.detail || error.response.data?.error || error.message;

            if (status === 401) {
                throw new Error('Replicate API unauthorized: Check your REPLICATE_API_TOKEN');
            }
            if (status === 402) {
                throw new Error('Replicate API payment required: Add credits to your account');
            }
            if (status === 422) {
                throw new Error('Replicate API validation error: ' + message);
            }
            if (status === 429) {
                throw new Error('Replicate API rate limit exceeded');
            }

            throw new Error('Replicate API error (' + status + '): ' + message);
        } else if (error.request) {
            throw new Error('Replicate network error: Could not connect');
        } else {
            throw error;
        }
    }
}

module.exports = new FaceSwapClient();
