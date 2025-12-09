# 🚀 ThumbnailBuilder v9.2.0 - START HERE

**Complete automated setup in one command!**

---

## ⚡ Quick Setup (One Command)

```bash
cd /Users/kvimedia/thumbnailbuilder
./FULL_LOCAL_SETUP.sh
```

This single script will:
1. ✅ Install Homebrew (if needed)
2. ✅ Install PostgreSQL 14
3. ✅ Install Redis 7
4. ✅ Install PM2 process manager
5. ✅ Create database
6. ✅ Configure environment variables
7. ✅ Run database migrations
8. ✅ Create admin user
9. ✅ Allocate test credits
10. ✅ Start application with PM2
11. ✅ Run health check

**Time:** ~10 minutes (depending on internet speed)

---

## 📍 After Setup Complete

### Access the Application

```bash
# Command Center (main UI)
open http://localhost:3000/create-v9-command-center.html

# Admin Console
open http://localhost:3000/admin-v9-console.html

# Health Check
curl http://localhost:3000/health
```

### Login Credentials

**Admin User:**
- Email: `admin@thumbnailbuilder.app`
- Password: `Admin123!`

---

## 🧪 Test the System

```bash
# Run comprehensive API tests
./test-api-endpoints.sh

# Run health check
./scripts/health-check.sh

# Check server logs
pm2 logs thumbnailbuilder-api
```

---

## 🛠️ Common Commands

### Server Management
```bash
# View server status
pm2 status

# Restart server
pm2 restart thumbnailbuilder-api

# Stop server
pm2 stop thumbnailbuilder-api

# View logs (live)
pm2 logs thumbnailbuilder-api

# View last 100 log lines
pm2 logs thumbnailbuilder-api --lines 100
```

### Database
```bash
# Connect to database
psql -d thumbnailbuilder

# View all users
psql -d thumbnailbuilder -c "SELECT id, email, username, role FROM users;"

# View credit balances
psql -d thumbnailbuilder -c "
SELECT u.email, uc.credits_remaining, uc.credits_allocated
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id;
"

# Grant admin role to a user
psql -d thumbnailbuilder -c "UPDATE users SET role = 'admin' WHERE email = 'user@example.com';"
```

### Services
```bash
# Check PostgreSQL status
brew services list | grep postgresql

# Check Redis status
brew services list | grep redis

# Restart PostgreSQL
brew services restart postgresql@14

# Restart Redis
brew services restart redis
```

---

## 🔧 Configuration

### Stripe Setup (Required for Payments)

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy your test API keys
3. Edit `server/.env`:
   ```bash
   nano server/.env
   ```
4. Update these lines:
   ```
   STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY_HERE
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_SECRET_HERE
   ```
5. Restart server:
   ```bash
   pm2 restart thumbnailbuilder-api
   ```

### Supabase Setup (Optional - for cloud storage)

1. Create account at https://supabase.com
2. Create new project
3. Get credentials from Settings → API
4. Edit `server/.env`:
   ```bash
   nano server/.env
   ```
5. Uncomment and update:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJxxxxx
   ```
6. Restart server

---

## 📊 Verify Everything Works

### 1. Health Check ✅
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok",...}`

### 2. API Test ✅
```bash
./test-api-endpoints.sh
```
Expected: All tests pass (except Stripe webhook which needs manual setup)

### 3. Login Test ✅
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@thumbnailbuilder.app",
    "password": "Admin123!"
  }'
```
Expected: Returns JWT token

### 4. Browser Test ✅
1. Open http://localhost:3000/create-v9-command-center.html
2. Login with admin credentials
3. See command center UI
4. Check credits display (should show test credits)

---

## 🚨 Troubleshooting

### Server Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill process using port 3000
kill -9 $(lsof -t -i :3000)

# Restart server
pm2 restart thumbnailbuilder-api
```

### Database Connection Error
```bash
# Check PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql@14

# Test connection
psql -d thumbnailbuilder -c "SELECT 1;"
```

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping

# Start Redis
brew services start redis
```

### Migration Errors
```bash
cd server

# Check migration status
npm run migrate:status

# Rollback and retry
npm run migrate:down
npm run migrate:up
```

---

## 📚 Full Documentation

- **Quick Start:** [QUICK_START.md](./QUICK_START.md)
- **Deployment Guide:** [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- **Testing Guide:** [E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md)
- **Admin Guide:** [ADMIN_CONSOLE_GUIDE.md](./ADMIN_CONSOLE_GUIDE.md)
- **Project Overview:** [README.md](./README.md)

---

## 🎯 Next Steps

Once local setup is complete:

1. ✅ Test all features in browser
2. ✅ Configure Stripe test keys
3. ✅ Test subscription checkout flow
4. ✅ Test thumbnail generation
5. ✅ Test admin console features
6. 🚀 Deploy to production (see [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md))

---

## 💡 Quick Tips

- **View real-time logs:** `pm2 logs thumbnailbuilder-api --lines 0`
- **Monitor all services:** `pm2 monit`
- **Restart after .env changes:** `pm2 restart thumbnailbuilder-api`
- **Check queue health:** `redis-cli LLEN bull:thumbnail-generation:active`
- **Manual credit allocation:** `psql -d thumbnailbuilder -f scripts/allocate-test-credits.sql`

---

**Status:** Ready to deploy! 🚀
**Version:** 9.2.0 Command Center
**Updated:** December 9, 2025

*Run `./FULL_LOCAL_SETUP.sh` to get started!*
