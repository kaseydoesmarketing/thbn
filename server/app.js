require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const nanoConfig = require('./src/config/nano');
const thumbnailRoutes = require('./src/routes/thumbnail');
const facesRoutes = require('./src/routes/faces');
const db = require('./src/db/connection');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// API Routes
app.use('/api', thumbnailRoutes);
app.use('/api/faces', facesRoutes);

// Health Check - comprehensive
app.get('/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            nano_config: !!nanoConfig.nanoBanana.apiKey,
            database: false
        }
    };

    // Check database connection
    try {
        const dbHealthy = await db.healthCheck();
        health.services.database = dbHealthy;
    } catch (error) {
        health.services.database = false;
        health.services.database_error = error.message;
    }

    // Set overall status
    if (!health.services.database) {
        health.status = 'degraded';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Simple health check for load balancers
app.get('/ping', (req, res) => {
    res.send('pong');
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[Error]', err);

    // Don't leak error details in production
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(err.status || 500).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[Server] SIGINT received, shutting down gracefully...');
    await db.close();
    process.exit(0);
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n========================================`);
        console.log(`  Thumbnail Builder Server`);
        console.log(`========================================`);
        console.log(`  Port:        ${PORT}`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`  Nano API:    ${nanoConfig.nanoBanana.baseUrl}`);
        console.log(`  API Key:     ${nanoConfig.nanoBanana.apiKey ? '✓ Configured' : '✗ Missing'}`);
        console.log(`  Uploads:     ${uploadsDir}`);
        console.log(`========================================\n`);
    });
}

module.exports = app;
