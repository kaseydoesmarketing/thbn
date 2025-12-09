#!/bin/bash

################################################################################
# ThumbnailBuilder v9.2.0 - API Endpoint Testing Script
# Tests all 30+ API endpoints to verify functionality
################################################################################

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@thumbnailbuilder.app}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Tokens (will be populated during tests)
USER_TOKEN=""
ADMIN_TOKEN=""
USER_ID=""

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_test() {
    echo -n "Testing $1... "
}

test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local token=$4
    local data=$5
    local description=$6

    print_test "$description"

    local headers=()
    if [ -n "$token" ]; then
        headers+=(-H "Authorization: Bearer $token")
    fi
    headers+=(-H "Content-Type: application/json")

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" "${headers[@]}" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" "${headers[@]}" -d "$data" 2>/dev/null)
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (Status: $status_code)"
        ((TESTS_PASSED++))

        # Store response for later use
        echo "$body" > /tmp/last_response.json
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "   Response: $body"
        ((TESTS_FAILED++))
        return 1
    fi
}

skip_test() {
    local description=$1
    echo -e "${YELLOW}⊘ SKIP${NC} $description (requires manual setup)"
    ((TESTS_SKIPPED++))
}

extract_json_value() {
    local json=$1
    local key=$2
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
}

################################################################################
# Main Test Suite
################################################################################

print_header "ThumbnailBuilder API Test Suite"
echo "Base URL: $BASE_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Check if server is running
echo -n "Checking if server is accessible... "
if curl -s -f "$BASE_URL/ping" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not accessible at $BASE_URL${NC}"
    echo "Please start the server and try again."
    exit 1
fi

################################################################################
# 1. HEALTH ENDPOINTS
################################################################################

print_header "1. Health Endpoints"

test_endpoint GET /health 200 "" "" "GET /health"
test_endpoint GET /ping 200 "" "" "GET /ping"

################################################################################
# 2. AUTH ENDPOINTS
################################################################################

print_header "2. Auth Endpoints"

# Register new user
test_endpoint POST /api/auth/register 200 "" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"username\":\"testuser\"}" \
    "POST /api/auth/register (new user)"

if [ $? -eq 0 ]; then
    response=$(cat /tmp/last_response.json)
    USER_ID=$(extract_json_value "$response" "userId")
    echo "   User ID: $USER_ID"
fi

# Login with new user
test_endpoint POST /api/auth/login 200 "" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "POST /api/auth/login"

if [ $? -eq 0 ]; then
    response=$(cat /tmp/last_response.json)
    USER_TOKEN=$(extract_json_value "$response" "token")
    echo "   Token: ${USER_TOKEN:0:20}..."
fi

# Test duplicate registration
test_endpoint POST /api/auth/register 400 "" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"username\":\"testuser\"}" \
    "POST /api/auth/register (duplicate email)"

# Test invalid login
test_endpoint POST /api/auth/login 401 "" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"WrongPassword123!\"}" \
    "POST /api/auth/login (wrong password)"

# Logout
test_endpoint POST /api/auth/logout 200 "$USER_TOKEN" "" \
    "POST /api/auth/logout"

# Re-login for further tests
test_endpoint POST /api/auth/login 200 "" \
    "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
    "POST /api/auth/login (re-login)"

if [ $? -eq 0 ]; then
    response=$(cat /tmp/last_response.json)
    USER_TOKEN=$(extract_json_value "$response" "token")
fi

################################################################################
# 3. BILLING ENDPOINTS
################################################################################

print_header "3. Billing Endpoints"

# Get subscription plans
test_endpoint GET /api/billing/plans 200 "" "" \
    "GET /api/billing/plans"

# Get credits (should be 0 initially)
test_endpoint GET /api/billing/credits 200 "$USER_TOKEN" "" \
    "GET /api/billing/credits"

# Get subscription status
test_endpoint GET /api/billing/subscription 200 "$USER_TOKEN" "" \
    "GET /api/billing/subscription"

# Create checkout session
test_endpoint POST /api/billing/checkout 200 "$USER_TOKEN" \
    "{\"planId\":1,\"successUrl\":\"http://localhost:3000/success\",\"cancelUrl\":\"http://localhost:3000/cancel\"}" \
    "POST /api/billing/checkout"

# Create customer portal session
test_endpoint POST /api/billing/portal 200 "$USER_TOKEN" \
    "{\"returnUrl\":\"http://localhost:3000/account\"}" \
    "POST /api/billing/portal"

