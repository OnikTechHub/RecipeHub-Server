const express = require("express");
const router = express.Router();
const { handleAIChat, getAIUsageStatus, handleGenerateRecipe, handleGenerateGroceryList } = require("../controllers/aiController");
const { requirePremium } = require("../middlewares/authMiddleware");

router.post("/api/ai/chat", handleAIChat);
router.get("/api/ai/usage", getAIUsageStatus);
router.post("/api/ai/generate-recipe", requirePremium, handleGenerateRecipe);
router.post("/api/ai/generate-grocery-list", requirePremium, handleGenerateGroceryList);

module.exports = router;
