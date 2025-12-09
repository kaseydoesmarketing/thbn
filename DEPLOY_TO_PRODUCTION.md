# 🚀 Deploy ThumbnailBuilder v9.2.0 to Production

**Complete production deployment guide with multiple platform options**

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] GitHub repository: https://github.com/kaseydoesmarketing/thbn
- [ ] Domain name (e.g., thumbnailbuilder.app)
- [ ] Stripe account (live API keys)
- [ ] Production server OR hosting platform account
- [ ] Database backup strategy
- [ ] SSL certificate plan (Let's Encrypt recommended)

---

## 🎯 Deployment Options

Choose your deployment platform:

1. **[Railway](#option-1-railway-easiest)** - Easiest, ~$20/month
2. **[Vercel + Supabase](#option-2-vercel--supabase)** - Serverless, pay-as-you-go
3. **[DigitalOcean](#option-3-digitalocean-vps)** - Full control, $12-24/month
4. **[Hostinger VPS](#option-4-hostinger-vps)** - Budget option, $8-15/month
5. **[AWS/GCP](#option-5-aws--gcp)** - Enterprise scale, variable pricing

---

## Option 1: Railway (Easiest) ⭐ RECOMMENDED

**Pros:** Automatic SSL, GitHub integration, PostgreSQL/Redis included, zero config
**Cons:** ~$20/month minimum
**Time:** 15 minutes

### Step 1: Push to GitHub

```bash
cd /Users/kvimedia/thumbnailbuilder

# Commit all v9.2.0 changes
git add .
git commit -m "ThumbnailBuilder v9.2.0 - Production Ready

Complete Stripe integration, Command Center UI, Admin Console
- 28 files created, 4 modified
- Monetization layer with credit system
- Premium glassmorphism UI
- Admin console with analytics
- Full testing suite"

# Push to GitHub
git push origin main
```

### Step 2: Deploy to Railway

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `kaseydoesmarketing/thbn`
5. Railway will auto-detect Node.js app

### Step 3: Add Services

In Railway dashboard:
- Click "+ New" → PostgreSQL (automatically provisions)
- Click "+ New" → Redis (automatically provisions)

### Step 4: Configure Environment Variables

In Railway project settings → Variables, add:

```bash
NODE_ENV=production
PORT=3000

# Database (auto-populated by Railway PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (auto-populated by Railway Redis service)
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}

# JWT Secret (generate: openssl rand -base64 32)
JWT_SECRET=your_generated_secret_here

# Stripe LIVE keys (from dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET

# NanoBanana
NANOBANANA_API_KEY=your_nanobanana_api_key_here

# Gemini
GEMINI_API_KEY=your_gemini_key_here

# Supabase (optional)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_key

# CORS (use your domain)
CORS_ORIGIN=https://thumbnailbuilder.app
```

### Step 5: Configure Build & Start

In Railway settings:
- **Build Command:** `cd server && npm install`
- **Start Command:** `cd server && npm start`
- **Root Directory:** `/`

### Step 6: Run Migrations

In Railway terminal:
```bash
cd server
npm run migrate:up
```

### Step 7: Configure Domain

1. In Railway → Settings → Domains
2. Add custom domain: `thumbnailbuilder.app`
3. Update DNS (A record or CNAME as instructed)
4. Railway auto-provisions SSL certificate

### Step 8: Test Deployment

```bash
# Test health endpoint
curl https://thumbnailbuilder.app/health

# Should return: {"status":"ok",...}
```

**✅ Done! Your app is live at https://thumbnailbuilder.app**

---

## Option 2: Vercel + Supabase

**Pros:** Serverless, auto-scaling, free tier available
**Cons:** Edge runtime limitations, requires Supabase for database
**Time:** 30 minutes

### Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Create new project
3. Wait for database provisioning (~2 minutes)
4. Note connection string from Settings → Database

### Step 2: Setup Upstash Redis

1. Go to https://upstash.com
2. Create Redis database
3. Copy connection details

### Step 3: Configure Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd /Users/kvimedia/thumbnailbuilder
vercel --prod
```

### Step 4: Add Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
REDIS_URL=redis://:[PASSWORD]@[HOST].upstash.io:6379
JWT_SECRET=your_secret
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NANOBANANA_API_KEY=...
GEMINI_API_KEY=...
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_KEY=...
CORS_ORIGIN=https://thumbnailbuilder.vercel.app
```

### Step 5: Deploy Static Frontend

Frontend files will be served by Vercel CDN automatically.

**✅ Done! App live at https://thumbnailbuilder.vercel.app**

---

## Option 3: DigitalOcean VPS

**Pros:** Full control, predictable pricing, simple
**Cons:** Manual server management
**Time:** 60 minutes
**Cost:** $12-24/month

### Step 1: Create Droplet

1. Go to https://digitalocean.com
2. Create Droplet:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($12/month - 2GB RAM)
   - **Datacenter:** Choose closest to users
   - **Authentication:** SSH key (recommended)

### Step 2: Initial Server Setup

```bash
# SSH into server
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y

# Create deployment user
adduser deployer
usermod -aG sudo deployer
su - deployer
```

### Step 3: Install Dependencies

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

### Step 4: Clone Repository

```bash
# Create app directory
sudo mkdir -p /var/www/thumbnailbuilder
sudo chown deployer:deployer /var/www/thumbnailbuilder

# Clone repository
cd /var/www/thumbnailbuilder
git clone https://github.com/kaseydoesmarketing/thbn.git .
```

### Step 5: Run Automated Deployment

```bash
# Make deployment script executable
chmod +x /var/www/thumbnailbuilder/scripts/deploy.sh

# Run deployment
cd /var/www/thumbnailbuilder
./scripts/deploy.sh
```

The script will:
- ✅ Install dependencies
- ✅ Create database
- ✅ Run migrations
- ✅ Start PM2 processes
- ✅ Run health checks

### Step 6: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/thumbnailbuilder
```

Add:
```nginx
server {
    listen 80;
    server_name thumbnailbuilder.app www.thumbnailbuilder.app;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/thumbnailbuilder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Setup SSL

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d thumbnailbuilder.app -d www.thumbnailbuilder.app

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 8: Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

**✅ Done! App live at https://thumbnailbuilder.app**

---

## Option 4: Hostinger VPS

**Pros:** Budget-friendly, good support
**Cons:** Smaller resources
**Time:** 45 minutes
**Cost:** $8-15/month

Follow same steps as DigitalOcean, but:
1. Purchase VPS from https://hostinger.com
2. Use Hostinger's control panel to access server
3. Follow DigitalOcean steps 2-8

---

## Option 5: AWS / GCP

**Pros:** Enterprise-grade, global CDN, auto-scaling
**Cons:** Complex setup, variable pricing
**Time:** 2-3 hours

### AWS Deployment

Use AWS Elastic Beanstalk:
```bash
# Install EB CLI
pip install awsebcli

# Initialize
cd /Users/kvimedia/thumbnailbuilder
eb init

# Create environment
eb create thumbnailbuilder-prod

# Deploy
eb deploy
```

### GCP Deployment

Use Google Cloud Run:
```bash
# Install gcloud CLI
# See: https://cloud.google.com/sdk/docs/install

# Deploy
gcloud run deploy thumbnailbuilder \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 🔒 Post-Deployment Security

### 1. Configure Stripe Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://thumbnailbuilder.app/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret
5. Update `STRIPE_WEBHOOK_SECRET` in environment variables

### 2. Create Subscription Plans

In Stripe dashboard:
1. Products → Add Product
2. **Solo Plan:** $24.99/month recurring
3. **Pro Plan:** $49.99/month recurring
4. Copy Price IDs
5. Update database:
   ```sql
   UPDATE subscription_plans SET stripe_price_id = 'price_XXXXX' WHERE name = 'Solo Plan';
   UPDATE subscription_plans SET stripe_price_id = 'price_YYYYY' WHERE name = 'Pro Plan';
   ```

### 3. Setup Monitoring

```bash
# Install monitoring (optional)
npm install -g @sentry/cli

# Configure error tracking
# See: https://sentry.io
```

---

## ✅ Deployment Verification Checklist

After deployment, verify:

- [ ] Health endpoint responding: `curl https://your-domain.com/health`
- [ ] SSL certificate valid (check browser)
- [ ] Database migrations applied
- [ ] Redis connected
- [ ] Admin login works
- [ ] Stripe checkout creates session
- [ ] Webhook endpoint accessible
- [ ] Generation works end-to-end
- [ ] Admin console accessible
- [ ] Credits deduct properly
- [ ] PM2 processes running
- [ ] Logs accessible

---

## 🚨 Rollback Procedure

If deployment fails:

```bash
# On server
cd /var/www/thumbnailbuilder
./scripts/deploy.sh rollback

# Or manually
pm2 stop all
git checkout HEAD~1
npm install
pm2 restart all
```

---

## 📊 Monitoring & Maintenance

### Daily
```bash
# Check server status
pm2 status

# View logs
pm2 logs --lines 100
```

### Weekly
```bash
# Backup database
pg_dump thumbnailbuilder > backup_$(date +%Y%m%d).sql

# Check disk space
df -h

# Review error logs
cat /var/log/nginx/error.log | tail -100
```

### Monthly
```bash
# Update dependencies
cd /var/www/thumbnailbuilder/server
npm audit fix

# Restart services
pm2 restart all
```

---

## 🎯 Recommended: Railway Deployment

**For fastest deployment, use Railway (Option 1):**

1. Push to GitHub ← 2 minutes
2. Connect Railway ← 5 minutes
3. Add PostgreSQL/Redis ← 2 minutes
4. Configure env vars ← 5 minutes
5. Run migrations ← 1 minute
6. Test ← 5 minutes

**Total: ~20 minutes to production! 🚀**

---

**Choose your platform and let's deploy!**
