# How to Run Thumbnail Builder Backend

## Prerequisites
- Node.js v18+
- PostgreSQL (optional, currently using in-memory mock for prototype routes)

## Setup

1. **Install Dependencies**:
   \`\`\`bash
   cd server
   npm install
   \`\`\`

2. **Environment Variables**:
   Create a \`.env\` file in the \`server/\` directory:
   \`\`\`env
   PORT=3000
   NANO_BANANA_API_KEY=your_actual_api_key_here
   NANO_BANANA_API_BASE_URL=https://api.nanobanana.com/v1
   THUMBNAIL_STORAGE_BUCKET=my-bucket
   THUMBNAIL_CDN_BASE_URL=https://cdn.example.com
   \`\`\`

3. **Start the Server**:
   \`\`\`bash
   npm start
   \`\`\`

## Architecture
- **`server/app.js`**: Main entry point.
- **`server/src/services/nanoClient.js`**: The robust client for Nano Banana API.
- **`server/src/routes/thumbnail.js`**: Handles job creation and polling.

## Frontend Prototype
The frontend (`create.html`) currently uses a **Mock Backend** (`mock-backend.js`) to allow you to test the UI flow without running the Node server. To switch to the real backend:
1. Open `create.html`.
2. Remove `<script src="mock-backend.js"></script>`.
3. Ensure the Node server is running on port 3000.
4. You may need to serve the HTML files via a web server (e.g., `npx serve .`) to avoid CORS issues with `file://` protocol.
