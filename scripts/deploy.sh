#!/bin/bash

################################################################################
# ThumbnailBuilder v9.2.0 - Automated Deployment Script
# Deploys application to production with safety checks
################################################################################

set -e  # Exit on error

# Configuration
APP_NAME="thumbnailbuilder"
APP_DIR="/var/www/thumbnailbuilder"
BACKUP_DIR="/var/backups/thumbnailbuilder"
NODE_ENV="${NODE_ENV:-production}"
PM2_APP_NAME="thumbnailbuilder-api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

################################################################################
# Helper Functions
################################################################################

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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

confirm() {
    local message=$1
    echo -n -e "${YELLOW}$message (y/N): ${NC}"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

################################################################################
# Pre-Flight Checks
################################################################################

preflight_checks() {
    print_header "Pre-Flight Checks"

    # Check if running as appropriate user
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. Consider using a service user."
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Install Node.js 18+ first."
        exit 1
    fi
    print_success "Node.js $(node -v) found"

    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Install npm first."
        exit 1
    fi
    print_success "npm $(npm -v) found"

    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL not found. Install PostgreSQL 14+ first."
        exit 1
    fi
    print_success "PostgreSQL $(psql --version | awk '{print $3}') found"

    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        print_error "Redis not found. Install Redis 7+ first."
        exit 1
    fi
    print_success "Redis found"

    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        print_warning "PM2 not found. Installing PM2..."
        npm install -g pm2
    fi
    print_success "PM2 $(pm2 -v) found"

    # Check git
    if ! command -v git &> /dev/null; then
        print_error "git not found. Install git first."
        exit 1
    fi
    print_success "git $(git --version | awk '{print $3}') found"

    # Check disk space
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        print_error "Disk usage is ${DISK_USAGE}%. Free up space before deploying."
        exit 1
    fi
    print_success "Disk usage: ${DISK_USAGE}%"

    print_success "All pre-flight checks passed"
}

################################################################################
# Backup Current Deployment
################################################################################

backup_current() {
    print_header "Backing Up Current Deployment"

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"

    # Create backup directory
    mkdir -p "$BACKUP_PATH"

    # Backup application files
    if [ -d "$APP_DIR" ]; then
        print_info "Backing up application files..."
        cp -r "$APP_DIR" "$BACKUP_PATH/app"
        print_success "Application files backed up"
    else
        print_warning "Application directory not found. Skipping file backup."
    fi

    # Backup database
    print_info "Backing up database..."
    DB_NAME="${DB_NAME:-thumbnailbuilder}"
    if command -v pg_dump &> /dev/null; then
        pg_dump "$DB_NAME" > "$BACKUP_PATH/database_$TIMESTAMP.sql"
        print_success "Database backed up to $BACKUP_PATH/database_$TIMESTAMP.sql"
    else
        print_warning "pg_dump not found. Skipping database backup."
    fi

    # Keep only last 5 backups
    print_info "Cleaning old backups..."
    cd "$BACKUP_DIR"
    ls -t | tail -n +6 | xargs -r rm -rf
    print_success "Old backups cleaned"

    echo ""
    print_success "Backup completed: $BACKUP_PATH"
}

################################################################################
# Pull Latest Code
################################################################################

pull_code() {
    print_header "Pulling Latest Code"

    cd "$APP_DIR"

    # Check if git repo exists
    if [ ! -d ".git" ]; then
        print_error "Not a git repository. Initialize or clone the repository first."
        exit 1
    fi

    # Stash any local changes
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "Local changes detected. Stashing..."
        git stash save "Auto-stash before deployment $(date)"
    fi

    # Pull latest changes
    print_info "Pulling latest changes from main branch..."
    git fetch origin
    git checkout main
    git pull origin main

    # Show latest commit
    LATEST_COMMIT=$(git log -1 --pretty=format:"%h - %s (%an, %ar)")
    print_success "Latest commit: $LATEST_COMMIT"
}

################################################################################
# Install Dependencies
################################################################################

install_dependencies() {
    print_header "Installing Dependencies"

    cd "$APP_DIR/server"

    # Clean install
    print_info "Installing Node.js dependencies..."
    npm ci --production

    print_success "Dependencies installed"
}

################################################################################
# Run Database Migrations
################################################################################

run_migrations() {
    print_header "Running Database Migrations"

    cd "$APP_DIR/server"

    # Check migration status
    print_info "Checking migration status..."
    npm run migrate:status

    # Ask for confirmation
    if confirm "Run database migrations?"; then
        print_info "Running migrations..."
        npm run migrate:up

        print_success "Migrations completed"
    else
        print_warning "Skipping migrations"
    fi
}

################################################################################
# Build Application
################################################################################

build_application() {
    print_header "Building Application"

    # If you have a build step (e.g., TypeScript compilation), add it here
    print_info "No build step required for this application"
}

################################################################################
# Restart Services
################################################################################

restart_services() {
    print_header "Restarting Services"

    # Stop PM2 processes gracefully
    print_info "Stopping PM2 processes..."
    if pm2 list | grep -q "$PM2_APP_NAME"; then
        pm2 stop "$PM2_APP_NAME"
        print_success "PM2 processes stopped"
    else
        print_warning "No PM2 processes found to stop"
    fi

    # Start PM2 processes
    print_info "Starting PM2 processes..."
    cd "$APP_DIR/server"

    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start app.js --name "$PM2_APP_NAME" --instances 2 --env production
    fi

    pm2 save
    print_success "PM2 processes started"

    # Reload Nginx (if available)
    if command -v nginx &> /dev/null; then
        print_info "Reloading Nginx..."
        sudo nginx -t && sudo systemctl reload nginx
        print_success "Nginx reloaded"
    fi
}

################################################################################
# Smoke Tests
################################################################################

smoke_tests() {
    print_header "Running Smoke Tests"

    # Wait for server to start
    print_info "Waiting for server to start..."
    sleep 5

    BASE_URL="${BASE_URL:-http://localhost:3000}"

    # Test /ping endpoint
    print_info "Testing /ping endpoint..."
    if curl -s -f "$BASE_URL/ping" > /dev/null 2>&1; then
        print_success "/ping endpoint responding"
    else
        print_error "/ping endpoint not responding"
        return 1
    fi

    # Test /health endpoint
    print_info "Testing /health endpoint..."
    HEALTH_RESPONSE=$(curl -s "$BASE_URL/health" 2>/dev/null)
    if [ -n "$HEALTH_RESPONSE" ]; then
        STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$STATUS" = "ok" ]; then
            print_success "/health endpoint status: $STATUS"
        else
            print_warning "/health endpoint status: $STATUS (degraded)"
        fi
    else
        print_error "/health endpoint not responding"
        return 1
    fi

    # Test API endpoint
    print_info "Testing /api/billing/plans endpoint..."
    if curl -s -f "$BASE_URL/api/billing/plans" > /dev/null 2>&1; then
        print_success "/api/billing/plans endpoint responding"
    else
        print_error "/api/billing/plans endpoint not responding"
        return 1
    fi

    print_success "All smoke tests passed"
}

################################################################################
# Rollback Function
################################################################################

rollback() {
    print_header "ROLLBACK INITIATED"

    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | head -n1)

    if [ -z "$LATEST_BACKUP" ]; then
        print_error "No backups found to rollback to"
        exit 1
    fi

    print_warning "Rolling back to: $LATEST_BACKUP"

    # Stop services
    pm2 stop "$PM2_APP_NAME"

    # Restore application files
    if [ -d "$BACKUP_DIR/$LATEST_BACKUP/app" ]; then
        print_info "Restoring application files..."
        rm -rf "$APP_DIR"
        cp -r "$BACKUP_DIR/$LATEST_BACKUP/app" "$APP_DIR"
        print_success "Application files restored"
    fi

    # Restore database
    DB_BACKUP=$(find "$BACKUP_DIR/$LATEST_BACKUP" -name "database_*.sql" | head -n1)
    if [ -f "$DB_BACKUP" ]; then
        if confirm "Restore database from backup?"; then
            print_info "Restoring database..."
            DB_NAME="${DB_NAME:-thumbnailbuilder}"
            psql "$DB_NAME" < "$DB_BACKUP"
            print_success "Database restored"
        fi
    fi

    # Restart services
    pm2 restart "$PM2_APP_NAME"
    pm2 save

    print_success "Rollback completed"
}

