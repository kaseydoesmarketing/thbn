#!/bin/bash

################################################################################
# ThumbnailBuilder v9.2.0 - Comprehensive Health Check Script
# Verifies all services and dependencies are operational
################################################################################

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
DB_NAME="${DB_NAME:-thumbnailbuilder}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Status counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

check_pass() {
    echo -e "${GREEN}✅ PASS${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠ WARN${NC} $1"
    ((CHECKS_WARNING++))
}

################################################################################
# Main Health Checks
################################################################################

print_header "ThumbnailBuilder Health Check"
echo "Timestamp: $(date)"
echo "Base URL: $BASE_URL"
echo ""

################################################################################
# 1. SYSTEM REQUIREMENTS
################################################################################

print_header "1. System Requirements"

# Check Node.js version
echo -n "Checking Node.js version... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        check_pass "Node.js $NODE_VERSION"
    else
        check_fail "Node.js $NODE_VERSION (requires v18+)"
    fi
else
    check_fail "Node.js not found"
fi

# Check npm version
echo -n "Checking npm version... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check_pass "npm $NPM_VERSION"
else
    check_fail "npm not found"
fi

# Check disk space
echo -n "Checking disk space... "
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    check_pass "Disk usage: ${DISK_USAGE}%"
elif [ "$DISK_USAGE" -lt 90 ]; then
    check_warn "Disk usage: ${DISK_USAGE}% (getting high)"
else
    check_fail "Disk usage: ${DISK_USAGE}% (critical)"
fi

# Check memory
echo -n "Checking memory... "
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | awk '/Mem:/ {printf("%.0f", ($3/$2)*100)}')
    if [ "$MEMORY_USAGE" -lt 80 ]; then
        check_pass "Memory usage: ${MEMORY_USAGE}%"
    elif [ "$MEMORY_USAGE" -lt 90 ]; then
        check_warn "Memory usage: ${MEMORY_USAGE}% (getting high)"
    else
        check_fail "Memory usage: ${MEMORY_USAGE}% (critical)"
    fi
else
    check_warn "Memory check not available (free command not found)"
fi

################################################################################
# 2. DATABASE (PostgreSQL)
################################################################################

print_header "2. Database (PostgreSQL)"

# Check if PostgreSQL is installed
echo -n "Checking PostgreSQL installation... "
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | awk '{print $3}')
    check_pass "PostgreSQL $PG_VERSION"
else
    check_fail "PostgreSQL not found"
fi

# Check if database exists
echo -n "Checking database exists... "
if command -v psql &> /dev/null; then
    if psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        check_pass "Database '$DB_NAME' exists"
    else
        check_fail "Database '$DB_NAME' not found"
    fi
else
    check_warn "Cannot verify database (psql not available)"
fi

# Check database connection
echo -n "Checking database connection... "
if command -v pg_isready &> /dev/null; then
    if pg_isready -d "$DB_NAME" &> /dev/null; then
        check_pass "Database accepting connections"
    else
        check_fail "Database not accepting connections"
    fi
else
    check_warn "Cannot verify connection (pg_isready not available)"
fi

# Check required tables exist
if command -v psql &> /dev/null; then
    echo -n "Checking required tables... "
    REQUIRED_TABLES=("users" "subscription_plans" "user_subscriptions" "user_credits" "credit_transactions" "stripe_events" "stripe_customers")
    MISSING_TABLES=()

    for table in "${REQUIRED_TABLES[@]}"; do
        if ! psql -d "$DB_NAME" -tAc "SELECT 1 FROM pg_tables WHERE tablename='$table'" 2>/dev/null | grep -q 1; then
            MISSING_TABLES+=("$table")
        fi
    done

    if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
        check_pass "All required tables exist (${#REQUIRED_TABLES[@]} tables)"
    else
        check_fail "Missing tables: ${MISSING_TABLES[*]}"
    fi
fi

################################################################################
# 3. REDIS
################################################################################

print_header "3. Redis"

# Check if Redis is installed
echo -n "Checking Redis installation... "
if command -v redis-cli &> /dev/null; then
    check_pass "redis-cli available"
else
    check_fail "redis-cli not found"
fi

# Check Redis connection
echo -n "Checking Redis connection... "
if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
        check_pass "Redis responding on $REDIS_HOST:$REDIS_PORT"
    else
        check_fail "Redis not responding on $REDIS_HOST:$REDIS_PORT"
    fi
else
    check_warn "Cannot verify Redis (redis-cli not available)"
fi

# Check Redis memory usage
if command -v redis-cli &> /dev/null; then
    echo -n "Checking Redis memory... "
    REDIS_MEMORY=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
    if [ -n "$REDIS_MEMORY" ]; then
        check_pass "Redis memory usage: $REDIS_MEMORY"
    else
        check_warn "Cannot retrieve Redis memory info"
    fi
fi

# Check Redis connected clients
if command -v redis-cli &> /dev/null; then
    echo -n "Checking Redis clients... "
    REDIS_CLIENTS=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" INFO clients 2>/dev/null | grep "connected_clients" | cut -d: -f2 | tr -d '\r')
    if [ -n "$REDIS_CLIENTS" ]; then
        check_pass "Redis connected clients: $REDIS_CLIENTS"
    else
        check_warn "Cannot retrieve Redis client info"
    fi
