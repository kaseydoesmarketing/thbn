#!/bin/bash

###############################################################################
# ThumbnailBuilder v9.1.0 PRO Deployment Script
# Deploys Tier 2 + Tier 3 Phase 1 to production
###############################################################################

set -e  # Exit on error

echo "================================================"
echo "ThumbnailBuilder v9.1.0 PRO Deployment"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_DIR="/opt/thumbnailbuilder"
SERVER_DIR="$DEPLOY_DIR/server"

# Step 1: Check if running on server
echo -e "${YELLOW}Step 1: Checking environment...${NC}"
if [ ! -d "$DEPLOY_DIR" ]; then
    echo -e "${RED}Error: $DEPLOY_DIR not found. Are you on the production server?${NC}"
    echo "This script should be run on the production server."
    exit 1
fi
echo -e "${GREEN}✓ Environment check passed${NC}"
echo ""

# Step 2: Pull latest code
echo -e "${YELLOW}Step 2: Pulling latest code from GitHub...${NC}"
cd "$DEPLOY_DIR"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# Step 3: Stop running containers
echo -e "${YELLOW}Step 3: Stopping running containers...${NC}"
cd "$SERVER_DIR"
docker-compose down
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Step 4: Rebuild containers (no cache for fresh build)
echo -e "${YELLOW}Step 4: Building containers with v9.1.0 PRO code...${NC}"
docker-compose build --no-cache
echo -e "${GREEN}✓ Containers built${NC}"
echo ""

# Step 5: Start services
echo -e "${YELLOW}Step 5: Starting services...${NC}"
docker-compose up -d
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Step 6: Wait for services to be ready
echo -e "${YELLOW}Step 6: Waiting for services to be ready (30s)...${NC}"
sleep 30
echo -e "${GREEN}✓ Wait complete${NC}"
echo ""

# Step 7: Health checks
echo -e "${YELLOW}Step 7: Running health checks...${NC}"

# Check API health
echo "Checking API health..."
API_HEALTH=$(curl -s http://localhost:3001/health || echo "FAILED")
if echo "$API_HEALTH" | grep -q "healthy"; then
    echo -e "${GREEN}✓ API is healthy${NC}"
else
    echo -e "${RED}✗ API health check failed${NC}"
    echo "$API_HEALTH"
fi

# Check container status
echo "Checking container status..."
docker-compose ps

echo ""

# Step 8: Run Tier 2 quick test
echo -e "${YELLOW}Step 8: Running Tier 2 verification test...${NC}"
if [ -f "tests/tier2-quick-test.js" ]; then
    docker exec thumbnailbuilder-worker node tests/tier2-quick-test.js
    echo -e "${GREEN}✓ Tier 2 verification complete${NC}"
else
    echo -e "${YELLOW}⚠ Tier 2 test not found (skipping)${NC}"
fi
echo ""

# Step 9: Display logs
echo -e "${YELLOW}Step 9: Checking recent logs...${NC}"
echo "API logs:"
docker-compose logs --tail=20 app
echo ""
echo "Worker logs:"
docker-compose logs --tail=20 worker
echo ""

# Step 10: Summary
echo "================================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Version: v9.1.0 PRO"
echo "Features:"
echo "  ✓ Tier 1: Multi-Model, Multi-Pass, Color Grading, 3D Text"
echo "  ✓ Tier 2: Emotion Detection, Face Enhancement, Style Transfer"
echo "  ✓ Tier 3: A/B Variants, Dynamic Composition"
echo ""
echo "Next Steps:"
echo "  1. Test API endpoint: curl http://localhost:3001/api/generate"
echo "  2. Monitor logs: docker-compose logs -f"
echo "  3. Check health: curl http://localhost:3001/health"
echo ""
echo "Rollback command (if needed):"
echo "  cd $DEPLOY_DIR && git checkout [previous-commit-hash]"
echo "  cd $SERVER_DIR && docker-compose down && docker-compose up -d"
echo ""
