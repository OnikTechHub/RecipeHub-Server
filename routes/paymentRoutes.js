const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { optionalAuth } = require("../middlewares/authMiddleware");

// Stripe checkout session creation (supports /api/payments/create-payment-intent and /create-checkout-session)
router.post(
  ["/create-checkout-session", "/api/payments/create-payment-intent", "/api/create-checkout-session"],
  optionalAuth,
  paymentController.createCheckoutSession
);

// Payment verification after redirect
router.post(
  ["/verify-payment", "/api/verify-payment", "/api/payments/verify"],
  optionalAuth,
  paymentController.verifyPayment
);

// User transaction history
router.get(
  ["/transactions", "/api/transactions"],
  optionalAuth,
  paymentController.getTransactions
);

// Creator earnings & sales statistics
router.get(
  ["/creator-earnings", "/api/creator-earnings"],
  optionalAuth,
  paymentController.getCreatorEarnings
);

// Purchased recipe details verification
router.get(
  ["/purchased-details/:id", "/api/purchased-details/:id"],
  optionalAuth,
  paymentController.getPurchasedDetails
);

// Purchased recipe IDs for user access check
router.get(
  ["/user-purchased-ids", "/api/user-purchased-ids"],
  optionalAuth,
  paymentController.getUserPurchasedRecipeIds
);

// Membership upgrade webhook endpoint
router.post(
  ["/api/payment-success-webhook", "/payment-success-webhook"],
  paymentController.paymentSuccessWebhook
);

module.exports = router;