fi

################################################################################
# 4. NODE.JS APPLICATION
################################################################################

print_header "4. Node.js Application"

# Check if server is running
echo -n "Checking server accessibility... "
if curl -s -f "$BASE_URL/ping" > /dev/null 2>&1; then
    check_pass "Server responding at $BASE_URL"
else
    check_fail "Server not accessible at $BASE_URL"
fi

# Check /health endpoint
echo -n "Checking /health endpoint... "
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health" 2>/dev/null)
if [ -n "$HEALTH_RESPONSE" ]; then
    STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" = "ok" ]; then
        check_pass "Health status: $STATUS"
    elif [ "$STATUS" = "degraded" ]; then
        check_warn "Health status: $STATUS (some services degraded)"
    else
        check_fail "Health status: $STATUS"
    fi

    # Parse service statuses
    echo ""
    echo "   Service Status:"
    echo "$HEALTH_RESPONSE" | grep -o '"[^"]*":\(true\|false\)' | while read -r line; do
        service=$(echo "$line" | cut -d'"' -f2)
        status=$(echo "$line" | cut -d: -f2)
        if [ "$status" = "true" ]; then
            echo -e "   ${GREEN}✓${NC} $service"
        else
            echo -e "   ${RED}✗${NC} $service"
        fi
    done
    echo ""
else
    check_fail "/health endpoint not responding"
fi

# Check PM2 process (if available)
if command -v pm2 &> /dev/null; then
    echo -n "Checking PM2 processes... "
    PM2_STATUS=$(pm2 jlist 2>/dev/null)
    if [ -n "$PM2_STATUS" ]; then
        RUNNING_PROCESSES=$(echo "$PM2_STATUS" | grep -c '"status":"online"' || echo "0")
        TOTAL_PROCESSES=$(echo "$PM2_STATUS" | grep -c '"name"' || echo "0")
        if [ "$RUNNING_PROCESSES" -gt 0 ]; then
            check_pass "$RUNNING_PROCESSES/$TOTAL_PROCESSES PM2 processes online"
        else
            check_fail "No PM2 processes running"
        fi
    else
        check_warn "PM2 not managing processes"
    fi
else
    check_warn "PM2 not installed"
fi

################################################################################
# 5. EXTERNAL DEPENDENCIES
################################################################################

print_header "5. External Dependencies"

# Check environment variables are set
echo -n "Checking environment variables... "
REQUIRED_ENVS=("DATABASE_URL" "STRIPE_SECRET_KEY" "JWT_SECRET")
MISSING_ENVS=()

for env in "${REQUIRED_ENVS[@]}"; do
    if [ -z "${!env}" ]; then
        MISSING_ENVS+=("$env")
    fi
done

if [ ${#MISSING_ENVS[@]} -eq 0 ]; then
    check_pass "All required env vars set"
else
    check_warn "Missing env vars: ${MISSING_ENVS[*]}"
fi

# Check Supabase connectivity (if configured)
echo -n "Checking Supabase configuration... "
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
    check_pass "Supabase configured"
else
    check_warn "Supabase not configured"
fi

# Check Stripe connectivity (ping Stripe API)
echo -n "Checking Stripe API accessibility... "
if curl -s -f https://api.stripe.com/healthcheck > /dev/null 2>&1; then
    check_pass "Stripe API accessible"
else
    check_warn "Stripe API not accessible (check network)"
fi

################################################################################
# 6. FILE SYSTEM
################################################################################

print_header "6. File System"

# Check uploads directory exists and is writable
echo -n "Checking uploads directory... "
UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
if [ -d "$UPLOAD_DIR" ]; then
    if [ -w "$UPLOAD_DIR" ]; then
        check_pass "Uploads directory writable: $UPLOAD_DIR"
    else
        check_fail "Uploads directory not writable: $UPLOAD_DIR"
    fi
else
    check_warn "Uploads directory not found: $UPLOAD_DIR"
fi

# Check log directory (if using file logging)
if [ -d "./logs" ]; then
    echo -n "Checking logs directory... "
    if [ -w "./logs" ]; then
        check_pass "Logs directory writable"
    else
        check_fail "Logs directory not writable"
    fi
fi

################################################################################
# RESULTS SUMMARY
################################################################################

print_header "Health Check Summary"

echo ""
echo -e "${GREEN}Passed:  $CHECKS_PASSED${NC}"
echo -e "${RED}Failed:  $CHECKS_FAILED${NC}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo "Total:   $((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    if [ $CHECKS_WARNING -eq 0 ]; then
        echo -e "${GREEN}🎉 All checks passed! System is healthy.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠ System is operational but has warnings.${NC}"
        echo "Review warnings above and address if necessary."
        exit 0
    fi
else
    echo -e "${RED}❌ Health check failed!${NC}"
    echo "Review failed checks above and fix issues before deployment."
    exit 1
fi
