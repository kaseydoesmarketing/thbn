var jwt = require('jsonwebtoken');
var db = require('../db/connection');

// Enforce JWT_SECRET in production
var JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable must be set in production');
    }
    JWT_SECRET = 'thumbnail-builder-dev-secret-change-in-production';
    console.warn('[Auth] WARNING: Using default JWT secret. Set JWT_SECRET in production!');
}
var JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT token
function generateToken(user) {
    var payload = {
        userId: user.id,
        email: user.email
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Auth middleware - requires valid token and active account
async function requireAuth(req, res, next) {
    var authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    var token = authHeader.substring(7);
    var decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Check user status in database (prevents suspended users from using old tokens)
    try {
        var userCheck = await db.query(
            'SELECT status, role FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (userCheck.rows[0].status !== 'approved') {
            return res.status(403).json({ error: 'Account not active' });
        }

        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userRole = userCheck.rows[0].role;
        next();
    } catch (error) {
        console.error('[Auth] Database check failed:', error);
        return res.status(500).json({ error: 'Authentication check failed' });
    }
}

// Optional auth - sets userId if token present, but doesn't fail
// NOTE: Routes using this MUST handle undefined userId appropriately
function optionalAuth(req, res, next) {
    var authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        var token = authHeader.substring(7);
        var decoded = verifyToken(token);

        if (decoded) {
            req.userId = decoded.userId;
            req.userEmail = decoded.email;
        }
    }

    // DO NOT set default user ID - removed for security
    // Routes must check if userId is set and handle appropriately
    next();
}

module.exports = {
    generateToken: generateToken,
    verifyToken: verifyToken,
    requireAuth: requireAuth,
    optionalAuth: optionalAuth,
    JWT_SECRET: JWT_SECRET
};
