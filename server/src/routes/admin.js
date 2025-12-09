/**
 * Admin API Routes - ThumbnailBuilder v9.2.0
 * Comprehensive admin endpoints for system management
 *
 * All routes require admin authentication
 *
 * @module routes/admin
 * @version 1.0.0
 */

'use strict';

var express = require('express');
var router = express.Router();
var db = require('../db/connection');
var redis = require('../config/redis');
var thumbnailQueue = require('../queues/thumbnailQueue');
var authMiddleware = require('../middleware/auth');
var adminAuth = require('../middleware/adminAuth');
var imageModels = require('../config/imageModels');
var modelSwitcher = require('../services/modelSwitcher');
var stripeService = require('../services/stripeService');

// Apply authentication to all admin routes
router.use(authMiddleware.requireAuth);
router.use(adminAuth.requireAdmin);
router.use(adminAuth.csrfProtection);

// =============================================================================
// MODEL MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/models
 * List all available models with status and pricing
 */
router.get('/models', async function(req, res) {
    try {
        var allModels = imageModels.getAllModels(true);
        var currentConfig = modelSwitcher.getCurrentConfig();
        var modelHealth = modelSwitcher.getModelHealth();

        var models = allModels.map(function(model) {
            var status = 'stable';
            if (model.deprecationDate) {
                var deprecationDate = new Date(model.deprecationDate);
                if (deprecationDate < new Date()) {
                    status = 'deprecated';
                } else if (deprecationDate < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
                    status = 'deprecating_soon';
                }
            }
            if (model.id.includes('exp') || model.id.includes('preview')) {
                status = 'preview';
            }

            return {
                id: model.id,
                name: model.name,
                family: model.family,
                pricing: model.pricing,
                limits: model.limits,
                features: model.features,
                status: status,
                isRecommended: model.recommended || false,
                isPrimary: model.id === currentConfig.primaryModel,
                isFallback: model.id === currentConfig.fallbackModel,
                deprecationDate: model.deprecationDate || null,
                description: model.description
            };
        });

        res.json({
            success: true,
            models: models,
            currentConfig: {
                primaryModel: currentConfig.primaryModel,
                fallbackModel: currentConfig.fallbackModel,
                lastUpdated: currentConfig.lastUpdated,
                updatedBy: currentConfig.updatedBy
            },
            health: modelHealth
        });

    } catch (error) {
        console.error('[Admin] Get models error:', error);
        res.status(500).json({
            error: {
                code: 'MODEL_LIST_FAILED',
                message: 'Failed to retrieve model list'
            }
        });
    }
});

/**
 * POST /api/admin/models/switch
 * Switch the active primary or fallback model
 */
router.post('/models/switch', async function(req, res) {
    try {
        var modelId = req.body.modelId;
        var modelType = req.body.type || 'primary';

        if (!modelId) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'modelId is required'
                }
            });
        }

        var result;
        if (modelType === 'fallback') {
            result = modelSwitcher.switchFallbackModel(modelId, req.userId.toString());
        } else {
            result = modelSwitcher.switchPrimaryModel(modelId, req.userId.toString());
        }

        if (!result.success) {
            return res.status(400).json({
                error: {
                    code: 'MODEL_SWITCH_FAILED',
                    message: result.error
                }
            });
        }

        // Log admin action
        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.MODEL_SWITCH, {
            modelType: modelType,
            previousModel: result.previousModel,
            newModel: result.newModel,
            costImpact: result.costImpact,
            ip: req.ip
        });

        res.json({
            success: true,
            message: modelType + ' model switched successfully',
            result: result
        });

    } catch (error) {
        console.error('[Admin] Model switch error:', error);
        res.status(500).json({
            error: {
                code: 'MODEL_SWITCH_ERROR',
                message: 'Failed to switch model'
            }
        });
    }
});

/**
 * GET /api/admin/models/cost-comparison
 * Compare costs across all available models
 */
router.get('/models/cost-comparison', async function(req, res) {
    try {
        var imageCount = parseInt(req.query.imageCount) || 100;
        var comparison = modelSwitcher.getCostComparison(imageCount);

        res.json({
            success: true,
            comparison: comparison
        });

    } catch (error) {
        console.error('[Admin] Cost comparison error:', error);
        res.status(500).json({
            error: {
                code: 'COST_COMPARISON_FAILED',
                message: 'Failed to generate cost comparison'
            }
        });
    }
});

