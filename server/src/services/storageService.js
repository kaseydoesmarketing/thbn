var createClient = require('@supabase/supabase-js').createClient;
var fs = require('fs');
var path = require('path');
var axios = require('axios');

var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_KEY;

var supabase = null;

function getClient() {
    if (!supabase && supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
    return supabase;
}

var BUCKETS = {
    FACES: process.env.SUPABASE_BUCKET_FACES || 'faces',
    THUMBNAILS: process.env.SUPABASE_BUCKET_THUMBNAILS || 'thumbnails'
};

// Upload face image from local file
async function uploadFaceImage(bufferOrPath, userId, label, contentType) {
    var client = getClient();
    if (!client) {
        console.warn('[Storage] Supabase not configured, using local storage');
        return { url: bufferOrPath, isLocal: true };
    }

    var buffer;
    var ext;

    // Handle both buffer and file path inputs
    if (Buffer.isBuffer(bufferOrPath)) {
        buffer = bufferOrPath;
        contentType = contentType || 'image/jpeg';
        ext = contentType.includes('png') ? '.png' : '.jpg';
    } else {
        // It's a file path
        buffer = fs.readFileSync(bufferOrPath);
        ext = path.extname(bufferOrPath);
        contentType = getContentType(ext);
    }

    label = label || Date.now() + '_' + Math.random().toString(36).substring(7);
    var filename = userId + '/' + label + ext;

    var result = await client.storage
        .from(BUCKETS.FACES)
        .upload(filename, buffer, {
            contentType: contentType,
            upsert: true
        });

    if (result.error) {
        throw new Error('Face upload failed: ' + result.error.message);
    }

    var publicUrl = client.storage
        .from(BUCKETS.FACES)
        .getPublicUrl(filename);

    return {
        url: publicUrl.data.publicUrl,
        key: filename,
        bucket: BUCKETS.FACES,
        isLocal: false
    };
}

// Upload thumbnail from URL (download from Nano Banana, upload to Supabase)
async function uploadThumbnailFromUrl(imageUrl, userId, jobId, variantLabel) {
    var client = getClient();
    if (!client) {
        console.warn('[Storage] Supabase not configured, returning original URL');
        return { url: imageUrl, isLocal: true };
    }

    // Download the image
    var response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    var buffer = Buffer.from(response.data);

    // Determine extension from content-type
    var contentType = response.headers['content-type'] || 'image/png';
    var ext = contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' : '.png';

    var filename = userId + '/' + jobId + '/' + variantLabel + ext;

    var result = await client.storage
        .from(BUCKETS.THUMBNAILS)
        .upload(filename, buffer, {
            contentType: contentType,
            upsert: true
        });

    if (result.error) {
        throw new Error('Thumbnail upload failed: ' + result.error.message);
    }

    var publicUrl = client.storage
        .from(BUCKETS.THUMBNAILS)
        .getPublicUrl(filename);

    return {
        url: publicUrl.data.publicUrl,
        key: filename,
        bucket: BUCKETS.THUMBNAILS,
        isLocal: false
    };
}

// Upload thumbnail from buffer
async function uploadThumbnail(buffer, userId, jobId, variantLabel, contentType) {
    var client = getClient();
    if (!client) {
        console.warn('[Storage] Supabase not configured');
        return null;
    }

    contentType = contentType || 'image/png';
    var ext = contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' : '.png';
    var filename = userId + '/' + jobId + '/' + variantLabel + ext;

    var result = await client.storage
        .from(BUCKETS.THUMBNAILS)
        .upload(filename, buffer, {
            contentType: contentType,
            upsert: true
        });

    if (result.error) {
        throw new Error('Thumbnail upload failed: ' + result.error.message);
    }

    var publicUrl = client.storage
        .from(BUCKETS.THUMBNAILS)
        .getPublicUrl(filename);

    return {
        url: publicUrl.data.publicUrl,
        key: filename,
        bucket: BUCKETS.THUMBNAILS
    };
}

// Delete file from storage
async function deleteFile(bucket, key) {
    var client = getClient();
    if (!client) return false;

    var result = await client.storage
        .from(bucket)
        .remove([key]);

    return !result.error;
}

// Get public URL for a file
function getPublicUrl(bucket, key) {
    var client = getClient();
    if (!client) return null;

    var result = client.storage
        .from(bucket)
        .getPublicUrl(key);

    return result.data.publicUrl;
}

// Check if Supabase is configured
function isConfigured() {
    return !!(supabaseUrl && supabaseKey);
}

// Health check
async function healthCheck() {
    var client = getClient();
    if (!client) return { configured: false };

    try {
        var result = await client.storage.listBuckets();
        return {
            configured: true,
            connected: !result.error,
            buckets: result.data ? result.data.length : 0
        };
    } catch (error) {
        return {
            configured: true,
            connected: false,
            error: error.message
        };
    }
}

function getContentType(ext) {
    var types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return types[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
    uploadFaceImage: uploadFaceImage,
    uploadThumbnailFromUrl: uploadThumbnailFromUrl,
    uploadThumbnail: uploadThumbnail,
    deleteFile: deleteFile,
    getPublicUrl: getPublicUrl,
    isConfigured: isConfigured,
    healthCheck: healthCheck,
    BUCKETS: BUCKETS
};
