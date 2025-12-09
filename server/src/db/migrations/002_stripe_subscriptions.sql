-- Migration: Stripe Subscription & Credit System
-- Version: 1.0.0
-- Description: Adds subscription plans, user subscriptions, credit tracking, and Stripe integration tables

-- =====================================================
-- 1. SUBSCRIPTION PLANS
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    stripe_product_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_price_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(50) NOT NULL CHECK (tier IN ('solo', 'pro', 'agency')),
    monthly_price_cents INTEGER NOT NULL CHECK (monthly_price_cents > 0),
    monthly_credits INTEGER NOT NULL CHECK (monthly_credits > 0),
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_plans_tier ON subscription_plans(tier);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);

-- =====================================================
-- 2. USER SUBSCRIPTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired', 'paused')),
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);

-- =====================================================
-- 3. USER CREDITS
-- =====================================================
CREATE TABLE IF NOT EXISTS user_credits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    credits_remaining INTEGER NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
    credits_allocated INTEGER NOT NULL DEFAULT 0,
    last_allocation_at TIMESTAMP,
    last_allocation_period_start TIMESTAMP,
    last_allocation_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);

-- =====================================================
-- 4. CREDIT TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Positive for allocation, negative for deduction
    type VARCHAR(50) NOT NULL CHECK (type IN ('allocation', 'deduction', 'refund', 'bonus', 'adjustment')),
    reason VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    related_job_id INTEGER REFERENCES thumbnail_jobs(id),
    related_subscription_id INTEGER REFERENCES user_subscriptions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- =====================================================
-- 5. STRIPE EVENTS LOG (for idempotency)
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_events (
    id SERIAL PRIMARY KEY,
    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payload JSONB,
    processing_status VARCHAR(50) DEFAULT 'processed' CHECK (processing_status IN ('processed', 'failed', 'skipped'))
);

CREATE INDEX idx_stripe_events_event_id ON stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_event_type ON stripe_events(event_type);

-- =====================================================
-- 6. STRIPE CUSTOMERS
-- =====================================================
CREATE TABLE IF NOT EXISTS stripe_customers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_stripe_customer_id ON stripe_customers(stripe_customer_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get user credit balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    SELECT credits_remaining INTO v_balance
    FROM user_credits
    WHERE user_id = p_user_id;

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Function: Deduct credits atomically
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id INTEGER,
    p_amount INTEGER,
    p_job_id INTEGER DEFAULT NULL,
    p_reason VARCHAR DEFAULT 'Thumbnail generation'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, message TEXT) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Lock the row for update to prevent race conditions
    SELECT credits_remaining INTO v_current_balance
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Check if user has credits record
    IF v_current_balance IS NULL THEN
        RETURN QUERY SELECT false, 0, 'User credits not found'::TEXT;
        RETURN;
    END IF;

    -- Check if sufficient credits
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT false, v_current_balance, 'Insufficient credits'::TEXT;
        RETURN;
    END IF;

    -- Deduct credits
    v_new_balance := v_current_balance - p_amount;

    UPDATE user_credits
    SET credits_remaining = v_new_balance,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;

    -- Log transaction
    INSERT INTO credit_transactions (
        user_id,
        amount,
        type,
        reason,
        balance_before,
        balance_after,
        related_job_id
    ) VALUES (
        p_user_id,
        -p_amount,
        'deduction',
        p_reason,
        v_current_balance,
        v_new_balance,
        p_job_id
    );

    RETURN QUERY SELECT true, v_new_balance, 'Credits deducted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA (Default Plans)
-- =====================================================

-- Note: Stripe product/price IDs should be replaced with actual IDs from Stripe dashboard
-- These are placeholder values for development

INSERT INTO subscription_plans (stripe_product_id, stripe_price_id, name, tier, monthly_price_cents, monthly_credits, features) VALUES
('prod_solo_creator_tb', 'price_solo_2499_monthly', 'Solo Creator', 'solo', 2499, 100, '{"gemini_model": "gemini-2.5-flash-image", "support": "email", "storage_gb": 5}'),
('prod_pro_creator_tb', 'price_pro_4999_monthly', 'Pro Creator', 'pro', 4999, 250, '{"gemini_model": "gemini-3-pro-image-preview", "support": "priority", "storage_gb": 20, "advanced_analytics": true}')
ON CONFLICT (stripe_product_id) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE subscription_plans IS 'Available subscription plans with Stripe product/price mappings';
COMMENT ON TABLE user_subscriptions IS 'Active and historical user subscriptions linked to Stripe';
COMMENT ON TABLE user_credits IS 'Current credit balance for each user (one row per user)';
COMMENT ON TABLE credit_transactions IS 'Immutable log of all credit allocations and deductions';
COMMENT ON TABLE stripe_events IS 'Webhook event log for idempotency and debugging';
COMMENT ON TABLE stripe_customers IS 'Stripe customer ID mapping to users';

COMMENT ON FUNCTION get_user_credit_balance IS 'Safely retrieve user credit balance';
COMMENT ON FUNCTION deduct_credits IS 'Atomically deduct credits with transaction logging and race condition protection';
