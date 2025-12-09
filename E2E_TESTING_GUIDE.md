# ThumbnailBuilder v9.2.0 - End-to-End Testing Guide

**Version:** 9.2.0 Command Center
**Date:** December 9, 2025
**Purpose:** Comprehensive testing procedures for all user journeys and system integrations

---

## Table of Contents

1. [Testing Environment Setup](#testing-environment-setup)
2. [User Journey Tests](#user-journey-tests)
3. [Stripe Integration Tests](#stripe-integration-tests)
4. [Generation Pipeline Tests](#generation-pipeline-tests)
5. [Admin Console Tests](#admin-console-tests)
6. [API Endpoint Tests](#api-endpoint-tests)
7. [Performance Tests](#performance-tests)
8. [Security Tests](#security-tests)
9. [Rollback Tests](#rollback-tests)
10. [Automated Testing Scripts](#automated-testing-scripts)

---

## Testing Environment Setup

### Prerequisites

1. **Test Stripe Account**
   - Create separate Stripe test account at https://dashboard.stripe.com/test
   - Use test API keys (starts with `pk_test_` and `sk_test_`)
   - Test credit card: `4242 4242 4242 4242` (any future date, any CVC)

2. **Test Database**
   ```bash
   # Create isolated test database
   createdb thumbnailbuilder_test

   # Run migrations
   cd server
   npm run migrate:up
   ```

3. **Test Environment Variables**
   ```bash
   # server/.env.test
   NODE_ENV=test
   PORT=3001
   DATABASE_URL=postgresql://postgres:password@localhost/thumbnailbuilder_test
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_DB=1  # Use separate Redis DB for testing

   # Stripe TEST keys
   STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXX
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXX

   # NanoBanana API
   NANOBANANA_API_KEY=your_test_key

   # Gemini API
   GEMINI_API_KEY=your_test_key

   # CORS
   CORS_ORIGIN=http://localhost:3001
   ```

4. **Start Test Server**
   ```bash
   # Terminal 1: Start server with test env
   NODE_ENV=test node server/app.js

   # Terminal 2: Serve frontend
   cd /Users/kvimedia/thumbnailbuilder
   python3 -m http.server 3002
   ```

5. **Testing Tools**
   ```bash
   # Install testing dependencies
   npm install --save-dev \
     jest \
     supertest \
     @stripe/stripe-js \
     puppeteer \
     artillery  # For load testing
   ```

---

## User Journey Tests

### Journey 1: New User Registration → First Thumbnail

**Objective:** Verify complete onboarding flow from signup to first generation.

**Steps:**

1. **Registration (POST /api/auth/register)**
   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "SecurePass123!",
       "username": "testuser"
     }'
   ```

   **Expected Response:**
   ```json
   {
     "message": "User registered successfully",
     "userId": 1
   }
   ```

2. **Login (POST /api/auth/login)**
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "SecurePass123!"
     }'
   ```

   **Expected Response:**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIs...",
     "user": {
       "id": 1,
       "email": "test@example.com",
       "username": "testuser"
     }
   }
   ```

   **Store token:** `export TOKEN="eyJhbGciOiJIUzI1NiIs..."`

3. **Check Initial Credits (GET /api/billing/credits)**
   ```bash
   curl http://localhost:3001/api/billing/credits \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected Response:**
   ```json
   {
     "credits": 0,
     "creditsAllocated": 0,
     "creditsUsed": 0,
     "hasActiveSubscription": false
   }
   ```

4. **Create Checkout Session (POST /api/billing/checkout)**
   ```bash
   curl -X POST http://localhost:3001/api/billing/checkout \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "planId": 1,
       "successUrl": "http://localhost:3002/success",
       "cancelUrl": "http://localhost:3002/cancel"
     }'
   ```

   **Expected Response:**
   ```json
   {
     "url": "https://checkout.stripe.com/c/pay/cs_test_..."
   }
   ```

5. **Complete Stripe Checkout**
   - Open checkout URL in browser
   - Use test card: `4242 4242 4242 4242`
   - Complete payment
   - Verify webhook receives `checkout.session.completed`

6. **Verify Credits Allocated**
   ```bash
   curl http://localhost:3001/api/billing/credits \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected Response (Solo Plan):**
   ```json
   {
     "credits": 100,
     "creditsAllocated": 100,
     "creditsUsed": 0,
     "hasActiveSubscription": true
   }
   ```

7. **Generate First Thumbnail (POST /api/generate)**
   ```bash
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "text": "How I Made $10,000 in 30 Days",
       "creatorStyle": "mrbeast",
       "textPosition": "center",
       "textSize": 80,
       "textColor": "#FFFF00",
       "subjectUrl": "https://example.com/face.jpg"
     }'
   ```

   **Expected Response:**
   ```json
   {
     "jobId": "job_abc123"
   }
   ```

8. **Poll Job Status (GET /api/jobs/:jobId)**
   ```bash
   while true; do
     curl http://localhost:3001/api/jobs/job_abc123 \
       -H "Authorization: Bearer $TOKEN"
     sleep 2
   done
   ```

   **Expected Progress:**
   ```json
   {"jobId": "job_abc123", "status": "pending", "progress": 0}
   {"jobId": "job_abc123", "status": "active", "progress": 25}
   {"jobId": "job_abc123", "status": "active", "progress": 50}
   {"jobId": "job_abc123", "status": "active", "progress": 75}
   {"jobId": "job_abc123", "status": "completed", "progress": 100, "variants": [...]}
   ```

9. **Verify Credits Deducted**
   ```bash
   curl http://localhost:3001/api/billing/credits \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected Response:**
   ```json
   {
     "credits": 99,
     "creditsAllocated": 100,
     "creditsUsed": 1,
     "hasActiveSubscription": true
   }
   ```

**Success Criteria:**
- ✅ User registered successfully
- ✅ Login returns valid JWT token
- ✅ Initial credits are 0
- ✅ Stripe checkout completes without errors
- ✅ Webhook allocates correct credits (100 for Solo, 200 for Pro)
- ✅ Generation job completes successfully
- ✅ Credits deducted atomically (99 remaining)
- ✅ Variants returned with valid Supabase URLs

---

### Journey 2: Existing User - Subscription Renewal

**Objective:** Test automatic subscription renewal and credit refresh.

**Steps:**

1. **Check Current Subscription (GET /api/billing/subscription)**
   ```bash
   curl http://localhost:3001/api/billing/subscription \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected Response:**
   ```json
   {
     "plan": "Solo Plan",
     "status": "active",
     "creditsRemaining": 50,
     "renewalDate": "2025-01-09T00:00:00.000Z"
   }
   ```

2. **Use All Credits**
   ```bash
   # Generate 50 thumbnails to exhaust credits
   for i in {1..50}; do
     curl -X POST http://localhost:3001/api/generate \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d "{\"text\": \"Test $i\", \"creatorStyle\": \"auto\"}"
     sleep 1
   done
   ```

3. **Verify Zero Credits**
   ```bash
   curl http://localhost:3001/api/billing/credits \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected Response:**
   ```json
   {
     "credits": 0,
     "creditsAllocated": 100,
     "creditsUsed": 100,
     "hasActiveSubscription": true
   }
   ```

4. **Attempt Generation with Zero Credits**
   ```bash
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text": "Should Fail", "creatorStyle": "auto"}'
   ```

   **Expected Response (403 Forbidden):**
   ```json
   {
     "error": "Insufficient credits",
     "creditsRequired": 1,
     "creditsAvailable": 0
   }
   ```

5. **Simulate Stripe Renewal Webhook**
   ```bash
   # Trigger invoice.payment_succeeded webhook
   # (Use Stripe CLI: stripe trigger invoice.payment_succeeded)
   stripe trigger invoice.payment_succeeded
   ```

6. **Verify Credits Refreshed**
   ```bash
   curl http://localhost:3001/api/billing/credits \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected Response:**
   ```json
   {
     "credits": 100,
     "creditsAllocated": 200,
     "creditsUsed": 100,
     "hasActiveSubscription": true
   }
   ```

**Success Criteria:**
- ✅ Subscription status shows active
- ✅ Credit exhaustion prevents generation
- ✅ 403 error with clear message on insufficient credits
- ✅ Renewal webhook allocates new credits
- ✅ User can generate after renewal

---

### Journey 3: Plan Upgrade (Solo → Pro)

**Objective:** Test in-place subscription upgrade and credit adjustment.

**Steps:**

1. **Check Current Plan (Solo)**
   ```bash
   curl http://localhost:3001/api/billing/subscription \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected:**
   ```json
   {
     "plan": "Solo Plan",
     "creditsRemaining": 50
   }
   ```

2. **Create Upgrade Checkout**
   ```bash
   curl -X POST http://localhost:3001/api/billing/checkout \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "planId": 2,
       "successUrl": "http://localhost:3002/success",
       "cancelUrl": "http://localhost:3002/cancel"
     }'
   ```

3. **Complete Upgrade Payment**
   - Stripe will prorate the current subscription
   - Complete checkout with test card

4. **Verify Plan Upgraded**
   ```bash
   curl http://localhost:3001/api/billing/subscription \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected:**
   ```json
   {
     "plan": "Pro Plan",
     "status": "active",
     "creditsRemaining": 150
   }
   ```

5. **Generate with Pro Model**
   ```bash
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Pro Model Test",
       "creatorStyle": "hormozi",
       "useProModel": true
     }'
   ```

   **Expected:**
   - Job uses Gemini 3 Pro Image Preview
   - Higher quality output
   - Metadata includes `model: "gemini-3-pro-image-preview"`

**Success Criteria:**
- ✅ Upgrade checkout completes
- ✅ Subscription updated to Pro Plan
- ✅ Credits adjusted correctly (100 Solo → 200 Pro)
- ✅ Pro model accessible after upgrade
- ✅ Higher cost per generation reflected

---

## Stripe Integration Tests

### Test 1: Webhook Signature Verification

**Objective:** Ensure webhook endpoints reject unsigned requests.

**Steps:**

1. **Send Unsigned Webhook**
   ```bash
   curl -X POST http://localhost:3001/api/stripe/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "type": "checkout.session.completed",
       "data": {"object": {"id": "cs_test_fake"}}
     }'
   ```

   **Expected Response (400 Bad Request):**
   ```json
   {
     "error": "Invalid signature"
   }
   ```

2. **Send Properly Signed Webhook (via Stripe CLI)**
   ```bash
   # Forward webhooks from Stripe to local server
   stripe listen --forward-to localhost:3001/api/stripe/webhook

   # Trigger test event
   stripe trigger checkout.session.completed
   ```

   **Expected Response (200 OK):**
   ```json
   {
     "received": true
   }
   ```

**Success Criteria:**
- ✅ Unsigned requests rejected with 400
- ✅ Signed requests accepted with 200
- ✅ Webhook secret properly configured

---

### Test 2: Subscription Cancellation

**Objective:** Verify credits remain usable until period end.

**Steps:**

1. **Cancel Subscription**
   ```bash
   # Via Stripe Dashboard or API
   curl -X POST http://localhost:3001/api/billing/portal \
     -H "Authorization: Bearer $TOKEN"
   # Open portal URL and cancel subscription
   ```

2. **Verify Status Updated**
   ```bash
   curl http://localhost:3001/api/billing/subscription \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected:**
   ```json
   {
     "plan": "Solo Plan",
     "status": "active",
     "cancelAtPeriodEnd": true,
     "periodEnd": "2025-01-09T00:00:00.000Z",
     "creditsRemaining": 75
   }
   ```

3. **Generate Thumbnail (Should Still Work)**
   ```bash
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text": "Post-Cancel Test", "creatorStyle": "auto"}'
   ```

   **Expected:**
   - Generation completes successfully
   - Credits deducted: 74 remaining

4. **Simulate Period End**
   ```bash
   # Trigger subscription.deleted webhook
   stripe trigger customer.subscription.deleted
   ```

5. **Verify Subscription Ended**
   ```bash
   curl http://localhost:3001/api/billing/subscription \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected:**
   ```json
   {
     "plan": null,
     "status": "canceled",
     "creditsRemaining": 74
   }
   ```

6. **Attempt Generation After Cancellation**
   ```bash
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text": "Should Work With Remaining Credits", "creatorStyle": "auto"}'
   ```

   **Expected:**
   - Generation succeeds (uses remaining 74 credits)
   - Credits deducted: 73 remaining

**Success Criteria:**
- ✅ Cancellation doesn't immediately revoke access
- ✅ Credits remain usable until exhausted
- ✅ No new credits allocated after period end
- ✅ User can resubscribe anytime

---

## Generation Pipeline Tests

### Test 1: Multi-Model Pipeline Execution

**Objective:** Verify all 3 models execute correctly in sequence.

**Steps:**

1. **Generate with All Models**
   ```bash
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Pipeline Test",
       "creatorStyle": "mrbeast",
       "textPosition": "center",
       "textSize": 80,
       "textColor": "#FFFF00",
       "subjectUrl": "https://example.com/face.jpg",
       "useProModel": true
     }'
   ```

2. **Monitor Worker Logs**
   ```bash
   # Should see 3 sequential API calls:
   # 1. NanoBanana composition generation
   # 2. Flux PuLID face integration
   # 3. Gemini 3 Pro Image Preview style enhancement
   ```

3. **Verify Variant Metadata**
   ```bash
   curl http://localhost:3001/api/jobs/job_abc123 \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected Variant Structure:**
   ```json
   {
     "variants": [
       {
         "url": "https://supabase.storage.co/...",
         "cost": 0.015,
         "models": ["nanobanana", "flux-pulid", "gemini-3-pro"],
         "metadata": {
           "composition": "nanobanana",
           "faceEnhancement": "flux-pulid",
           "styleTransfer": "gemini-3-pro-image-preview"
         }
       }
     ],
     "totalCost": 0.045
   }
   ```

**Success Criteria:**
- ✅ All 3 models execute in correct order
- ✅ Each model's output passed to next
- ✅ Total cost calculated correctly
- ✅ Final variant has all enhancements

---

### Test 2: Creator Style Switching

**Objective:** Test all 5 creator styles produce distinct outputs.

**Styles to Test:**
1. Auto (Smart Selection)
2. MrBeast (High Engagement)
3. Hormozi (Professional)
4. Gadzhi (Premium)
5. Magnates (Cinematic)

**Test Script:**
```bash
#!/bin/bash
STYLES=("auto" "mrbeast" "hormozi" "gadzhi" "magnates")
TOKEN="your_token_here"

for style in "${STYLES[@]}"; do
  echo "Testing style: $style"

  response=$(curl -s -X POST http://localhost:3001/api/generate \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"Creator Style Test: $style\",
      \"creatorStyle\": \"$style\",
      \"textPosition\": \"center\",
      \"textSize\": 80
    }")

  jobId=$(echo $response | jq -r '.jobId')
  echo "Job ID: $jobId"

  # Poll until completion
  while true; do
    status=$(curl -s http://localhost:3001/api/jobs/$jobId \
      -H "Authorization: Bearer $TOKEN" \
      | jq -r '.status')

    if [ "$status" = "completed" ]; then
      echo "✅ $style completed"
      break
    elif [ "$status" = "failed" ]; then
      echo "❌ $style failed"
      break
    fi

    sleep 2
  done

  sleep 1
done

echo "All styles tested!"
```

**Success Criteria:**
- ✅ All 5 styles complete without errors
- ✅ Visual inspection confirms distinct aesthetics
- ✅ Auto style adapts based on text content

---

### Test 3: Error Handling and Retries

**Objective:** Verify graceful degradation when external APIs fail.

**Scenarios:**

1. **NanoBanana API Failure**
   ```bash
   # Temporarily block NanoBanana endpoint
   sudo iptables -A OUTPUT -d nano-banana-api.com -j DROP

   # Attempt generation
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text": "API Failure Test", "creatorStyle": "auto"}'
   ```

   **Expected:**
   - Worker retries 3 times
   - Job fails with clear error message
   - Credits NOT deducted (atomic rollback)

   ```bash
   # Restore connectivity
   sudo iptables -D OUTPUT -d nano-banana-api.com -j DROP
   ```

2. **Supabase Upload Failure**
   ```bash
   # Temporarily remove Supabase credentials
   export SUPABASE_URL=""
   export SUPABASE_KEY=""

   # Restart server and attempt generation
   ```

   **Expected:**
   - Worker completes generation
   - Upload to Supabase fails
   - Job status: "failed"
   - Clear error message in response

3. **Redis Connection Loss**
   ```bash
   # Stop Redis temporarily
   redis-cli shutdown

   # Attempt generation
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text": "Redis Failure Test", "creatorStyle": "auto"}'
   ```

   **Expected:**
   - Job fails to queue
   - 503 Service Unavailable response
   - Health endpoint shows degraded status

   ```bash
   # Restart Redis
   redis-server
   ```

**Success Criteria:**
- ✅ External API failures don't crash worker
- ✅ Clear error messages returned to user
- ✅ Credits refunded on failure
- ✅ System recovers automatically when services restore

---

## Admin Console Tests

### Test 1: Model Switching

**Objective:** Test live model switching without server restart.

**Steps:**

1. **Login as Admin**
   ```sql
   -- Set user as admin in database
   UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
   ```

2. **Access Admin Console**
   - Navigate to `http://localhost:3002/admin-v9-console.html`
   - Login with admin credentials

3. **Switch to Gemini 3 Pro**
   - Click "Models" tab
   - Select "Gemini 3 Pro Image Preview"
   - Click "Switch Model"

   **Expected:**
   - Success notification
   - Audit log entry created
   - Next generation uses Gemini 3 Pro

4. **Verify Model Switch (POST /api/admin/models/switch)**
   ```bash
   curl -X POST http://localhost:3001/api/admin/models/switch \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "targetModel": "gemini-3-pro-image-preview"
     }'
   ```

   **Expected Response:**
   ```json
   {
     "success": true,
     "message": "Model switched to gemini-3-pro-image-preview"
   }
   ```

5. **Generate with New Model**
   ```bash
   curl -X POST http://localhost:3001/api/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"text": "Post-Switch Test", "creatorStyle": "auto"}'
   ```

   **Expected:**
   - Variant metadata shows `gemini-3-pro-image-preview`
   - Higher cost per variant

**Success Criteria:**
- ✅ Model switch without server restart
- ✅ Audit log records admin action
- ✅ Subsequent generations use new model
- ✅ No errors or downtime

---

### Test 2: Credit Adjustment

**Objective:** Test manual credit allocation/deduction.

**Steps:**

1. **Search for User**
   ```bash
   curl http://localhost:3001/api/admin/users/search?q=test@example.com \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

   **Expected:**
   ```json
   {
     "users": [
       {
         "id": 1,
         "email": "test@example.com",
         "credits": 75,
         "subscription": "Solo Plan"
       }
     ]
   }
   ```

2. **Add 50 Bonus Credits**
   ```bash
   curl -X POST http://localhost:3001/api/admin/users/1/credits/adjust \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 50,
       "reason": "Compensation for downtime"
     }'
   ```

   **Expected:**
   ```json
   {
     "success": true,
     "newBalance": 125,
     "transaction": {
       "amount": 50,
       "type": "admin_adjustment",
       "reason": "Compensation for downtime"
     }
   }
   ```

3. **Verify Credit Balance**
   ```bash
   # User checks their credits
   curl http://localhost:3001/api/billing/credits \
     -H "Authorization: Bearer $TOKEN"
   ```

   **Expected:**
   ```json
   {
     "credits": 125,
     "creditsAllocated": 150,
     "creditsUsed": 25
   }
   ```

4. **Deduct Credits (Penalty)**
   ```bash
   curl -X POST http://localhost:3001/api/admin/users/1/credits/adjust \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "amount": -25,
       "reason": "Policy violation"
     }'
   ```

   **Expected:**
   ```json
   {
     "success": true,
     "newBalance": 100
   }
   ```

**Success Criteria:**
- ✅ Credits adjusted correctly
- ✅ Transaction logged with reason
- ✅ Audit entry created
- ✅ User sees updated balance immediately

---

### Test 3: Analytics Dashboard

**Objective:** Verify analytics calculations are accurate.

**Steps:**

1. **Generate Test Data**
   ```bash
   # Generate 20 thumbnails across different users
   for i in {1..20}; do
     curl -X POST http://localhost:3001/api/generate \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d "{\"text\": \"Analytics Test $i\", \"creatorStyle\": \"auto\"}"
     sleep 1
   done
   ```

2. **Fetch Analytics Overview**
   ```bash
   curl http://localhost:3001/api/admin/analytics/overview?period=24h \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

   **Expected:**
   ```json
   {
     "totalGenerations": 20,
     "totalCost": 0.30,
     "activeUsers": 1,
     "avgGenerationsPerUser": 20.0,
     "period": "24h"
   }
   ```

3. **Fetch Usage Breakdown**
   ```bash
   curl http://localhost:3001/api/admin/analytics/usage?period=7d \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

   **Expected:**
   ```json
   {
     "byCreatorStyle": {
       "auto": 10,
       "mrbeast": 5,
       "hormozi": 3,
       "gadzhi": 1,
       "magnates": 1
     },
     "byModel": {
       "gemini-2.5-flash-image": 15,
       "gemini-3-pro-image-preview": 5
     }
   }
   ```

4. **Fetch Top Users**
   ```bash
   curl http://localhost:3001/api/admin/analytics/top-users?limit=10 \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

   **Expected:**
   ```json
   {
     "users": [
       {
         "email": "test@example.com",
         "totalGenerations": 20,
         "creditsUsed": 20,
         "rank": 1
       }
     ]
   }
   ```

**Success Criteria:**
- ✅ Total generations match expected count
- ✅ Cost calculations accurate
- ✅ Usage breakdown sums correctly
- ✅ Top users ranked correctly

---

## API Endpoint Tests

### Full API Test Suite

**Script: `test-api-endpoints.sh`**

```bash
#!/bin/bash

# Configuration
BASE_URL="http://localhost:3001"
ADMIN_TOKEN="your_admin_token_here"
USER_TOKEN="your_user_token_here"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3
  local token=$4
  local data=$5

  echo -n "Testing $method $endpoint... "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  status_code=$(echo "$response" | tail -n1)

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${NC} (Status: $status_code)"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
    ((TESTS_FAILED++))
  fi
}

echo "========================================"
echo "  ThumbnailBuilder API Test Suite"
echo "========================================"
echo ""

# Health Endpoints
echo "--- Health Endpoints ---"
test_endpoint GET /health 200 ""
test_endpoint GET /ping 200 ""

# Auth Endpoints
echo ""
echo "--- Auth Endpoints ---"
test_endpoint POST /api/auth/register 200 "" '{"email":"newuser@test.com","password":"Pass123!","username":"newuser"}'
test_endpoint POST /api/auth/login 200 "" '{"email":"test@example.com","password":"SecurePass123!"}'
test_endpoint POST /api/auth/logout 200 "$USER_TOKEN"

# Billing Endpoints
echo ""
echo "--- Billing Endpoints ---"
test_endpoint GET /api/billing/plans 200 ""
test_endpoint GET /api/billing/credits 200 "$USER_TOKEN"
test_endpoint GET /api/billing/subscription 200 "$USER_TOKEN"
test_endpoint POST /api/billing/checkout 200 "$USER_TOKEN" '{"planId":1,"successUrl":"http://test.com","cancelUrl":"http://test.com"}'

# Generation Endpoints
echo ""
echo "--- Generation Endpoints ---"
test_endpoint POST /api/generate 200 "$USER_TOKEN" '{"text":"API Test","creatorStyle":"auto"}'
test_endpoint GET /api/jobs/test_job_id 404 "$USER_TOKEN"

# Admin Endpoints (Protected)
echo ""
echo "--- Admin Endpoints (Protected) ---"
test_endpoint GET /api/admin/models 200 "$ADMIN_TOKEN"
test_endpoint GET /api/admin/analytics/overview 200 "$ADMIN_TOKEN"
test_endpoint GET /api/admin/users/search?q=test 200 "$ADMIN_TOKEN"
test_endpoint GET /api/admin/health/detailed 200 "$ADMIN_TOKEN"

# Unauthorized Access Tests
echo ""
echo "--- Unauthorized Access Tests ---"
test_endpoint GET /api/admin/models 401 ""
test_endpoint GET /api/admin/models 403 "$USER_TOKEN"
test_endpoint POST /api/generate 401 ""

echo ""
echo "========================================"
echo "  Test Results"
echo "========================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed${NC}"
  exit 1
fi
```

**Run:**
```bash
chmod +x test-api-endpoints.sh
./test-api-endpoints.sh
```

---

## Performance Tests

### Load Test with Artillery

**artillery-config.yml:**

```yaml
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 20
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      name: "Spike test"
  variables:
    testToken: "your_test_token_here"

scenarios:
  - name: "Generate Thumbnail"
    flow:
      - post:
          url: "/api/generate"
          headers:
            Authorization: "Bearer {{ testToken }}"
            Content-Type: "application/json"
          json:
            text: "Load Test {{ $randomString() }}"
            creatorStyle: "auto"
          capture:
            - json: "$.jobId"
              as: "jobId"

      - loop:
          - get:
              url: "/api/jobs/{{ jobId }}"
              headers:
                Authorization: "Bearer {{ testToken }}"
              capture:
                - json: "$.status"
                  as: "jobStatus"
          - think: 2
          count: 30
          whileTrue: "jobStatus !== 'completed' && jobStatus !== 'failed'"
```

**Run Load Test:**
```bash
npm install -g artillery
artillery run artillery-config.yml
```

**Expected Metrics:**
- Request rate: 50 req/sec sustained
- P95 latency: < 500ms (non-generation endpoints)
- Error rate: < 1%
- Worker queue: No job timeout

---

## Security Tests

### Test 1: SQL Injection

**Objective:** Verify parameterized queries prevent SQL injection.

```bash
# Attempt SQL injection in email field
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com OR 1=1--",
    "password": "anything"
  }'
```

**Expected:**
- Login fails with "Invalid credentials"
- No database error exposed
- Logs show sanitized input

### Test 2: JWT Token Manipulation

**Objective:** Ensure tampered tokens are rejected.

```bash
# Decode token and modify payload
# (Use jwt.io to decode and modify)

# Attempt request with modified token
curl http://localhost:3001/api/billing/credits \
  -H "Authorization: Bearer TAMPERED_TOKEN"
```

**Expected:**
- 401 Unauthorized
- Error: "Invalid token"

### Test 3: Rate Limiting

**Objective:** Verify rate limits prevent abuse.

```bash
# Send 150 requests in 15 minutes (exceeds 100/15min limit)
for i in {1..150}; do
  curl http://localhost:3001/api/billing/plans
done
```

**Expected:**
- First 100 requests: 200 OK
- Requests 101-150: 429 Too Many Requests
- Response includes `Retry-After` header

---

## Rollback Tests

### Test 1: Database Migration Rollback

**Objective:** Ensure migrations can be reversed without data loss.

**Steps:**

1. **Check Current Migration**
   ```bash
   npm run migrate:status
   ```

2. **Create Test Data**
   ```sql
   INSERT INTO users (email, password, username)
   VALUES ('rollback@test.com', 'hash', 'rollbackuser');
   ```

3. **Rollback Migration**
   ```bash
   npm run migrate:down
   ```

4. **Verify Data Integrity**
   ```sql
   SELECT * FROM users WHERE email = 'rollback@test.com';
   ```

   **Expected:** Data preserved in previous schema

5. **Re-apply Migration**
   ```bash
   npm run migrate:up
   ```

**Success Criteria:**
- ✅ Migration rollback succeeds
- ✅ No data loss
- ✅ Schema reverted correctly
- ✅ Re-migration succeeds

---

## Automated Testing Scripts

### Jest Test Suite

**`server/tests/integration/generation.test.js`:**

```javascript
const request = require('supertest');
const app = require('../../app');
const db = require('../../src/db/connection');

describe('Thumbnail Generation Flow', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Register test user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'jest@test.com',
        password: 'TestPass123!',
        username: 'jestuser'
      });

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'jest@test.com',
        password: 'TestPass123!'
      });

    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Allocate credits
    await db.query(
      'INSERT INTO user_credits (user_id, credits_allocated, credits_remaining) VALUES ($1, 100, 100)',
      [userId]
    );
  });

  afterAll(async () => {
    // Cleanup
    await db.query('DELETE FROM users WHERE email = $1', ['jest@test.com']);
    await db.close();
  });

  test('Should generate thumbnail successfully', async () => {
    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'Jest Test Thumbnail',
        creatorStyle: 'auto'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jobId');
  });

  test('Should deduct credits after generation', async () => {
    const res = await request(app)
      .get('/api/billing/credits')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.credits).toBe(99); // 1 credit deducted
  });

  test('Should reject generation without credits', async () => {
    // Exhaust credits
    await db.query(
      'UPDATE user_credits SET credits_remaining = 0 WHERE user_id = $1',
      [userId]
    );

    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        text: 'Should Fail',
        creatorStyle: 'auto'
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient credits');
  });
});
```

**Run Jest Tests:**
```bash
cd server
npm test
```

---

## Final Checklist

### Before Production Deployment:

- [ ] All user journey tests pass
- [ ] Stripe integration tests pass (live mode)
- [ ] Generation pipeline tests pass
- [ ] Admin console tests pass
- [ ] All API endpoints return expected responses
- [ ] Load test completes without errors
- [ ] Security tests show no vulnerabilities
- [ ] Database migration/rollback verified
- [ ] Automated Jest tests pass
- [ ] Manual UI testing complete
- [ ] Browser compatibility verified (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsive testing (if applicable)
- [ ] Error monitoring configured (Sentry)
- [ ] Rate limiting verified
- [ ] CORS configuration correct
- [ ] SSL certificates valid
- [ ] Backup procedures tested
- [ ] Rollback plan documented and tested

---

## Troubleshooting Guide

### Common Issues:

**Issue:** "Insufficient credits" despite having credits

**Solution:**
```sql
-- Check actual credit balance
SELECT * FROM user_credits WHERE user_id = 1;

-- Recalculate if needed
UPDATE user_credits
SET credits_remaining = credits_allocated - credits_used
WHERE user_id = 1;
```

---

**Issue:** Webhook not receiving events

**Solution:**
```bash
# Verify webhook secret matches Stripe dashboard
echo $STRIPE_WEBHOOK_SECRET

# Check webhook endpoint is publicly accessible
curl https://thumbnailbuilder.app/api/stripe/webhook

# View Stripe webhook logs
stripe logs tail
```

---

**Issue:** Generation jobs stuck in "active" state

**Solution:**
```bash
# Check Redis connection
redis-cli ping

# View stuck jobs
redis-cli LRANGE bull:thumbnail-generation:active 0 -1

# Clear stuck jobs (use cautiously)
redis-cli DEL bull:thumbnail-generation:active
```

---

**Issue:** Admin console shows 403 Forbidden

**Solution:**
```sql
-- Verify user has admin role
SELECT id, email, role FROM users WHERE email = 'admin@example.com';

-- Grant admin role
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

---

## Continuous Testing Strategy

### Daily Automated Tests:
```bash
# Cron job (runs at 2 AM daily)
0 2 * * * cd /path/to/server && npm test && ./test-api-endpoints.sh
```

### Pre-Deployment Tests:
```bash
# Run full test suite before each deployment
npm run test:full
artillery run artillery-config.yml
./test-api-endpoints.sh
```

### Post-Deployment Smoke Tests:
```bash
# Verify critical paths after deployment
curl -f https://thumbnailbuilder.app/health || exit 1
curl -f https://thumbnailbuilder.app/api/billing/plans || exit 1
```

---

**Status:** ✅ E2E Testing Guide Complete
**Coverage:** User journeys, Stripe, Generation, Admin, API, Performance, Security, Rollback
**Next:** Final project completion summary

---

*E2E Testing Guide - ThumbnailBuilder v9.2.0*
*December 9, 2025*
