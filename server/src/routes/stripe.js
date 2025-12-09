/**
 * Stripe Webhook Routes
 *
 * Handles Stripe webhook events for subscription lifecycle
 */

const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');

/**
 * POST /api/stripe/webhook
 * Stripe webhook endpoint - receives events from Stripe
 *
 * IMPORTANT: This route must use express.raw() middleware to access raw body
 * for signature verification. Configured in app.js.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];

    try {
        // Verify webhook signature
        const event = stripeService.verifyWebhookSignature(req.body, signature);

        console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

        // Check for idempotency - skip if already processed
        const alreadyProcessed = await stripeService.hasEventBeenProcessed(event.id);
        if (alreadyProcessed) {
            console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
            return res.json({ received: true, status: 'already_processed' });
        }

        // Process event based on type
        let processed = false;
        let processingStatus = 'processed';

        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    await stripeService.handleCheckoutCompleted(event.data.object);
                    processed = true;
                    break;

                case 'customer.subscription.created':
                    console.log('[Stripe Webhook] Subscription created (handled by checkout.session.completed)');
                    processed = true;
                    break;

                case 'customer.subscription.updated':
                    await stripeService.handleSubscriptionUpdated(event.data.object);
                    processed = true;
                    break;

                case 'customer.subscription.deleted':
                    await stripeService.handleSubscriptionDeleted(event.data.object);
                    processed = true;
                    break;

                case 'invoice.payment_succeeded':
                    await stripeService.handleInvoicePaymentSucceeded(event.data.object);
                    processed = true;
                    break;

                case 'invoice.payment_failed':
                    console.log('[Stripe Webhook] Invoice payment failed:', event.data.object.id);
                    // Could trigger email notification or UI alert
                    processed = true;
                    break;

                default:
                    console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
                    processingStatus = 'skipped';
                    processed = true;
            }
        } catch (processingError) {
            console.error(`[Stripe Webhook] Error processing event ${event.id}:`, processingError);
            processingStatus = 'failed';
            // Still mark as processed to avoid infinite retries
            processed = true;
        }

        // Mark event as processed for idempotency
        if (processed) {
            await stripeService.markEventProcessed(
                event.id,
                event.type,
                event.data.object,
                processingStatus
            );
        }

        res.json({ received: true, status: processingStatus });

    } catch (error) {
        console.error('[Stripe Webhook] Webhook processing failed:', error);

        // Return 400 for signature verification failures (Stripe will retry)
        if (error.message === 'Invalid webhook signature') {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // Return 500 for other errors (Stripe will retry)
        return res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;
