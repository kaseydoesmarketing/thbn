# ThumbnailBuilder v9.2.0 - Quick Start Guide

**Fast-track guide to get ThumbnailBuilder running in production**

---

## 🚀 Quick Deploy (5 minutes)

### Prerequisites Installed?

```bash
# Check if you have everything
node -v    # Should be v18+
npm -v     # Should be v9+
psql --version  # Should be v14+
redis-cli ping  # Should return "PONG"
```

If anything is missing, see [Full Installation](#full-installation) below.

---

## Option 1: Local Development Setup

### 1. Start Required Services

```bash
# Terminal 1: Start PostgreSQL (if not running)
# macOS with Homebrew:
brew services start postgresql@14

# Terminal 2: Start Redis
redis-server

# Or if using Homebrew:
brew services start redis
```

### 2. Setup Database

```bash
cd /Users/kvimedia/thumbnailbuilder/server

# Create database
createdb thumbnailbuilder

# Run migrations
npm install
npm run migrate:up

# Verify tables created
psql -d thumbnailbuilder -c "\dt"
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values:
nano .env
```

**Required values:**
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost/thumbnailbuilder
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Secret (generate: openssl rand -base64 32)
JWT_SECRET=your_secret_here

# Stripe TEST keys (from dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# NanoBanana API
NANOBANANA_API_KEY=your_key_here

# Gemini API
GEMINI_API_KEY=your_key_here

# Supabase (optional for local dev)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_key_here
```

### 4. Create Admin User

```bash
cd /Users/kvimedia/thumbnailbuilder/server

# Start server temporarily
node app.js &

# Register admin user via API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@thumbnailbuilder.app",
    "password": "Admin123!",
    "username": "admin"
  }'

# Grant admin role
psql -d thumbnailbuilder -c "UPDATE users SET role = 'admin' WHERE email = 'admin@thumbnailbuilder.app';"

# Kill temporary server
pkill -f "node app.js"
```

### 5. Allocate Test Credits

```bash
# Run credit allocation script
psql -d thumbnailbuilder -f /Users/kvimedia/thumbnailbuilder/scripts/allocate-test-credits.sql
```

### 6. Start Application

```bash
cd /Users/kvimedia/thumbnailbuilder/server

# Start with PM2 (recommended)
pm2 start ecosystem.config.js

# OR start directly (for debugging)
npm start

# View logs
pm2 logs
```

### 7. Run Health Check

```bash
cd /Users/kvimedia/thumbnailbuilder
./scripts/health-check.sh
```

Expected output:
```
✅ PASS Node.js v18.x.x
✅ PASS npm 9.x.x
✅ PASS PostgreSQL 14.x
✅ PASS Redis responding
✅ PASS Server responding at http://localhost:3000
✅ PASS Health status: ok
🎉 All checks passed! System is healthy.
```

### 8. Run API Tests

```bash
# Test all endpoints
cd /Users/kvimedia/thumbnailbuilder
./test-api-endpoints.sh
```

Expected: All tests should pass (except admin tests if admin user not configured).

### 9. Open Application

```bash
# Open frontend in browser
open http://localhost:3000/create-v9-command-center.html

# Open admin console
open http://localhost:3000/admin-v9-console.html
```

**Login with:**
- Email: `admin@thumbnailbuilder.app`
- Password: `Admin123!`

---

## Option 2: Production Deployment

### 1. Server Setup (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 14
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Clone Repository

```bash
# Create application directory
sudo mkdir -p /var/www/thumbnailbuilder
sudo chown $USER:$USER /var/www/thumbnailbuilder

