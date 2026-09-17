const fs = require("fs");
const path = require("path");

let chatbotKnowledge = null;
let multilingualFAQ = null;

/**
 * Load local knowledge base files
 */
const loadKnowledgeBase = () => {
  try {
    const faqPath = path.join(__dirname, "../data/multilingualFAQ.json");
    if (fs.existsSync(faqPath)) {
      const content = fs.readFileSync(faqPath, "utf-8");
      multilingualFAQ = JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to load multilingualFAQ.json:", err.message);
  }

  try {
    const kbPath = path.join(__dirname, "../data/chatbotKnowledge.json");
    if (fs.existsSync(kbPath)) {
      const content = fs.readFileSync(kbPath, "utf-8");
      chatbotKnowledge = JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to load chatbotKnowledge.json:", err.message);
  }
};

// Initial load
loadKnowledgeBase();

/**
 * Find local knowledge match for user query (Semantic Multilingual Caching & Intent Analysis)
 * @param {string} userQuery - Raw user prompt
 * @returns {object} { matched: boolean, intent?: string, reply?: string, source?: string }
 */
const matchLocalKnowledge = (userQuery) => {
  loadKnowledgeBase();
  if (!userQuery || typeof userQuery !== "string") {
    return { matched: false };
  }

  const raw = userQuery.trim();
  const lower = raw.toLowerCase();
  const cleanQuery = lower.replace(/[?.,!:]/g, "").trim();

  // Detect query language (Bengali script or Banglish keywords)
  const isBengaliScript = /[\u0980-\u09FF]/.test(raw);
  const isBanglish = lower.includes("kanto") || lower.includes("klanto") || lower.includes("ranna") || lower.includes("khabar") || lower.includes("dinar");
  const isBengali = isBengaliScript || isBanglish;

  // 1. Semantic Match on Multilingual 10-FAQ Dataset
  if (Array.isArray(multilingualFAQ) && multilingualFAQ.length > 0) {
    let bestFaqMatch = null;
    let maxFaqScore = 0;

    // Define generic single words that should not trigger a cache hit on their own
    const genericSingleWords = new Set(["5", "10", "ডিম", "ভাত", "পোস্ট", "শেয়ার", "খুঁজে", "সার্চ", "ঝাল", "মিষ্টি", "fast", "cheap", "mood", "spicy", "rice", "eggs", "post", "share"]);

    for (const faq of multilingualFAQ) {
      let score = 0;

      // Exact or Substring match on english or bengali question
      const cleanQuestionEn = (faq.question_en || "").toLowerCase().replace(/[?.,!:]/g, "").trim();
      const cleanQuestionBn = (faq.question_bn || "").toLowerCase().replace(/[?.,!:]/g, "").trim();

      if (cleanQuery === cleanQuestionEn || cleanQuery === cleanQuestionBn) {
        score += 10;
      } else if (cleanQuery.includes(cleanQuestionEn) || cleanQuery.includes(cleanQuestionBn)) {
        score += 6;
      }

      // Keyword overlap scoring
      if (Array.isArray(faq.keywords)) {
        for (const kw of faq.keywords) {
          const lowerKw = kw.toLowerCase().trim();
          if (cleanQuery.includes(lowerKw)) {
            const wordCount = lowerKw.split(" ").length;
            if (wordCount >= 2) {
              score += 4;
            } else if (genericSingleWords.has(lowerKw)) {
              score += 1;
            } else {
              score += 2;
            }
          }
        }
      }

      if (score > maxFaqScore) {
        maxFaqScore = score;
        bestFaqMatch = faq;
      }
    }

    // Threshold: Score >= 4 for confident local cache match
    if (bestFaqMatch && maxFaqScore >= 4) {
      const selectedReply = isBengali ? bestFaqMatch.answer_bn : bestFaqMatch.answer_en;
      console.log(`[Hybrid Router Cache HIT] Matched Multilingual FAQ #${bestFaqMatch.id} (Score: ${maxFaqScore}, Lang: ${isBengali ? "BN" : "EN"})`);
      return {
        matched: true,
        faqId: bestFaqMatch.id,
        source: "multilingual_faq_cache",
        reply: selectedReply,
      };
    }
  }

  // 2. Fallback Match on Platform chatbotKnowledge.json
  if (chatbotKnowledge && Array.isArray(chatbotKnowledge.intents)) {
    // Guard: If query is purely about specific cooking/baking and has no platform context, delegate to AI culinary engine
    const culinaryKeywords = ["cake", "chocolate", "bake", "cookie", "salmon", "chicken", "beef", "pasta", "salad", "soup", "fry", "roast", "grill", "bowl", "breakfast", "sweet potato", "potato", "crispy", "vegetable", "veggie", "shepherd", "pie", "ground beef", "cottage pie"];
    const platformScopeKeywords = ["recipehub", "recipe hub", "platform", "website", "app", "membership", "stripe", "account", "login", "signup", "dashboard", "upload", "creator"];

    const hasCulinaryContext = culinaryKeywords.some((ck) => cleanQuery.includes(ck));
    const hasPlatformContext = platformScopeKeywords.some((pk) => cleanQuery.includes(pk));

    if (!hasCulinaryContext || hasPlatformContext) {
      let bestIntent = null;
      let maxScore = 0;

      for (const intent of chatbotKnowledge.intents) {
        if (!Array.isArray(intent.keywords)) continue;

        let score = 0;
        for (const kw of intent.keywords) {
          const lowerKw = kw.toLowerCase();
          if (cleanQuery.includes(lowerKw)) {
            score += lowerKw.split(" ").length;
          }
        }

        if (score > maxScore) {
          maxScore = score;
          bestIntent = intent;
        }
      }

      if (bestIntent && maxScore >= 2) {
        console.log(`[Hybrid Router] Matched Local Knowledge Keywords: (Score: ${maxScore}, Intent: ${bestIntent.id})`);
        return {
          matched: true,
          intent: bestIntent.id,
          source: "local_knowledge_base",
          reply: bestIntent.response,
        };
      }
    }
  }

  // 3. No local cache match -> Route to Gemini API
  return { matched: false };
};

module.exports = {
  matchLocalKnowledge,
  loadKnowledgeBase,
};
