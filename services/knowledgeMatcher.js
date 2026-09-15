const fs = require("fs");
const path = require("path");

let knowledgeData = null;

/**
 * Load local chatbot knowledge base from JSON file
 */
const loadKnowledgeBase = () => {
  try {
    const filePath = path.join(__dirname, "../data/chatbotKnowledge.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      knowledgeData = JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to load chatbotKnowledge.json:", err.message);
  }
};

// Initial load
loadKnowledgeBase();

/**
 * Find local knowledge match for user query
 * @param {string} userQuery - Raw user prompt
 * @returns {object} { matched: boolean, intent?: string, reply?: string, source?: string }
 */
const matchLocalKnowledge = (userQuery) => {
  loadKnowledgeBase();
  if (!knowledgeData || !Array.isArray(knowledgeData.intents) || !userQuery) {
    return { matched: false };
  }

  // Strip trailing punctuation for exact matching
  const cleanQuery = userQuery.toLowerCase().replace(/[?.,!:]/g, "").trim();

  // Guard: If user query is a specific culinary dish request, bypass platform FAQs unless platform terms are present
  const culinaryKeywords = ["cake", "chocolate", "bake", "cookie", "salmon", "chicken", "beef", "pasta", "salad", "soup", "fry", "roast", "grill", "bowl", "breakfast", "sweet potato", "potato", "crispy", "vegetable", "veggie", "shepherd", "pie", "ground beef", "cottage pie"];
  const platformScopeKeywords = ["recipehub", "recipe hub", "platform", "website", "app", "membership", "stripe", "account", "login", "signup", "dashboard", "upload", "creator"];

  const hasCulinaryContext = culinaryKeywords.some((ck) => cleanQuery.includes(ck));
  const hasPlatformContext = platformScopeKeywords.some((pk) => cleanQuery.includes(pk));

  // If query is purely about specific cooking/baking and has no platform context, delegate to AI culinary engine
  if (hasCulinaryContext && !hasPlatformContext) {
    return { matched: false };
  }

  // 1. Direct Phrase Match Check (Sorted by phrase length descending for maximum precision)
  const allPhrases = [];
  for (const intent of knowledgeData.intents) {
    if (Array.isArray(intent.phrases)) {
      for (const phrase of intent.phrases) {
        allPhrases.push({
          cleanPhrase: phrase.toLowerCase().replace(/[?.,!:]/g, "").trim(),
          rawPhrase: phrase,
          intent: intent,
        });
      }
    }
  }

  // Sort phrases longest first
  allPhrases.sort((a, b) => b.cleanPhrase.length - a.cleanPhrase.length);

  for (const item of allPhrases) {
    if (cleanQuery.includes(item.cleanPhrase) || cleanQuery === item.cleanPhrase) {
      console.log(`[Hybrid Router] Matched Local Knowledge Phrase: "${item.rawPhrase}" (Intent: ${item.intent.id})`);
      return {
        matched: true,
        intent: item.intent.id,
        source: "local_knowledge_base",
        reply: item.intent.response,
      };
    }
  }

  // 2. Keyword Overlap Scoring Check
  let bestIntent = null;
  let maxScore = 0;

  for (const intent of knowledgeData.intents) {
    if (!Array.isArray(intent.keywords)) continue;

    let score = 0;
    for (const kw of intent.keywords) {
      const lowerKw = kw.toLowerCase();
      if (cleanQuery.includes(lowerKw)) {
        score += lowerKw.split(" ").length; // Give higher weight to multi-word keyword phrases
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  // Threshold: At least score >= 2 for confident keyword match
  if (bestIntent && maxScore >= 2) {
    console.log(`[Hybrid Router] Matched Local Knowledge Keywords: (Score: ${maxScore}, Intent: ${bestIntent.id})`);
    return {
      matched: true,
      intent: bestIntent.id,
      source: "local_knowledge_base",
      reply: bestIntent.response,
    };
  }

  return { matched: false };
};

module.exports = {
  matchLocalKnowledge,
  loadKnowledgeBase,
};
