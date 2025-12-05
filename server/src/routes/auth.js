var express = require('express');
var bcrypt = require('bcrypt');
var router = express.Router();
var db = require('../db/connection');
var authMiddleware = require('../middleware/auth');
var { authLimiter, loginLimiter, passwordResetLimiter } = require('../middleware/rateLimit');

var SALT_ROUNDS = 12;

// POST /api/auth/register - rate limited (10 req/15min)
router.post('/register', authLimiter, async function(req, res) {
    try {
        var email = req.body.email;
        var password = req.body.password;
        var name = req.body.name;

        // Validate
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Email validation
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Password validation - strength requirements
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({
                error: 'Password must contain uppercase, lowercase, and numbers'
            });
        }

        // Check if user exists
        var existing = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        var passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user with pending status (requires admin approval)
        var result = await db.query(
            'INSERT INTO users (email, password_hash, name, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, status, created_at',
            [email.toLowerCase(), passwordHash, name || null, 'user', 'pending']
        );

        var user = result.rows[0];

        console.log('[Auth] New user registered (pending approval): ' + user.email);

        res.status(201).json({
            success: true,
            message: 'Registration submitted. Please wait for admin approval.',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                status: user.status
            }
        });

    } catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login - rate limited (5 failed attempts/15min)
router.post('/login', loginLimiter, async function(req, res) {
    try {
        var email = req.body.email;
        var password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        var result = await db.query(
            'SELECT id, email, name, password_hash, role, status FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        var user = result.rows[0];

        // Verify password
        var valid = await bcrypt.compare(password, user.password_hash);

        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check account status
        if (user.status === 'pending') {
            return res.status(403).json({
                error: 'Account pending approval',
                message: 'Your account is awaiting admin approval. Please check back later.'
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                error: 'Account suspended',
                message: 'Your account has been suspended. Contact admin for assistance.'
            });
        }

        var token = authMiddleware.generateToken(user);

        console.log('[Auth] User logged in: ' + user.email + ' (role: ' + user.role + ')');

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status
            },
            token: token
        });

    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me - Get current user
router.get('/me', authMiddleware.requireAuth, async function(req, res) {
    try {
        var result = await db.query(
            'SELECT id, email, name, role, status, created_at FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });

    } catch (error) {
        console.error('[Auth] Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// ============== ADMIN ROUTES ==============

// Middleware to check admin role
async function requireAdmin(req, res, next) {
    try {
        var result = await db.query(
            'SELECT role FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Authorization check failed' });
    }
}

// GET /api/auth/admin/users - List all users (admin only)
router.get('/admin/users', authMiddleware.requireAuth, requireAdmin, async function(req, res) {
    try {
        var status = req.query.status; // Filter by status: pending, approved, suspended

        var query = 'SELECT id, email, name, role, status, approved_at, created_at FROM users ORDER BY created_at DESC';
        var params = [];

        if (status) {
            query = 'SELECT id, email, name, role, status, approved_at, created_at FROM users WHERE status = $1 ORDER BY created_at DESC';
            params = [status];
        }

        var result = await db.query(query, params);

        res.json({ users: result.rows });

    } catch (error) {
        console.error('[Admin] List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

// GET /api/auth/admin/pending - List pending users (admin only)
router.get('/admin/pending', authMiddleware.requireAuth, requireAdmin, async function(req, res) {
    try {
        var result = await db.query(
            'SELECT id, email, name, created_at FROM users WHERE status = $1 ORDER BY created_at ASC',
            ['pending']
        );

        res.json({
            pending: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('[Admin] List pending error:', error);
        res.status(500).json({ error: 'Failed to list pending users' });
    }
});

// POST /api/auth/admin/approve/:userId - Approve user (admin only)
router.post('/admin/approve/:userId', authMiddleware.requireAuth, requireAdmin, async function(req, res) {
    try {
        var targetUserId = req.params.userId;

        // Check user exists and is pending
        var check = await db.query(
            'SELECT id, email, status FROM users WHERE id = $1',
            [targetUserId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (check.rows[0].status === 'approved') {
            return res.status(400).json({ error: 'User already approved' });
        }

        // Approve user
        var result = await db.query(
            'UPDATE users SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING id, email, name, status',
            ['approved', req.userId, targetUserId]
        );

        console.log('[Admin] User approved: ' + result.rows[0].email + ' by admin ' + req.userId);

        res.json({
            success: true,
            message: 'User approved successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('[Admin] Approve user error:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// POST /api/auth/admin/reject/:userId - Reject/delete pending user (admin only)
router.post('/admin/reject/:userId', authMiddleware.requireAuth, requireAdmin, async function(req, res) {
    try {
        var targetUserId = req.params.userId;

        // Check user exists
        var check = await db.query(
            'SELECT id, email, status FROM users WHERE id = $1',
            [targetUserId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow rejecting admins
        if (check.rows[0].role === 'admin') {
            return res.status(403).json({ error: 'Cannot reject admin accounts' });
        }

        // Only allow rejecting pending or suspended users
        if (check.rows[0].status === 'approved') {
            return res.status(400).json({ error: 'Cannot reject approved users. Use suspend first.' });
        }

        // Delete user
        await db.query('DELETE FROM users WHERE id = $1', [targetUserId]);

        console.log('[Admin] User rejected/deleted: ' + check.rows[0].email);

        res.json({
            success: true,
            message: 'User rejected and removed'
        });

    } catch (error) {
        console.error('[Admin] Reject user error:', error);
        res.status(500).json({ error: 'Failed to reject user' });
    }
});

// POST /api/auth/admin/suspend/:userId - Suspend user (admin only)
router.post('/admin/suspend/:userId', authMiddleware.requireAuth, requireAdmin, async function(req, res) {
    try {
        var targetUserId = req.params.userId;

        // Check user exists
        var check = await db.query(
            'SELECT id, email, role, status FROM users WHERE id = $1',
            [targetUserId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Don't allow suspending admins
        if (check.rows[0].role === 'admin') {
            return res.status(403).json({ error: 'Cannot suspend admin accounts' });
        }

        // Only allow suspending approved users
        if (check.rows[0].status !== 'approved') {
            return res.status(400).json({ error: 'Can only suspend approved users' });
        }

        // Suspend user
        var result = await db.query(
            'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, status',
            ['suspended', targetUserId]
        );

        console.log('[Admin] User suspended: ' + result.rows[0].email);

        res.json({
            success: true,
            message: 'User suspended',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('[Admin] Suspend user error:', error);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

// POST /api/auth/admin/reactivate/:userId - Reactivate suspended user (admin only)
router.post('/admin/reactivate/:userId', authMiddleware.requireAuth, requireAdmin, async function(req, res) {
    try {
        var targetUserId = req.params.userId;

        // Check user exists and is suspended
        var check = await db.query(
            'SELECT id, email, status FROM users WHERE id = $1',
            [targetUserId]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Only allow reactivating suspended users
        if (check.rows[0].status !== 'suspended') {
            return res.status(400).json({ error: 'Can only reactivate suspended users' });
        }

        var result = await db.query(
            'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, status',
            ['approved', targetUserId]
        );

        console.log('[Admin] User reactivated: ' + result.rows[0].email);

        res.json({
            success: true,
            message: 'User reactivated',
            user: result.rows[0]
        });

    } catch (error) {
        console.error('[Admin] Reactivate user error:', error);
        res.status(500).json({ error: 'Failed to reactivate user' });
    }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware.requireAuth, async function(req, res) {
    try {
        var currentPassword = req.body.currentPassword;
        var newPassword = req.body.newPassword;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        // Get user
        var result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        var valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);

        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        var newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Update
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [newHash, req.userId]
        );

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (error) {
        console.error('[Auth] Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

module.exports = router;