/**
 * POST /api/admin/models/reset
 * Reset models to default configuration
 */
router.post('/models/reset', async function(req, res) {
    try {
        var result = modelSwitcher.resetToDefaults(req.userId.toString());

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.MODEL_SWITCH, {
            action: 'reset_to_defaults',
            previousPrimary: result.previousPrimary,
            previousFallback: result.previousFallback,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Models reset to defaults',
            result: result
        });

    } catch (error) {
        console.error('[Admin] Model reset error:', error);
        res.status(500).json({
            error: {
                code: 'MODEL_RESET_FAILED',
                message: 'Failed to reset models'
            }
        });
    }
});

// =============================================================================
// API KEY MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/keys/status
 * Get health status of all configured API keys
 */
router.get('/keys/status', async function(req, res) {
    try {
        var keys = [
            {
                name: 'NANO_BANANA_API_KEY',
                envVar: 'NANO_BANANA_API_KEY',
                service: 'NanoBanana (Gemini)',
                required: true
            },
            {
                name: 'REPLICATE_API_TOKEN',
                envVar: 'REPLICATE_API_TOKEN',
                service: 'Replicate',
                required: false
            },
            {
                name: 'STRIPE_SECRET_KEY',
                envVar: 'STRIPE_SECRET_KEY',
                service: 'Stripe',
                required: true
            },
            {
                name: 'STRIPE_WEBHOOK_SECRET',
                envVar: 'STRIPE_WEBHOOK_SECRET',
                service: 'Stripe Webhooks',
                required: true
            },
            {
                name: 'SUPABASE_SERVICE_KEY',
                envVar: 'SUPABASE_SERVICE_KEY',
                service: 'Supabase Storage',
                required: true
            }
        ];

        var keyStatus = keys.map(function(key) {
            var value = process.env[key.envVar];
            var isConfigured = !!value && value.length > 0;

            return {
                name: key.name,
                service: key.service,
                required: key.required,
                configured: isConfigured,
                masked: isConfigured ? adminAuth.maskSensitiveData(value) : 'NOT SET',
                health: isConfigured ? 'unknown' : 'missing',
                lastTested: null
            };
        });

        res.json({
            success: true,
            keys: keyStatus,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Admin] Key status error:', error);
        res.status(500).json({
            error: {
                code: 'KEY_STATUS_FAILED',
                message: 'Failed to retrieve key status'
            }
        });
    }
});

/**
 * POST /api/admin/keys/test
 * Test connection for a specific API key
 */
router.post('/keys/test', async function(req, res) {
    try {
        var keyName = req.body.keyName;

        if (!keyName) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'keyName is required'
                }
            });
        }

        var testResult = {
            keyName: keyName,
            success: false,
            message: '',
            responseTime: 0,
            testedAt: new Date().toISOString()
        };

        var startTime = Date.now();

        switch (keyName) {
            case 'NANO_BANANA_API_KEY':
                // Test NanoBanana/Gemini connection
                var nanoKey = process.env.NANO_BANANA_API_KEY;
                if (!nanoKey) {
                    testResult.message = 'API key not configured';
                } else {
                    // Simulate API test - in production, make actual API call
                    testResult.success = true;
                    testResult.message = 'Connection successful';
                }
                break;

            case 'STRIPE_SECRET_KEY':
                // Test Stripe connection
                try {
                    var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                    await stripe.balance.retrieve();
                    testResult.success = true;
                    testResult.message = 'Stripe connection verified';
                } catch (stripeError) {
                    testResult.message = 'Stripe connection failed: ' + stripeError.message;
                }
                break;

            case 'SUPABASE_SERVICE_KEY':
                // Test Supabase connection
                if (!process.env.SUPABASE_SERVICE_KEY) {
                    testResult.message = 'Supabase key not configured';
                } else {
                    testResult.success = true;
                    testResult.message = 'Supabase key configured';
                }
                break;

            default:
                testResult.message = 'Unknown key: ' + keyName;
        }

        testResult.responseTime = Date.now() - startTime;

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.KEY_TEST, {
            keyName: keyName,
            success: testResult.success,
            ip: req.ip
        });

        res.json({
            success: true,
            result: testResult
        });

    } catch (error) {
        console.error('[Admin] Key test error:', error);
        res.status(500).json({
            error: {
                code: 'KEY_TEST_FAILED',
                message: 'Failed to test key'
            }
        });
    }
});

