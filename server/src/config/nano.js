require('dotenv').config();

const requiredVars = [
    'NANO_BANANA_API_KEY',
    'THUMBNAIL_STORAGE_BUCKET',
    'THUMBNAIL_CDN_BASE_URL'
];

// Validate Env Vars
requiredVars.forEach(key => {
    if (!process.env[key]) {
        console.warn(\`WARNING: Missing required environment variable: \${key}\`);
        // In production, we might want to throw error, but for dev/prototype we warn
        // throw new Error(\`Missing required environment variable: \${key}\`);
    }
});

module.exports = {
    nanoBanana: {
        apiKey: process.env.NANO_BANANA_API_KEY,
        baseUrl: process.env.NANO_BANANA_API_BASE_URL || 'https://api.nanobanana.com/v1',
        timeout: parseInt(process.env.NANO_TIMEOUT_MS) || 30000,
        maxRetries: 3
    },
    storage: {
        bucket: process.env.THUMBNAIL_STORAGE_BUCKET,
        cdnUrl: process.env.THUMBNAIL_CDN_BASE_URL
    }
};
