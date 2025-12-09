/**
 * Stripe Service - Subscription and Credit Management
 *
 * Handles:
 * - Checkout session creation
 * - Webhook event processing
 * - Credit allocation and deduction
 * - Subscription status management
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db/connection');

class StripeService {
    constructor() {
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    }

    /**
     * Create Stripe checkout session for subscription
     * @param {number} userId - User ID
     * @param {string} priceId - Stripe price ID
     * @param {string} successUrl - Success redirect URL
     * @param {string} cancelUrl - Cancel redirect URL
     * @returns {Promise<Object>} Checkout session
     */
    async createCheckoutSession(userId, priceId, successUrl, cancelUrl) {
        try {
            // Get or create Stripe customer
            const customer = await this.getOrCreateCustomer(userId);

            // Create checkout session
            const session = await stripe.checkout.sessions.create({
                customer: customer.stripe_customer_id,
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [
                    {
                        price: priceId,
                        quantity: 1
                    }
                ],
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    user_id: userId.toString()
                },
                subscription_data: {
                    metadata: {
                        user_id: userId.toString()
                    }
                }
            });

            return {
                sessionId: session.id,
                url: session.url
            };
        } catch (error) {
            console.error('[StripeService] Checkout session creation failed:', error);
            throw new Error(`Failed to create checkout session: ${error.message}`);
        }
    }

    /**
     * Create Stripe billing portal session
     * @param {number} userId - User ID
     * @param {string} returnUrl - Return URL after portal session
     * @returns {Promise<Object>} Portal session
     */
    async createPortalSession(userId, returnUrl) {
        try {
            const customer = await this.getOrCreateCustomer(userId);

            const session = await stripe.billingPortal.sessions.create({
                customer: customer.stripe_customer_id,
                return_url: returnUrl
            });

            return {
                url: session.url
            };
        } catch (error) {
            console.error('[StripeService] Portal session creation failed:', error);
            throw new Error(`Failed to create portal session: ${error.message}`);
        }
    }

    /**
     * Handle checkout.session.completed webhook
     * @param {Object} session - Stripe checkout session object
     */
    async handleCheckoutCompleted(session) {
        const userId = parseInt(session.metadata.user_id);
        const subscriptionId = session.subscription;

        console.log(`[StripeService] Checkout completed for user ${userId}, subscription ${subscriptionId}`);

        // Fetch full subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Get plan details from our database
        const priceId = subscription.items.data[0].price.id;
        const plan = await this.getPlanByPriceId(priceId);

        if (!plan) {
            throw new Error(`No plan found for price ID: ${priceId}`);
        }

        // Create subscription record
        await this.createSubscription(userId, subscription, plan);

        // Allocate initial credits
        await this.allocateCredits(userId, plan.monthly_credits, subscription.id, 'Initial subscription allocation');

        console.log(`[StripeService] Subscription created and credits allocated for user ${userId}`);
    }

    /**
     * Handle customer.subscription.updated webhook
     * @param {Object} subscription - Stripe subscription object
     */
    async handleSubscriptionUpdated(subscription) {
        const userId = parseInt(subscription.metadata.user_id);

        console.log(`[StripeService] Subscription updated for user ${userId}: ${subscription.status}`);

        await db.query(
            `UPDATE user_subscriptions
             SET status = $1,
                 current_period_start = to_timestamp($2),
                 current_period_end = to_timestamp($3),
                 cancel_at_period_end = $4,
                 canceled_at = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE stripe_subscription_id = $6`,
            [
                subscription.status,
                subscription.current_period_start,
                subscription.current_period_end,
                subscription.cancel_at_period_end,
                subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
                subscription.id
            ]
        );
    }

    /**
     * Handle customer.subscription.deleted webhook
     * @param {Object} subscription - Stripe subscription object
     */
    async handleSubscriptionDeleted(subscription) {
        const userId = parseInt(subscription.metadata.user_id);

        console.log(`[StripeService] Subscription deleted for user ${userId}`);

        await db.query(
            `UPDATE user_subscriptions
             SET status = 'canceled',
                 canceled_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE stripe_subscription_id = $1`,
            [subscription.id]
        );
    }

    /**
     * Handle invoice.payment_succeeded webhook
     * @param {Object} invoice - Stripe invoice object
     */
    async handleInvoicePaymentSucceeded(invoice) {
        const subscriptionId = invoice.subscription;

        if (!subscriptionId) {
            console.log('[StripeService] Invoice is not for a subscription, skipping');
            return;
        }

        // Fetch subscription to get metadata
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = parseInt(subscription.metadata.user_id);

        // Get plan details
        const priceId = subscription.items.data[0].price.id;
        const plan = await this.getPlanByPriceId(priceId);

        if (!plan) {
            throw new Error(`No plan found for price ID: ${priceId}`);
        }

        // Allocate monthly credits
        await this.allocateCredits(
            userId,
            plan.monthly_credits,
            subscriptionId,
            `Monthly allocation for period ${new Date(subscription.current_period_start * 1000).toISOString()}`
        );

        console.log(`[StripeService] Credits allocated for user ${userId} after successful payment`);
    }

    /**
     * Allocate credits to user
     * @param {number} userId - User ID
     * @param {number} amount - Number of credits to allocate
     * @param {string} subscriptionId - Related Stripe subscription ID
     * @param {string} reason - Reason for allocation
     */
    async allocateCredits(userId, amount, subscriptionId, reason) {
        const client = await db.pool.connect();

        try {
            await client.query('BEGIN');

            // Get current balance
            const balanceResult = await client.query(
                'SELECT credits_remaining FROM user_credits WHERE user_id = $1 FOR UPDATE',
                [userId]
            );

            let currentBalance = 0;
            let isNewRecord = false;

            if (balanceResult.rows.length === 0) {
                // Create credits record if doesn't exist
                isNewRecord = true;
            } else {
                currentBalance = balanceResult.rows[0].credits_remaining;
            }

            const newBalance = currentBalance + amount;

            if (isNewRecord) {
                await client.query(
                    `INSERT INTO user_credits (user_id, credits_remaining, credits_allocated, last_allocation_at)
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                    [userId, newBalance, amount]
                );
            } else {
                await client.query(
                    `UPDATE user_credits
                     SET credits_remaining = $1,
                         credits_allocated = credits_allocated + $2,
                         last_allocation_at = CURRENT_TIMESTAMP,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $3`,
                    [newBalance, amount, userId]
                );
            }

            // Get subscription ID from database
            const subResult = await client.query(
                'SELECT id FROM user_subscriptions WHERE stripe_subscription_id = $1',
                [subscriptionId]
            );

            const dbSubscriptionId = subResult.rows.length > 0 ? subResult.rows[0].id : null;

            // Log transaction
            await client.query(
                `INSERT INTO credit_transactions (
                    user_id, amount, type, reason, balance_before, balance_after, related_subscription_id
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, amount, 'allocation', reason, currentBalance, newBalance, dbSubscriptionId]
            );

            await client.query('COMMIT');

            console.log(`[StripeService] Allocated ${amount} credits to user ${userId}. New balance: ${newBalance}`);

            return { success: true, newBalance };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[StripeService] Credit allocation failed:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Deduct credits from user (atomic operation)
     * @param {number} userId - User ID
     * @param {number} amount - Number of credits to deduct
     * @param {number} jobId - Related thumbnail job ID
     * @param {string} reason - Reason for deduction
     * @returns {Promise<Object>} Result with success status and new balance
     */
    async deductCredits(userId, amount, jobId = null, reason = 'Thumbnail generation') {
        try {
            const result = await db.query(
                'SELECT * FROM deduct_credits($1, $2, $3, $4)',
                [userId, amount, jobId, reason]
            );

            const { success, new_balance, message } = result.rows[0];

            if (!success) {
                console.log(`[StripeService] Credit deduction failed for user ${userId}: ${message}`);
            }

            return {
                success,
                newBalance: new_balance,
                message
            };
        } catch (error) {
            console.error('[StripeService] Credit deduction error:', error);
            throw error;
        }
    }

    /**
     * Get user credit balance
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Credit balance info
     */
    async getCreditBalance(userId) {
        try {
            const result = await db.query(
                `SELECT credits_remaining, credits_allocated, last_allocation_at
                 FROM user_credits
                 WHERE user_id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return {
                    credits_remaining: 0,
                    credits_allocated: 0,
                    last_allocation_at: null
                };
            }

            return result.rows[0];
        } catch (error) {
            console.error('[StripeService] Failed to get credit balance:', error);
            throw error;
        }
    }

    /**
     * Get user subscription status
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Subscription info
     */
    async getSubscriptionStatus(userId) {
        try {
            const result = await db.query(
                `SELECT us.*, sp.name as plan_name, sp.tier, sp.monthly_credits, sp.monthly_price_cents
                 FROM user_subscriptions us
                 JOIN subscription_plans sp ON us.plan_id = sp.id
                 WHERE us.user_id = $1 AND us.status IN ('active', 'trialing')
                 ORDER BY us.created_at DESC
                 LIMIT 1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            console.error('[StripeService] Failed to get subscription status:', error);
            throw error;
        }
    }

    /**
     * Get all available subscription plans
     * @returns {Promise<Array>} List of plans
     */
    async getAvailablePlans() {
        try {
            const result = await db.query(
                `SELECT * FROM subscription_plans
                 WHERE is_active = true
                 ORDER BY monthly_price_cents ASC`
            );

            return result.rows;
        } catch (error) {
            console.error('[StripeService] Failed to get plans:', error);
            throw error;
        }
    }

    /**
     * Get or create Stripe customer for user
     * @param {number} userId - User ID
     * @returns {Promise<Object>} Stripe customer info
     */
    async getOrCreateCustomer(userId) {
        // Check if customer already exists
        const existingResult = await db.query(
            'SELECT * FROM stripe_customers WHERE user_id = $1',
            [userId]
        );

        if (existingResult.rows.length > 0) {
            return existingResult.rows[0];
        }

        // Get user email
        const userResult = await db.query(
            'SELECT email, username FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error(`User ${userId} not found`);
        }

        const user = userResult.rows[0];

        // Create Stripe customer
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
                user_id: userId.toString()
            }
        });

        // Store in database
        const insertResult = await db.query(
            `INSERT INTO stripe_customers (user_id, stripe_customer_id, email, name)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, customer.id, user.email, user.username]
        );

        return insertResult.rows[0];
    }

    /**
     * Get plan by Stripe price ID
     * @param {string} priceId - Stripe price ID
     * @returns {Promise<Object>} Plan object
     */
    async getPlanByPriceId(priceId) {
        const result = await db.query(
            'SELECT * FROM subscription_plans WHERE stripe_price_id = $1',
            [priceId]
        );

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Create subscription record in database
     * @param {number} userId - User ID
     * @param {Object} subscription - Stripe subscription object
     * @param {Object} plan - Plan object from database
     */
    async createSubscription(userId, subscription, plan) {
        await db.query(
            `INSERT INTO user_subscriptions (
                user_id,
                plan_id,
                stripe_subscription_id,
                stripe_customer_id,
                status,
                current_period_start,
                current_period_end,
                trial_start,
                trial_end
             ) VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7), $8, $9)`,
            [
                userId,
                plan.id,
                subscription.id,
                subscription.customer,
                subscription.status,
                subscription.current_period_start,
                subscription.current_period_end,
                subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
                subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
            ]
        );
    }

    /**
     * Verify Stripe webhook signature
     * @param {Buffer} rawBody - Raw request body
     * @param {string} signature - Stripe signature header
     * @returns {Object} Verified event object
     */
    verifyWebhookSignature(rawBody, signature) {
        try {
            return stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
        } catch (error) {
            console.error('[StripeService] Webhook signature verification failed:', error);
            throw new Error('Invalid webhook signature');
        }
    }

    /**
     * Check if webhook event has been processed (idempotency)
     * @param {string} eventId - Stripe event ID
     * @returns {Promise<boolean>} True if already processed
     */
    async hasEventBeenProcessed(eventId) {
        const result = await db.query(
            'SELECT id FROM stripe_events WHERE stripe_event_id = $1',
            [eventId]
        );

        return result.rows.length > 0;
    }

    /**
     * Mark webhook event as processed
     * @param {string} eventId - Stripe event ID
     * @param {string} eventType - Event type
     * @param {Object} payload - Event payload
     * @param {string} status - Processing status
     */
    async markEventProcessed(eventId, eventType, payload, status = 'processed') {
        await db.query(
            `INSERT INTO stripe_events (stripe_event_id, event_type, payload, processing_status)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (stripe_event_id) DO NOTHING`,
            [eventId, eventType, JSON.stringify(payload), status]
        );
    }
}

module.exports = new StripeService();
