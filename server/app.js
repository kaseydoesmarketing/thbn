require('dotenv').config();

var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var path = require('path');

var nanoConfig = require('./src/config/nano');
var thumbnailRoutes = require('./src/routes/thumbnail');
var facesRoutes = require('./src/routes/faces');
var authRoutes = require('./src/routes/auth');
var stripeRoutes = require('./src/routes/stripe');
var billingRoutes = require('./src/routes/billing');
var adminRoutes = require('./src/routes/admin');
var db = require('./src/db/connection');
var redis = require('./src/config/redis');
var storageService = require('./src/services/storageService');
var thumbnailQueue = require('./src/queues/thumbnailQueue');
var { generalLimiter } = require('./src/middleware/rateLimit');

var app = express();
var PORT = process.env.PORT || 3000;

// Middleware - CORS configuration
var corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? 'https://thumbnailbuilder.app' : '*');
app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Apply general rate limiting (100 req/15min)
app.use(generalLimiter);

// Serve uploaded files statically
var uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use(function(req, res, next) {
        console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.path);
        next();
    });
}

// API Routes
// IMPORTANT: Order matters! More specific routes must come before less specific ones.
// Auth routes handle their own per-route auth middleware
app.use('/api/auth', authRoutes);
app.use('/api/faces', facesRoutes);
app.use('/api/billing', billingRoutes);  // Billing routes (requires auth)
app.use('/api/stripe', stripeRoutes);    // Stripe webhooks (no auth, signature verification)
app.use('/api/admin', adminRoutes);      // Admin routes (requires admin role)
app.use('/api', thumbnailRoutes);  // Keep at /api for /api/generate, /api/jobs, etc.

// Health Check - comprehensive
app.get('/health', async function(req, res) {
    var health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '9.2.0',
        pipeline: 'V9_PRO',
        features: {
            tier1: true,  // Multi-Model, Multi-Pass, Color Grading, 3D Text
            tier2: true,  // Emotion Detection, Face Enhancement, Style Transfer
            tier3: true   // A/B Variants, Dynamic Composition
        },
        services: {
            nano_config: !!nanoConfig.nanoBanana.apiKey,
            database: false,
            redis: false,
            storage: false
        },
        tier2Services: {
            emotion: 'loaded',
            faceEnhancement: 'loaded',
            styleTransfer: 'loaded'
        },
        tier3Services: {
            variantGenerator: 'loaded',
            composition: 'loaded'
        }
    };

    // Check database connection
    try {
        var dbHealthy = await db.healthCheck();
        health.services.database = dbHealthy;
    } catch (error) {
        health.services.database = false;
        health.services.database_error = error.message;
    }

    // Check Redis connection
    try {
        var redisHealthy = await redis.healthCheck();
        health.services.redis = redisHealthy;
    } catch (error) {
        health.services.redis = false;
        health.services.redis_error = error.message;
    }

    // Check Supabase storage
    try {
        var storageHealth = await storageService.healthCheck();
        health.services.storage = storageHealth.connected || false;
        health.services.storage_configured = storageHealth.configured;
    } catch (error) {
        health.services.storage = false;
        health.services.storage_error = error.message;
    }

    // Get queue stats
    try {
        var queueStats = await thumbnailQueue.getStats();
        health.queue = queueStats;
    } catch (error) {
        health.queue = { error: error.message };
    }

    // Set overall status
    if (!health.services.database || !health.services.redis) {
        health.status = 'degraded';
    }

    var statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Simple health check for load balancers
app.get('/ping', function(req, res) {
    res.send('pong');
});

// 404 handler
app.use(function(req, res) {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Global error handler
app.use(function(err, req, res, next) {
    console.error('[Error]', err);

    // Don't leak error details in production
    var message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(err.status || 500).json({
        error: message
    });
});

// Graceful shutdown
async function shutdown() {
    console.log('[Server] Shutting down gracefully...');
    await thumbnailQueue.close();
    await redis.close();
    await db.close();
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start Server
if (require.main === module) {
    // Initialize admin audit table on startup
    var adminAuth = require('./src/middleware/adminAuth');
    adminAuth.ensureAuditTable().catch(function(err) {
        console.warn('[Server] Failed to create audit table:', err.message);
    });

    app.listen(PORT, function() {
        console.log('\n========================================');
        console.log('  Thumbnail Builder Server v9.2.0');
        console.log('========================================');
        console.log('  Port:        ' + PORT);
        console.log('  Environment: ' + (process.env.NODE_ENV || 'development'));
        console.log('  Nano API:    ' + nanoConfig.nanoBanana.baseUrl);
        console.log('  API Key:     ' + (nanoConfig.nanoBanana.apiKey ? 'Configured' : 'Missing'));
        console.log('  Redis:       ' + (process.env.REDIS_HOST || 'localhost') + ':' + (process.env.REDIS_PORT || 6379));
        console.log('  Supabase:    ' + (storageService.isConfigured() ? 'Configured' : 'Not configured'));
        console.log('  Uploads:     ' + uploadsDir);
        console.log('========================================\n');
    });
}

module.exports = app;