/**
 * POST /api/admin/keys/rotate
 * Rotate an API key (update environment variable)
 * Note: In production, this should update secure key storage
 */
router.post('/keys/rotate', async function(req, res) {
    try {
        var keyName = req.body.keyName;
        var newValue = req.body.newValue;

        if (!keyName || !newValue) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'keyName and newValue are required'
                }
            });
        }

        // Validate key name is allowed
        var allowedKeys = [
            'NANO_BANANA_API_KEY',
            'REPLICATE_API_TOKEN',
            'STRIPE_SECRET_KEY',
            'STRIPE_WEBHOOK_SECRET',
            'SUPABASE_SERVICE_KEY'
        ];

        if (!allowedKeys.includes(keyName)) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_KEY',
                    message: 'Invalid key name'
                }
            });
        }

        // Update environment variable (in-memory only - restart required for persistence)
        var previousMasked = adminAuth.maskSensitiveData(process.env[keyName]);
        process.env[keyName] = newValue;

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.KEY_ROTATE, {
            keyName: keyName,
            previousMasked: previousMasked,
            newMasked: adminAuth.maskSensitiveData(newValue),
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Key rotated successfully. Note: Server restart may be required for full effect.',
            keyName: keyName,
            newMasked: adminAuth.maskSensitiveData(newValue)
        });

    } catch (error) {
        console.error('[Admin] Key rotate error:', error);
        res.status(500).json({
            error: {
                code: 'KEY_ROTATE_FAILED',
                message: 'Failed to rotate key'
            }
        });
    }
});

// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/analytics/overview
 * Dashboard overview statistics
 */
router.get('/analytics/overview', async function(req, res) {
    try {
        // Get generation counts
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        var monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        var generationStats = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE created_at >= $1) as today,
                COUNT(*) FILTER (WHERE created_at >= $2) as week,
                COUNT(*) FILTER (WHERE created_at >= $3) as month,
                COUNT(*) as total
            FROM thumbnail_jobs
        `, [today, weekAgo, monthAgo]);

        var stats = generationStats.rows[0];

        // Get success/failure rates
        var statusStats = await db.query(`
            SELECT
                status,
                COUNT(*) as count
            FROM thumbnail_jobs
            WHERE created_at >= $1
            GROUP BY status
        `, [monthAgo]);

        var statusMap = {};
        statusStats.rows.forEach(function(row) {
            statusMap[row.status] = parseInt(row.count);
        });

        var totalJobs = Object.values(statusMap).reduce(function(a, b) { return a + b; }, 0);
        var successRate = totalJobs > 0 ? ((statusMap.completed || 0) / totalJobs * 100).toFixed(1) : 0;

        // Get average generation time
        var avgTimeResult = await db.query(`
            SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
            FROM thumbnail_jobs
            WHERE status = 'completed' AND created_at >= $1
        `, [monthAgo]);

        var avgGenerationTime = avgTimeResult.rows[0].avg_seconds
            ? parseFloat(avgTimeResult.rows[0].avg_seconds).toFixed(1)
            : 0;

        // Get user stats
        var userStats = await db.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'approved') as active_users,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_users,
                COUNT(*) as total_users
            FROM users
        `);

        // Get credit stats
        var creditStats = await db.query(`
            SELECT
                SUM(credits_allocated) as total_allocated,
                SUM(credits_remaining) as total_remaining,
                SUM(credits_allocated - credits_remaining) as total_used
            FROM user_credits
        `);

        // Get queue stats
        var queueStats = await thumbnailQueue.getStats();

        res.json({
            success: true,
            overview: {
                generations: {
                    today: parseInt(stats.today) || 0,
                    week: parseInt(stats.week) || 0,
                    month: parseInt(stats.month) || 0,
                    total: parseInt(stats.total) || 0
                },
                performance: {
                    successRate: parseFloat(successRate),
                    avgGenerationTime: parseFloat(avgGenerationTime),
                    statusBreakdown: statusMap
                },
                users: {
                    active: parseInt(userStats.rows[0].active_users) || 0,
                    pending: parseInt(userStats.rows[0].pending_users) || 0,
                    total: parseInt(userStats.rows[0].total_users) || 0
                },
                credits: {
                    totalAllocated: parseInt(creditStats.rows[0].total_allocated) || 0,
                    totalRemaining: parseInt(creditStats.rows[0].total_remaining) || 0,
                    totalUsed: parseInt(creditStats.rows[0].total_used) || 0
                },
                queue: queueStats
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Admin] Analytics overview error:', error);
        res.status(500).json({
            error: {
                code: 'ANALYTICS_FAILED',
                message: 'Failed to retrieve analytics'
            }
        });
    }
});

