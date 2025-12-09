# ThumbnailBuilder Admin Console v9.2.0

## Overview

The Admin Console provides comprehensive system management capabilities for ThumbnailBuilder administrators. This guide covers setup, features, and usage.

## Table of Contents

1. [Setup & Installation](#setup--installation)
2. [Features](#features)
3. [API Reference](#api-reference)
4. [Security](#security)
5. [Troubleshooting](#troubleshooting)

---

## Setup & Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Admin user account with `role = 'admin'` in the database

### Files Created

| File | Location | Description |
|------|----------|-------------|
| `admin-v9-console.html` | `/thumbnailbuilder/` | Main admin console frontend |
| `admin-console-styles.css` | `/thumbnailbuilder/` | Admin console styling |
| `admin.js` | `/server/src/routes/` | Admin API endpoints |
| `adminAuth.js` | `/server/src/middleware/` | Admin authentication middleware |

### Database Setup

Run the following SQL to create the audit log table:

```sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    success BOOLEAN DEFAULT true,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);
```

Alternatively, call `ensureAuditTable()` from `adminAuth.js` on server startup.

### Server Integration

Add the admin routes to your Express app:

```javascript
// In your main server file (e.g., app.js or index.js)
const adminRoutes = require('./routes/admin');

// Mount admin routes
app.use('/api/admin', adminRoutes);

// Initialize audit table on startup
const adminAuth = require('./middleware/adminAuth');
adminAuth.ensureAuditTable();
```

### Environment Variables

Ensure these are configured:

```env
# Required
NANO_BANANA_API_KEY=your_gemini_api_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret
SUPABASE_SERVICE_KEY=your_supabase_key
JWT_SECRET=your_jwt_secret

# Optional
GEMINI_PRIMARY_MODEL=gemini-3-pro-image-preview
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-image
```

### Accessing the Console

1. Navigate to `/admin-v9-console.html`
2. Log in with admin credentials
3. The console will redirect non-admin users automatically

---

## Features

### 1. Dashboard Overview

The main dashboard provides at-a-glance system metrics:

- **Today's Generations**: Total thumbnails generated today
- **This Week**: Weekly generation count
- **Active Users**: Users with approved status
- **Credits Used**: Total credits consumed

Additional panels show:
- Generation activity chart (7/30 day view)
- Queue status (active, waiting, completed, failed)
- Recent generation history

### 2. Model Switcher

Manage AI model configuration:

#### View Models
- List all available Gemini models
- See pricing, limits, and features
- Model status indicators (stable, preview, deprecated)

#### Switch Models
- Set primary model for image generation
- Configure fallback model for redundancy
- Real-time cost impact calculation

#### Cost Comparison
- Compare costs across all models
- Estimate expenses for projected usage
- Current model highlighted

**API Endpoints:**
```
GET  /api/admin/models              - List all models
POST /api/admin/models/switch       - Switch active model
GET  /api/admin/models/cost-comparison - Compare model costs
POST /api/admin/models/reset        - Reset to defaults
```

### 3. API Key Management

Monitor and manage API credentials:

#### Key Status
- View configured keys (masked for security)
- Health status indicators
- Required vs optional keys

#### Test Connections
- Verify API connectivity
- Response time measurement
- Error message display

#### Key Rotation
- Update API keys in memory
- Audit log for all rotations
- Server restart notice

**API Endpoints:**
```
GET  /api/admin/keys/status  - Get key health status
POST /api/admin/keys/test    - Test key connection
POST /api/admin/keys/rotate  - Rotate API key
```

**Managed Keys:**
- `NANO_BANANA_API_KEY` - Gemini API access
- `REPLICATE_API_TOKEN` - Replicate integration
- `STRIPE_SECRET_KEY` - Payment processing
- `STRIPE_WEBHOOK_SECRET` - Webhook verification
- `SUPABASE_SERVICE_KEY` - Storage access

### 4. Usage Analytics

Comprehensive usage statistics:

#### Generation Trends
- Daily generation counts
- Success/failure breakdown
- Interactive chart (7/30 days)

#### Cost Breakdown
- Total generations in period
- Cost per image
- Estimated total spend
- Category breakdown (API, storage, processing)

#### Top Users
- Users ranked by generation count
- Success rate per user
- Last activity timestamp

#### Recent Jobs
- Last 20 generation jobs
- Status, style, variants
- User attribution

**API Endpoints:**
```
GET /api/admin/analytics/overview    - Dashboard stats
GET /api/admin/analytics/usage       - Usage by period
GET /api/admin/analytics/costs       - Cost breakdown
GET /api/admin/analytics/top-users   - Top users list
GET /api/admin/analytics/recent-jobs - Recent generation history
```

### 5. Credit & Plan Editor

User credit management:

#### User Search
- Search by email or user ID
- View credit balance
- Subscription status

#### Credit Adjustment
- Add credits manually
- Remove credits (refunds, corrections)
- Reason tracking for audit
- Transaction history

#### Subscription Management
- View current subscription
- Force refresh from Stripe
- Plan details display

**API Endpoints:**
```
GET  /api/admin/users/search                    - Search users
GET  /api/admin/users/:id/credits               - Get user credits
POST /api/admin/users/:id/credits/adjust        - Add/remove credits
GET  /api/admin/users/:id/transactions          - Credit transaction history
POST /api/admin/users/:id/subscription/refresh  - Refresh from Stripe
```

### 6. System Health Monitor

Real-time system status:

#### Service Status
- Database (PostgreSQL)
- Redis cache
- Stripe API
- Supabase storage
- Gemini API

#### Server Statistics
- Uptime
- Memory usage (heap, RSS)
- Node.js version

#### Queue Status
- Active jobs
- Waiting jobs
- Completed count
- Failed count

#### Error Logs
- Recent failed jobs
- Error messages
- Context information

#### Audit Log
- Admin action history
- Success/failure status
- IP tracking

**API Endpoints:**
```
GET  /api/admin/health/detailed  - Detailed health check
GET  /api/admin/logs/errors      - Recent error logs
GET  /api/admin/logs/audit       - Admin audit log
POST /api/admin/cache/clear      - Clear Redis cache
```

### 7. Test Generation Tool

Admin testing functionality:

#### Quick Test Form
- Brief/scene description
- Creator style selection
- Niche and expression
- Optional text overlay

#### Results Display
- Generation status tracking
- Completion metadata
- Variant preview
- Model and cost info

#### Rate Limiting
- 10 tests per hour per admin
- Bypass credit requirements

**API Endpoints:**
```
POST /api/admin/test/generate  - Generate without credit check
GET  /api/admin/test/job/:id   - Get test job status
```

---

## API Reference

### Authentication

All admin endpoints require:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. User with `role = 'admin'` in database
3. User with `status = 'approved'`

### Response Format

**Success Response:**
```json
{
    "success": true,
    "data": { ... }
}
```

**Error Response:**
```json
{
    "error": {
        "code": "ERROR_CODE",
        "message": "Human-readable message"
    }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_REQUIRED` | 401 | No valid authentication |
| `ADMIN_REQUIRED` | 403 | User is not admin |
| `USER_NOT_FOUND` | 404 | User does not exist |
| `INVALID_REQUEST` | 400 | Missing/invalid parameters |
| `RATE_LIMITED` | 429 | Too many requests |
| `*_FAILED` | 500 | Operation failed |

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| Test Generation | 10/hour per admin |
| Key Rotation | No limit (audited) |
| Credit Adjustment | No limit (audited) |

---

## Security

### Access Control

- All endpoints require admin role
- Role verified on every request
- Suspended admins cannot access

### Data Protection

- API keys masked to last 4 characters
- Passwords never exposed
- Sensitive data filtered from logs

### Audit Trail

Every admin action is logged:
- Admin user ID
- Action type
- Detailed context
- Success/failure status
- IP address
- Timestamp

### CSRF Protection

- JWT tokens in headers (not cookies)
- Origin validation recommended
- Implement X-CSRF-Token for enhanced security

### Recommendations

1. **Rotate JWT secrets regularly**
2. **Use HTTPS in production**
3. **Implement IP allowlisting for admin access**
4. **Review audit logs periodically**
5. **Limit admin account creation**

---

## Troubleshooting

### Console Not Loading

1. Check browser console for errors
2. Verify user has admin role: `SELECT role FROM users WHERE email = 'your@email.com'`
3. Check JWT token validity
4. Ensure backend routes are mounted

### API Errors

**401 Unauthorized:**
- Token expired - log in again
- Token invalid - clear localStorage, re-login

**403 Forbidden:**
- User not admin
- Account suspended

**500 Server Error:**
- Check server logs
- Verify database connection
- Check Redis connection

### Key Test Failures

**Stripe:**
- Verify key format (sk_test_ or sk_live_)
- Check Stripe dashboard for key status

**Supabase:**
- Verify service key format
- Check project status

**NanoBanana/Gemini:**
- Verify key is active
- Check API quota

### Model Switch Issues

- Verify model ID exists in config
- Check for deprecation warnings
- Restart server if changes don't apply

### Credit Adjustment Not Reflecting

1. Check transaction history for entry
2. Verify user_credits table updated
3. Clear user's cached data
4. Check for database transaction rollback

### Queue Jobs Stuck

1. Check Redis connection
2. Verify worker processes running
3. Clear failed jobs if necessary
4. Check for process memory issues

---

## Changelog

### v9.2.0 (Current)
- Initial admin console release
- Model switcher functionality
- API key management
- Usage analytics dashboard
- Credit editor
- System health monitor
- Test generation tool
- Full audit logging

---

## Support

For issues or feature requests:
1. Check existing documentation
2. Review server logs
3. Check audit log for recent changes
4. Contact system administrator

---

*ThumbnailBuilder Admin Console v9.2.0*
*Last updated: December 2025*
