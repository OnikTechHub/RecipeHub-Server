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
    console.error("Gemini API Error Details: No Gemini API keys configured in .env");
    throw new Error("No Gemini API keys configured. Please add GEMINI_API_KEY_1 to GEMINI_API_KEY_10 in .env.");
  }

  let lastError = null;
  const totalKeys = apiKeys.length;
  // Models to try (gemini-1.5-flash is primary stable chat model)
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

  console.error("Gemini API Error Details: All configured Gemini API keys failed or exceeded quota.");
  throw lastError || new Error("All configured Gemini API keys exceeded quota or rate limits.");
};

module.exports = {
  getGeminiApiKeys,
  generateAIContent,
};