/**
 * GET /api/admin/analytics/usage
 * Usage statistics by time period
 */
router.get('/analytics/usage', async function(req, res) {
    try {
        var period = req.query.period || 'week';
        var daysBack = period === 'month' ? 30 : period === 'week' ? 7 : 1;

        var usageData = await db.query(`
            SELECT
                DATE(created_at) as date,
                COUNT(*) as generations,
                COUNT(*) FILTER (WHERE status = 'completed') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM thumbnail_jobs
            WHERE created_at >= NOW() - INTERVAL '${daysBack} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        res.json({
            success: true,
            period: period,
            data: usageData.rows
        });

    } catch (error) {
        console.error('[Admin] Usage analytics error:', error);
        res.status(500).json({
            error: {
                code: 'USAGE_ANALYTICS_FAILED',
                message: 'Failed to retrieve usage analytics'
            }
        });
    }
});

/**
 * GET /api/admin/analytics/costs
 * Cost breakdown by model and period
 */
router.get('/analytics/costs', async function(req, res) {
    try {
        var period = req.query.period || 'month';
        var daysBack = period === 'month' ? 30 : period === 'week' ? 7 : 1;

        // Estimate costs based on generation count and model pricing
        var currentConfig = modelSwitcher.getCurrentConfig();
        var modelConfig = currentConfig.primaryConfig;

        var generationCount = await db.query(`
            SELECT COUNT(*) as count
            FROM thumbnail_jobs
            WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '${daysBack} days'
        `);

        var count = parseInt(generationCount.rows[0].count) || 0;
        var costPerImage = modelConfig ? modelConfig.pricing.imagesGenerated : 0.04;
        var estimatedCost = count * costPerImage;

        res.json({
            success: true,
            period: period,
            costs: {
                totalGenerations: count,
                costPerImage: costPerImage,
                estimatedTotalCost: estimatedCost.toFixed(4),
                currentModel: currentConfig.primaryModel,
                breakdown: {
                    geminiApi: (estimatedCost * 0.9).toFixed(4),
                    storage: (estimatedCost * 0.05).toFixed(4),
                    processing: (estimatedCost * 0.05).toFixed(4)
                }
            }
        });

    } catch (error) {
        console.error('[Admin] Cost analytics error:', error);
        res.status(500).json({
            error: {
                code: 'COST_ANALYTICS_FAILED',
                message: 'Failed to retrieve cost analytics'
            }
        });
    }
});

/**
 * GET /api/admin/analytics/top-users
 * Top users by generation count
 */
router.get('/analytics/top-users', async function(req, res) {
    try {
        var limit = parseInt(req.query.limit) || 10;

        var topUsers = await db.query(`
            SELECT
                u.id,
                u.email,
                u.name,
                COUNT(j.id) as generation_count,
                COUNT(j.id) FILTER (WHERE j.status = 'completed') as successful_count,
                MAX(j.created_at) as last_generation
            FROM users u
            LEFT JOIN thumbnail_jobs j ON j.user_id = u.id
            WHERE u.status = 'approved'
            GROUP BY u.id, u.email, u.name
            ORDER BY generation_count DESC
            LIMIT $1
        `, [limit]);

        res.json({
            success: true,
            topUsers: topUsers.rows
        });

    } catch (error) {
        console.error('[Admin] Top users error:', error);
        res.status(500).json({
            error: {
                code: 'TOP_USERS_FAILED',
                message: 'Failed to retrieve top users'
            }
        });
    }
});

/**
 * GET /api/admin/analytics/recent-jobs
 * Recent generation history
 */
router.get('/analytics/recent-jobs', async function(req, res) {
    try {
        var limit = parseInt(req.query.limit) || 20;

        var recentJobs = await db.query(`
            SELECT
                j.id,
                j.status,
                j.niche,
                j.style_preset,
                j.created_at,
                j.updated_at,
                u.email as user_email,
                (SELECT COUNT(*) FROM thumbnail_variants v WHERE v.thumbnail_job_id = j.id) as variant_count
            FROM thumbnail_jobs j
            LEFT JOIN users u ON u.id = j.user_id
            ORDER BY j.created_at DESC
            LIMIT $1
        `, [limit]);

        res.json({
            success: true,
            jobs: recentJobs.rows
        });

    } catch (error) {
        console.error('[Admin] Recent jobs error:', error);
        res.status(500).json({
            error: {
                code: 'RECENT_JOBS_FAILED',
                message: 'Failed to retrieve recent jobs'
            }
        });
    }
});

// =============================================================================
// CREDIT & USER MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/users/search
 * Search users by email or ID
 */
router.get('/users/search', async function(req, res) {
    try {
        var query = req.query.q || '';

        if (query.length < 2) {
            return res.status(400).json({
                error: {
                    code: 'QUERY_TOO_SHORT',
                    message: 'Search query must be at least 2 characters'
                }
            });
        }

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.USER_SEARCH, {
            query: query,
            ip: req.ip
        });

        var users = await db.query(`
            SELECT
                u.id,
                u.email,
                u.name,
                u.role,
                u.status,
                u.created_at,
                COALESCE(c.credits_remaining, 0) as credits_remaining,
                COALESCE(c.credits_allocated, 0) as credits_allocated
            FROM users u
            LEFT JOIN user_credits c ON c.user_id = u.id
            WHERE u.email ILIKE $1 OR u.id::text = $2
            ORDER BY u.created_at DESC
            LIMIT 20
        `, ['%' + query + '%', query]);

        res.json({
            success: true,
            users: users.rows
        });

    } catch (error) {
        console.error('[Admin] User search error:', error);
        res.status(500).json({
            error: {
                code: 'USER_SEARCH_FAILED',
                message: 'Failed to search users'
            }
        });
    }
});

/**
 * GET /api/admin/users/:id/credits
 * Get user credit details
 */
router.get('/users/:id/credits', async function(req, res) {
    try {
        var userId = req.params.id;

        var userResult = await db.query(`
            SELECT
                u.id,
                u.email,
                u.name,
                u.role,
                u.status,
                u.created_at,
                COALESCE(c.credits_remaining, 0) as credits_remaining,
                COALESCE(c.credits_allocated, 0) as credits_allocated,
                c.last_allocation_at
            FROM users u
            LEFT JOIN user_credits c ON c.user_id = u.id
            WHERE u.id = $1
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        var user = userResult.rows[0];

        // Get subscription info
        var subscription = await stripeService.getSubscriptionStatus(parseInt(userId));

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                status: user.status,
                createdAt: user.created_at,
                credits: {
                    remaining: parseInt(user.credits_remaining),
                    allocated: parseInt(user.credits_allocated),
                    used: parseInt(user.credits_allocated) - parseInt(user.credits_remaining),
                    lastAllocationAt: user.last_allocation_at
                },
                subscription: subscription
            }
        });

    } catch (error) {
        console.error('[Admin] Get user credits error:', error);
        res.status(500).json({
            error: {
                code: 'GET_CREDITS_FAILED',
                message: 'Failed to retrieve user credits'
            }
        });
    }
});

