'use strict';

/**
 * ThumbnailBuilder - Abstract Image Generation Provider
 * Base class for all image generation providers (Gemini, Flux, etc.)
 * @module services/imageProvider
 * @version 1.0.0
 */

class ImageProviderError extends Error {
    constructor(message, code, statusCode, isRetryable, context) {
        super(message);
        this.name = 'ImageProviderError';
        this.code = code || 'PROVIDER_ERROR';
        this.statusCode = statusCode || 500;
        this.isRetryable = isRetryable !== undefined ? isRetryable : false;
        this.context = context || {};
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            error: {
                name: this.name,
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
                isRetryable: this.isRetryable,
                timestamp: this.timestamp,
                context: this.context
            }
        };
    }
}

class ImageProvider {
    constructor(config) {
        if (new.target === ImageProvider) {
            throw new Error('ImageProvider is an abstract class');
        }
        if (!config) {
            throw new ImageProviderError('Config required', 'CONFIG_REQUIRED', 400, false);
        }
        if (!config.apiKey) {
            throw new ImageProviderError('API key required', 'API_KEY_REQUIRED', 401, false);
        }
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || '';
        this.timeout = config.timeout || 120000;
        this.maxRetries = config.maxRetries || 3;
        this.modelId = config.modelId || null;
        this.metrics = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, totalCost: 0, lastRequestTime: null, averageLatency: 0 };
        this.rateLimitState = { lastRequestTime: 0, requestsThisMinute: 0, requestsToday: 0, minuteReset: Date.now(), dayReset: Date.now() };
    }

    async generateImage(prompt, options) { throw new ImageProviderError('Not implemented', 'NOT_IMPLEMENTED', 501, false); }
    estimateCost(options) { throw new ImageProviderError('Not implemented', 'NOT_IMPLEMENTED', 501, false); }
    async healthCheck() { throw new ImageProviderError('Not implemented', 'NOT_IMPLEMENTED', 501, false); }
    getModelInfo() { throw new ImageProviderError('Not implemented', 'NOT_IMPLEMENTED', 501, false); }

    async waitForRateLimit(minInterval) {
        var now = Date.now();
        var wait = minInterval - (now - this.rateLimitState.lastRequestTime);
        if (wait > 0) await new Promise(function(r) { setTimeout(r, wait); });
        this.rateLimitState.lastRequestTime = Date.now();
        this.rateLimitState.requestsThisMinute++;
    }

    async withRetry(fn, max, delay) {
        max = max || this.maxRetries; delay = delay || 1000;
        for (var i = 1; i <= max; i++) {
            try { return await fn(); }
            catch (e) { if (!this.isRetryableError(e) || i === max) throw e; await new Promise(function(r) { setTimeout(r, delay * Math.pow(2, i-1)); }); }
        }
    }

    isRetryableError(e) { return e.isRetryable || (e.response && (e.response.status === 429 || e.response.status >= 500)); }
    trackSuccess(cost, latency) { this.metrics.totalRequests++; this.metrics.successfulRequests++; this.metrics.totalCost += cost || 0; }
    trackFailure() { this.metrics.totalRequests++; this.metrics.failedRequests++; }
    getMetrics() { return { ...this.metrics, successRate: this.metrics.totalRequests > 0 ? ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2) + '%' : 'N/A' }; }

    createError(msg, code, ctx) {
        var map = { 'RATE_LIMITED': [429, true], 'UNAUTHORIZED': [401, false], 'SERVER_ERROR': [500, true] };
        var m = map[code] || [500, false];
        return new ImageProviderError(msg, code, m[0], m[1], { provider: this.constructor.name, modelId: this.modelId, ...ctx });
    }
}

module.exports = ImageProvider;
module.exports.ImageProviderError = ImageProviderError;
