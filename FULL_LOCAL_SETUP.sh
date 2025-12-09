#!/bin/bash

################################################################################
# ThumbnailBuilder v9.2.0 - Complete Local Setup Script
# This script will install all dependencies and get the system fully running
################################################################################

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ  $1${NC}"
}

################################################################################
# Step 1: Install Homebrew (if needed)
################################################################################

print_header "Step 1: Installing Homebrew"

if command -v brew &> /dev/null; then
    print_success "Homebrew already installed"
else
    print_info "Installing Homebrew... (you may need to enter your password)"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for Apple Silicon Macs
    if [ -f "/opt/homebrew/bin/brew" ]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    print_success "Homebrew installed"
fi

################################################################################
# Step 2: Install PostgreSQL
################################################################################

print_header "Step 2: Installing PostgreSQL 14"

if brew list postgresql@14 &> /dev/null; then
    print_success "PostgreSQL 14 already installed"
else
    print_info "Installing PostgreSQL 14..."
    brew install postgresql@14
    print_success "PostgreSQL 14 installed"
fi

# Start PostgreSQL service
print_info "Starting PostgreSQL service..."
brew services start postgresql@14

# Wait for PostgreSQL to start
sleep 3

print_success "PostgreSQL is running"

################################################################################
# Step 3: Install Redis
################################################################################

print_header "Step 3: Installing Redis"

if brew list redis &> /dev/null; then
    print_success "Redis already installed"
else
    print_info "Installing Redis..."
    brew install redis
    print_success "Redis installed"
fi

# Start Redis service
print_info "Starting Redis service..."
brew services start redis

# Wait for Redis to start
sleep 2

print_success "Redis is running"

################################################################################
# Step 4: Install PM2 (Process Manager)
################################################################################

print_header "Step 4: Installing PM2"

if command -v pm2 &> /dev/null; then
    print_success "PM2 already installed"
else
    print_info "Installing PM2 globally..."
    npm install -g pm2
    print_success "PM2 installed"
fi

################################################################################
# Step 5: Create Database
################################################################################

print_header "Step 5: Setting Up Database"

cd /Users/kvimedia/thumbnailbuilder/server

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw thumbnailbuilder; then
    print_info "Database 'thumbnailbuilder' already exists"
else
    print_info "Creating database 'thumbnailbuilder'..."
    createdb thumbnailbuilder
    print_success "Database created"
fi

################################################################################
# Step 6: Configure Environment Variables
################################################################################

print_header "Step 6: Configuring Environment Variables"

# Generate JWT secret if needed
if ! grep -q "JWT_SECRET=" .env || grep -q "JWT_SECRET=$" .env || grep -q "JWT_SECRET=your" .env; then
    print_info "Generating JWT secret..."
    JWT_SECRET=$(openssl rand -base64 32)

    # Update .env file
    if grep -q "# JWT_SECRET=" .env; then
        sed -i '' "s|# JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    elif grep -q "JWT_SECRET=" .env; then
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    else
        echo "" >> .env
        echo "# JWT Authentication" >> .env
        echo "JWT_SECRET=$JWT_SECRET" >> .env
    fi
    print_success "JWT secret generated"
fi

# Enable Redis configuration
if grep -q "# REDIS_HOST=" .env; then
    print_info "Enabling Redis configuration..."
    sed -i '' 's/# REDIS_HOST=/REDIS_HOST=/' .env
    sed -i '' 's/# REDIS_PORT=/REDIS_PORT=/' .env
    print_success "Redis configuration enabled"
fi

# Add DATABASE_URL if missing
if ! grep -q "DATABASE_URL=" .env; then
    print_info "Adding DATABASE_URL..."
    echo "" >> .env
    echo "# Database URL (for migrations)" >> .env
    echo "DATABASE_URL=postgresql://localhost/thumbnailbuilder" >> .env
    print_success "DATABASE_URL added"
fi

