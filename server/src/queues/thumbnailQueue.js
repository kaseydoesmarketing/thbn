var Queue = require('bull');
var redisConfig = require('../config/redis');

var QUEUE_NAME = 'thumbnail-generation';

var thumbnailQueue = new Queue(QUEUE_NAME, {
    redis: redisConfig.config,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: 100,
        removeOnFail: 50
    }
});

thumbnailQueue.on('error', function(error) {
    console.error('[ThumbnailQueue] Error:', error.message);
});

thumbnailQueue.on('waiting', function(jobId) {
    console.log('[ThumbnailQueue] Job ' + jobId + ' waiting');
});

thumbnailQueue.on('active', function(job) {
    console.log('[ThumbnailQueue] Job ' + job.id + ' started processing');
});

thumbnailQueue.on('completed', function(job, result) {
    console.log('[ThumbnailQueue] Job ' + job.id + ' completed');
});

thumbnailQueue.on('failed', function(job, err) {
    console.error('[ThumbnailQueue] Job ' + job.id + ' failed:', err.message);
});

// Add a thumbnail generation job
async function addJob(data) {
    var job = await thumbnailQueue.add('generate', data, {
        jobId: data.jobId
    });
    console.log('[ThumbnailQueue] Added job ' + job.id);
    return job;
}

// Get job by ID
async function getJob(jobId) {
    return await thumbnailQueue.getJob(jobId);
}

// Get queue stats
async function getStats() {
    var waiting = await thumbnailQueue.getWaitingCount();
    var active = await thumbnailQueue.getActiveCount();
    var completed = await thumbnailQueue.getCompletedCount();
    var failed = await thumbnailQueue.getFailedCount();

    return {
        waiting: waiting,
        active: active,
        completed: completed,
        failed: failed
    };
}

// Close queue
async function close() {
    await thumbnailQueue.close();
}

module.exports = {
    queue: thumbnailQueue,
    addJob: addJob,
    getJob: getJob,
    getStats: getStats,
    close: close
};
