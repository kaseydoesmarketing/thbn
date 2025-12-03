#!/bin/bash
# Thumbnail Builder Deployment Script
# Run this on the VPS: ./deploy.sh

set -e

echo "=========================================="
echo "  Thumbnail Builder Deployment"
echo "=========================================="

# Configuration
APP_DIR="/opt/thumbnailbuilder"
REPO_URL="https://github.com/kaseydoesmarketing/thbn.git"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (sudo ./deploy.sh)"
    exit 1
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose..."
    apt-get update
    apt-get install -y docker-compose-plugin
fi

# Create application directory
log_info "Setting up application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or update repository
if [ -d ".git" ]; then
    log_info "Updating existing repository..."
    git pull origin main
else
    log_info "Cloning repository..."
    git clone $REPO_URL .
fi

# Navigate to server directory
cd server

# Create .env if not exists
if [ ! -f ".env" ]; then
    log_info "Creating .env file..."
    cp .env.production .env
    log_warn "Please edit /opt/thumbnailbuilder/server/.env with your actual credentials!"
fi

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

# Build and start containers
log_info "Building and starting containers..."
docker compose down 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

# Wait for services to be healthy
log_info "Waiting for services to start..."
sleep 10

# Check health
if curl -sf http://localhost:3001/ping > /dev/null; then
    log_info "API is healthy!"
else
    log_warn "API health check failed. Check logs with: docker compose logs app"
fi

# Show status
echo ""
log_info "Deployment complete!"
echo ""
echo "Services running:"
docker compose ps
echo ""
echo "API endpoint: http://localhost:3001"
echo "Health check: http://localhost:3001/health"
echo ""
echo "Next steps:"
echo "1. Configure Nginx reverse proxy for thumbnailbuilder.app"
echo "2. Set up SSL with Certbot"
echo "3. Test the API endpoints"
