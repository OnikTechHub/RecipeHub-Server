const { generateAIContent, generateAIRecipe } = require("../services/geminiService");
const { matchLocalKnowledge } = require("../services/knowledgeMatcher");
const User = require("../models/User");
const Recipe = require("../models/Recipe");

/**
 * Direct Mongo DB Query for exact count of AI recipes saved by user email in the last 7 days
 */
const getAIWeeklyCountFromDB = async (userEmail) => {
  if (!userEmail || !userEmail.trim()) {
    return { usageCount: 0, resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
  }

  const cleanEmail = userEmail.trim().toLowerCase();
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const emailRegex = new RegExp(`^${escapeRegex(cleanEmail)}$`, "i");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Direct Database Query on recipes collection
  const query = {
    $or: [{ authorEmail: emailRegex }, { userEmail: emailRegex }],
    $and: [
      {
        $or: [
          { isAiGenerated: true },
          { isAIGenerated: true },
          { isAI: true },
          { recipeType: "AI" }
        ]
      },
      {
        $or: [
          { createdAt: { $gte: sevenDaysAgo } },
          { created_at: { $gte: sevenDaysAgo } }
        ]
      }
    ]
  };

  const usageCount = await Recipe.countDocuments(query);

  // Find oldest AI recipe in 7-day window to calculate live reset time
  const oldestRecipe = await Recipe.findOne(query).sort({ createdAt: 1, created_at: 1 });

  let resetAt = null;
  if (oldestRecipe) {
    const createdDate = oldestRecipe.createdAt || oldestRecipe.created_at || new Date();
    resetAt = new Date(new Date(createdDate).getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    resetAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  return { usageCount, resetAt };
};

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

/**
 * Check AI Generator Weekly Usage Status (Direct MongoDB query on recipes collection)
 * Route: GET /api/ai/usage?email=...
 */
const getAIUsageStatus = async (req, res, next) => {
  try {
    const { email } = req.query;
    const targetEmail = (email || req.user?.email || "").trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@recipehub.com").trim().toLowerCase();

    const isAdmin = targetEmail === adminEmail || req.user?.role === "admin";

    if (isAdmin) {
      return res.send({
        success: true,
        usageCount: 0,
        weeklyLimit: 2,
        remaining: 999,
        isAdmin: true,
        resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    if (!targetEmail) {
      return res.status(400).send({
        success: false,
        message: "User email parameter is required.",
      });
    }

    // Direct Database Query on recipes collection
    const { usageCount, resetAt } = await getAIWeeklyCountFromDB(targetEmail);
    const remaining = Math.max(0, 2 - usageCount);

    res.send({
      success: true,
      usageCount,
      weeklyLimit: 2,
      remaining,
      resetAt,
      isAdmin: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Premium-Only AI Smart Recipe Generator Endpoint
 * Route: POST /api/ai/generate-recipe
 */
const handleGenerateRecipe = async (req, res, next) => {
  try {
    const { ingredients, dietaryPreference, mealType, servings, recipeIdea, userEmail, email } = req.body;


    // Verify Premium Access
    const targetEmail = (userEmail || email || req.user?.email || "").trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@recipehub.com").trim().toLowerCase();

    let isAdmin = targetEmail === adminEmail || req.user?.role === "admin";
    let isPremium = isAdmin;
    let userDoc = null;

    if (targetEmail) {
      userDoc = await User.findByEmailWithFallback(targetEmail);
      if (userDoc && (userDoc.isPremium === true || userDoc.role === "premium" || userDoc.role === "admin")) {
        isPremium = true;
      }
    }

    if (!isPremium && req.user) {
      if (req.user.isPremium || req.user.role === "premium" || req.user.role === "admin") {
        isPremium = true;
      }
    }

    if (!isPremium) {
      return res.status(403).send({
        success: false,
        isPremiumRequired: true,
        message: "Exclusive Premium Feature. Please upgrade your account to RecipeHub Premium to access the AI Smart Recipe Generator!",
      });
    }

    if (!ingredients || (Array.isArray(ingredients) && ingredients.length === 0)) {
      return res.status(400).send({
        success: false,
        message: "At least one ingredient is required to generate a recipe.",
      });
    }

    // Direct Database Query for Quota Check (Hard Block if >= 2 AI recipes in last 7 days)
    if (!isAdmin) {
      const { usageCount, resetAt } = await getAIWeeklyCountFromDB(targetEmail);

      if (usageCount >= 2) {
        return res.status(403).send({
          success: false,
          limitReached: true,
          usageCount,
          weeklyLimit: 2,
          remaining: 0,
          resetAt,
          message: "Weekly AI generation limit (2 recipes) reached!",
        });
      }
    }

    const recipe = await generateAIRecipe({
      ingredients,
      dietaryPreference,
      mealType,
      servings: servings || 2,
      recipeIdea,
    });


    const { usageCount, resetAt } = await getAIWeeklyCountFromDB(targetEmail);
    const remaining = isAdmin ? 999 : Math.max(0, 2 - usageCount);

    res.send({
      success: true,
      recipe,
      usageCount,
      remaining,
      resetAt,
      source: "gemini_ai",
    });
  } catch (error) {
    console.error("AI Recipe Generator Error:", error);
    res.status(500).send({
      success: false,
      message: error.message || "Failed to generate custom AI recipe.",
    });
  }
};

module.exports = {
  handleAIChat,
  getAIUsageStatus,
  handleGenerateRecipe,
};
