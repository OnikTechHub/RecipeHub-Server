const express = require("express");
const router = express.Router();
const { handleAIChat } = require("../controllers/aiController");

router.post("/api/ai/chat", handleAIChat);

module.exports = router;
