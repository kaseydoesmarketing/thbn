# Thumbnail Builder - Backend Implementation Plan

## 1. Project Structure
We will adopt a standard Node.js/Express architecture, keeping the backend separate from the static frontend files for clarity.

```
/server
  /src
    /config       # Environment variables and configuration
    /db           # Database schema and connection
    /services     # Business logic (Nano Banana Client, Storage)
    /routes       # API Route definitions
    /middleware   # Auth and Error handling
    app.js        # Server entry point
```

## 2. Nano Banana Client (`nanoClient.js`)
- **Config**: Reads `NANO_BANANA_API_KEY` and `BASE_URL`.
- **Methods**:
  - `createJob(payload)`: POST /jobs
  - `getJobStatus(jobId)`: GET /jobs/:id
- **Resilience**: Implements exponential backoff for polling and retries for 5xx errors.

## 3. Data Model (SQL)
We will define the schema to support the flow:
- `face_profiles` & `face_profile_images`: Storing user uploaded references.
- `thumbnail_jobs`: Tracking the generation request state.
- `thumbnail_variants`: Storing the results (Nano Banana outputs).

## 4. API Routes
- `POST /api/faces`: Upload face images.
- `POST /api/generate`: Start a thumbnail job.
- `GET /api/jobs/:id`: Poll status.
- `GET /api/library`: List generated thumbnails.

## 5. Frontend Integration
- Update `app.js` to replace mock logic with real `fetch()` calls to these endpoints.
- **Mocking**: Since we are running in a static file environment for the prototype, we will include a `mock-server.js` script in the frontend that intercepts these requests and simulates the backend responses, allowing the UI to be fully testable without spinning up the Node process explicitly.

## 6. Verification
- We will verify the Nano Client with unit tests (mocked).
- We will verify the UI flow via the browser subagent.
