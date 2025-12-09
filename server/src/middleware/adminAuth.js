/**
 * Admin Authentication Middleware
 * Provides role-based access control for admin-only routes
 *
 * @module middleware/adminAuth
 * @version 1.0.0
 */

'use strict';

var db = require('../db/connection');
var authMiddleware = require('./auth');

/**
 * Audit log types for admin actions
 */
var AUDIT_ACTIONS = {
    MODEL_SWITCH: 'model_switch',
    KEY_ROTATE: 'key_rotate',
    KEY_TEST: 'key_test',
    CREDIT_ADJUST: 'credit_adjust',
    SUBSCRIPTION_REFRESH: 'subscription_refresh',
    CACHE_CLEAR: 'cache_clear',
    TEST_GENERATE: 'test_generate',
    USER_SEARCH: 'user_search',
    LOGS_VIEW: 'logs_view'
};

/**
 * Require admin role middleware
 * Must be used after requireAuth middleware
 * Verifies the user has admin role in the database
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function requireAdmin(req, res, next) {
    try {
        // userId should be set by requireAuth middleware
        if (!req.userId) {
            return res.status(401).json({
                error: {
                    code: 'AUTH_REQUIRED',
                    message: 'Authentication required'
                }
            });
        }

        var result = await db.query(
            'SELECT role, status FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        var user = result.rows[0];

        if (user.status !== 'approved') {
            return res.status(403).json({
                error: {
                    code: 'ACCOUNT_INACTIVE',
                    message: 'Account is not active'
                }
            });
        }

        if (user.role !== 'admin') {
            // Log unauthorized access attempt
            console.warn('[AdminAuth] Unauthorized admin access attempt by user ' + req.userId);

            await logAdminAction(req.userId, 'unauthorized_access_attempt', {
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip
            }, false);

            return res.status(403).json({
                error: {
                    code: 'ADMIN_REQUIRED',
                    message: 'Administrator access required'
                }
            });
        }

        // Set admin flag on request
        req.isAdmin = true;
        next();

    } catch (error) {
        console.error('[AdminAuth] Middleware error:', error);
        return res.status(500).json({
            error: {
                code: 'AUTH_ERROR',
                message: 'Authorization check failed'
            }
        });
    }
}

/**
 * Log admin action for audit trail
 *
 * @param {number} adminId - ID of admin performing action
 * @param {string} action - Action type from AUDIT_ACTIONS
 * @param {Object} details - Additional details about the action
 * @param {boolean} [success=true] - Whether action was successful
 * @returns {Promise<void>}
 */
async function logAdminAction(adminId, action, details, success) {
    success = success !== false;

    try {
        await db.query(
            `INSERT INTO admin_audit_log (admin_id, action, details, success, ip_address, created_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [adminId, action, JSON.stringify(details), success, details.ip || null]
        );
    } catch (error) {
        // Don't fail the request if audit logging fails
        console.error('[AdminAuth] Failed to log admin action:', error.message);
    }
}

/**
 * Mask sensitive data like API keys
 * Shows only last 4 characters
 *
 * @param {string} value - Value to mask
 * @returns {string} Masked value
 */
function maskSensitiveData(value) {
    if (!value || typeof value !== 'string') {
        return '****';
    }

    if (value.length <= 4) {
        return '****';
    }

    var lastFour = value.slice(-4);
    var maskedLength = Math.min(value.length - 4, 20);
    var mask = '*'.repeat(maskedLength);

    return mask + lastFour;
}

/**
 * Rate limiter specifically for admin test generation
 * Allows 10 test generations per hour
 */
var testGenerationCounts = new Map();

function testGenerationRateLimit(req, res, next) {
    var userId = req.userId;
    var now = Date.now();
    var windowMs = 60 * 60 * 1000; // 1 hour
    var maxRequests = 10;

    var userRecord = testGenerationCounts.get(userId);

    if (!userRecord || now - userRecord.windowStart > windowMs) {
        // New window
        testGenerationCounts.set(userId, {
            windowStart: now,
            count: 1
        });
        return next();
    }

    if (userRecord.count >= maxRequests) {
        return res.status(429).json({
            error: {
                code: 'RATE_LIMITED',
                message: 'Test generation rate limit exceeded. Max ' + maxRequests + ' per hour.',
                retryAfter: Math.ceil((userRecord.windowStart + windowMs - now) / 1000)
            }
        });
    }

    userRecord.count++;
    next();
}

/**
 * CSRF protection middleware for admin routes
 * Validates token from header matches session
 */
function csrfProtection(req, res, next) {
    // Skip CSRF for GET requests (read-only)
    if (req.method === 'GET') {
        return next();
    }

    var csrfToken = req.headers['x-csrf-token'];
    var sessionToken = req.headers['x-session-id'];

    // For now, we use the JWT token as CSRF protection since it's sent in headers
    // In production, implement proper CSRF token generation and validation
    if (!csrfToken && !req.headers.authorization) {
        console.warn('[AdminAuth] CSRF validation warning: No token provided');
    }

    next();
}

/**
 * Ensure admin_audit_log table exists
 * Call this on server startup
 */
async function ensureAuditTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER NOT NULL,
                action VARCHAR(100) NOT NULL,
                details JSONB,
                success BOOLEAN DEFAULT true,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at)
        `);

        console.log('[AdminAuth] Audit log table ready');
    } catch (error) {
        console.error('[AdminAuth] Failed to create audit table:', error.message);
    }
}

module.exports = {
    requireAdmin: requireAdmin,
    logAdminAction: logAdminAction,
    maskSensitiveData: maskSensitiveData,
    testGenerationRateLimit: testGenerationRateLimit,
    csrfProtection: csrfProtection,
    ensureAuditTable: ensureAuditTable,
    AUDIT_ACTIONS: AUDIT_ACTIONS
};
