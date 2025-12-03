const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nanoConfig = require('./src/config/nano');
const thumbnailRoutes = require('./src/routes/thumbnail');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', thumbnailRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', nano_config: !!nanoConfig.nanoBanana.apiKey });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(\`Thumbnail Builder Server running on port \${PORT}\`);
        console.log(\`Nano Banana Client configured for: \${nanoConfig.nanoBanana.baseUrl}\`);
    });
}

module.exports = app;