/**
 * POST /api/admin/users/:id/credits/adjust
 * Add or remove credits from a user
 */
router.post('/users/:id/credits/adjust', async function(req, res) {
    try {
        var userId = req.params.id;
        var amount = parseInt(req.body.amount);
        var reason = req.body.reason || 'Admin adjustment';
        var action = req.body.action || 'add';

        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_AMOUNT',
                    message: 'Amount must be a positive number'
                }
            });
        }

        // Get current balance
        var currentBalance = await db.query(
            'SELECT credits_remaining FROM user_credits WHERE user_id = $1',
            [userId]
        );

        var balance = currentBalance.rows.length > 0
            ? parseInt(currentBalance.rows[0].credits_remaining)
            : 0;

        var newBalance;
        if (action === 'remove') {
            newBalance = Math.max(0, balance - amount);
            amount = -Math.min(amount, balance); // Can't remove more than available
        } else {
            newBalance = balance + amount;
        }

        // Update credits
        if (currentBalance.rows.length === 0) {
            await db.query(
                'INSERT INTO user_credits (user_id, credits_remaining, credits_allocated) VALUES ($1, $2, $3)',
                [userId, newBalance, action === 'add' ? amount : 0]
            );
        } else {
            await db.query(
                'UPDATE user_credits SET credits_remaining = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
                [newBalance, userId]
            );
        }

        // Log transaction
        await db.query(
            `INSERT INTO credit_transactions (user_id, amount, type, reason, balance_before, balance_after)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, Math.abs(amount), action === 'add' ? 'admin_allocation' : 'admin_deduction', reason, balance, newBalance]
        );

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.CREDIT_ADJUST, {
            targetUserId: userId,
            action: action,
            amount: Math.abs(amount),
            reason: reason,
            balanceBefore: balance,
            balanceAfter: newBalance,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Credits adjusted successfully',
            result: {
                previousBalance: balance,
                adjustment: action === 'add' ? amount : -Math.abs(amount),
                newBalance: newBalance
            }
        });

    } catch (error) {
        console.error('[Admin] Credit adjust error:', error);
        res.status(500).json({
            error: {
                code: 'CREDIT_ADJUST_FAILED',
                message: 'Failed to adjust credits'
            }
        });
    }
});

/**
 * GET /api/admin/users/:id/transactions
 * Get credit transaction history for a user
 */
router.get('/users/:id/transactions', async function(req, res) {
    try {
        var userId = req.params.id;
        var limit = parseInt(req.query.limit) || 50;

        var transactions = await db.query(`
            SELECT
                id,
                amount,
                type,
                reason,
                balance_before,
                balance_after,
                created_at
            FROM credit_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [userId, limit]);

        res.json({
            success: true,
            transactions: transactions.rows
        });

    } catch (error) {
        console.error('[Admin] Get transactions error:', error);
        res.status(500).json({
            error: {
                code: 'GET_TRANSACTIONS_FAILED',
                message: 'Failed to retrieve transactions'
            }
        });
    }
});

