/**
 * Credit Check Middleware
 *
 * Verifies user has sufficient credits before allowing thumbnail generation
 */

const stripeService = require('../services/stripeService');

/**
 * Middleware to require credits for an operation
 * @param {number} creditsNeeded - Number of credits required (default: 1)
 * @returns {Function} Express middleware function
 */
function requireCredits(creditsNeeded = 1) {
    return async function(req, res, next) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            // Get user's credit balance
            const balance = await stripeService.getCreditBalance(userId);
            const creditsRemaining = balance.credits_remaining;

            // Check if user has sufficient credits
            if (creditsRemaining < creditsNeeded) {
                // Get subscription info for upsell
                const subscription = await stripeService.getSubscriptionStatus(userId);

                return res.status(402).json({
                    error: 'Insufficient credits',
                    code: 'INSUFFICIENT_CREDITS',
                    upsell: true,
                    details: {
                        creditsNeeded,
                        creditsRemaining,
                        hasSubscription: !!subscription,
                        planName: subscription?.plan_name || null
                    }
                });
            }

            // Attach credit info to request for use in route handlers
            req.userCredits = {
                remaining: creditsRemaining,
                allocated: balance.credits_allocated,
                lastAllocation: balance.last_allocation_at
            };

            next();
        } catch (error) {
            console.error('[CreditCheck] Credit verification failed:', error);
            res.status(500).json({
                error: 'Failed to verify credits',
                code: 'CREDIT_CHECK_FAILED'
            });
        }
    };
}

/**
 * Optional credit check - doesn't block if insufficient, just warns
 * @param {number} creditsNeeded - Number of credits required (default: 1)
 * @returns {Function} Express middleware function
 */
function checkCredits(creditsNeeded = 1) {
    return async function(req, res, next) {
        try {
            const userId = req.user?.id;

            if (!userId) {
                return next();
            }

            // Get user's credit balance
            const balance = await stripeService.getCreditBalance(userId);
            const creditsRemaining = balance.credits_remaining;

            // Attach credit info to request
            req.userCredits = {
                remaining: creditsRemaining,
                allocated: balance.credits_allocated,
                lastAllocation: balance.last_allocation_at,
                sufficient: creditsRemaining >= creditsNeeded
            };

            next();
        } catch (error) {
            console.error('[CreditCheck] Optional credit check failed:', error);
            // Don't block on optional check failures
            next();
        }
    };
}

module.exports = {
    requireCredits,
    checkCredits
};
