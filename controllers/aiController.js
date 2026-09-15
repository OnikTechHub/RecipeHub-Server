const { generateAIContent } = require("../services/geminiService");
const { matchLocalKnowledge } = require("../services/knowledgeMatcher");

/**
 * Global AI Chatbot Endpoint with Smart Hybrid Intent Matching
 * Route: POST /api/ai/chat
 */
const handleAIChat = async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).send({
        success: false,
        message: "Message is required.",
      });
    }

    // 1. Smart Hybrid Check: Query Local Knowledge Base First
    const localMatch = matchLocalKnowledge(message);
    if (localMatch.matched && localMatch.reply) {
      return res.send({
        success: true,
        reply: localMatch.reply,
        source: "local_knowledge_base",
      });
    }

    // 2. Custom / Live Query: Route to Gemini 10-Key API Utility
    const systemInstruction = `You are Chef RecipeHub, an expert, friendly AI culinary assistant for the RecipeHub platform.
Your job is to answer questions about cooking, recipes, ingredients, flavor pairings, dietary substitutes, cooking techniques, meal planning, and RecipeHub features.
Keep responses helpful, appetizing, concise, structured with bullet points or bold text where helpful, and polite. Always maintain a warm, culinary expert tone.
If the user asks questions that are completely unrelated to cooking, food, culinary techniques, or the RecipeHub platform (e.g., coding, politics, physics, math, general off-topic topics), politely state that you are Chef RecipeHub—a dedicated culinary assistant—and invite them to ask about recipes, cooking hacks, dinner menus, or RecipeHub platform features instead. Do NOT invent fake recipes for unrelated topics.`;

    let combinedPrompt = message;
    if (Array.isArray(history) && history.length > 0) {
      const formattedHistory = history
        .slice(-6)
        .map((h) => `${h.role === "user" ? "User" : "Chef"}: ${h.text}`)
        .join("\n");
      combinedPrompt = `Previous Conversation:\n${formattedHistory}\n\nUser Question: ${message}`;
    }

    const reply = await generateAIContent(combinedPrompt, systemInstruction, message);

    res.send({
      success: true,
      reply: reply,
      source: "gemini_ai",
    });
  } catch (error) {
    console.error("Gemini API Error Details:", error?.response?.data || error?.message || error);
    res.status(500).send({
      success: false,
      message: error.message || "Failed to process AI chat response.",
    });
  }
};

module.exports = {
  handleAIChat,
};