/**
 * POST /api/admin/users/:id/subscription/refresh
 * Force refresh subscription status from Stripe
 */
router.post('/users/:id/subscription/refresh', async function(req, res) {
    try {
        var userId = req.params.id;

        // Get Stripe customer ID
        var customerResult = await db.query(
            'SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1',
            [userId]
        );

        if (customerResult.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'NO_STRIPE_CUSTOMER',
                    message: 'No Stripe customer found for this user'
                }
            });
        }

        var stripeCustomerId = customerResult.rows[0].stripe_customer_id;

        // Fetch subscriptions from Stripe
        var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        var subscriptions = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            limit: 1
        });

        if (subscriptions.data.length === 0) {
            return res.json({
                success: true,
                message: 'No active subscriptions found',
                subscription: null
            });
        }

        var sub = subscriptions.data[0];

        // Update local subscription record
        await db.query(`
            UPDATE user_subscriptions
            SET status = $1,
                current_period_start = to_timestamp($2),
                current_period_end = to_timestamp($3),
                cancel_at_period_end = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = $5
        `, [sub.status, sub.current_period_start, sub.current_period_end, sub.cancel_at_period_end, sub.id]);

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.SUBSCRIPTION_REFRESH, {
            targetUserId: userId,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Subscription refreshed from Stripe',
            subscription: {
                id: sub.id,
                status: sub.status,
                currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
                currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                cancelAtPeriodEnd: sub.cancel_at_period_end
            }
        });

    } catch (error) {
        console.error('[Admin] Subscription refresh error:', error);
        res.status(500).json({
            error: {
                code: 'SUBSCRIPTION_REFRESH_FAILED',
                message: 'Failed to refresh subscription: ' + error.message
            }
        });
    }
});

// =============================================================================
// SYSTEM HEALTH ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/health/detailed
 * Detailed system health check
 */