# Add Stripe test keys placeholders if missing
if ! grep -q "STRIPE_SECRET_KEY=" .env; then
    print_info "Adding Stripe configuration placeholders..."
    echo "" >> .env
    echo "# Stripe Configuration (TEST MODE)" >> .env
    echo "# Get keys from: https://dashboard.stripe.com/test/apikeys" >> .env
    echo "STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE" >> .env
    echo "STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE" >> .env
    print_success "Stripe placeholders added"
fi

print_success "Environment configured"

################################################################################
# Step 7: Install Dependencies
################################################################################

print_header "Step 7: Installing Node.js Dependencies"

print_info "Installing dependencies..."
npm install

print_success "Dependencies installed"

################################################################################
# Step 8: Run Database Migrations
################################################################################

print_header "Step 8: Running Database Migrations"

print_info "Running migrations..."
npm run migrate:up

print_success "Migrations completed"

################################################################################
# Step 9: Create Admin User
################################################################################

print_header "Step 9: Setting Up Admin User"

# Start server temporarily in background
print_info "Starting temporary server..."
node app.js &
SERVER_PID=$!
sleep 5

# Register admin user
print_info "Creating admin user (admin@thumbnailbuilder.app)..."
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@thumbnailbuilder.app",
    "password": "Admin123!",
    "username": "admin"
  }' > /dev/null 2>&1 || print_info "Admin user may already exist"

# Stop temporary server
kill $SERVER_PID 2>/dev/null || true
sleep 2

# Grant admin role
print_info "Granting admin role..."
psql -d thumbnailbuilder -c "UPDATE users SET role = 'admin' WHERE email = 'admin@thumbnailbuilder.app';" > /dev/null 2>&1

print_success "Admin user configured"
echo "   Email: admin@thumbnailbuilder.app"
echo "   Password: Admin123!"

################################################################################
# Step 10: Allocate Test Credits
################################################################################

print_header "Step 10: Allocating Test Credits"

print_info "Running credit allocation script..."
psql -d thumbnailbuilder -f /Users/kvimedia/thumbnailbuilder/scripts/allocate-test-credits.sql > /dev/null 2>&1

print_success "Test credits allocated"

################################################################################
# Step 11: Start Application with PM2
################################################################################

print_header "Step 11: Starting Application"

# Stop any existing PM2 processes
pm2 delete thumbnailbuilder-api 2>/dev/null || true

# Start with PM2
print_info "Starting application with PM2..."
pm2 start app.js --name thumbnailbuilder-api --instances 1

# Save PM2 configuration
pm2 save

print_success "Application started with PM2"

################################################################################
# Step 12: Run Health Check
################################################################################

print_header "Step 12: Running Health Check"

sleep 3

cd /Users/kvimedia/thumbnailbuilder
./scripts/health-check.sh

################################################################################
# COMPLETE
################################################################################

print_header "🎉 Setup Complete!"

echo ""
echo -e "${GREEN}ThumbnailBuilder v9.2.0 is now fully operational!${NC}"
echo ""
echo "📍 Access Points:"
echo "   • Command Center: http://localhost:3000/create-v9-command-center.html"
echo "   • Admin Console:  http://localhost:3000/admin-v9-console.html"
echo "   • Health Check:   http://localhost:3000/health"
echo ""
echo "👤 Admin Login:"
echo "   • Email:    admin@thumbnailbuilder.app"
echo "   • Password: Admin123!"
echo ""
echo "🛠️  Useful Commands:"
echo "   • View logs:       pm2 logs thumbnailbuilder-api"
echo "   • Restart server:  pm2 restart thumbnailbuilder-api"
echo "   • Stop server:     pm2 stop thumbnailbuilder-api"
echo "   • Server status:   pm2 status"
echo "   • Run API tests:   ./test-api-endpoints.sh"
echo ""
echo "📝 Next Steps:"
echo "   1. Configure Stripe keys in server/.env (get from dashboard.stripe.com/test)"
echo "   2. Add Supabase credentials if you want cloud storage"
echo "   3. Run API tests: ./test-api-endpoints.sh"
echo "   4. Open browser and test the UI!"
echo ""
echo -e "${BLUE}Happy building! 🚀${NC}"
echo ""
