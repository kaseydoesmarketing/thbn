# ThumbnailBuilder.app - Architecture Notes

**Document Version**: 1.0
**Last Updated**: December 5, 2025
**Status**: Phase 0 MVP - Production Ready (Partial)

---

## 1. Current System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Static HTML)                          │
│   home.html → login.html → index.html (dashboard) → create.html         │
│   (Public)    (Auth)       (Protected)              (Wizard)            │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          NGINX REVERSE PROXY                            │
│   thumbnailbuilder.app:443 → Static files + API proxy                   │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
   ┌────────────────┐      ┌──────────────────┐      ┌─────────────────┐
   │  Static Files  │      │   Express API    │      │  Worker Process │
   │  /opt/thbn/*   │      │   Port 3001      │      │  Bull Queue     │
   └────────────────┘      └────────┬─────────┘      └────────┬────────┘
                                    │                         │
                 ┌──────────────────┼──────────────────┬──────┘
                 ▼                  ▼                  ▼
        ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
        │  PostgreSQL   │  │     Redis     │  │   Supabase    │
        │  (Docker)     │  │   (Docker)    │  │   Storage     │
        └───────────────┘  └───────────────┘  └───────────────┘
```

### 1.2 Service Inventory

| Service | Location | Port | Status |
|---------|----------|------|--------|
| Frontend | `/opt/thumbnailbuilder/*.html` | 443 (nginx) | ✅ Production |
| API Server | `/opt/thumbnailbuilder/server/app.js` | 3001 | ✅ Production |
| Worker | `/opt/thumbnailbuilder/server/src/workers/thumbnailWorker.js` | - | ✅ Production |
| PostgreSQL | Docker: `thumbnailbuilder-postgres` | 5432 | ✅ Production |
| Redis | Docker: `thumbnailbuilder-redis` | 6379 | ✅ Production |
| Storage | Supabase Cloud | - | ✅ Production |

---

## 2. Backend Implementation Details

### 2.1 Express Server (`server/app.js`)

**Routes Implemented:**
- `POST /api/auth/register` - User registration (requires admin approval)
- `POST /api/auth/login` - JWT authentication
- `GET /api/auth/me` - Current user info
- `POST /api/auth/admin/*` - Admin user management
- `POST /api/faces/upload` - Single face image upload
- `POST /api/faces` - Batch face upload (up to 10 images)
- `GET /api/faces` - List user's face profiles
- `POST /api/generate` - Start thumbnail generation job
- `GET /api/jobs/:id` - Poll job status
- `GET /api/library` - User's thumbnail gallery
- `GET /health` - Comprehensive health check
- `GET /ping` - Simple liveness probe

### 2.2 Database Schema (`server/src/db/schema.sql`)

```sql
-- Core tables implemented:
users                  -- User accounts with approval workflow
face_profiles          -- Face reference collections per user
face_profile_images    -- Individual face photos with quality status
thumbnail_jobs         -- Generation job tracking
thumbnail_variants     -- Generated thumbnail outputs
```

**Key Relationships:**
- `users` 1:N `face_profiles`
- `face_profiles` 1:N `face_profile_images`
- `users` 1:N `thumbnail_jobs`
- `thumbnail_jobs` 1:N `thumbnail_variants`

### 2.3 Job Queue System

**Technology**: Bull (Redis-backed)

**Queue Configuration** (`server/src/queues/thumbnailQueue.js`):
- Queue name: `thumbnail-generation`
- Default attempts: 2
- Backoff: exponential (5000ms base)
- Remove on complete: 100 jobs kept
- Remove on fail: 50 jobs kept

**Job Flow:**
1. `POST /api/generate` creates DB record + enqueues job
2. Worker picks up job from Redis queue
3. Worker calls Gemini API via `nanoClient.js`
4. Results stored in Supabase, URLs saved to DB
5. Job marked `completed` or `failed`

### 2.4 AI Integration (`server/src/services/nanoClient.js`)

**Current Model**: `gemini-2.0-flash-exp`

**Configuration:**
```javascript
this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
this.timeout = 120000; // 2 minutes
this.minRequestInterval = 4000; // Rate limiting (~15 RPM)
```

**Generation Parameters:**
```javascript
{
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
        responseModalities: ['image', 'text'],
        responseMimeType: 'text/plain'
    }
}
```

**Rate Limiting:**
- 4-second interval between requests
- Exponential backoff on 429/5xx errors
- Max 3 retry attempts

### 2.5 Storage Service (`server/src/services/storageService.js`)

**Provider**: Supabase Storage

**Buckets:**
- `faces` - User-uploaded face reference images
- `thumbnails` - Generated thumbnail outputs

**File Naming Convention:**
- Faces: `{userId}/{timestamp}_{random}.{ext}`
- Thumbnails: `{userId}/{jobId}/{variantLabel}.{ext}`

---

## 3. Frontend Implementation

### 3.1 Page Structure

| File | Purpose | Auth Required |
|------|---------|---------------|
| `home.html` | Public landing page | No |
| `login.html` | Login/Register forms | No |
| `index.html` | Dashboard (redirects if no token) | Yes |
| `create.html` | 6-step thumbnail wizard | Yes |
| `library.html` | Generated thumbnails gallery | Yes |
| `admin.html` | Admin user management | Yes (Admin) |
| `account.html` | User settings | Yes |
| `presets.html` | Style preset management | Yes |

### 3.2 Wizard Flow (`create.html`)

```
Step 1: Upload Faces (3-10 images)
    ↓
Step 2: Link Video (optional URL)
    ↓
Step 3: Select Style (preset cards)
    ↓
Step 4: Write Brief (text prompt)
    ↓
Step 5: Generate (calls /api/generate)
    ↓
Step 6: Review & Download
```

### 3.3 Authentication Flow

1. User registers via `POST /api/auth/register`
2. Account status = `pending` (requires admin approval)
3. Admin approves via `POST /api/auth/admin/approve/:userId`
4. User logs in via `POST /api/auth/login`
5. JWT token stored in `localStorage.tb_token`
6. Token sent in `Authorization: Bearer {token}` header

---

## 4. Infrastructure

### 4.1 Docker Compose Services

```yaml
services:
  app:         # API Server
  worker:      # Job processor
  redis:       # Job queue + cache
  postgres:    # Primary database
```

### 4.2 Environment Variables

**Required:**
```
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
REDIS_HOST, REDIS_PORT
SUPABASE_URL, SUPABASE_SERVICE_KEY
NANO_BANANA_API_KEY (Google Gen AI API Key)
JWT_SECRET
```

**Optional:**
```
GEMINI_MODEL (default: gemini-2.0-flash-exp)
CORS_ORIGIN (default: https://thumbnailbuilder.app)
NODE_ENV (production/development)
```

### 4.3 Nginx Configuration

- SSL termination via Let's Encrypt
- Static files served from `/opt/thumbnailbuilder`
- API proxied to `localhost:3001`
- Default index: `home.html`

---

## 5. Phase 0 MVP Status

### 5.1 Completed Features ✅

- [x] User registration with admin approval
- [x] JWT authentication
- [x] Face image upload (local + Supabase)
- [x] Thumbnail generation via Gemini API
- [x] Job queue with Bull/Redis
- [x] PostgreSQL persistence
- [x] Supabase storage integration
- [x] Docker deployment
- [x] Public landing page (home.html)
- [x] E2E flow verified (register → faces → generate → download)

### 5.2 Pending/Partial ⏳

- [ ] Face images NOT passed to Gemini (text-only prompts)
- [ ] Model upgrade: `gemini-2.0-flash-exp` → `gemini-2.5-flash-image`
- [ ] Python AI microservice (currently Node.js only)
- [ ] Face detection/quality scoring
- [ ] Rate limiting on auth endpoints
- [ ] STYLE_REFERENCE.md creation
- [ ] Template/niche intelligence

---

## 6. Upgrade Path: Phase 0 → Phase 1

### 6.1 Model Upgrade

**Current**: `gemini-2.0-flash-exp` (Node.js)
**Target**: `gemini-2.5-flash-image` (Python microservice)

**Required Changes:**
1. Create Python microservice using `google-genai` SDK
2. Implement `ImageConfig(aspect_ratio='16:9')`
3. Add face image inputs to `generate_content` call
4. Configure safety settings (`BLOCK_ONLY_HIGH`)
5. Add exponential backoff with tenacity

### 6.2 Face Integration

**Current**: Face images uploaded but NOT used in generation
**Target**: Face images passed as inputs to Gemini

**Required Changes:**
1. Fetch user's face images before generation
2. Include as `Part` objects in `contents` array
3. Bias prompts for face preservation
4. Implement likeness verification (optional)

### 6.3 Style Intelligence

**Current**: Basic style presets (text strings)
**Target**: Deep style rules from STYLE_REFERENCE.md

**Required Changes:**
1. Create STYLE_REFERENCE.md from Fiverr analysis
2. Implement template-based prompt construction
3. Add niche-specific composition rules
4. Mobile-first validation (168x94px legibility)

---

## 7. API Reference

### 7.1 Authentication

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}

Response:
{
  "success": true,
  "message": "Registration submitted. Please wait for admin approval.",
  "user": { "id": "...", "email": "...", "status": "pending" }
}
```

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response:
{
  "success": true,
  "user": { "id": "...", "email": "...", "role": "user" },
  "token": "eyJ..."
}
```

### 7.2 Thumbnail Generation

```http
POST /api/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "brief": "A tech review thumbnail showing excitement",
  "style": "vibrant",
  "niche": "tech",
  "videoUrl": "https://youtube.com/watch?v=..." // optional
}

Response:
{
  "success": true,
  "jobId": "uuid",
  "status": "queued"
}
```

```http
GET /api/jobs/{jobId}
Authorization: Bearer {token}

Response (completed):
{
  "id": "uuid",
  "status": "completed",
  "variants": [
    { "id": "...", "url": "https://...", "label": "A" },
    { "id": "...", "url": "https://...", "label": "B" }
  ]
}
```

---

## 8. File Structure

```
/Users/kvimedia/thumbnailbuilder/
├── home.html                 # Public landing page
├── home.css                  # Landing page styles
├── login.html                # Auth forms
├── index.html                # Dashboard
├── create.html               # Wizard
├── library.html              # Gallery
├── admin.html                # Admin panel
├── styles.css                # Global styles
├── app.js                    # Frontend wizard logic
├── ARCHITECTURE_NOTES.md     # This document
├── STYLE_REFERENCE.md        # [TODO] Style rules from Fiverr analysis
│
└── server/
    ├── app.js                # Express server
    ├── Dockerfile            # Node 20 Alpine
    ├── docker-compose.yml    # Full stack
    ├── .env                  # Environment config
    │
    └── src/
        ├── config/
        │   ├── nano.js       # Gemini API config
        │   └── redis.js      # Redis config
        ├── db/
        │   ├── connection.js # PostgreSQL pool
        │   └── schema.sql    # Database schema
        ├── middleware/
        │   └── auth.js       # JWT middleware
        ├── routes/
        │   ├── auth.js       # Auth endpoints
        │   ├── faces.js      # Face upload
        │   └── thumbnail.js  # Generation
        ├── services/
        │   ├── nanoClient.js # Gemini client
        │   └── storageService.js # Supabase
        ├── queues/
        │   └── thumbnailQueue.js # Bull queue
        └── workers/
            └── thumbnailWorker.js # Job processor
```

---

## 9. Deployment Notes

### 9.1 Server Details

- **Host**: 72.61.0.118 (Hostinger VPS)
- **Domain**: thumbnailbuilder.app
- **SSL**: Let's Encrypt via Certbot
- **Docker**: Compose v2

### 9.2 Deployment Commands

```bash
# Deploy updates
cd /opt/thumbnailbuilder
git pull origin main
cd server
docker compose build --no-cache app worker
docker compose up -d

# Check health
curl https://thumbnailbuilder.app/health
```

### 9.3 Monitoring

- Health endpoint: `GET /health`
- Queue stats: Included in health response
- Logs: `docker compose logs -f app worker`

---

## 10. Next Steps (Priority Order)

1. **Create STYLE_REFERENCE.md** - Analyze Fiverr portfolios, document style rules
2. **Upgrade Gemini Model** - Switch to `gemini-2.5-flash-image` when available
3. **Face Integration** - Pass face images to Gemini API
4. **Python Microservice** - Implement dedicated AI service with `google-genai`
5. **Rate Limiting** - Add to auth and generation endpoints
6. **Template System** - Implement niche-based prompt templates

---

*Document maintained by the ThumbnailBuilder development team.*
