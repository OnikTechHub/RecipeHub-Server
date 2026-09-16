const { generateAIContent, generateAIRecipe } = require("../services/geminiService");
const { matchLocalKnowledge } = require("../services/knowledgeMatcher");
const User = require("../models/User");
const Recipe = require("../models/Recipe");
const Payment = require("../models/Payment");

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
    const { ingredients, dietaryPreference, mealType, servings, recipeIdea, cuisine, prepTime, difficulty, userEmail, email } = req.body;



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
      cuisine,
      prepTime,
      difficulty,
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

/**
 * AI Smart Grocery List Generator with Strict Backend Access Control
 * Route: POST /api/ai/generate-grocery-list
 */
const handleGenerateGroceryList = async (req, res, next) => {
  try {
    const { recipeIds, userEmail, email } = req.body;
    const targetEmail = (userEmail || email || req.user?.email || "").toLowerCase().trim();

    if (!targetEmail) {
      return res.status(400).send({
        success: false,
        message: "User email is required.",
      });
    }

    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      return res.status(400).send({
        success: false,
        message: "Please select at least one recipe.",
      });
    }

    // 1. Verify User Membership Status
    const userDoc = await User.findByEmailWithFallback(targetEmail);
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@recipehub.com").toLowerCase();
    const isAdmin =
      targetEmail === ADMIN_EMAIL ||
      targetEmail === "admin@recipehub.com" ||
      (userDoc && userDoc.role === "admin") ||
      req.user?.role === "admin";

    const isPremiumUser = isAdmin || (userDoc && (userDoc.isPremium === true || userDoc.role === "premium"));

    if (!isPremiumUser) {
      return res.status(403).send({
        success: false,
        message: "Exclusive Premium Feature. Upgrade to RecipeHub Premium to use Smart Grocery List!",
      });
    }

    // 2. Fetch requested recipes from MongoDB
    const validIds = recipeIds.filter((id) => id && id.toString().match(/^[0-9a-fA-F]{24}$/));
    const recipes = await Recipe.find({ _id: { $in: validIds } }).lean();

    if (recipes.length === 0) {
      return res.status(404).send({
        success: false,
        message: "No valid recipes found in database.",
      });
    }

    // 3. Strict Ownership & Access Verification per Recipe
    const authorizedRecipes = [];

    for (const recipe of recipes) {
      const isPaid =
        recipe.recipeType === "Paid" ||
        recipe.isPaid === true ||
        Number(recipe.price || 0) > 0;

      const authorEmails = [
        recipe.authorEmail,
        recipe.userEmail,
        recipe.creatorEmail,
        recipe.email,
        recipe.createdBy,
      ]
        .filter(Boolean)
        .map((e) => e.toString().toLowerCase().trim());

      const isAuthor = authorEmails.includes(targetEmail);

      let hasAccess = isAdmin || isAuthor || !isPaid;

      // Paid recipe requires explicit payment verification
      if (isPaid && !isAdmin && !isAuthor) {
        const paymentRecord = await Payment.findOne({
          userEmail: {
            $regex: new RegExp("^" + targetEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "$", "i"),
          },
          recipeId: { $in: [recipe._id.toString(), recipe._id] },
          paymentStatus: "paid",
        });

        if (paymentRecord) {
          hasAccess = true;
        }
      }

      if (hasAccess) {
        authorizedRecipes.push(recipe);
      }
    }

    if (authorizedRecipes.length === 0) {
      return res.status(403).send({
        success: false,
        message: "Access Denied: None of the selected recipes are unlocked or accessible for your account.",
      });
    }

    // 4. Build Per-Recipe Ingredient Breakdown & Aggregated Aisle Categories
    const recipeBreakdown = [];
    const rawIngredients = [];

    authorizedRecipes.forEach((recipe) => {
      const ingList = Array.isArray(recipe.ingredients)
        ? recipe.ingredients
        : typeof recipe.ingredients === "string"
        ? recipe.ingredients.split(",").map((i) => i.trim()).filter(Boolean)
        : [];

      recipeBreakdown.push({
        recipeId: recipe._id.toString(),
        recipeName: recipe.recipeName || "Recipe",
        image: recipe.recipeImage || recipe.image,
        category: Array.isArray(recipe.category) ? recipe.category[0] : recipe.category || "General",
        ingredients: ingList,
      });

      rawIngredients.push(...ingList);
    });

    // Categorization Pools
    const categoriesPool = {
      Produce: { title: "Produce & Fresh Veggies", icon: "🥬", items: [] },
      Dairy: { title: "Dairy, Cheese & Eggs", icon: "🥛", items: [] },
      Meat: { title: "Meat, Poultry & Seafood", icon: "🥩", items: [] },
      Pantry: { title: "Grains, Pasta & Bakery", icon: "🌾", items: [] },
      Spices: { title: "Oils, Spices & Seasonings", icon: "🧂", items: [] },
      Condiments: { title: "Sauces & Condiments", icon: "🥫", items: [] },
    };

    const itemMap = new Map();

    rawIngredients.forEach((ingStr) => {
      if (!ingStr || typeof ingStr !== "string") return;
      const cleanStr = ingStr.trim();
      const lower = cleanStr.toLowerCase();

      let catKey = "Pantry";

      if (
        lower.includes("spinach") || lower.includes("garlic") || lower.includes("onion") ||
        lower.includes("tomato") || lower.includes("avocado") || lower.includes("lemon") ||
        lower.includes("lime") || lower.includes("herb") || lower.includes("potato") ||
        lower.includes("mushroom") || lower.includes("pepper") || lower.includes("lettuce") ||
        lower.includes("kale") || lower.includes("cilantro") || lower.includes("basil")
      ) {
        catKey = "Produce";
      } else if (
        lower.includes("milk") || lower.includes("cream") || lower.includes("cheese") ||
        lower.includes("butter") || lower.includes("egg") || lower.includes("yogurt") ||
        lower.includes("parmesan") || lower.includes("mozzarella") || lower.includes("cheddar")
      ) {
        catKey = "Dairy";
      } else if (
        lower.includes("chicken") || lower.includes("beef") || lower.includes("steak") ||
        lower.includes("pork") || lower.includes("salmon") || lower.includes("shrimp") ||
        lower.includes("fish") || lower.includes("bacon") || lower.includes("turkey") ||
        lower.includes("tuna")
      ) {
        catKey = "Meat";
      } else if (
        lower.includes("oil") || lower.includes("salt") || lower.includes("pepper") ||
        lower.includes("paprika") || lower.includes("oregano") || lower.includes("cumin") ||
        lower.includes("cinnamon") || lower.includes("vinegar") || lower.includes("thyme") ||
        lower.includes("spice") || lower.includes("seasoning")
      ) {
        catKey = "Spices";
      } else if (
        lower.includes("sauce") || lower.includes("soy") || lower.includes("mustard") ||
        lower.includes("mayo") || lower.includes("ketchup") || lower.includes("honey") ||
        lower.includes("syrup") || lower.includes("paste")
      ) {
        catKey = "Condiments";
      }

      const existing = itemMap.get(cleanStr);
      if (existing) {
        existing.count += 1;
      } else {
        itemMap.set(cleanStr, { name: cleanStr, category: catKey, count: 1 });
      }
    });

    itemMap.forEach((item) => {
      if (categoriesPool[item.category]) {
        categoriesPool[item.category].items.push(item);
      } else {
        categoriesPool.Pantry.items.push(item);
      }
    });

    const activeCategories = Object.values(categoriesPool).filter((cat) => cat.items.length > 0);
    const totalItemsCount = itemMap.size;

    const minEst = Math.max(8.5, totalItemsCount * 1.85);
    const maxEst = Math.max(12.0, totalItemsCount * 2.65);
    const costString = `$${minEst.toFixed(2)} - $${maxEst.toFixed(2)}`;

    res.send({
      success: true,
      data: {
        selectedRecipesCount: authorizedRecipes.length,
        totalItemsCount,
        estimatedCost: costString,
        categories: activeCategories,
        recipeBreakdown,
      },
    });
  } catch (error) {
    console.error("Grocery List Backend Error:", error);
    next(error);
  }
};

module.exports = {
  handleAIChat,
  getAIUsageStatus,
  handleGenerateRecipe,
  handleGenerateGroceryList,
};

