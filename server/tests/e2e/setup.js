/**
 * E2E Test Setup Configuration
 *
 * ZEROFAIL-VALIDATOR-PRIME: Production-grade E2E test infrastructure
 *
 * Provides:
 * - Test API base URL configuration
 * - Mock authentication tokens
 * - Test timeout settings
 * - Shared test utilities
 * - Database cleanup helpers
 */

const jwt = require('jsonwebtoken');

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
    // API Configuration
    API_BASE_URL: process.env.TEST_API_URL || 'http://localhost:3000',
    API_PREFIX: '/api',

    // Timeouts (in milliseconds)
    TIMEOUT: {
        DEFAULT: 10000,           // 10 seconds for standard API calls
        GENERATION: 60000,        // 60 seconds for thumbnail generation
        POLLING: 90000,           // 90 seconds max for job completion polling
        POLL_INTERVAL: 2000,      // 2 seconds between status polls
        UPLOAD: 30000             // 30 seconds for file uploads
    },

    // Test user configuration
    TEST_USER: {
        id: 'test-user-e2e-001',
        email: 'e2e-test@thumbnailbuilder.test',
        role: 'user',
        status: 'approved'
    },

    // Admin user for elevated permissions
    ADMIN_USER: {
        id: 'test-admin-e2e-001',
        email: 'e2e-admin@thumbnailbuilder.test',
        role: 'admin',
        status: 'approved'
    },

    // Invalid/suspended user for negative tests
    SUSPENDED_USER: {
        id: 'test-suspended-e2e-001',
        email: 'e2e-suspended@thumbnailbuilder.test',
        role: 'user',
        status: 'suspended'
    },

    // JWT configuration
    JWT: {
        SECRET: process.env.JWT_SECRET || 'thumbnail-builder-dev-secret-change-in-production',
        EXPIRES_IN: '1h'  // Short-lived tokens for tests
    },

    // Thumbnail specifications
    THUMBNAIL: {
        WIDTH: 1920,
        HEIGHT: 1080,
        ASPECT_RATIO: 16 / 9,
        MAX_FILE_SIZE_BYTES: 2 * 1024 * 1024,  // 2MB
        ALLOWED_FORMATS: ['png', 'jpg', 'jpeg', 'webp']
    },

    // Safe zone specifications (from thumbnailSpecs.js)
    SAFE_ZONES: {
        desktop: {
            marginX: 90,
            marginY: 50
        },
        mobile: {
            marginX: 160,
            marginY: 90
        },
        durationOverlay: {
            x: 1750,   // Scaled for 1920 width
            y: 1000,   // Scaled for 1080 height
            width: 170,
            height: 80
        }
    },

    // Valid options for validation tests
    VALID_OPTIONS: {
        niches: [
            'gaming', 'tech', 'finance', 'beauty', 'fitness',
            'cooking', 'travel', 'reaction', 'podcast', 'tutorial'
        ],
        expressions: [
            'excited', 'shocked', 'happy', 'angry', 'surprised',
            'confident', 'thoughtful', 'laughing', 'serious', 'curious'
        ],
        creatorStyles: ['auto', 'mrbeast', 'hormozi', 'gadzhi', 'magnates']
    },

    // Creator style specifications for style tests
    CREATOR_STYLES: {
        mrbeast: {
            textColor: '#FFFF00',     // Bright yellow
            strokeColor: '#000000',   // Black stroke
            textCase: 'uppercase',
            hasDoubleStroke: true
        },
        hormozi: {
            textColor: '#F7C204',     // Hormozi yellow
            strokeColor: '#000000',
            textCase: 'uppercase',
            hasDoubleStroke: true
        },
        gadzhi: {
            textColor: '#FFFFFF',     // White only
            strokeColor: '#000000',
            textCase: 'lowercase',    // Critical: lowercase for luxury feel
            hasDoubleStroke: false
        },
        magnates: {
            textColor: '#FFFFFF',     // White primary
            accentColor: '#CC0000',   // Red accents
            strokeColor: '#000000',
            textCase: 'uppercase',
            hasDoubleStroke: true
        }
    }
};

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate a valid JWT token for a test user
 * @param {Object} user - User object with id and email
 * @param {Object} options - Optional JWT options
 * @returns {string} JWT token
 */
