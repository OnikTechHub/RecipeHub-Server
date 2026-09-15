/**
 * Gemini AI Service with 10-API Key Automatic Fallback & Rotation
 */

const isRealKey = (key) => {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("your_key_") || trimmed.startsWith("your_default_") || trimmed.includes("YOUR_KEY")) {
    return false;
  }
  return true;
};

const getGeminiApiKeys = () => {
  const keys = [];

  // Collect GEMINI_API_KEY_1 to GEMINI_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (isRealKey(key)) {
      keys.push(key.trim());
    }
  }

  // Fallback to standard GEMINI_API_KEY if no indexed keys exist
  if (keys.length === 0) {
    const defaultKey = process.env.GEMINI_API_KEY;
    if (isRealKey(defaultKey)) {
      keys.push(defaultKey.trim());
    }
  }

  return keys;
};

// Global index tracking for round-robin load distribution
let currentKeyIndex = 0;

/**
 * Smart Culinary Fallback Generator when Gemini API keys are invalid/quota exceeded
 */
const getSmartCulinaryFallback = (rawQuery) => {
  const query = (rawQuery || "").trim();
  const lower = query.toLowerCase();

  // 1. Greetings (only when user query itself starts with or matches greeting)
  if (/^(hi|hello|hey|greetings|good morning|good evening|hola|salut|assalamu alaikum|slm)/i.test(lower)) {
    return "Hello there! 👋 I'm **Chef RecipeHub**, your personal AI culinary assistant.\n\nHow can I help you today? You can ask me about:\n- 🍳 Quick & easy recipe ideas\n- 🥦 Healthy ingredient substitutions\n- ⏱️ Cooking times & techniques\n- 🍰 Dessert and baking tips";
  }

  // 2. RecipeHub Premium Access / Pricing Questions
  if (
    lower.includes("premium") || lower.includes("membership") || lower.includes("subscription") || 
    lower.includes("price") || lower.includes("cost") || lower.includes("upgrade") || lower.includes("stripe")
  ) {
    return "🌟 **RecipeHub Premium Membership** unlocks exclusive culinary features:\n\n- 🔓 **Unlimited Recipe Access:** View all secret chef recipes.\n- 🤖 **Chef AI Assistant:** Unlimited 24/7 cooking guidance.\n- ⚡ **Ad-Free Browsing:** Seamless cooking experience.\n- 💎 **Exclusive Badges:** Showcase your chef status on community recipes.\n\nVisit our **Pricing** page to upgrade today!";
  }

  // 3. Specific Ingredient / Food / Recipe / Cooking Questions
  if (
    lower.includes("chicken") || lower.includes("egg") || lower.includes("rice") || lower.includes("fish") || 
    lower.includes("beef") || lower.includes("pasta") || lower.includes("salad") || lower.includes("soup") || 
    lower.includes("dessert") || lower.includes("cake") || lower.includes("cook") || lower.includes("make") || 
    lower.includes("recipe") || lower.includes("bake") || lower.includes("ingredient") || lower.includes("scale")
  ) {
    let dishName = "your requested dish";
    if (lower.includes("egg")) dishName = "Egg & Tomato Dish";
    else if (lower.includes("chicken")) dishName = "Savory Garlic Chicken & Rice";
    else if (lower.includes("pasta")) dishName = "Creamy Garlic Pasta";
    else if (lower.includes("rice")) dishName = "Aromatic Fried Rice";
    else if (lower.includes("salad")) dishName = "Fresh Garden Salad";

    return `👨‍🍳 **Chef RecipeHub Guide for "${query}"**:\n\n1. **Preparation:** Always prep and measure ingredients (mise en place) before starting to ensure smooth cooking.\n2. **Flavor Enhancers:** Use fresh garlic, herbs, and a touch of butter or olive oil for high aroma.\n3. **Pro Tip:** Season in layers throughout cooking rather than all at the end.\n\nLooking for full community recipes for **${dishName}**? Check out the **Recipes** tab on RecipeHub! 🥘`;
  }

  // 4. Any other custom user query
  return `👨‍🍳 **Chef RecipeHub Assistant**:

Thank you for your question regarding **"${query}"**!

Here are key culinary insights for your query:
- **Technique:** Maintain consistent heat control and avoid overcrowding your cooking pan.
- **Scaling:** When adjusting recipe servings up or down, adjust spices gradually and taste test.
- **Community Recipes:** You can also search for step-by-step community recipes directly using the top search bar!

What else would you like to cook or learn today? 🍳`;
};

/**
 * Generate AI content with automatic fallback across 10 Gemini API keys
 * @param {string} prompt - Formatted combined prompt including conversation history
 * @param {string} systemInstruction - System instruction for Chef AI persona
 * @param {string} userQuery - The exact live query string from the user
 */
const generateAIContent = async (prompt, systemInstruction = "", userQuery = "") => {
  const queryToUse = userQuery || prompt;
  const apiKeys = getGeminiApiKeys();

  if (apiKeys.length === 0) {
    console.error("Gemini API Error Details: No valid Gemini API keys configured in .env. Using Smart Culinary Fallback.");
    return getSmartCulinaryFallback(queryToUse);
  }

  let lastError = null;
  const totalKeys = apiKeys.length;
  // Primary stable model: gemini-1.5-flash, Fallback: gemini-2.0-flash
  const models = ["gemini-1.5-flash", "gemini-2.0-flash"];

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const keyIndex = (currentKeyIndex + attempt) % totalKeys;
    const apiKey = apiKeys[keyIndex];

    for (const modelName of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const payload = {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        };

        if (systemInstruction && systemInstruction.trim()) {
          payload.systemInstruction = {
            parts: [{ text: systemInstruction.trim() }],
          };
        }

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          const errorDetails = data.error || data || response.statusText;
          console.error(`Gemini API Error Details (Key ${keyIndex + 1}/${totalKeys}, Model: ${modelName}):`, JSON.stringify(errorDetails, null, 2));

          const errorMsg = data.error?.message || response.statusText;
          lastError = new Error(`Key ${keyIndex + 1} (${modelName}) Error: ${errorMsg}`);

          // If model not found, try fallback model; otherwise switch API key
          if (data.error?.code === 404 || (errorMsg && errorMsg.toLowerCase().includes("not found"))) {
            continue;
          }
          break;
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          // Success! Advance rotation index for future load balance
          currentKeyIndex = (keyIndex + 1) % totalKeys;
          return reply;
        } else {
          console.error(`Gemini API Error Details (Key ${keyIndex + 1}): Candidate response empty or blocked.`, data);
          lastError = new Error("Empty candidate received from Gemini model response.");
        }
      } catch (err) {
        console.error("Gemini API Error Details:", err?.response?.data || err?.message || err);
        lastError = err;
      }
    }
  }

  console.error("Gemini API Error Details: All configured Gemini API keys failed or returned invalid key errors. Using Chef RecipeHub Smart Fallback.");
  return getSmartCulinaryFallback(queryToUse);
};

module.exports = {
  getGeminiApiKeys,
  generateAIContent,
};
