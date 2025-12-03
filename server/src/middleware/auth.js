var jwt = require('jsonwebtoken');

var JWT_SECRET = process.env.JWT_SECRET || 'thumbnail-builder-dev-secret-change-in-production';
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

// Auth middleware - requires valid token
function requireAuth(req, res, next) {
    var authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    var token = authHeader.substring(7);
    var decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
}

// Optional auth - sets userId if token present, but doesn't fail
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

    // Default user ID for unauthenticated requests (for backward compatibility)
    if (!req.userId) {
        req.userId = '00000000-0000-0000-0000-000000000001';
    }

    next();
}

module.exports = {
    generateToken: generateToken,
    verifyToken: verifyToken,
    requireAuth: requireAuth,
    optionalAuth: optionalAuth,
    JWT_SECRET: JWT_SECRET
};
