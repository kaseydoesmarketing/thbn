const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'thumbnail_builder',
    user: process.env.DB_USER || 'thumbnail_builder',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
});

// Log connection events
pool.on('connect', () => {
    console.log('[DB] New client connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client:', err);
});

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('[DB] Query:', { text: text.substring(0, 50), duration: `${duration}ms`, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        console.error('[DB] Query error:', { text: text.substring(0, 50), error: error.message });
        throw error;
    }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} PostgreSQL client
 */
async function getClient() {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    const originalRelease = client.release.bind(client);

    // Override query to log
    client.query = async (...args) => {
        const start = Date.now();
        const result = await originalQuery(...args);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('[DB] Transaction query:', { duration: `${duration}ms` });
        }
        return result;
    };

    // Override release to prevent double-release
    let released = false;
    client.release = () => {
        if (released) return;
        released = true;
        originalRelease();
    };

    return client;
}

/**
 * Check database connection health
 * @returns {Promise<boolean>} True if connected
 */
async function healthCheck() {
    try {
        const result = await pool.query('SELECT NOW()');
        return !!result.rows[0];
    } catch (error) {
        console.error('[DB] Health check failed:', error.message);
        return false;
    }
}

/**
 * Close all pool connections
 */
async function close() {
    await pool.end();
    console.log('[DB] Connection pool closed');
}

module.exports = {
    query,
    getClient,
    healthCheck,
    close,
    pool
};
