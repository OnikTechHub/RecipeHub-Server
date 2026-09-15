const { generateAIContent } = require("../services/geminiService");

/**
 * Global AI Chatbot Endpoint
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

    const systemInstruction = `You are Chef RecipeHub, an expert, friendly AI culinary assistant for the RecipeHub platform.
Your job is to answer questions about cooking, recipes, ingredients, flavor pairings, dietary substitutes, cooking techniques, and RecipeHub features.
Keep responses helpful, appetizing, concise, structured with bullet points or bold text where helpful, and polite. Always maintain a warm, culinary expert tone.`;

    let combinedPrompt = message;
    if (Array.isArray(history) && history.length > 0) {
      const formattedHistory = history
        .slice(-6)
        .map((h) => `${h.role === "user" ? "User" : "Chef"}: ${h.text}`)
        .join("\n");
      combinedPrompt = `Previous Conversation:\n${formattedHistory}\n\nUser Question: ${message}`;
    }

    const reply = await generateAIContent(combinedPrompt, systemInstruction);

    res.send({
      success: true,
      reply: reply,
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