################################################################################
# 4. GENERATION ENDPOINTS
################################################################################

print_header "4. Generation Endpoints"

# Test generation without credits (should fail)
test_endpoint POST /api/generate 403 "$USER_TOKEN" \
    "{\"text\":\"Test Thumbnail\",\"creatorStyle\":\"auto\"}" \
    "POST /api/generate (no credits)"

# Test job status (non-existent job)
test_endpoint GET /api/jobs/fake_job_id 404 "$USER_TOKEN" "" \
    "GET /api/jobs/:jobId (not found)"

# Test generation without auth
test_endpoint POST /api/generate 401 "" \
    "{\"text\":\"Test Thumbnail\",\"creatorStyle\":\"auto\"}" \
    "POST /api/generate (no auth)"

################################################################################
# 5. ADMIN ENDPOINTS (if admin user exists)
################################################################################

print_header "5. Admin Endpoints"

echo "Attempting to login as admin..."
admin_login_response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null)

admin_login_status=$?

if [ $admin_login_status -eq 0 ]; then
    ADMIN_TOKEN=$(extract_json_value "$admin_login_response" "token")

    if [ -n "$ADMIN_TOKEN" ]; then
        echo -e "${GREEN}✅ Admin login successful${NC}"

        # Model management
        test_endpoint GET /api/admin/models 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/models"

        # Analytics
        test_endpoint GET "/api/admin/analytics/overview?period=24h" 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/analytics/overview"

        test_endpoint GET "/api/admin/analytics/usage?period=7d" 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/analytics/usage"

        test_endpoint GET "/api/admin/analytics/top-users?limit=10" 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/analytics/top-users"

        # User search
        test_endpoint GET "/api/admin/users/search?q=test" 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/users/search"

        # Health
        test_endpoint GET /api/admin/health/detailed 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/health/detailed"

        # API keys
        test_endpoint GET /api/admin/keys/status 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/keys/status"

        # Queue stats
        test_endpoint GET /api/admin/queue/stats 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/queue/stats"

        # Audit log
        test_endpoint GET "/api/admin/audit?limit=10" 200 "$ADMIN_TOKEN" "" \
            "GET /api/admin/audit"

    else
        echo -e "${YELLOW}⚠ Admin login failed - skipping admin tests${NC}"
        skip_test "Admin endpoints (no admin credentials)"
    fi
else
    echo -e "${YELLOW}⚠ Admin user not configured - skipping admin tests${NC}"
    skip_test "Admin endpoints (admin user not configured)"
fi

################################################################################
# 6. UNAUTHORIZED ACCESS TESTS
################################################################################

print_header "6. Unauthorized Access Tests"

# Try to access admin endpoints without auth
test_endpoint GET /api/admin/models 401 "" "" \
    "GET /api/admin/models (no auth)"

# Try to access admin endpoints as regular user
test_endpoint GET /api/admin/models 403 "$USER_TOKEN" "" \
    "GET /api/admin/models (non-admin user)"

# Try to access user endpoints without auth
test_endpoint GET /api/billing/credits 401 "" "" \
    "GET /api/billing/credits (no auth)"

test_endpoint POST /api/generate 401 "" \
    "{\"text\":\"Test\",\"creatorStyle\":\"auto\"}" \
    "POST /api/generate (no auth)"

################################################################################
# 7. STRIPE WEBHOOK (manual test required)
################################################################################

print_header "7. Stripe Webhook Endpoint"

skip_test "POST /api/stripe/webhook (requires Stripe signature)"

################################################################################
# 8. FACES ENDPOINTS (if implemented)
################################################################################

print_header "8. Faces Endpoints"

# Test face upload endpoint exists
test_endpoint POST /api/faces/upload 400 "$USER_TOKEN" "" \
    "POST /api/faces/upload (no file)"

################################################################################
# RESULTS SUMMARY
################################################################################

print_header "Test Results Summary"

echo ""
echo -e "${GREEN}Passed:  $TESTS_PASSED${NC}"
echo -e "${RED}Failed:  $TESTS_FAILED${NC}"
echo -e "${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
echo "Total:   $((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Set up admin user: UPDATE users SET role = 'admin' WHERE email = '$ADMIN_EMAIL';"
    echo "2. Allocate test credits: Run credit allocation script"
    echo "3. Test complete generation flow in browser"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Review the failed tests above and fix issues before deployment."
    echo ""
    exit 1
fi
