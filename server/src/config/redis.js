var Redis = require('ioredis');

var redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
};

var redis = null;

function getClient() {
    if (!redis) {
        redis = new Redis(redisConfig);

        redis.on('error', function(err) {
            console.error('[Redis] Connection error:', err.message);
        });

        redis.on('connect', function() {
            console.log('[Redis] Connected to ' + redisConfig.host + ':' + redisConfig.port);
        });
    }
    return redis;
}

async function healthCheck() {
    try {
        var client = getClient();
        var result = await client.ping();
        return result === 'PONG';
    } catch (error) {
        console.error('[Redis] Health check failed:', error.message);
        return false;
    }
}

async function close() {
    if (redis) {
        await redis.quit();
        redis = null;
    }
}

module.exports = {
    getClient: getClient,
    healthCheck: healthCheck,
    close: close,
    config: redisConfig
};