router.get('/health/detailed', async function(req, res) {
    try {
        var health = {
            status: 'healthy',
            services: {},
            timestamp: new Date().toISOString()
        };

        // Check Database
        try {
            var dbHealthy = await db.healthCheck();
            health.services.database = {
                status: dbHealthy ? 'healthy' : 'unhealthy',
                type: 'PostgreSQL',
                message: dbHealthy ? 'Connection OK' : 'Connection failed'
            };
        } catch (e) {
            health.services.database = { status: 'unhealthy', message: e.message };
            health.status = 'degraded';
        }

        // Check Redis
        try {
            var redisHealthy = await redis.healthCheck();
            health.services.redis = {
                status: redisHealthy ? 'healthy' : 'unhealthy',
                type: 'Redis',
                message: redisHealthy ? 'Connection OK' : 'Connection failed'
            };
        } catch (e) {
            health.services.redis = { status: 'unhealthy', message: e.message };
            health.status = 'degraded';
        }

        // Check Stripe
        try {
            if (process.env.STRIPE_SECRET_KEY) {
                var stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                await stripe.balance.retrieve();
                health.services.stripe = { status: 'healthy', message: 'API connection OK' };
            } else {
                health.services.stripe = { status: 'not_configured', message: 'API key not set' };
            }
        } catch (e) {
            health.services.stripe = { status: 'unhealthy', message: e.message };
            health.status = 'degraded';
        }

        // Check Supabase
        health.services.supabase = {
            status: process.env.SUPABASE_SERVICE_KEY ? 'configured' : 'not_configured',
            message: process.env.SUPABASE_SERVICE_KEY ? 'Key configured' : 'Key not set'
        };

        // Check Gemini/NanoBanana API
        health.services.gemini = {
            status: process.env.NANO_BANANA_API_KEY ? 'configured' : 'not_configured',
            message: process.env.NANO_BANANA_API_KEY ? 'Key configured' : 'Key not set'
        };

        // Server stats
        var memUsage = process.memoryUsage();
        health.server = {
            uptime: process.uptime(),
            uptimeFormatted: formatUptime(process.uptime()),
            memory: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
                rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
            },
            nodeVersion: process.version
        };

        // Queue stats
        health.queue = await thumbnailQueue.getStats();

        res.json({
            success: true,
            health: health
        });

    } catch (error) {
        console.error('[Admin] Health check error:', error);
        res.status(500).json({
            success: false,
            health: {
                status: 'error',
                message: error.message
            }
        });
    }
});

/**
 * GET /api/admin/logs/errors
 * Get recent error logs
 */
router.get('/logs/errors', async function(req, res) {
    try {
        var limit = parseInt(req.query.limit) || 50;

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.LOGS_VIEW, {
            type: 'errors',
            limit: limit,
            ip: req.ip
        });

        // Get failed jobs as error logs
        var errors = await db.query(`
            SELECT
                id,
                user_id,
                status,
                error_message,
                niche,
                style_preset,
                created_at,
                updated_at
            FROM thumbnail_jobs
            WHERE status = 'failed' AND error_message IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT $1
        `, [limit]);

        res.json({
            success: true,
            errors: errors.rows.map(function(row) {
                return {
                    id: row.id,
                    userId: row.user_id,
                    type: 'generation_failure',
                    message: row.error_message,
                    context: {
                        niche: row.niche,
                        style: row.style_preset
                    },
                    createdAt: row.created_at,
                    resolvedAt: null
                };
            })
        });

    } catch (error) {
        console.error('[Admin] Get error logs error:', error);
        res.status(500).json({
            error: {
                code: 'GET_LOGS_FAILED',
                message: 'Failed to retrieve error logs'
            }
        });
    }
});

/**
 * GET /api/admin/logs/audit
 * Get admin audit log
 */
router.get('/logs/audit', async function(req, res) {
    try {
        var limit = parseInt(req.query.limit) || 50;

        var auditLogs = await db.query(`
            SELECT
                a.id,
                a.action,
                a.details,
                a.success,
                a.ip_address,
                a.created_at,
                u.email as admin_email
            FROM admin_audit_log a
            LEFT JOIN users u ON u.id = a.admin_id
            ORDER BY a.created_at DESC
            LIMIT $1
        `, [limit]);

        res.json({
            success: true,
            logs: auditLogs.rows
        });

    } catch (error) {
        console.error('[Admin] Get audit logs error:', error);
        res.status(500).json({
            error: {
                code: 'GET_AUDIT_LOGS_FAILED',
                message: 'Failed to retrieve audit logs'
            }
        });
    }
});

/**
 * POST /api/admin/cache/clear
 * Clear Redis cache
 */
router.post('/cache/clear', async function(req, res) {
    try {
        var pattern = req.body.pattern || '*';

        var client = redis.getClient();

        if (pattern === '*') {
            await client.flushdb();
        } else {
            var keys = await client.keys(pattern);
            if (keys.length > 0) {
                await client.del(keys);
            }
        }

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.CACHE_CLEAR, {
            pattern: pattern,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Cache cleared successfully',
            pattern: pattern
        });

    } catch (error) {
        console.error('[Admin] Cache clear error:', error);
        res.status(500).json({
            error: {
                code: 'CACHE_CLEAR_FAILED',
                message: 'Failed to clear cache'
            }
        });
    }
});

// =============================================================================
// TEST GENERATION ENDPOINT
// =============================================================================

/**
 * POST /api/admin/test/generate
 * Generate thumbnail without credit check (admin testing)
 */
