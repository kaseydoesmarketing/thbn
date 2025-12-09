-- ============================================================================
-- ThumbnailBuilder v9.2.0 - Test Credit Allocation Script
-- Allocates credits to test users for development/testing
-- ============================================================================

-- Create scripts directory if running standalone
-- Run with: psql -d thumbnailbuilder -f scripts/allocate-test-credits.sql

BEGIN;

-- Function to safely allocate credits to a user
CREATE OR REPLACE FUNCTION allocate_test_credits(
    p_user_email TEXT,
    p_credits INTEGER DEFAULT 100
) RETURNS TABLE(
    user_id INTEGER,
    email TEXT,
    credits_allocated INTEGER,
    success BOOLEAN
) AS $$
DECLARE
    v_user_id INTEGER;
    v_existing_credits INTEGER;
BEGIN
    -- Find user by email
    SELECT id INTO v_user_id FROM users WHERE users.email = p_user_email;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found: %', p_user_email;
        RETURN QUERY SELECT NULL::INTEGER, p_user_email, 0, FALSE;
        RETURN;
    END IF;

    -- Check if user already has credits
    SELECT credits_remaining INTO v_existing_credits
    FROM user_credits
    WHERE user_credits.user_id = v_user_id;

    IF v_existing_credits IS NOT NULL THEN
        RAISE NOTICE 'User % already has % credits', p_user_email, v_existing_credits;
        RETURN QUERY SELECT v_user_id, p_user_email, v_existing_credits, FALSE;
        RETURN;
    END IF;

    -- Insert credits record
    INSERT INTO user_credits (user_id, credits_allocated, credits_used, credits_remaining, last_allocated_at)
    VALUES (v_user_id, p_credits, 0, p_credits, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET credits_allocated = user_credits.credits_allocated + p_credits,
        credits_remaining = user_credits.credits_remaining + p_credits,
        last_allocated_at = NOW();

    -- Log transaction
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, created_at)
    VALUES (v_user_id, p_credits, 'allocation', 'Test credits allocation', NOW());

    RAISE NOTICE 'Allocated % credits to %', p_credits, p_user_email;

    RETURN QUERY SELECT v_user_id, p_user_email, p_credits, TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ALLOCATE CREDITS TO COMMON TEST USERS
-- ============================================================================

-- Allocate 100 credits to admin user (if exists)
SELECT * FROM allocate_test_credits('admin@thumbnailbuilder.app', 100);

-- Allocate 100 credits to test user (if exists)
SELECT * FROM allocate_test_credits('test@example.com', 100);

-- ============================================================================
-- DISPLAY CURRENT CREDIT BALANCES
-- ============================================================================

SELECT
    u.id,
    u.email,
    u.username,
    COALESCE(uc.credits_allocated, 0) as credits_allocated,
    COALESCE(uc.credits_used, 0) as credits_used,
    COALESCE(uc.credits_remaining, 0) as credits_remaining,
    u.role
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id
ORDER BY u.created_at DESC
LIMIT 10;

-- ============================================================================
-- DISPLAY RECENT TRANSACTIONS
-- ============================================================================

SELECT
    ct.id,
    u.email,
    ct.amount,
    ct.transaction_type,
    ct.description,
    ct.created_at
FROM credit_transactions ct
JOIN users u ON ct.user_id = u.id
ORDER BY ct.created_at DESC
LIMIT 20;

COMMIT;

-- ============================================================================
-- HELPER QUERIES (uncomment to use)
-- ============================================================================

-- Remove test credits from a user:
-- DELETE FROM credit_transactions WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');
-- DELETE FROM user_credits WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');

-- Reset credits for a user:
-- UPDATE user_credits SET credits_allocated = 100, credits_used = 0, credits_remaining = 100
-- WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com');

-- Grant admin role to a user:
-- UPDATE users SET role = 'admin' WHERE email = 'admin@thumbnailbuilder.app';

-- View all users with their credit balances:
-- SELECT u.email, uc.credits_remaining, uc.credits_allocated, uc.credits_used
-- FROM users u
-- LEFT JOIN user_credits uc ON u.id = uc.user_id;
