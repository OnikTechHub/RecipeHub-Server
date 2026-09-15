const express = require("express");
const router = express.Router();
const { handleAIChat, getAIUsageStatus, handleGenerateRecipe } = require("../controllers/aiController");
const { requirePremium } = require("../middlewares/authMiddleware");

router.post("/api/ai/chat", handleAIChat);
router.get("/api/ai/usage", getAIUsageStatus);
router.post("/api/ai/generate-recipe", requirePremium, handleGenerateRecipe);

module.exports = router;
