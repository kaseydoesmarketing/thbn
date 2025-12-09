# ThumbnailBuilder v9.2.0 - Production Deployment Checklist

**Version:** 9.2.0 Command Center + Stripe + Admin Console
**Date:** December 9, 2025
**Deployment Type:** Full Stack (Backend + Frontend + Database)

---

## ⚠️ Pre-Deployment Requirements

### Environment Validation

- [ ] **Node.js Version:** 18.0.0 or higher
  ```bash
  node --version  # Should be >= v18.0.0
  ```

- [ ] **PostgreSQL Version:** 15.0 or higher
  ```bash
  psql --version  # Should be >= 15.x
  ```

- [ ] **Redis Version:** 7.0 or higher
  ```bash
  redis-cli --version  # Should be >= 7.x
  ```

- [ ] **Nginx Version:** 1.24 or higher (for proxy/SSL)
  ```bash
  nginx -v  # Should be >= 1.24.x
  ```

---

## 📋 Pre-Flight Checklist

### 1. Code Review

- [ ] All Phase 1-3 files exist and are in correct locations
- [ ] No syntax errors in JavaScript files
- [ ] No broken imports/requires
- [ ] All environment variables documented
- [ ] Git repository is clean (`git status`)

### 2. Dependency Installation

```bash
cd /Users/kvimedia/thumbnailbuilder/server
npm install

# Verify Stripe SDK installed
npm list stripe  # Should show stripe@^14.0.0
```

- [ ] All dependencies installed without errors
- [ ] No critical vulnerability warnings (`npm audit`)
- [ ] `node_modules` size reasonable (< 500MB)

### 3. Database Migrations

**Run migrations in order:**

```bash
# Connect to database
psql -U postgres -d thumbnail_builder

# Run Stripe migration
\i server/src/db/migrations/002_stripe_subscriptions.sql

# Verify tables created
\dt

# Expected tables:
# - subscription_plans
# - user_subscriptions
# - user_credits
# - credit_transactions
# - stripe_events
# - stripe_customers
```

- [ ] All 6 Stripe tables created successfully
- [ ] Helper functions `get_user_credit_balance()` and `deduct_credits()` exist
- [ ] Seed data inserted (2 subscription plans)
- [ ] No migration errors in log

### 4. Stripe Configuration

**A. Create Stripe Account (if needed):**
- [ ] Sign up at https://dashboard.stripe.com
- [ ] Complete business information
- [ ] Verify email and phone
- [ ] Enable live mode (after testing)

**B. Create Products:**

```javascript
// Solo Creator Product
Name: Solo Creator
Price: $24.99/month (recurring)
Metadata:
  monthly_credits: 100
  tier: solo
  gemini_model: gemini-2.5-flash-image

// Save Product ID: prod_XXXXX
// Save Price ID: price_XXXXX
```

- [ ] Solo Creator product created
- [ ] Pro Creator product created ($49.99/month, 250 credits)
- [ ] Product IDs copied

**C. Update Migration File:**

Edit `server/src/db/migrations/002_stripe_subscriptions.sql` line ~191:

```sql
INSERT INTO subscription_plans (...) VALUES
('prod_REAL_STRIPE_ID', 'price_REAL_STRIPE_ID', 'Solo Creator', ...),
('prod_REAL_STRIPE_ID', 'price_REAL_STRIPE_ID', 'Pro Creator', ...);
```

- [ ] Migration file updated with real Stripe IDs
- [ ] Re-run migration to update plans

**D. Configure Webhook:**

- [ ] Go to https://dashboard.stripe.com/webhooks
- [ ] Click "Add endpoint"
- [ ] Endpoint URL: `https://thumbnailbuilder.app/api/stripe/webhook`
- [ ] Events selected:
  - [x] `checkout.session.completed`
  - [x] `customer.subscription.created`
  - [x] `customer.subscription.updated`
  - [x] `customer.subscription.deleted`
  - [x] `invoice.payment_succeeded`
  - [x] `invoice.payment_failed`
- [ ] Signing secret copied (starts with `whsec_`)

### 5. Environment Variables

