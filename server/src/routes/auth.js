var express = require('express');
var bcrypt = require('bcrypt');
var router = express.Router();
var db = require('../db/connection');
var authMiddleware = require('../middleware/auth');

var SALT_ROUNDS = 12;

// POST /api/auth/register
router.post('/register', async function(req, res) {
    try {
        var email = req.body.email;
        var password = req.body.password;
        var name = req.body.name;

        // Validate
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
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

        // Create user
        var result = await db.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
            [email.toLowerCase(), passwordHash, name || null]
        );

        var user = result.rows[0];
        var token = authMiddleware.generateToken(user);

        console.log('[Auth] New user registered: ' + user.email);

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            token: token
        });

    } catch (error) {
        console.error('[Auth] Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', async function(req, res) {
    try {
        var email = req.body.email;
        var password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        var result = await db.query(
            'SELECT id, email, name, password_hash FROM users WHERE email = $1',
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

        var token = authMiddleware.generateToken(user);

        console.log('[Auth] User logged in: ' + user.email);

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
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
            'SELECT id, email, name, created_at FROM users WHERE id = $1',
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
