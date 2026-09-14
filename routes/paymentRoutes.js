const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { optionalAuth } = require("../middlewares/authMiddleware");

// Stripe checkout session creation
router.post("/create-checkout-session", optionalAuth, paymentController.createCheckoutSession);

// Payment verification after redirect
router.post("/verify-payment", optionalAuth, paymentController.verifyPayment);

// User transaction history
router.get("/transactions", optionalAuth, paymentController.getTransactions);

// Creator earnings & sales statistics
router.get("/creator-earnings", optionalAuth, paymentController.getCreatorEarnings);

// Purchased recipe details verification
router.get("/purchased-details/:id", optionalAuth, paymentController.getPurchasedDetails);

// Membership upgrade webhook endpoint
router.post("/api/payment-success-webhook", paymentController.paymentSuccessWebhook);

module.exports = router;