function generateTestToken(user = TEST_CONFIG.TEST_USER, options = {}) {
    const payload = {
        userId: user.id,
        email: user.email
    };

    return jwt.sign(payload, TEST_CONFIG.JWT.SECRET, {
        expiresIn: options.expiresIn || TEST_CONFIG.JWT.EXPIRES_IN
    });
}

/**
 * Generate an expired token for negative tests
 * @param {Object} user - User object
 * @returns {string} Expired JWT token
 */
function generateExpiredToken(user = TEST_CONFIG.TEST_USER) {
    const payload = {
        userId: user.id,
        email: user.email
    };

    return jwt.sign(payload, TEST_CONFIG.JWT.SECRET, {
        expiresIn: '-1h'  // Already expired
    });
}

/**
 * Generate a token with invalid signature
 * @param {Object} user - User object
 * @returns {string} JWT token with invalid signature
 */
function generateInvalidSignatureToken(user = TEST_CONFIG.TEST_USER) {
    const payload = {
        userId: user.id,
        email: user.email
    };

    return jwt.sign(payload, 'wrong-secret-key', {
        expiresIn: TEST_CONFIG.JWT.EXPIRES_IN
    });
}

/**
 * Get authorization header for a user
 * @param {Object} user - User object
 * @returns {Object} Headers object with Authorization
 */
function getAuthHeaders(user = TEST_CONFIG.TEST_USER) {
    return {
        'Authorization': `Bearer ${generateTestToken(user)}`,
        'Content-Type': 'application/json'
    };
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a thumbnail generation job and return the response
 * @param {Object} options - Job options
 * @param {string} token - JWT token (optional, uses test user if not provided)
 * @returns {Promise<Object>} Job creation response
 */
async function createTestJob(options = {}, token = null) {
    const axios = require('axios');

    const defaultOptions = {
        brief: 'Test thumbnail generation for E2E testing',
        niche: 'reaction',
        expression: 'excited',
        thumbnailText: 'TEST',
        creatorStyle: 'auto'
    };

    const jobData = { ...defaultOptions, ...options };

    const headers = token
        ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        : getAuthHeaders();

    try {
        const response = await axios.post(
            `${TEST_CONFIG.API_BASE_URL}${TEST_CONFIG.API_PREFIX}/generate`,
            jobData,
            { headers, timeout: TEST_CONFIG.TIMEOUT.DEFAULT }
        );
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status || 500
        };
    }
}

/**
 * Poll for job completion with timeout
 * @param {string} jobId - Job ID to poll
 * @param {number} timeout - Maximum time to wait (ms)
 * @param {string} token - JWT token (optional)
 * @returns {Promise<Object>} Final job status
 */
async function waitForJobCompletion(jobId, timeout = TEST_CONFIG.TIMEOUT.POLLING, token = null) {
    const axios = require('axios');

    const headers = token
        ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        : getAuthHeaders();

    const startTime = Date.now();
    let lastStatus = null;

    while (Date.now() - startTime < timeout) {
        try {
            const response = await axios.get(
                `${TEST_CONFIG.API_BASE_URL}${TEST_CONFIG.API_PREFIX}/jobs/${jobId}`,
                { headers, timeout: TEST_CONFIG.TIMEOUT.DEFAULT }
            );

            lastStatus = response.data;

            if (lastStatus.status === 'completed') {
                return {
                    success: true,
                    data: lastStatus,
                    duration: Date.now() - startTime
                };
            }

            if (lastStatus.status === 'failed') {
                return {
                    success: false,
                    data: lastStatus,
                    error: lastStatus.error || 'Job failed',
                    duration: Date.now() - startTime
                };
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.TIMEOUT.POLL_INTERVAL));

        } catch (error) {
            // Allow transient errors during polling
            console.warn(`[E2E] Poll error for job ${jobId}:`, error.message);
            await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.TIMEOUT.POLL_INTERVAL));
        }
    }

    return {
        success: false,
        data: lastStatus,
        error: 'Timeout waiting for job completion',
        duration: Date.now() - startTime
    };
}

