# ThumbnailBuilder v9.2.0 Command Center 🚀

**Premium AI-powered thumbnail generation platform with Stripe monetization**

![Version](https://img.shields.io/badge/version-9.2.0-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-blue)
![Redis](https://img.shields.io/badge/redis-7%2B-red)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### 💰 **Monetization**
- Complete Stripe integration with subscription billing
- Two-tier pricing: Solo ($24.99) and Pro ($49.99)
- Credit-based generation system with atomic operations
- Automatic monthly renewals
- Customer portal for self-service

### 🎨 **Premium UI**
- Glassmorphism command center design
- 3-column professional workspace layout
- 5 visually distinct creator style cards (Auto, MrBeast, Hormozi, Gadzhi, Magnates)
- 4-step premium loading animation
- Real-time credit balance display

### 🤖 **Multi-Model AI Pipeline**
- **Gemini 3 Pro Image Preview** (Pro tier) - $0.007 per generation
- **Gemini 2.5 Flash Image** (Solo tier) - $0.002 per generation
- **NanoBanana API** - Composition generation
- **Flux PuLID** - Face integration

### 🛡️ **Enterprise Features**
- Role-based access control (user, admin)
- Comprehensive admin console with 7 tabs
- Live model switching (no restart required)
- Analytics dashboard with Chart.js
- Audit logging for all admin actions
- Rate limiting (100 req/15min global, 5 req/15min auth)
- Health monitoring and error logging

### 📊 **Admin Console**
- **Overview:** System health, user stats, revenue metrics
- **Models:** Live model switching, cost tracking
- **API Keys:** Status monitoring, connectivity testing
- **Analytics:** Usage graphs, top users, creator style popularity
- **Credits:** User search, credit history, manual adjustments
- **Health:** Detailed service status, error logs, queue stats
- **Test:** Admin test generation, webhook simulator

---

## 🚀 Quick Start

### Option 1: Local Development (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/thumbnailbuilder.git
cd thumbnailbuilder

# 2. Setup database
createdb thumbnailbuilder
cd server
npm install
npm run migrate:up

# 3. Configure environment
cp .env.example .env
nano .env  # Add your API keys

# 4. Start application
pm2 start ecosystem.config.js

# 5. Run health check
cd ..
./scripts/health-check.sh

# 6. Open application
open http://localhost:3000/create-v9-command-center.html
```

**See [QUICK_START.md](./QUICK_START.md) for detailed instructions.**

### Option 2: Production Deployment

```bash
# Automated deployment script
sudo ./scripts/deploy.sh
```

**See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) for full guide.**

---

## 📁 Project Structure

```
thumbnailbuilder/
├── server/                          # Backend Node.js application
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js             # Authentication endpoints
│   │   │   ├── billing.js          # Billing endpoints (6 routes)
│   │   │   ├── stripe.js           # Stripe webhook handler
│   │   │   ├── admin.js            # Admin endpoints (23 routes)
│   │   │   ├── thumbnail.js        # Generation endpoints
│   │   │   └── faces.js            # Face upload endpoint
│   │   ├── services/
│   │   │   ├── stripeService.js    # Stripe integration logic
│   │   │   └── storageService.js   # Supabase storage
│   │   ├── middleware/
│   │   │   ├── creditCheck.js      # Credit verification
│   │   │   ├── adminAuth.js        # Admin role verification
│   │   │   └── rateLimit.js        # Rate limiting
│   │   ├── workers/
│   │   │   └── thumbnailWorkerV9Pro.js  # Bull queue worker
│   │   ├── db/
│   │   │   ├── connection.js       # PostgreSQL connection
│   │   │   └── migrations/
│   │   │       ├── 001_initial.sql
│   │   │       └── 002_stripe_subscriptions.sql  # 6 new tables
│   │   ├── config/
│   │   │   ├── nano.js
│   │   │   └── redis.js
│   │   └── queues/
│   │       └── thumbnailQueue.js
│   ├── app.js                      # Express app entry point
│   ├── package.json
│   └── ecosystem.config.js         # PM2 configuration
│
├── create-v9-command-center.html   # Premium UI (41KB)
├── command-center-styles.css       # UI styles (38KB)
├── loading-state-component.html    # 4-step loading animation
├── loading-state-premium.css       # Loading styles
├── admin-v9-console.html           # Admin interface (28KB)
├── admin-console-styles.css        # Admin styles
│
├── scripts/
│   ├── deploy.sh                   # Automated deployment
│   ├── health-check.sh             # System health verification
│   └── allocate-test-credits.sql   # Test credit allocation
│
├── test-api-endpoints.sh           # API testing script
│
└── docs/
    ├── QUICK_START.md              # Fast-track setup guide
    ├── PRODUCTION_DEPLOYMENT_CHECKLIST.md
    ├── E2E_TESTING_GUIDE.md
    ├── PROJECT_COMPLETION_SUMMARY.md
    ├── ADMIN_CONSOLE_GUIDE.md
    ├── V9_MIGRATION_GUIDE.md
    ├── PHASE_1_FOUNDATION_COMPLETE.md
    ├── PHASE_2_UI_COMPLETE.md
    └── PHASE_3_ADMIN_COMPLETE.md
```

---

## 🔧 Technology Stack

**Backend:**
- Node.js 18+ (Express.js framework)
- PostgreSQL 14+ (primary database)
- Redis 7+ (queue, cache, rate limiting)
- Bull (job queue for async generation)
- Stripe SDK (payment processing)
- JWT (authentication)

**Frontend:**
- Vanilla HTML5/CSS3/JavaScript
- Chart.js (admin analytics)
- No framework dependencies

**External APIs:**
- NanoBanana API (composition)
- Google Gemini API (style enhancement)
- Flux PuLID (face integration)
- Stripe API (payments)

**Storage:**
- Supabase Storage (thumbnails)
- Local filesystem (temporary)

**Deployment:**
- PM2 (process management)
- Nginx (reverse proxy)
- Let's Encrypt (SSL)

---

## 📊 Database Schema

**6 New Tables (Migration 002):**

```sql
subscription_plans       -- Solo & Pro plan definitions
user_subscriptions       -- Active subscriptions
user_credits             -- Credit balances (with row locking)
credit_transactions      -- Full audit trail
stripe_events            -- Webhook deduplication
stripe_customers         -- Stripe customer mapping
admin_audit_log          -- Admin action logging
```

**Helper Functions:**
- `get_user_credit_balance(user_id)` - Real-time balance
- `deduct_credits(user_id, amount, description)` - Atomic deduction

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Billing (6 endpoints)
- `GET /api/billing/plans` - List subscription plans
- `POST /api/billing/checkout` - Create Stripe checkout
- `POST /api/billing/portal` - Customer portal access
- `GET /api/billing/subscription` - Current subscription
- `GET /api/billing/credits` - Credit balance

### Stripe Webhooks
- `POST /api/stripe/webhook` - Webhook handler

### Generation
- `POST /api/generate` - Generate thumbnail (requires credits)
- `GET /api/jobs/:jobId` - Job status polling

### Admin (23 endpoints)
- **Models:** GET /models, POST /models/switch
- **Analytics:** GET /analytics/overview, /usage, /costs, /top-users
- **Credits:** GET /users/search, POST /users/:id/credits/adjust
- **Health:** GET /health/detailed, /logs/errors
- **Test:** POST /test/generate

See [API documentation](./E2E_TESTING_GUIDE.md#api-endpoint-tests) for full details.

---

## 💳 Pricing & Profit Margins

### Solo Plan - $24.99/month
- 100 credits per month
- Gemini 2.5 Flash Image ($0.010 per generation)
- **Cost:** $1.00/month
- **Profit:** $23.99/month (96% margin)

### Pro Plan - $49.99/month
- 200 credits per month
- Gemini 3 Pro Image Preview ($0.015 per generation)
- **Cost:** $3.00/month
- **Profit:** $46.99/month (94% margin)

**Break-even:** 42 Solo subscribers = $1,049/month

---

## 🧪 Testing

### Run All Tests

```bash
# API endpoint tests (30+ endpoints)
./test-api-endpoints.sh

# Health check (system verification)
./scripts/health-check.sh

# Allocate test credits
psql -d thumbnailbuilder -f scripts/allocate-test-credits.sql
```

### E2E Test Scenarios

See [E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md) for:
- User registration → first thumbnail flow
- Subscription renewal testing
- Plan upgrade testing (Solo → Pro)
- Stripe webhook testing
- Admin console testing
- Security testing (SQL injection, JWT tampering)
- Load testing with Artillery (50 req/sec)

---

## 📈 Monitoring

### Application Health

```bash
# Health check endpoint
curl http://localhost:3000/health

# PM2 monitoring
pm2 status
pm2 logs
pm2 monit

# Queue statistics
redis-cli LLEN bull:thumbnail-generation:active
```

### Admin Console Monitoring

Access at: `http://localhost:3000/admin-v9-console.html`

**Real-time metrics:**
- Total users, active subscriptions, revenue
- Total generations, average per user
- System health (DB, Redis, Storage, Queue)
- Error logs (last 50 errors)
- Queue statistics (waiting, active, completed, failed)

---

## 🔐 Security

### Authentication & Authorization
- JWT tokens (7-day expiry)
- Bcrypt password hashing (10 rounds)
- Role-based access control (user, admin)

### Rate Limiting
- General: 100 requests / 15 minutes
- Auth endpoints: 5 requests / 15 minutes

### Stripe Security
- Webhook signature verification (SHA-256 HMAC)
- Event deduplication
- Idempotency keys

### Database Security
- Parameterized queries (SQL injection prevention)
- Row-level locking for credit operations
- Audit logging for admin actions

### API Key Protection
- Environment variables only
- Masked in logs (last 4 chars shown)
- Admin console masks sensitive data

---

## 🚨 Troubleshooting

### Server Won't Start
```bash
# Check port availability
lsof -i :3000

# View logs
pm2 logs --lines 100

# Check environment variables
cat .env | grep -v "^#"
```

### Database Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -d thumbnailbuilder -c "SELECT 1;"

# View migration status
npm run migrate:status
```

### Redis Issues
```bash
# Test Redis connection
redis-cli ping

# View Redis info
redis-cli INFO
```

### Stripe Webhooks Not Working
```bash
# Test locally with Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

See [QUICK_START.md](./QUICK_START.md#troubleshooting) for complete troubleshooting guide.

---

## 📚 Documentation

### Getting Started
- **[QUICK_START.md](./QUICK_START.md)** - Fast-track setup guide (5 minutes)
- **[PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)** - Complete deployment guide

### Testing & Quality
- **[E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md)** - Comprehensive testing procedures
- **[V9_MIGRATION_GUIDE.md](./V9_MIGRATION_GUIDE.md)** - v8 → v9 upgrade path

### Admin & Operations
- **[ADMIN_CONSOLE_GUIDE.md](./ADMIN_CONSOLE_GUIDE.md)** - Admin interface walkthrough
- **[PROJECT_COMPLETION_SUMMARY.md](./PROJECT_COMPLETION_SUMMARY.md)** - Full project overview

### Phase Documentation
- **[PHASE_1_FOUNDATION_COMPLETE.md](./PHASE_1_FOUNDATION_COMPLETE.md)** - Stripe integration
- **[PHASE_2_UI_COMPLETE.md](./PHASE_2_UI_COMPLETE.md)** - Command center UI
- **[PHASE_3_ADMIN_COMPLETE.md](./PHASE_3_ADMIN_COMPLETE.md)** - Admin console

---

## 🛠️ Development

### Local Development

```bash
# Install dependencies
cd server && npm install

# Run development server (with auto-reload)
npm run dev

# Run migrations
npm run migrate:up

# Check migration status
npm run migrate:status

# Rollback migration
npm run migrate:down
```

### Database Operations

```bash
# Create backup
pg_dump thumbnailbuilder > backup_$(date +%Y%m%d).sql

# Restore backup
psql -d thumbnailbuilder < backup_20251209.sql

# Grant admin role to user
psql -d thumbnailbuilder -c "UPDATE users SET role = 'admin' WHERE email = 'user@example.com';"

# View all users with credits
psql -d thumbnailbuilder -c "
SELECT u.email, uc.credits_remaining, uc.credits_allocated
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id;
"
```

### Deployment

```bash
# Deploy to production (automated)
sudo ./scripts/deploy.sh

# Rollback to previous version
sudo ./scripts/deploy.sh rollback
```

---

## 📦 Installation

### System Requirements

- **OS:** Ubuntu 22.04 LTS (or macOS for development)
- **CPU:** 2+ cores
- **RAM:** 4GB+ (8GB recommended)
- **Storage:** 20GB+ SSD

### Dependencies

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 14+
sudo apt install -y postgresql postgresql-contrib

# Redis 7+
sudo apt install -y redis-server

# Nginx (for production)
sudo apt install -y nginx

# PM2 (process manager)
sudo npm install -g pm2
```

See [QUICK_START.md](./QUICK_START.md) for complete installation guide.

---

## 🤝 Contributing

This is a private project. For internal team contributions:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test thoroughly
3. Run tests: `./test-api-endpoints.sh`
4. Commit with descriptive message
5. Push and create pull request

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🆘 Support

**Internal Support:**
- Documentation: See `docs/` directory
- Health Check: `./scripts/health-check.sh`
- API Tests: `./test-api-endpoints.sh`

**Logs:**
- Application: `pm2 logs`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- PostgreSQL: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`

---

## 🎯 Project Status

**Version:** 9.2.0 Command Center
**Status:** ✅ Production Ready
**Last Updated:** December 9, 2025

**Implementation Statistics:**
- 28 files created
- 4 files modified
- 16,738 total lines (code + docs)
- 30+ API endpoints
- 6 new database tables
- 23 admin features
- 15+ E2E test scenarios

**Feature Completeness:** 23/23 features complete (100%)

---

## 🚀 What's Next?

After deployment:

1. **Monitor Performance:** Set up alerts for errors, queue depth, API response times
2. **User Onboarding:** Create welcome emails, video tutorials
3. **Marketing:** Launch landing page, start content marketing
4. **Analytics:** Track conversion rates, churn, LTV
5. **Optimization:** Implement Redis caching, CDN for assets

**Future Features (v9.3.0):**
- Mobile responsive layout
- Dark/light theme toggle
- Variant comparison mode
- Export history
- Batch generation

---

**Built with ❤️ using Node.js, PostgreSQL, Redis, and Stripe**

*ThumbnailBuilder v9.2.0 - December 9, 2025*
