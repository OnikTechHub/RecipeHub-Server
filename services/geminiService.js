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
const getSmartCulinaryFallback = (prompt) => {
  const text = (prompt || "").toLowerCase();

  if (text.includes("hi") || text.includes("hello") || text.includes("hey") || text.includes("greeting")) {
    return "Hello there! 👋 I'm **Chef RecipeHub**, your personal AI culinary assistant.\n\nHow can I help you today? You can ask me about:\n- 🍳 Quick & easy recipe ideas\n- 🥦 Healthy ingredient substitutions\n- ⏱️ Cooking times & techniques\n- 🍰 Dessert and baking tips";
  }

  if (text.includes("chicken") || text.includes("rice") || text.includes("ingredient") || text.includes("cook")) {
    return "That sounds like a fantastic meal idea! 👨‍🍳 Here's a quick recipe concept:\n\n### 🍗 **Savory Garlic Herb Chicken & Rice**\n- **Ingredients:** Chicken breast/thighs, rice, garlic, olive oil, butter, chicken broth, & herbs (thyme/parsley).\n- **Prep:** Sauté seasoned chicken in butter and oil until golden brown. Set aside.\n- **Cook:** Sauté minced garlic, add rice & broth, simmer covered for 15-18 mins. Top with sliced chicken!\n\n*Tip: Check out our RecipeHub feed for full step-by-step community recipes!* 🥘";
  }

  return "Welcome to **Chef RecipeHub**! 👨‍🍳 I'm here to assist you with cooking tips, flavor pairings, dietary substitutes, and recipe ideas. What dish are you planning to prepare today?";
};

/**
 * Generate AI content with automatic fallback across 10 Gemini API keys
 * @param {string} prompt - User message or cooking question
 * @param {string} systemInstruction - Optional system instruction for Chef AI persona
 */
const generateAIContent = async (prompt, systemInstruction = "") => {
  const apiKeys = getGeminiApiKeys();

  if (apiKeys.length === 0) {
    console.error("Gemini API Error Details: No valid Gemini API keys configured in .env. Using Smart Culinary Fallback.");
    return getSmartCulinaryFallback(prompt);
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
  return getSmartCulinaryFallback(prompt);
};

module.exports = {
  getGeminiApiKeys,
  generateAIContent,
};