/**
 * Validate image dimensions by fetching and checking metadata
 * @param {string} url - Image URL
 * @returns {Promise<Object>} Validation result with dimensions
 */
async function validateImageDimensions(url) {
    const axios = require('axios');
    const sharp = require('sharp');

    try {
        // Fetch image
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: TEST_CONFIG.TIMEOUT.DEFAULT
        });

        const imageBuffer = Buffer.from(response.data);
        const metadata = await sharp(imageBuffer).metadata();

        const isValid = metadata.width === TEST_CONFIG.THUMBNAIL.WIDTH &&
                       metadata.height === TEST_CONFIG.THUMBNAIL.HEIGHT;

        const aspectRatio = metadata.width / metadata.height;
        const aspectRatioValid = Math.abs(aspectRatio - TEST_CONFIG.THUMBNAIL.ASPECT_RATIO) < 0.01;

        return {
            valid: isValid,
            width: metadata.width,
            height: metadata.height,
            aspectRatio: aspectRatio,
            aspectRatioValid: aspectRatioValid,
            format: metadata.format,
            fileSize: imageBuffer.length,
            fileSizeValid: imageBuffer.length <= TEST_CONFIG.THUMBNAIL.MAX_FILE_SIZE_BYTES,
            errors: [
                !isValid ? `Dimensions ${metadata.width}x${metadata.height} do not match expected 1920x1080` : null,
                !aspectRatioValid ? `Aspect ratio ${aspectRatio.toFixed(4)} does not match 16:9` : null,
                imageBuffer.length > TEST_CONFIG.THUMBNAIL.MAX_FILE_SIZE_BYTES ? 'File size exceeds 2MB' : null
            ].filter(Boolean)
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message,
            errors: [error.message]
        };
    }
}

/**
 * Extract text bounding box from an image (mock implementation)
 * In production, this would use OCR or computer vision
 * For tests, returns mock data based on typical text positions
 *
 * @param {Buffer|string} image - Image buffer or URL
 * @param {Object} options - Options for text extraction
 * @returns {Promise<Object>} Text bounding box information
 */
async function extractTextBounds(image, options = {}) {
    // Mock implementation for testing
    // Returns typical text bounds based on position preset
    const position = options.position || 'rightCenter';

    const mockBounds = {
        rightCenter: { left: 1100, top: 300, right: 1800, bottom: 500 },
        rightUpper: { left: 1100, top: 150, right: 1800, bottom: 350 },
        topCenter: { left: 400, top: 50, right: 1520, bottom: 200 },
        center: { left: 400, top: 400, right: 1520, bottom: 680 },
        bottomLeft: { left: 90, top: 900, right: 600, bottom: 1030 }
    };

    const bounds = mockBounds[position] || mockBounds.rightCenter;

    // Check if bounds are within safe zones
    const safeZone = TEST_CONFIG.SAFE_ZONES.desktop;
    const durationZone = TEST_CONFIG.SAFE_ZONES.durationOverlay;

    const isInSafeZone = bounds.left >= safeZone.marginX &&
                         bounds.right <= (TEST_CONFIG.THUMBNAIL.WIDTH - safeZone.marginX) &&
                         bounds.top >= safeZone.marginY &&
                         bounds.bottom <= (TEST_CONFIG.THUMBNAIL.HEIGHT - safeZone.marginY);

    const avoidsOurationOverlay = !(bounds.right > durationZone.x && bounds.bottom > durationZone.y);

    return {
        bounds,
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top,
        isInSafeZone,
        avoidsOurationOverlay,
        fullyVisible: isInSafeZone && avoidsOurationOverlay,
        position
    };
}

/**
 * Check if a point/region is in the safe zone
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Region width (optional)
 * @param {number} height - Region height (optional)
 * @returns {boolean} Whether the point/region is in safe zone
 */
