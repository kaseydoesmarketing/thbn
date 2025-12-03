# Thumbnail Builder

**Powered by Title Tester Pro v8**

A professional YouTube thumbnail generation tool that creates face-locked, realistic thumbnails using AI.

## 🎨 Features

- **6-Step Creation Wizard**: Face → Video → Style → Brief → Thumbnails → Export
- **Face-Locked Realism**: Upload 3-10 face photos for personalized thumbnails
- **Niche-Driven Styles**: Pre-built style presets for different content types
- **AI-Powered Generation**: Powered by Nano Banana API
- **Premium Design**: Dark neon blueprint aesthetic

## 🚀 Quick Start

### Frontend (Prototype Mode)
1. Open `index.html` in your browser
2. Navigate to "Create" to start the wizard
3. The mock backend will simulate API calls

### Backend (Production Mode)

1. **Install Dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your NANO_BANANA_API_KEY
   ```

3. **Start Server**
   ```bash
   npm start
   ```

4. **Access API**
   - Server runs on `http://localhost:3000`
   - Health check: `http://localhost:3000/health`

## 📁 Project Structure

```
/
├── index.html              # Dashboard/Landing page
├── create.html             # 6-step creation wizard
├── library.html            # Thumbnail gallery
├── presets.html            # Style preset management
├── account.html            # User settings
├── styles.css              # Design system
├── app.js                  # Frontend logic
├── mock-backend.js         # Development mock server
├── server/                 # Backend (Node.js/Express)
│   ├── app.js             # Server entry point
│   ├── package.json       # Dependencies
│   ├── .env.example       # Environment template
│   └── src/
│       ├── config/        # Configuration
│       ├── services/      # Nano Banana client
│       ├── routes/        # API routes
│       └── db/            # Database schema
└── docs/
    ├── ARCHITECTURE.md
    └── IMPLEMENTATION_SUMMARY.md
```

## 🔧 Environment Variables

Required variables (see `server/.env.example`):

```env
NANO_BANANA_API_KEY=your_api_key_here
THUMBNAIL_STORAGE_BUCKET=your-bucket-name
THUMBNAIL_CDN_BASE_URL=https://cdn.example.com
```

## 🎯 API Endpoints

- `POST /api/generate` - Start thumbnail generation job
- `GET /api/jobs/:id` - Poll job status
- `GET /health` - Health check

## 📚 Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)
- [Backend Setup](server/README.md)

## 🔒 Security

- No hardcoded API keys
- Environment-based configuration
- No PII logging
- User data isolation

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript
- Custom design system (Dark Neon Blueprint)

**Backend:**
- Node.js + Express
- PostgreSQL (schema provided)
- Nano Banana API integration

## 📝 License

Proprietary - Title Tester Pro v8

## 🤝 Support

For issues or questions, contact the development team.
