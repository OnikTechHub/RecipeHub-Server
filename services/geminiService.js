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

  // 1. Greetings
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

  // 3. Baking & Vegan Egg / Dairy Substitutes (High Priority Check)
  if (
    lower.includes("substitute") || lower.includes("replace") || lower.includes("swap") || 
    lower.includes("vegan") || (lower.includes("egg") && (lower.includes("cake") || lower.includes("bake") || lower.includes("chocolate") || lower.includes("cookie")))
  ) {
    let target = "baking ingredients";
    if (lower.includes("egg")) target = "Eggs in Baking / Cakes";
    else if (lower.includes("butter")) target = "Butter";
    else if (lower.includes("milk")) target = "Dairy Milk";

    return `🍰 **Chef RecipeHub's Best Plant-Based Binding Substitutes for ${target}**:\n\n1. **Flaxseed or Chia Egg (Best for Binding & Dense Cakes):**\n   - **Ratio:** 1 tbsp ground flaxseed/chia + 3 tbsp warm water (let sit for 5 mins until gelatinous = 1 egg).\n   - **Texture Effect:** Gives structure and a slightly dense, moist crumb with subtle nutty undertones.\n\n2. **Unsweetened Applesauce or Mashed Banana (Best for Moisture):**\n   - **Ratio:** 1/4 cup per egg.\n   - **Texture Effect:** Leaves the cake extra tender and soft; adds gentle natural sweetness.\n\n3. **Silken Tofu or Aquafaba (Best for Fluffiness):**\n   - **Ratio:** 1/4 cup blended silken tofu or 3 tbsp whipped chickpea water (aquafaba) = 1 egg.\n   - **Texture Effect:** Provides light, airy lifting power without altering flavor profile.\n\n*Pro Baking Tip:* When replacing eggs in chocolate cakes, adding 1/2 tsp of baking soda + 1 tbsp apple cider vinegar creates extra fluffy leavening! 🍫`;
  }

  // 4. General Cakes & Baking Questions (non-substitute)
  if (lower.includes("cake") || lower.includes("chocolate") || lower.includes("bake") || lower.includes("dessert") || lower.includes("pastry") || lower.includes("cookie")) {
    return `🍰 **Chef RecipeHub Baking Tips for "${query}"**:\n\n1. **Room Temperature Ingredients:** Always bring liquid ingredients, butter, and plant milks to room temperature before mixing.\n2. **Don't Overmix:** Fold wet and dry ingredients gently until just combined to keep texture tender.\n3. **Oven Precision:** Pre-heat your oven fully and avoid opening the oven door during the first 20 minutes of baking.\n\nCheck out the **Recipes** tab on RecipeHub for community-rated cake and dessert guides! 🍫`;
  }

  // 5. Savory Meals & Dishes (Chicken, Beef, Fish, Pasta, Rice, Salad, Soup)
  if (
    lower.includes("chicken") || lower.includes("beef") || lower.includes("fish") || lower.includes("salmon") || 
    lower.includes("pasta") || lower.includes("rice") || lower.includes("salad") || lower.includes("soup") || 
    lower.includes("dinner") || lower.includes("lunch")
  ) {
    let dishName = "your savory dish";
    if (lower.includes("chicken")) dishName = "Savory Garlic Chicken & Rice";
    else if (lower.includes("salmon") || lower.includes("fish")) dishName = "Lemon Herb Salmon";
    else if (lower.includes("pasta")) dishName = "Creamy Garlic Pasta";
    else if (lower.includes("rice")) dishName = "Aromatic Fried Rice";
    else if (lower.includes("salad")) dishName = "Fresh Garden Salad";

    return `👨‍🍳 **Chef RecipeHub Guide for "${query}"**:\n\n1. **Preparation:** Always prep and measure ingredients (mise en place) before starting to ensure smooth cooking.\n2. **Flavor Enhancers:** Use fresh garlic, aromatic herbs, and a touch of quality oil or butter.\n3. **Pro Tip:** Season in layers throughout cooking rather than all at the end.\n\nLooking for full community recipes for **${dishName}**? Check out the **Recipes** tab on RecipeHub! 🥘`;
  }

  // 6. General Fallback for Custom Queries
  return `👨‍🍳 **Chef RecipeHub Culinary Assistant**:

Thank you for your question regarding **"${query}"**!

Here are key culinary insights for your query:
- **Technique:** Maintain consistent heat/temperature control and measure key ratio ingredients accurately.
- **Scaling:** When adjusting recipe servings up or down, adjust seasonings gradually and taste test as you go.
- **Search Recipes:** You can also search for step-by-step community recipes directly using the search bar on our homepage!

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
