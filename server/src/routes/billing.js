/**
 * Billing API Routes
 *
 * User-facing billing endpoints for subscription management
 */

const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/billing/plans
 * Get all available subscription plans
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = await stripeService.getAvailablePlans();

        res.json({
            plans: plans.map(plan => ({
                id: plan.id,
                name: plan.name,
                tier: plan.tier,
                price: plan.monthly_price_cents / 100, // Convert cents to dollars
                priceDisplay: `$${(plan.monthly_price_cents / 100).toFixed(2)}`,
                credits: plan.monthly_credits,
                stripePriceId: plan.stripe_price_id,
                features: plan.features
            }))
        });
    } catch (error) {
        console.error('[Billing] Failed to get plans:', error);
        res.status(500).json({ error: 'Failed to retrieve plans' });
    }
});

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session
 * Body: { priceId: string }
 */
router.post('/checkout', requireAuth, async (req, res) => {
    try {
        const { priceId } = req.body;
        const userId = req.user.id;

        if (!priceId) {
            return res.status(400).json({ error: 'priceId is required' });
        }

        // Check if user already has active subscription
        const existingSub = await stripeService.getSubscriptionStatus(userId);
        if (existingSub) {
            return res.status(400).json({
                error: 'User already has an active subscription',
                subscription: existingSub
            });
        }

        // Create checkout session
        const baseUrl = process.env.FRONTEND_URL || 'https://thumbnailbuilder.app';
        const successUrl = `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}/pricing?checkout=canceled`;

        const session = await stripeService.createCheckoutSession(
            userId,
            priceId,
            successUrl,
            cancelUrl
        );

        res.json({
            sessionId: session.sessionId,
            url: session.url
        });
    } catch (error) {
        console.error('[Billing] Checkout creation failed:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

/**
 * POST /api/billing/portal
 * Create Stripe billing portal session
 */
router.post('/portal', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const baseUrl = process.env.FRONTEND_URL || 'https://thumbnailbuilder.app';
        const returnUrl = `${baseUrl}/dashboard?portal=return`;

        const session = await stripeService.createPortalSession(userId, returnUrl);

        res.json({
            url: session.url
        });
    } catch (error) {
        console.error('[Billing] Portal creation failed:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

/**
 * GET /api/billing/subscription
 * Get user's current subscription status
 */
router.get('/subscription', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const subscription = await stripeService.getSubscriptionStatus(userId);

        if (!subscription) {
            return res.json({
                hasSubscription: false,
                subscription: null
            });
        }

        res.json({
            hasSubscription: true,
            subscription: {
                id: subscription.id,
                planName: subscription.plan_name,
                tier: subscription.tier,
                status: subscription.status,
                monthlyCredits: subscription.monthly_credits,
                price: subscription.monthly_price_cents / 100,
                currentPeriodStart: subscription.current_period_start,
                currentPeriodEnd: subscription.current_period_end,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                canceledAt: subscription.canceled_at
            }
        });
    } catch (error) {
        console.error('[Billing] Failed to get subscription:', error);
        res.status(500).json({ error: 'Failed to retrieve subscription' });
    }
});

/**
 * GET /api/billing/credits
 * Get user's current credit balance
 */
router.get('/credits', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const balance = await stripeService.getCreditBalance(userId);

        res.json({
            credits: balance.credits_remaining,
            creditsAllocated: balance.credits_allocated,
            lastAllocation: balance.last_allocation_at
        });
    } catch (error) {
        console.error('[Billing] Failed to get credits:', error);
        res.status(500).json({ error: 'Failed to retrieve credits' });
    }
});

module.exports = router;
