# Thumbnail Builder - Architecture Overview

## System Architecture

Thumbnail Builder is a full-stack web application that generates professional YouTube thumbnails using the Nano Banana API.

### Frontend (Static HTML/CSS/JS)
- **Location**: Root directory (index.html, create.html, etc.)
- **Technology**: Vanilla HTML, CSS, JavaScript
- **Design System**: Dark neon blueprint aesthetic with orange/purple accents
- **Pages**:
  - index.html - Dashboard/Landing page
  - create.html - 6-step wizard (Face → Video → Style → Brief → Thumbnails → Export)
  - library.html - Gallery of generated thumbnails
  - presets.html - Style preset management
  - account.html - User settings

### Backend (Node.js/Express)
- **Location**: server/ directory
- **Technology**: Node.js, Express, PostgreSQL (optional)
- **Architecture**: RESTful API with job-based processing

#### Key Components

**1. Configuration (server/src/config/nano.js)**
- Centralized configuration for Nano Banana API
- Environment variable validation
- Fail-fast on missing required vars

**2. Nano Banana Client (server/src/services/nanoClient.js)**
- Single source of truth for all Nano Banana API calls
- Methods:
  - createThumbnailJob(payload) - Initiates generation
  - pollJob(jobId) - Polls for completion
- Features:
  - Exponential backoff for polling
  - Retry logic for transient errors
  - Comprehensive error handling
  - No PII logging

**3. API Routes (server/src/routes/thumbnail.js)**
- POST /api/generate - Start thumbnail generation job
- GET /api/jobs/:id - Poll job status
- POST /api/faces - Upload face reference images (TODO)
- GET /api/library - List user's thumbnails (TODO)

**4. Data Model (server/src/db/schema.sql)**
- face_profiles - User face reference collections
- face_profile_images - Individual face photos with quality status
- thumbnail_jobs - Generation job tracking
- thumbnail_variants - Generated thumbnail outputs

### Job Flow

User Input (Frontend) → POST /api/generate → Create ThumbnailJob record → Call Nano Banana API → Poll for completion → Store results in ThumbnailVariant → Return to frontend

### Mock Backend (Development)
- **File**: mock-backend.js
- **Purpose**: Allows frontend testing without running Node server
- **Method**: Intercepts fetch() calls and returns simulated responses
- **Usage**: Included in create.html for prototype verification

## Security Considerations

1. **API Key Management**
   - Never hardcoded
   - Loaded from environment variables
   - Not logged or exposed to frontend

2. **User Data**
   - Face images stored with user_id association
   - All routes must authenticate and authorize
   - No PII in logs

3. **Input Validation**
   - Thumbnail spec enforcement (1280x720, ≤2MB, JPG/PNG)
   - File type validation on uploads
   - SQL injection prevention via parameterized queries

## Deployment Checklist

- [ ] Set all required environment variables
- [ ] Run database migrations
- [ ] Configure storage bucket (S3/GCS)
- [ ] Set up CDN for thumbnail delivery
- [ ] Configure authentication/authorization
- [ ] Set up job queue (Bull/RabbitMQ) for production
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging

## Known Limitations

1. **Current State**: Prototype with mock data
2. **Missing Features**:
   - Real database integration (using in-memory Map)
   - File upload handling
   - User authentication
   - Job queue system
   - Storage service integration
3. **Next Steps**:
   - Replace mock DB with PostgreSQL
   - Implement file upload to S3
   - Add authentication middleware
   - Set up background job processing
