const express = require("express");
const router = express.Router();
const {
  handleAIChat,
  getAIUsageStatus,
  handleGenerateRecipe,
  handleGenerateGroceryList,
} = require("../controllers/aiController");
const { requirePremium } = require("../middlewares/authMiddleware");
const { aiRateLimiter } = require("../middlewares/rateLimitMiddleware");

// AI chatbot endpoint (Rate limited)
router.post(
  ["/api/ai/chat", "/ai/chat"],
  aiRateLimiter,
  handleAIChat
);

// AI usage metrics
router.get(
  ["/api/ai/usage", "/ai/usage"],
  getAIUsageStatus
);

// AI Smart Recipe Generator (Premium Only + Rate limited)
router.post(
  ["/api/ai/generate-recipe", "/ai/generate-recipe"],
  aiRateLimiter,
  requirePremium,
  handleGenerateRecipe
);

// AI Smart Grocery List Generator (Premium Only + Rate limited)
router.post(
  ["/api/ai/generate-grocery-list", "/ai/generate-grocery-list"],
  aiRateLimiter,
  requirePremium,
  handleGenerateGroceryList
);

module.exports = router;
