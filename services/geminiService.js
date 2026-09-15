/**
 * Gemini AI Service with 10-API Key Automatic Fallback & Rotation
 */

const getGeminiApiKeys = () => {
  const keys = [];

  // Collect GEMINI_API_KEY_1 to GEMINI_API_KEY_10
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key && key.trim()) {
      keys.push(key.trim());
    }
  }

  // Fallback to standard GEMINI_API_KEY if no indexed keys exist
  if (keys.length === 0 && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  return keys;
};

// Global index tracking for round-robin load distribution
let currentKeyIndex = 0;

/**
 * Generate AI content with automatic fallback across 10 Gemini API keys
 * @param {string} prompt - User message or cooking question
 * @param {string} systemInstruction - Optional system instruction for Chef AI persona
 */
const generateAIContent = async (prompt, systemInstruction = "") => {
  const apiKeys = getGeminiApiKeys();

  if (apiKeys.length === 0) {
    throw new Error("No Gemini API keys configured. Please add GEMINI_API_KEY_1 to GEMINI_API_KEY_10 in .env.");
  }

  let lastError = null;
  const totalKeys = apiKeys.length;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const keyIndex = (currentKeyIndex + attempt) % totalKeys;
    const apiKey = apiKeys[keyIndex];

    try {
      const modelName = "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const contentsPayload = [];
      if (systemInstruction) {
        contentsPayload.push({
          role: "user",
          parts: [{ text: `System Instruction: ${systemInstruction}` }],
        });
        contentsPayload.push({
          role: "model",
          parts: [{ text: "Understood! I am Chef RecipeHub, your AI culinary assistant." }],
        });
      }

      contentsPayload.push({
        role: "user",
        parts: [{ text: prompt }],
      });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: contentsPayload,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errorMsg = data.error?.message || response.statusText;
        const statusCode = response.status || data.error?.code;

        console.warn(`[Gemini Rotation] Key ${keyIndex + 1}/${totalKeys} rate limit/quota error (${statusCode}): ${errorMsg}`);
        lastError = new Error(`Key ${keyIndex + 1} Error: ${errorMsg}`);
        // Fallback to next key in rotation
        continue;
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        // Success! Advance rotation index for future load balance
        currentKeyIndex = (keyIndex + 1) % totalKeys;
        return reply;
      } else {
        lastError = new Error("Empty candidate received from Gemini model response.");
      }
    } catch (err) {
      console.warn(`[Gemini Rotation] Key ${keyIndex + 1}/${totalKeys} network error: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error("All configured Gemini API keys exceeded quota or rate limits.");
};

module.exports = {
  getGeminiApiKeys,
  generateAIContent,
};