# Clone repository
cd /var/www/thumbnailbuilder
git clone https://github.com/yourusername/thumbnailbuilder.git .
```

### 3. Run Automated Deployment

```bash
# Make scripts executable
chmod +x /var/www/thumbnailbuilder/scripts/*.sh

# Run deployment script
cd /var/www/thumbnailbuilder
sudo ./scripts/deploy.sh
```

The script will:
- ✅ Check system requirements
- ✅ Backup current deployment
- ✅ Pull latest code
- ✅ Install dependencies
- ✅ Run database migrations
- ✅ Restart PM2 processes
- ✅ Run smoke tests

### 4. Configure SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d thumbnailbuilder.app -d www.thumbnailbuilder.app

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

### 5. Configure Nginx

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/thumbnailbuilder

# Add configuration (see PRODUCTION_DEPLOYMENT_CHECKLIST.md)
# Then enable site
sudo ln -s /etc/nginx/sites-available/thumbnailbuilder /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 6. Configure Stripe Webhook

```bash
# Get your server's public URL
echo "https://$(curl -s ifconfig.me)/api/stripe/webhook"

# Add webhook endpoint in Stripe dashboard:
# 1. Go to https://dashboard.stripe.com/webhooks
# 2. Click "Add endpoint"
# 3. Enter URL: https://thumbnailbuilder.app/api/stripe/webhook
# 4. Select events:
#    - checkout.session.completed
#    - invoice.payment_succeeded
#    - customer.subscription.updated
#    - customer.subscription.deleted
# 5. Copy webhook signing secret to .env
```

### 7. Create Subscription Plans in Stripe

```bash
# Via Stripe Dashboard:
# 1. Go to Products → Add Product
# 2. Create "Solo Plan"
#    - Name: Solo Plan
#    - Price: $24.99/month
#    - Copy Price ID (starts with price_...)
# 3. Create "Pro Plan"
#    - Name: Pro Plan
#    - Price: $49.99/month
#    - Copy Price ID

# Update database with Price IDs
psql -d thumbnailbuilder -c "
UPDATE subscription_plans
SET stripe_price_id = 'price_XXXXX'
WHERE name = 'Solo Plan';

UPDATE subscription_plans
SET stripe_price_id = 'price_YYYYY'
WHERE name = 'Pro Plan';
"
```

### 8. Final Health Check

```bash
# Run comprehensive health check
cd /var/www/thumbnailbuilder
./scripts/health-check.sh

# Should see all green checkmarks
```

---

## Common Commands

### Development

```bash
# Start development server
cd server && npm run dev

# Run migrations
npm run migrate:up

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:down

# View logs
pm2 logs

# Restart server
pm2 restart thumbnailbuilder-api
```

### Testing

```bash
# Run API tests
./test-api-endpoints.sh

# Run health check
./scripts/health-check.sh

# Allocate test credits
psql -d thumbnailbuilder -f scripts/allocate-test-credits.sql
```

### Production

```bash
# Deploy latest version
sudo ./scripts/deploy.sh

# Rollback to previous version
sudo ./scripts/deploy.sh rollback

# View PM2 status
pm2 status

# View PM2 logs
pm2 logs thumbnailbuilder-api

# Restart application
pm2 restart thumbnailbuilder-api

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Database

```bash
# Connect to database
psql -d thumbnailbuilder

# Backup database
pg_dump thumbnailbuilder > backup_$(date +%Y%m%d).sql

# Restore database
psql -d thumbnailbuilder < backup_20251209.sql

# View all users
psql -d thumbnailbuilder -c "SELECT id, email, username, role FROM users;"

# Grant admin role
psql -d thumbnailbuilder -c "UPDATE users SET role = 'admin' WHERE email = 'user@example.com';"

# View credit balances
psql -d thumbnailbuilder -c "
SELECT u.email, uc.credits_remaining, uc.credits_allocated, uc.credits_used
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id;
"
```

---

## Troubleshooting

### Server Won't Start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process using port 3000
kill -9 $(lsof -t -i :3000)

# Check environment variables
cat .env

# Check logs
pm2 logs --lines 100
```

### Database Connection Error

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start PostgreSQL
sudo systemctl start postgresql

# Test connection
psql -d thumbnailbuilder -c "SELECT 1;"
```

### Redis Connection Error

```bash
# Check Redis is running
redis-cli ping

# Start Redis
sudo systemctl start redis

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### Migration Errors

```bash
# Check migration status
npm run migrate:status

# View migration error details
npm run migrate:up 2>&1 | tee migration-error.log

# Rollback and retry
npm run migrate:down
npm run migrate:up
```

### Stripe Webhook Not Working

```bash
# Test webhook locally with Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed

# Check webhook logs in Stripe dashboard
# https://dashboard.stripe.com/webhooks
```

### Credits Not Deducting

```bash
# Check credit balance
psql -d thumbnailbuilder -c "
SELECT * FROM user_credits WHERE user_id = 1;
"

# Manually allocate credits
psql -d thumbnailbuilder -f scripts/allocate-test-credits.sql

# Check transaction history
psql -d thumbnailbuilder -c "
SELECT * FROM credit_transactions WHERE user_id = 1 ORDER BY created_at DESC LIMIT 10;
"
```

---

## Next Steps

Once everything is running:

1. **Test Complete Flow:**
   - Register new user
   - Subscribe to plan
   - Generate thumbnail
   - Verify credit deduction

2. **Configure Monitoring:**
   - Set up error alerts (Sentry)
   - Configure uptime monitoring (UptimeRobot)
   - Set up log aggregation (Papertrail)

3. **Performance Optimization:**
   - Enable Redis caching
   - Configure CDN for static assets
   - Optimize database indexes

4. **Security Hardening:**
   - Configure firewall (ufw)
   - Set up fail2ban
   - Enable automatic security updates

5. **Documentation:**
   - Create user documentation
   - Write admin guide
   - Document API endpoints (OpenAPI)

---

## Support

**Documentation:**
- Full deployment guide: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- E2E testing guide: `E2E_TESTING_GUIDE.md`
- Project summary: `PROJECT_COMPLETION_SUMMARY.md`
- Admin guide: `ADMIN_CONSOLE_GUIDE.md`

**Commands:**
- Health check: `./scripts/health-check.sh`
- API tests: `./test-api-endpoints.sh`
- Deploy: `./scripts/deploy.sh`

**Logs:**
- Application: `pm2 logs`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- PostgreSQL: `sudo tail -f /var/log/postgresql/postgresql-14-main.log`

---

**Status:** ThumbnailBuilder v9.2.0 is production-ready! 🚀

*Quick Start Guide - December 9, 2025*