function isInSafeZone(x, y, width = 0, height = 0) {
    const safeZone = TEST_CONFIG.SAFE_ZONES.desktop;
    const canvasWidth = TEST_CONFIG.THUMBNAIL.WIDTH;
    const canvasHeight = TEST_CONFIG.THUMBNAIL.HEIGHT;

    const left = x;
    const right = x + width;
    const top = y;
    const bottom = y + height;

    return left >= safeZone.marginX &&
           right <= (canvasWidth - safeZone.marginX) &&
           top >= safeZone.marginY &&
           bottom <= (canvasHeight - safeZone.marginY);
}

/**
 * Check if a point/region conflicts with YouTube duration overlay
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Region width (optional)
 * @param {number} height - Region height (optional)
 * @returns {boolean} Whether the point/region conflicts with duration overlay
 */
function conflictsWithDurationOverlay(x, y, width = 0, height = 0) {
    const durationZone = TEST_CONFIG.SAFE_ZONES.durationOverlay;

    const right = x + width;
    const bottom = y + height;

    return right > durationZone.x && bottom > durationZone.y;
}

/**
 * Generate random test data
 * @returns {Object} Random test data for thumbnail generation
 */
function generateRandomTestData() {
    const niches = TEST_CONFIG.VALID_OPTIONS.niches;
    const expressions = TEST_CONFIG.VALID_OPTIONS.expressions;
    const styles = TEST_CONFIG.VALID_OPTIONS.creatorStyles;

    const testTexts = [
        'WOW!',
        'THIS IS INSANE',
        'You need to see this',
        'The secret that changed everything',
        '$1M in 30 days',
        'dont miss this',
        'HOW I DID IT'
    ];

    return {
        brief: `E2E Test - ${Date.now()}`,
        niche: niches[Math.floor(Math.random() * niches.length)],
        expression: expressions[Math.floor(Math.random() * expressions.length)],
        thumbnailText: testTexts[Math.floor(Math.random() * testTexts.length)],
        creatorStyle: styles[Math.floor(Math.random() * styles.length)]
    };
}

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// DATABASE HELPERS (for test isolation)
// ============================================================================

/**
 * Clean up test data from database
 * Call this in afterAll or afterEach hooks
 * @param {Object} db - Database connection
 * @param {string} testPrefix - Prefix used for test data (default: 'test-')
 */
async function cleanupTestData(db, testPrefix = 'test-') {
    if (!db) return;

    try {
        // Delete test thumbnail variants
        await db.query(
            `DELETE FROM thumbnail_variants WHERE user_id LIKE $1`,
            [`${testPrefix}%`]
        );

        // Delete test thumbnail jobs
        await db.query(
            `DELETE FROM thumbnail_jobs WHERE user_id LIKE $1`,
            [`${testPrefix}%`]
        );

        // Delete test face images (if any)
        await db.query(
            `DELETE FROM face_profile_images WHERE user_id LIKE $1`,
            [`${testPrefix}%`]
        );

        console.log('[E2E Setup] Test data cleaned up');
    } catch (error) {
        console.warn('[E2E Setup] Cleanup warning:', error.message);
    }
}

/**
 * Create test user in database if needed
 * @param {Object} db - Database connection
 * @param {Object} user - User data
 */
async function ensureTestUser(db, user = TEST_CONFIG.TEST_USER) {
    if (!db) return;

    try {
        // Check if user exists
        const result = await db.query(
            'SELECT id FROM users WHERE id = $1',
            [user.id]
        );

        if (result.rows.length === 0) {
            // Create test user
            await db.query(
                `INSERT INTO users (id, email, password_hash, role, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (id) DO NOTHING`,
                [user.id, user.email, 'test-hash-not-real', user.role, user.status]
            );
            console.log(`[E2E Setup] Created test user: ${user.id}`);
        }
    } catch (error) {
        console.warn('[E2E Setup] User creation warning:', error.message);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Configuration
    TEST_CONFIG,

    // Token generation
    generateTestToken,
    generateExpiredToken,
    generateInvalidSignatureToken,
    getAuthHeaders,

    // Test helpers
    createTestJob,
    waitForJobCompletion,
    validateImageDimensions,
    extractTextBounds,
    isInSafeZone,
    conflictsWithDurationOverlay,
    generateRandomTestData,
    sleep,

    // Database helpers
    cleanupTestData,
    ensureTestUser
};