**Create production `.env` file:**

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Gemini API
NANO_BANANA_API_KEY=your_gemini_api_key_here
GEMINI_PRIMARY_MODEL=gemini-3-pro-image-preview
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-image

# Replicate API
REPLICATE_API_TOKEN=your_replicate_token_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/thumbnail_builder

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Supabase Storage
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_BUCKET_FACES=faces
SUPABASE_BUCKET_THUMBNAILS=thumbnails

# Stripe
STRIPE_SECRET_KEY=sk_live_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX

# Frontend
FRONTEND_URL=https://thumbnailbuilder.app
CORS_ORIGIN=https://thumbnailbuilder.app

# JWT
JWT_SECRET=your_very_long_random_secret_here

# Upload Directory
UPLOAD_DIR=/var/www/thumbnailbuilder/uploads
```

- [ ] All environment variables set
- [ ] Keys are production values (not test)
- [ ] Secrets are strong and random
- [ ] No placeholder values remain

### 6. SSL/TLS Configuration

**A. Obtain SSL Certificate:**

```bash
# Using Certbot (Let's Encrypt)
sudo certbot --nginx -d thumbnailbuilder.app -d www.thumbnailbuilder.app

# Or manual certificate
# Place cert files in /etc/ssl/certs/
```

- [ ] SSL certificate obtained
- [ ] Certificate valid for 90+ days
- [ ] Both www and non-www covered

**B. Nginx Configuration:**

```nginx
# /etc/nginx/sites-available/thumbnailbuilder

server {
    listen 80;
    server_name thumbnailbuilder.app www.thumbnailbuilder.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name thumbnailbuilder.app www.thumbnailbuilder.app;

    ssl_certificate /etc/letsencrypt/live/thumbnailbuilder.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/thumbnailbuilder.app/privkey.pem;

    # Frontend files
    root /var/www/thumbnailbuilder;
    index create-v9-command-center.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Static files
    location / {
        try_files $uri $uri/ =404;
    }

    # Admin console (restrict by IP if needed)
    location /admin-v9-console.html {
        # allow 1.2.3.4;  # Your office IP
        # deny all;
        try_files $uri =404;
    }
}
```

- [ ] Nginx config created
- [ ] Config syntax valid (`nginx -t`)
- [ ] Symlink created to sites-enabled
- [ ] Nginx reloaded (`systemctl reload nginx`)

---

## 🚀 Deployment Steps

### Step 1: Backup Current System

```bash
# Database backup
pg_dump thumbnail_builder > backup_$(date +%Y%m%d_%H%M%S).sql

# Code backup
tar -czf backup_code_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/thumbnailbuilder

# Environment backup
cp .env .env.backup
```

- [ ] Database backed up
- [ ] Code backed up
- [ ] Backups stored safely

### Step 2: Deploy Backend

```bash
# Stop current server (if running)
pm2 stop thumbnailbuilder-server

# Pull latest code
cd /var/www/thumbnailbuilder/server
git pull origin main

# Install dependencies
npm install --production

# Run database migrations
psql -U postgres -d thumbnail_builder < src/db/migrations/002_stripe_subscriptions.sql

# Start server with PM2
pm2 start app.js --name thumbnailbuilder-server
pm2 save
```

- [ ] Server stopped gracefully
- [ ] Latest code deployed
- [ ] Dependencies installed
- [ ] Migrations executed
- [ ] Server started
- [ ] PM2 configuration saved

### Step 3: Deploy Frontend

```bash
# Copy new HTML files
cp create-v9-command-center.html /var/www/thumbnailbuilder/
cp admin-v9-console.html /var/www/thumbnailbuilder/
cp command-center-styles.css /var/www/thumbnailbuilder/
cp loading-state-premium.css /var/www/thumbnailbuilder/