################################################################################
# Main Deployment Flow
################################################################################

main() {
    print_header "ThumbnailBuilder v9.2.0 Deployment"
    echo "Timestamp: $(date)"
    echo "Environment: $NODE_ENV"
    echo ""

    # Check if rollback is requested
    if [ "$1" = "rollback" ]; then
        rollback
        exit 0
    fi

    # Confirm deployment
    if ! confirm "Start deployment to $NODE_ENV?"; then
        print_warning "Deployment cancelled"
        exit 0
    fi

    # Run deployment steps
    preflight_checks
    backup_current
    pull_code
    install_dependencies
    run_migrations
    build_application
    restart_services

    # Run smoke tests
    if smoke_tests; then
        print_header "Deployment Successful"
        print_success "ThumbnailBuilder v9.2.0 deployed successfully!"
        echo ""
        echo "Next steps:"
        echo "1. Monitor logs: pm2 logs $PM2_APP_NAME"
        echo "2. Check health: curl http://localhost:3000/health"
        echo "3. View status: pm2 status"
        echo ""
    else
        print_header "Deployment Failed"
        print_error "Smoke tests failed. Application may not be working correctly."
        echo ""
        if confirm "Rollback to previous version?"; then
            rollback
        else
            print_warning "Manual intervention required"
            echo "Check logs: pm2 logs $PM2_APP_NAME"
        fi
        exit 1
    fi
}

# Run main function
main "$@"