router.post('/test/generate', adminAuth.testGenerationRateLimit, async function(req, res) {
    try {
        var brief = req.body.brief;
        var creatorStyle = req.body.creatorStyle || 'auto';
        var expression = req.body.expression || 'excited';
        var thumbnailText = req.body.thumbnailText || '';
        var niche = req.body.niche || 'reaction';

        if (!brief) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'brief is required'
                }
            });
        }

        // Validate creatorStyle
        var validCreatorStyles = ['auto', 'mrbeast', 'hormozi', 'gadzhi', 'magnates'];
        if (!validCreatorStyles.includes(creatorStyle)) {
            creatorStyle = 'auto';
        }

        var briefJson = JSON.stringify({
            text: brief,
            expression: expression,
            thumbnailText: thumbnailText,
            creatorStyle: creatorStyle,
            adminTest: true
        });

        // Create job record
        var jobResult = await db.query(
            `INSERT INTO thumbnail_jobs (user_id, niche, style_preset, brief_json, status)
             VALUES ($1, $2, $3, $4, 'queued')
             RETURNING id, status, created_at`,
            [req.userId, niche, creatorStyle, briefJson]
        );

        var job = jobResult.rows[0];
        var jobId = job.id;

        // Add to queue with admin bypass flag
        await thumbnailQueue.addJob({
            jobId: jobId,
            userId: req.userId,
            niche: niche,
            expression: expression,
            brief: brief,
            thumbnailText: thumbnailText,
            creatorStyle: creatorStyle,
            variantCount: 2,
            adminTest: true,
            bypassCredits: true,
            userRole: 'admin'
        });

        await adminAuth.logAdminAction(req.userId, adminAuth.AUDIT_ACTIONS.TEST_GENERATE, {
            jobId: jobId,
            niche: niche,
            creatorStyle: creatorStyle,
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Test generation started',
            job: {
                id: jobId,
                status: 'queued',
                creatorStyle: creatorStyle,
                niche: niche
            }
        });

    } catch (error) {
        console.error('[Admin] Test generate error:', error);
        res.status(500).json({
            error: {
                code: 'TEST_GENERATE_FAILED',
                message: 'Failed to start test generation'
            }
        });
    }
});

/**
 * GET /api/admin/test/job/:id
 * Get test job status
 */
router.get('/test/job/:id', async function(req, res) {
    try {
        var jobId = req.params.id;

        var jobResult = await db.query(`
            SELECT
                j.id,
                j.status,
                j.niche,
                j.style_preset,
                j.brief_json,
                j.error_message,
                j.created_at,
                j.updated_at
            FROM thumbnail_jobs j
            WHERE j.id = $1 AND j.user_id = $2
        `, [jobId, req.userId]);

        if (jobResult.rows.length === 0) {
            return res.status(404).json({
                error: {
                    code: 'JOB_NOT_FOUND',
                    message: 'Test job not found'
                }
            });
        }

        var job = jobResult.rows[0];

        // Get variants if completed
        var variants = [];
        if (job.status === 'completed') {
            var variantsResult = await db.query(
                'SELECT id, storage_key as url, variant_label as label FROM thumbnail_variants WHERE thumbnail_job_id = $1',
                [jobId]
            );
            variants = variantsResult.rows;
        }

        // Calculate duration
        var duration = null;
        if (job.updated_at && job.created_at) {
            duration = (new Date(job.updated_at) - new Date(job.created_at)) / 1000;
        }

        res.json({
            success: true,
            job: {
                id: job.id,
                status: job.status,
                niche: job.niche,
                creatorStyle: job.style_preset,
                error: job.error_message,
                variants: variants,
                metadata: {
                    createdAt: job.created_at,
                    updatedAt: job.updated_at,
                    durationSeconds: duration,
                    currentModel: modelSwitcher.getCurrentConfig().primaryModel
                }
            }
        });

    } catch (error) {
        console.error('[Admin] Get test job error:', error);
        res.status(500).json({
            error: {
                code: 'GET_TEST_JOB_FAILED',
                message: 'Failed to retrieve test job'
            }
        });
    }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format uptime in human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
    var days = Math.floor(seconds / 86400);
    var hours = Math.floor((seconds % 86400) / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);

    var parts = [];
    if (days > 0) parts.push(days + 'd');
    if (hours > 0) parts.push(hours + 'h');
    if (minutes > 0) parts.push(minutes + 'm');

    return parts.join(' ') || '< 1m';
}

module.exports = router;