# Set permissions
chown www-data:www-data /var/www/thumbnailbuilder/*.html
chown www-data:www-data /var/www/thumbnailbuilder/*.css
chmod 644 /var/www/thumbnailbuilder/*.html
chmod 644 /var/www/thumbnailbuilder/*.css
```

- [ ] New HTML files deployed
- [ ] New CSS files deployed
- [ ] Permissions set correctly
- [ ] Old files backed up (v8)

### Step 4: Verify Deployment

**A. Backend Health Check:**

```bash
curl https://thumbnailbuilder.app/health

# Expected response:
{
  "status": "ok",
  "version": "9.2.0",
  "services": {
    "database": true,
    "redis": true,
    "storage": true
  }
}
```

- [ ] Health endpoint returns 200
- [ ] Version shows 9.2.0
- [ ] All services healthy

**B. Frontend Access:**

- [ ] Visit https://thumbnailbuilder.app/create-v9-command-center.html
- [ ] Page loads without errors
- [ ] No 404s in browser console
- [ ] All CSS/images load
- [ ] Credit display shows in header

**C. Admin Console:**

- [ ] Visit https://thumbnailbuilder.app/admin-v9-console.html
- [ ] Login as admin
- [ ] All 7 tabs load
- [ ] Dashboard shows stats
- [ ] Model switcher works

---

## 🧪 Smoke Testing

### Test 1: User Registration & Login

```bash
# Register new user
curl -X POST https://thumbnailbuilder.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "username": "testuser"
  }'

# Login
curl -X POST https://thumbnailbuilder.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Save token from response
```

- [ ] Registration successful (201)
- [ ] Login successful (200)
- [ ] JWT token received

### Test 2: Stripe Checkout

```bash
# Get plans
curl https://thumbnailbuilder.app/api/billing/plans

# Create checkout
curl -X POST https://thumbnailbuilder.app/api/billing/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priceId": "price_solo_2499_monthly"}'

# Visit checkout URL
# Complete test purchase with Stripe test card: 4242 4242 4242 4242
```

- [ ] Plans endpoint returns 200
- [ ] Checkout session created
- [ ] Redirected to Stripe
- [ ] Test payment completes
- [ ] Webhook fires (check logs)
- [ ] Credits allocated (check `/api/billing/credits`)

### Test 3: Thumbnail Generation

```bash
# Generate thumbnail
curl -X POST https://thumbnailbuilder.app/api/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brief": "Test smoke test thumbnail",
    "creatorStyle": "auto",
    "niche": "gaming"
  }'

# Save jobId from response

# Poll job status
curl https://thumbnailbuilder.app/api/jobs/$JOB_ID \
  -H "Authorization: Bearer $TOKEN"

# Wait until status = "completed"
```

- [ ] Generation queued (200)
- [ ] Job ID received
- [ ] Job progresses (processing)
- [ ] Job completes (completed)
- [ ] Variants returned
- [ ] Credit deducted (check balance)

### Test 4: Admin Console

```bash
# Login as admin
# Get token

# List models
curl https://thumbnailbuilder.app/api/admin/models \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get analytics
curl https://thumbnailbuilder.app/api/admin/analytics/overview \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Adjust credits
curl -X POST https://thumbnailbuilder.app/api/admin/users/1/credits/adjust \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "reason": "Smoke test"}'
```

- [ ] Admin login successful
- [ ] Models endpoint returns data
- [ ] Analytics endpoint returns stats
- [ ] Credit adjustment works
- [ ] Audit log populated

---

## 📊 Monitoring Setup

### Application Monitoring

**PM2 Monitoring:**

```bash
# View logs
pm2 logs thumbnailbuilder-server

# Monitor processes
pm2 monit

# Setup startup script
pm2 startup
pm2 save
```

- [ ] PM2 configured for auto-restart
- [ ] Startup script enabled
- [ ] Log rotation configured

**Error Tracking:**

- [ ] Sentry/Bugsnag configured (optional)
- [ ] Error logs accessible
- [ ] Alert notifications set up

### Performance Monitoring

**Metrics to Track:**

- [ ] Response time (`/health` endpoint)
- [ ] Memory usage (PM2)
- [ ] CPU usage (PM2)
- [ ] Queue depth (Redis)
- [ ] Database connections
- [ ] Generation success rate
- [ ] Credit deduction rate

**Tools:**
- [ ] Prometheus + Grafana (recommended)
- [ ] New Relic / DataDog (alternative)
- [ ] Custom dashboard created

### Business Metrics

**Stripe Dashboard:**
- [ ] MRR (Monthly Recurring Revenue) tracked
- [ ] Churn rate monitored
- [ ] Failed payments tracked
- [ ] Customer lifetime value calculated

**Database Queries:**

```sql
-- Active subscriptions
SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active';

-- Total revenue (this month)
SELECT SUM(monthly_price_cents)/100 as mrr
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.status = 'active';

-- Credit utilization
SELECT AVG(credits_remaining) as avg_balance
FROM user_credits;
```

- [ ] Business metrics dashboard created
- [ ] Daily report scheduled
- [ ] Alerts configured

---

## 🔒 Security Hardening

### Server Security

- [ ] Firewall configured (UFW/iptables)
  ```bash
  ufw allow 22/tcp   # SSH
  ufw allow 80/tcp   # HTTP
  ufw allow 443/tcp  # HTTPS
  ufw enable
  ```

- [ ] SSH key-only authentication
- [ ] Fail2ban configured
- [ ] Auto-updates enabled
- [ ] Root login disabled
- [ ] Non-root user for Node.js

### Application Security

- [ ] Rate limiting enabled (already in code)
- [ ] CORS configured correctly
- [ ] CSRF protection enabled
- [ ] Helmet.js middleware added (optional)
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS protection enabled

### API Key Security

- [ ] All keys in environment variables (not code)
- [ ] `.env` file not in git
- [ ] Secrets rotated from defaults
- [ ] Stripe webhook signature verified
- [ ] Admin endpoints require role check

---

## 🔄 Rollback Plan

### If Deployment Fails:

**Step 1: Stop new version**
```bash
pm2 stop thumbnailbuilder-server
```

**Step 2: Restore database**
```bash
psql thumbnail_builder < backup_20251209_120000.sql
```

**Step 3: Restore code**
```bash
tar -xzf backup_code_20251209_120000.tar.gz -C /var/www/
```

**Step 4: Restart old version**
```bash
pm2 start app.js --name thumbnailbuilder-server
```

**Step 5: Verify rollback**
- [ ] Health check returns old version
- [ ] Old UI accessible
- [ ] Database restored
- [ ] No errors in logs

---

## ✅ Post-Deployment Checklist

### Immediate (First Hour)

- [ ] All smoke tests pass
- [ ] No errors in server logs
- [ ] No errors in browser console
- [ ] SSL certificate valid
- [ ] Stripe webhooks firing
- [ ] Credits allocating correctly
- [ ] Admin console accessible

### Short-term (First Day)

- [ ] Monitor error rates
- [ ] Check Stripe webhook logs
- [ ] Verify no subscription failures
- [ ] Review database performance
- [ ] Check Redis memory usage
- [ ] Monitor generation success rate

### Medium-term (First Week)

- [ ] User feedback collected
- [ ] Performance metrics reviewed
- [ ] Cost tracking validated
- [ ] Stripe reconciliation completed
- [ ] Backup verification
- [ ] Security audit passed

---

## 📞 Emergency Contacts

**Technical Issues:**
- Database: DBA contact
- Server: DevOps contact
- DNS: Registrar support

**Business Issues:**
- Stripe: Stripe support
- Payment failures: Support team
- Legal/compliance: Legal team

---

## 📝 Deployment Log Template

```markdown
## Deployment: ThumbnailBuilder v9.2.0
**Date:** YYYY-MM-DD HH:MM UTC
**Deployed by:** [Name]
**Environment:** Production

### Pre-deployment:
- [x] Code reviewed
- [x] Dependencies installed
- [x] Database migrated
- [x] Stripe configured
- [x] Environment variables set

### Deployment:
- [x] Backend deployed: HH:MM UTC
- [x] Frontend deployed: HH:MM UTC
- [x] Smoke tests passed
- [x] Monitoring configured

### Issues encountered:
- None / [List any issues]

### Resolution:
- N/A / [How issues were resolved]

### Rollback performed:
- No / [Details if yes]

### Sign-off:
- Technical lead: [Name]
- Product owner: [Name]
```

---

**Deployment Checklist Complete**
**Version:** 9.2.0
**Status:** Ready for Production

---

*Production Deployment Checklist - ThumbnailBuilder v9.2.0*
*December 9, 2025*
