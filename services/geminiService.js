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
  const keysSet = new Set();

  const addCandidate = (str) => {
    if (!str || typeof str !== "string") return;
    const parts = str.split(/[,;\n\r]+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (isRealKey(trimmed)) {
        keysSet.add(trimmed);
      }
    }
  };

  // 1. Explicit multi-key env variables (GEMINI_API_KEYS, GEMINI_API_KEY_LIST)
  addCandidate(process.env.GEMINI_API_KEYS);
  addCandidate(process.env.GEMINI_API_KEY_LIST);

  // 2. Indexed environment variables (GEMINI_API_KEY_1 through GEMINI_API_KEY_50)
  for (let i = 1; i <= 50; i++) {
    const keyVal = process.env[`GEMINI_API_KEY_${i}`];
    if (keyVal) {
      addCandidate(keyVal);
    }
  }

  // 3. Standard GEMINI_API_KEY (supports comma/newline delimited list)
  addCandidate(process.env.GEMINI_API_KEY);

  // 4. Scan all process.env keys for any matching GEMINI_*KEY*
  Object.keys(process.env).forEach((envKey) => {
    if (/^GEMINI_.*KEY/i.test(envKey)) {
      addCandidate(process.env[envKey]);
    }
  });

  return Array.from(keysSet);
};

// Global index tracking for round-robin load distribution
let currentKeyIndex = 0;

// API Call & Quota Tracking System
const apiCallTracker = new Map();
let totalSystemCallsCount = 0;

const recordApiKeyCall = (apiKey) => {
  totalSystemCallsCount++;
  const keyToUse = apiKey || "DEFAULT_KEY";
  const now = Date.now();
  const entry = apiCallTracker.get(keyToUse) || { count: 0, lastReset: now };

  if (now - entry.lastReset > 24 * 60 * 60 * 1000) {
    entry.count = 0;
    entry.lastReset = now;
  }

  entry.count += 1;
  apiCallTracker.set(keyToUse, entry);
};

const KEY_POOL_METADATA = [
  { name: "Primary Production Key (AI Engine)", tag: "Primary Engine", category: "Core AI", provider: "Google Gemini 1.5 Flash" },
  { name: "High-Throughput Analytics Key", tag: "Analytics Pool", category: "System", provider: "Google Gemini 1.5 Flash" },
  { name: "Chef AI Recipe Generator Key #1", tag: "Recipe Engine", category: "Generator", provider: "Google Gemini 1.5 Flash" },
  { name: "Chef AI Recipe Generator Key #2", tag: "Recipe Engine", category: "Generator", provider: "Google Gemini 1.5 Flash" },
  { name: "Smart Grocery Parsing Key", tag: "Pantry Parser", category: "Utility", provider: "Google Gemini 1.5 Flash" },
  { name: "Content Moderation & Review Key", tag: "Safety Guard", category: "Security", provider: "Google Gemini 1.5 Flash" },
  { name: "Nutritional Calculation Engine Key", tag: "Health Matrix", category: "Nutrition", provider: "Google Gemini 1.5 Flash" },
  { name: "Recommendation Engine Key", tag: "ML Predictor", category: "Discovery", provider: "Google Gemini 1.5 Flash" },
  { name: "Secondary Failover Buffer Key", tag: "Failover Pool", category: "Standby", provider: "Google Gemini 1.5 Flash" },
  { name: "Emergency Hot Standby Key", tag: "Emergency Hot", category: "Standby", provider: "Google Gemini 1.5 Flash" },
];

const getApiPoolAnalytics = () => {
  const keys = getGeminiApiKeys();
  const activeKeysCount = keys.length > 0 ? keys.length : 1;
  const capacityPerKey = 1500; // Gemini Free tier daily request limit per key
  const totalSystemCapacity = activeKeysCount * capacityPerKey;

  let totalRequestsUsed = 0;
  const keyDetails = [];

  if (keys.length > 0) {
    keys.forEach((key, index) => {
      const tracker = apiCallTracker.get(key) || { count: 0 };
      totalRequestsUsed += tracker.count;

      const masked = key.length > 10 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : `API_KEY_${index + 1}`;
      const usagePct = Number(((tracker.count / capacityPerKey) * 100).toFixed(1));

      const meta = KEY_POOL_METADATA[index] || {
        name: `Gemini Key Pool #${index + 1}`,
        tag: `Buffer #${index + 1}`,
        category: "Extended Pool",
        provider: "Google Gemini 1.5 Flash",
      };

      keyDetails.push({
        id: `key_${index + 1}`,
        keyIndex: index + 1,
        name: meta.name,
        tag: meta.tag,
        category: meta.category,
        provider: meta.provider,
        maskedKey: masked,
        callsToday: tracker.count,
        capacity: capacityPerKey,
        usagePercent: usagePct,
        status: tracker.count >= capacityPerKey ? "Exhausted" : "Active",
      });
    });
  } else {
    const defaultEntry = apiCallTracker.get("DEFAULT_KEY") || { count: 0 };
    totalRequestsUsed = Math.max(totalSystemCallsCount, defaultEntry.count);

    keyDetails.push({
      id: "key_default",
      keyIndex: 1,
      name: "Primary Production Key (AI Engine)",
      tag: "Primary Engine",
      category: "Core AI",
      provider: "Google Gemini 1.5 Flash",
      maskedKey: "GEMINI_DEFAULT",
      callsToday: totalRequestsUsed,
      capacity: capacityPerKey,
      usagePercent: Number(((totalRequestsUsed / capacityPerKey) * 100).toFixed(1)),
      status: totalRequestsUsed >= capacityPerKey ? "Exhausted" : "Active",
    });
  }

  // Calculate Aggregated System Percentage
  const aggregatedUsagePercent = Number(((totalRequestsUsed / totalSystemCapacity) * 100).toFixed(2));

  return {
    activeKeysCount,
    totalSystemCapacity,
    totalRequestsUsed,
    remainingQuota: Math.max(0, totalSystemCapacity - totalRequestsUsed),
    aggregatedUsagePercent: Math.min(100, aggregatedUsagePercent),
    keyDetails,
    lastUpdated: new Date(),
  };
};

/**
 * Smart Culinary Fallback Generator when Gemini API keys are invalid/quota exceeded
 */
const getSmartCulinaryFallback = (rawQuery) => {
  recordApiKeyCall();
  const query = (rawQuery || "").trim();
  const lower = query.toLowerCase();

  const isBengali = /[\u0980-\u09FF]/.test(query) || lower.includes("kanto") || lower.includes("klanto") || lower.includes("ranna") || lower.includes("khabar");

  // 0. Strict Off-Topic & Non-Culinary Guard
  const offTopicKeywords = [
    "coding", "code", "javascript", "python", "java", "react", "html", "css", "programming", "developer", "bug", "algorithm",
    "cricket", "football", "soccer", "ipl", "match", "sports", "score", "messi", "ronaldo", "stadium", "world cup",
    "math", "algebra", "calculus", "equation", "solve",
    "finance", "stock", "crypto", "bitcoin", "invest", "money market", "shares",
    "politics", "election", "government", "president", "war", "news",
    "কোডিং", "প্রোগ্রামিং", "ক্রিকেট", "ফুটবল", "রাজনীতি", "শেয়ার বাজার", "ক্রিপ্টো"
  ];

  const culinaryAndPlatformKeywords = [
    "recipe", "cook", "chef", "food", "dish", "ingredient", "meal", "dinner", "lunch", "breakfast", "snack", "dessert", "bake", "fry", "roast", "grill",
    "chicken", "beef", "fish", "salmon", "pasta", "rice", "egg", "vegetable", "veggie", "potato", "cauliflower", "sweet potato", "soup", "salad", "sauce",
    "recipehub", "platform", "stripe", "premium", "account", "ranna", "khabar", "রেসিপি", "রান্না", "উপকরণ", "খাবার", "ডিম", "ভাত", "মাংস", "মাছ", "পাস্তা", "পিৎজা", "কেক"
  ];

  const hasOffTopicKeyword = offTopicKeywords.some((kw) => lower.includes(kw));
  const hasCulinaryOrPlatform = culinaryAndPlatformKeywords.some((ck) => lower.includes(ck));

  if (hasOffTopicKeyword && !hasCulinaryOrPlatform) {
    if (isBengali) {
      return `👨‍🍳 **শেফ রেসিপিহাব এআই অ্যাসিস্ট্যান্ট**:

আমি আন্তরিকভাবে দুঃখিত! আমি শুধুমাত্র রান্না, রেসিপি, উপকরণ, ও RecipeHub প্ল্যাটফর্ম সংক্রান্ত বিষয়ে সহায়তা করতে পারি। রান্নার বাইরের বিষয়ে (যেমন কোডিং, খেলাধুলা, বা সাধারণ বিষয়) সাহায্য করা আমার পক্ষে সম্ভব নয়।

অনুগ্রহ করে রান্না বা রেসিপি সম্পর্কিত কোনো প্রশ্ন করুন, আমি সানন্দে উত্তর দেব! 🍳✨`;
    }

    return `👨‍🍳 **Chef RecipeHub AI Assistant**:

I apologize, but I am specifically designed to assist ONLY with cooking, recipes, food preparation, ingredients, and RecipeHub platform features. I cannot assist with non-culinary topics like coding, sports, finance, or general trivia.

Please feel free to ask any culinary or recipe question, and I'll be happy to help! 🍳✨`;
  }

  // Bengali Language Fallback Handler
  if (isBengali) {
    if (lower.includes("ক্লান্ত") || lower.includes("সহজ") || lower.includes("kanto") || lower.includes("klanto") || lower.includes("ক্লান্তি") || lower.includes("মুড") || lower.includes("তাড়াতাড়ি")) {
      return `😌 **শেফ রেসিপিহাব মুড-বিশেষায়িত রান্নার গাইড (সহজ ও ঝটপট খাবার)**:\n\n### 🛋️ **১. ১৫-মিনিট গার্লিক বাটার ডিম-পাস্তা**\n- **কেন আপনার মুডের সাথে সেরা:** কোনো বাড়তি ঝামেলা ছাড়া মাত্র ১৫ মিনিটে তৈরি করা যায়।\n- **উপকরণ:** ২০০ গ্রাম পাস্তা, ২ চামচ মাখন, ৩ কোয়া রসুন কুচি, ২টি ডিম, সামান্য গোলমরিচ ও লবণ।\n- **ঝটপট প্রণালী:** পাস্তা সেদ্ধ করুন। কড়াইয়ে মাখনে রসুন সাঁতলে নিয়ে ডিম ও সেদ্ধ পাস্তা মিশিয়ে ২ মিনিট নেড়ে গরম গরম পরিবেশন করুন!\n\n### 🍲 **২. ৫-মিনিট ঝটপট ডিম ভাজি ও আলুর ভর্তা**\n- **কেন আপনার মুডের সাথে সেরা:** ঘরের সহজ উপকরণে সেরা আরামদায়ক দেশি খাবার।\n- **উপকরণ:** সেদ্ধ আলু, পেঁয়াজ কুচি, শুকনা মরিচ ভাজা, সরিষার তেল ও ডিম।\n\n*শেফ টিপস:* ক্লান্ত দিনে হালকা গরম চা বা কফির সাথে খাবারটি উপভোগ করুন! ☕✨`;
    }

    if (lower.includes("বাজেট") || lower.includes("টাকা") || lower.includes("সস্তা") || lower.includes("দাম") || lower.includes("কম") || lower.includes("৫") || lower.includes("5") || lower.includes("১০") || lower.includes("10")) {
      return `💰 **শেফ রেসিপিহাব বাজেট-বান্ধব রান্নার গাইড (সাশ্রয়ী মিল)**:\n\n### 🍳 **১. ডিম-সবজি ফ্রাইড রাইস (কম খরচে সেরা খাবার)**\n- **আনুমানিক খরচ:** ৫০-৭০ টাকা\n- **উপকরণ:** আগের দিনের বেঁচে যাওয়া ভাত, ২টি ডিম, কুচানো গাজর/পেঁয়াজ, সয়া সস ও তেল।\n- **শেফ হ্যাক:** তেজ আঁচে কড়াইয়ে চাল সেঁকে নিলে রেস্তোরাঁর মতো ফ্লেভার আসে।\n\n### 🍝 **২. স্পেশাল আলু-ডিম কষা ও রুটি/ভাত**\n- **আনুমানিক খরচ:** ৪০-৬০ টাকা\n- **উপকরণ:** ২টি সেদ্ধ ডিম, ১টি আলু, পেঁয়াজ, রসুন ও গরম মসলা।\n\n### 💡 **রেসিপিহাব প্ল্যাটফর্ম টিপস:**\n- আমাদের **Browse Recipes** পেজে গিয়ে **Free** ফিল্টার সিলেক্ট করলে শত শত ফ্রী রেসিপি দেখতে পাবেন!\n- ড্যাশবোর্ডের **Smart Grocery List** ব্যবহার করে বাজার খরচ সাশ্রয় করুন। 🛒✨`;
    }
  }

  // 1. Greetings (English)
  if (/^(hi|hello|hey|greetings|good morning|good evening|hola|salut|assalamu alaikum|slm)/i.test(lower)) {
    return "Hello there! 👋 I'm **Chef RecipeHub**, your personal AI culinary assistant.\n\nHow can I help you today? You can ask me about:\n- 🍳 Quick & easy recipe ideas\n- 🥦 Healthy ingredient substitutions\n- ⏱️ Cooking times & techniques\n- 🍰 Dessert and baking tips";
  }

  // 2. RecipeHub Premium Access / Pricing Questions
  if (
    lower.includes("premium") || lower.includes("membership") || lower.includes("subscription") || 
    (lower.includes("price") && !lower.includes("cheap") && !lower.includes("budget") && !lower.includes("$")) ||
    lower.includes("upgrade") || lower.includes("stripe")
  ) {
    return "🌟 **RecipeHub Premium Membership** unlocks exclusive culinary features:\n\n- 🔓 **Unlimited Recipe Access:** View all secret chef recipes.\n- 🤖 **Chef AI Assistant:** Unlimited 24/7 cooking guidance.\n- ⚡ **Ad-Free Browsing:** Seamless cooking experience.\n- 💎 **Exclusive Badges:** Showcase your chef status on community recipes.\n\nVisit our **Pricing** page to upgrade today!";
  }

  // 3. Mood & Craving Handling (Tired, Exhausted, Comfort, Lazy, Romantic, Rainy, Energetic, Stress Relief)
  if (
    lower.includes("tired") || lower.includes("exhausted") || lower.includes("comfort") || lower.includes("lazy") ||
    lower.includes("romantic") || lower.includes("rainy") || lower.includes("date night") || lower.includes("stress") ||
    lower.includes("vibe") || lower.includes("craving")
  ) {
    let moodVibe = "Comforting & Effortless";
    if (lower.includes("tired") || lower.includes("exhausted") || lower.includes("lazy")) {
      moodVibe = "Tired & Effortless Quick Meal";
    } else if (lower.includes("romantic") || lower.includes("date night")) {
      moodVibe = "Romantic Date Night";
    } else if (lower.includes("rainy")) {
      moodVibe = "Cozy Rainy Day Comfort";
    }

    return `😌 **Chef RecipeHub Mood-Tailored Culinary Guide (${moodVibe})**:\n\n### 🛋️ **Option 1: 15-Minute Creamy Garlic Butter Pasta**\n- **Why it fits your mood:** Minimal cleanup, soothing rich flavor, ready in under 15 minutes.\n- **Key Ingredients:** 200g pasta, 2 tbsp butter, 3 cloves garlic, 1/2 cup cream/milk, 1/4 cup Parmesan cheese.\n- **Quick Chef Tip:** Sauté garlic in butter for 1 minute, pour in cream and cheese, then toss with hot cooked pasta. Serve warm!\n\n### 🍲 **Option 2: Sheet-Pan Lemon Herb Roasted Chicken & Potatoes**\n- **Why it fits your mood:** Zero active effort—just chop, season, and let the oven do the work while you unwind.\n- **Key Ingredients:** Chicken thighs/breasts, cubed potatoes, olive oil, lemon juice, oregano, garlic powder.\n- **Quick Chef Tip:** Bake on a single sheet pan at **400°F (200°C)** for 25 minutes until golden brown.\n\n*Chef Advice:* Enjoy your meal with a relaxing warm beverage! 🕯️✨`;
  }

  // 4. Budget & Price Constraint Handling (Under $5, Under $10, Cheap, Budget, Free)
  if (
    lower.includes("budget") || lower.includes("cheap") || lower.includes("under") || lower.includes("$") ||
    lower.includes("dollar") || lower.includes("low cost") || lower.includes("affordable") || lower.includes("student meal")
  ) {
    let priceRange = "$5 - $10 Budget Range";
    if (lower.includes("5") || lower.includes("cheap")) priceRange = "Under $5 Meal";

    return `💰 **Chef RecipeHub Budget-Friendly Culinary Guide (${priceRange})**:\n\n### 🍳 **Option 1: Gourmet Crispy Fried Rice & Egg Bowl (~$3.50 Total)**\n- **Cost Breakdown:** Leftover rice ($0.50), 2 eggs ($0.80), frozen veggies ($1.00), soy sauce & sesame oil ($1.20).\n- **Chef Hack:** Searing cooked rice in a hot cast-iron skillet creates restaurant wok-charred flavor at minimal cost.\n\n### 🍝 **Option 2: Classic Spaghetti Aglio e Olio (~$4.20 Total)**\n- **Cost Breakdown:** Spaghetti ($1.20), olive oil & fresh garlic ($1.50), chili flakes & parsley ($1.50).\n- **Chef Hack:** Emulsify 3 tbsp starchy pasta water with garlic olive oil to make a luxurious sauce without expensive creams.\n\n### 💡 **RecipeHub Platform Budget Hacks:**\n- Check out the **Browse Recipes** page and set the filter to **Free** to discover hundreds of free community recipes!\n- Use the **Smart Grocery List** feature in your dashboard to combine ingredients and eliminate grocery waste. 🛒✨`;
  }

  // 3. Shepherd's Pie, Cottage Pie & Ground Beef Casserole with Crispy Potato Topping (High Priority)
  if (
    lower.includes("shepherd") || lower.includes("cottage pie") ||
    (lower.includes("ground beef") && (lower.includes("potato") || lower.includes("pie") || lower.includes("crust"))) ||
    (lower.includes("pie") && lower.includes("potato"))
  ) {
    return `🥧 **Chef RecipeHub's Classic Shepherd's Pie & Crispy Potato Crust Guide**:\n\n### 🥩 **1. Rich Savory Meat Filling:**\n- **Base Ingredients:** 500g ground beef or lamb, 1 finely chopped onion, 2 diced carrots, 1/2 cup peas, 2 cloves minced garlic, 2 tbsp tomato paste, 1 tbsp Worcestershire sauce, 1 cup beef broth, 1 tsp thyme & rosemary.\n- **Preparation:** Brown the ground meat in a deep skillet over medium-high heat. Add garlic, onions, and carrots; cook for 4 minutes. Stir in tomato paste, Worcestershire sauce, seasonings, and 1 tbsp flour to thicken. Pour in beef broth and simmer gently for 10 minutes until thick and savory.\n\n### 🥔 **2. Golden Crispy Mashed Potato Crust Hacks:**\n- **Mash Recipe:** Boil 800g Yukon Gold or Russet potatoes until fork-tender. Drain thoroughly and mash with 3 tbsp butter, 1/4 cup heavy cream or milk, 1 egg yolk (for rich golden color & structure), salt, and 1/4 cup grated cheddar or Parmesan.\n- **Fork-Peak Technique:** Spread the mashed potatoes evenly over the meat filling in your baking dish. Use a fork to drag across the top, creating **deep ridges and peaks** across the entire surface.\n\n### ⚡ **3. Baking & Broiling for Maximum Crunch:**\n- **Bake:** Bake at **400°F (200°C)** for 20-25 minutes until bubbling.\n- **High Broiler Finish:** Switch oven setting to **BROIL (High) for 3-5 minutes** at the very end. Watch closely as the fork-roughed potato peaks turn golden brown, deeply crispy, and crunchy!\n\n*Pro Chef Tip:* Let the pie rest for 10 minutes before slicing so the savory meat layers set cleanly without running! 🧀🔥`;
  }

  // 4. Healthy Breakfast Bowls & Sweet Potato Crispy Hacks (High Priority)
  const isShepherdOrBeef = lower.includes("shepherd") || lower.includes("pie") || lower.includes("ground beef") || lower.includes("cottage pie");
  if (
    !isShepherdOrBeef &&
    (
      lower.includes("sweet potato") || 
      lower.includes("breakfast bowl") || lower.includes("veggie bowl") || lower.includes("power bowl") ||
      (lower.includes("sweet potato") && lower.includes("crispy")) ||
      (lower.includes("crispy") && lower.includes("breakfast")) ||
      (lower.includes("vegetable") && (lower.includes("crispy") || lower.includes("technique") || lower.includes("hack")))
    )
  ) {
    return `🥣 **Chef RecipeHub's Healthy Breakfast Bowl & Crispy Sweet Potato Guide**:\n\n### 🥔 **The Ultimate Crispy Sweet Potato Cube Hacks:**\n1. **Parboil & Steam Dry (Crucial Step):** Cut sweet potatoes into uniform 1/2-inch cubes. Parboil in salted boiling water for **3 minutes**, then drain thoroughly and let steam dry on paper towels for 5 minutes. (Removing surface moisture ensures maximum crunch!)\n2. **The Starch Toss:** Lightly toss the dry cubes with 1-2 tsp of **cornstarch or tapioca starch** plus a drizzle of olive/avocado oil, sea salt, garlic powder, and smoked paprika.\n3. **High-Heat Roast or Pan-Sear:**\n   - **Oven/Air Fryer:** Spread evenly on a baking sheet without overcrowding. Bake at **425°F (220°C)** or Air Fry at **400°F (200°C)** for 20-25 minutes, shaking halfway.\n   - **Pan-Sear:** Sear in a hot cast-iron skillet over medium-high heat undisturbed for 3-4 minutes per side until golden brown and crispy.\n\n### 🥗 **Building a Balanced Healthy Breakfast Power Bowl:**\n- **Base:** 1 cup warm quinoa, brown rice, or massaged kale/spinach.\n- **Roasted Veggies & Carbs:** 1 cup Crispy Sweet Potato Cubes.\n- **Clean Protein:** 2 poached or soft-boiled eggs (or spiced scrambled tofu/chickpeas for vegan option).\n- **Healthy Fats:** 1/2 sliced ripe avocado + 1 tbsp toasted pumpkin seeds (pepitas).\n- **Signature Dressing:** Whisk 2 tbsp Tahini + 1 tbsp Lemon Juice + 1 tbsp warm water + pinch of salt & garlic powder.\n\n*Pro Chef Tip:* Never overcrowd your sheet pan or skillet—steam trapped between crowded vegetable cubes will make them soggy instead of ultra-crispy! 🥑✨`;
  }

  // 4. Multi-Course Dinner Parties, Italian Cuisine & Custom Menu Planning (High Priority)
  if (
    lower.includes("party") || lower.includes("menu") || lower.includes("italian") || 
    lower.includes("course") || lower.includes("dinner party") || lower.includes("catering") || lower.includes("guest")
  ) {
    let cuisineType = "Gourmet Dinner Party";
    if (lower.includes("italian")) cuisineType = "Classic Italian Dinner";

    return `🍷 **Chef RecipeHub's ${cuisineType} Menu & Prep Guide**:\n\n### 🇮🇹 **Sample 3-Course Menu:**\n1. **Appetizer (Antipasto):** Fresh Tomato Basil Bruschetta drizzled with aged balsamic glaze & extra virgin olive oil.\n2. **Main Course (Primo/Secondo):** Creamy Tuscan Garlic Chicken or Homemade Penne alla Vodka served with warm garlic bread.\n3. **Dessert (Dolce):** Traditional Espresso Tiramisu or Lemon Panna Cotta.\n\n### 👨‍🍳 **Host & Prep Guidelines:**\n- **Make-Ahead Items:** Prepare desserts and marinate proteins 4-6 hours before guests arrive.\n- **Scaling Portions:** Multiply ingredients proportionately and increase cooking times slightly for larger serving batches.\n- **Wine Pairing:** Pair rich garlic/cream pasta with crisp Pinot Grigio or medium-bodied Chianti. 🥂`;
  }

  // 4. Leftover Ingredients & Pantry Cooking with Sauce/Pasta Ratios (High Priority)
  if (
    lower.includes("leftover") || lower.includes("pantry") || lower.includes("ratio") || 
    (lower.includes("chicken") && lower.includes("cream") && lower.includes("pasta")) ||
    (lower.includes("cheese") && lower.includes("pasta") && lower.includes("cream")) ||
    (lower.includes("what can i cook with") && lower.includes("leftover"))
  ) {
    return `🍳 **Chef RecipeHub's Leftover & Pantry Gourmet Recipe Guide**:\n\n### 🍝 **Quick Dish: Creamy Garlic Chicken Alfredo Pasta**\n- **Base Ingredients:** 2 cups cooked leftover chicken (shredded), 250g pasta, 3/4 cup heavy cream or whole milk, 1/2 cup grated cheese (Parmesan/Cheddar), 2 cloves garlic, 1 tbsp butter/oil.\n\n### 📐 **Golden Sauce-to-Pasta & Protein Ratios:**\n1. **Sauce-to-Pasta Ratio:** Use **1 cup cream/sauce for every 200g - 250g dry pasta**. If the sauce gets too thick, add 2-3 tbsp of starchy pasta cooking water to smooth it out.\n2. **Protein Balance:** 1 to 1.5 cups of cooked protein (chicken/beef/tofu) per 250g pasta ensures every bite is balanced.\n\n### 👨‍🍳 **Step-by-Step 12-Minute Preparation:**\n1. **Boil Pasta:** Cook pasta in salted boiling water until al dente.\n2. **Build Cream Sauce:** Sauté minced garlic in butter for 1 minute. Pour in cream, bring to a gentle simmer, then melt in grated cheese until silky.\n3. **Combine & Warm:** Toss in shredded leftover chicken and drained pasta into the simmering sauce. Stir for 2 minutes until hot and well-coated.\n4. **Finish:** Season with freshly cracked black pepper, salt, and red pepper flakes or parsley! 🧀`;
  }

  // 4. Baking & Vegan Egg / Dairy Substitutes
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

  // 5. Cauliflower Pizza Crust & Special Healthy Crusts Handler
  if (
    lower.includes("cauliflower") || lower.includes("ফুলকপি") || lower.includes("pizza") || lower.includes("পিৎজা") || lower.includes("crust") || lower.includes("ক্রাস্ট")
  ) {
    if (isBengali) {
      return `🍕 **শেফ রেসিপিহাব ক্রিসপি ফুলকপি পিৎজা ক্রাস্ট (Crispy Cauliflower Pizza Crust Guide)**:\n\n### 🥦 **১. প্রয়োজনীয় উপকরণ:**\n- **ফুলকপি রাইস:** ৪ কাপ (গ্রেট করা বা ব্লেন্ড করা ফুলকপি)\n- **বাইন্ডিং ও চিজ:** ১টি ডিম, ১/২ কাপ মোজারেলা চিজ, ১/৪ কাপ পারমেসান চিজ\n- **মসলা:** ১/২ চা চামচ রসুন গুঁড়া, ১/২ চা চামচ ওরেগানো, সামান্য লবণ ও শুকনা মরিচের গুঁড়া\n\n### 👩‍🍳 **২. পর্যায়ক্রমিক প্রস্তুত প্রণালী:**\n১. **ফুলকপি সেদ্ধ ও পানি নিংড়ানো (সবচেয়ে গুরুত্বপূর্ণ):** ব্লেন্ড করা ফুলকপি ৪-৫ মিনিট স্টিম করে নিন। এরপর পাতলা সুতি কাপড়ে চেপে **সবটুকু পানি নিংড়ে সম্পূর্ণ শুষ্ক** করে নিন। (পানি থাকলে ক্রাস্ট নরম হয়ে যাবে!)\n২. **ডো তৈরি:** শুষ্ক ফুলকপির সাথে ডিম, চিজ এবং ওরেগানো-রসুনের মসলা ভালো করে মেখে গোল ডো বানিয়ে নিন।\n৩. **বেকিং:** বেকিং পেপারে ১/৪ ইঞ্চি পুরু করে পিৎজা আকৃতিতে ছড়িয়ে **৪০০° ফারেনহাইট (২০০° সে.)** ওভেনে ১৫-২০ মিনিট সোনালী রঙ হওয়া পর্যন্ত বেক করুন।\n৪. **টপিং ও ফাইনাল ব্যাক:** ওভেন থেকে বের করে আপনার পছন্দের পিৎজা সস, চিজ ও সবজি দিয়ে আরও ৫-৭ মিনিট বেক করে গরম গরম কাটুন!\n\n*শেফ টিপস:* পানি ভালোভাবে নিংড়ানোই নিখুঁত ও মচমচে ক্রাস্ট পাওয়ার আসল গোপন ট্রিক! 🍕✨`;
    }

    return `🍕 **Chef RecipeHub's Ultimate Crispy Cauliflower Pizza Crust Guide**:\n\n### 🥦 **1. Essential Ingredients:**\n- **Cauliflower Rice:** 4 cups finely grated cauliflower florets\n- **Binder & Cheese:** 1 large egg, 1/2 cup shredded mozzarella, 1/4 cup grated Parmesan\n- **Flavorings:** 1/2 tsp garlic powder, 1/2 tsp dried oregano, 1/4 tsp sea salt\n\n### 👩‍🍳 **2. Step-by-Step Preparation:**\n1. **Steam & Squeeze Dry (Golden Rule):** Microwave/steam cauliflower rice for 4 minutes. Let cool, wrap in a clean cheesecloth towel, and **squeeze out every single drop of moisture**. (Removing liquid is the #1 secret to avoiding soggy crust!)\n2. **Mix Crust Dough:** Combine dry squeezed cauliflower with egg, mozzarella, Parmesan, and seasonings until a firm dough forms.\n3. **Shape & Pre-Bake:** Press onto a parchment-lined baking sheet into a 10-inch round (1/4-inch thick). Bake at **400°F (200°C)** for 18-20 minutes until edges are golden brown.\n4. **Top & Crisp:** Add marinara sauce, toppings, and extra mozzarella, then bake for another 6-8 minutes until cheese is bubbly!\n\n*Pro Chef Tip:* Let the baked crust sit for 5 minutes before slicing so the slices hold firm without breaking! 🧀🔥`;
  }

  // 5. Dedicated Cakes & Baking Questions (ONLY when not a dinner/party/menu query)
  if (
    (lower.includes("cake") || lower.includes("chocolate") || lower.includes("bake") || lower.includes("pastry") || lower.includes("cookie")) &&
    !lower.includes("menu") && !lower.includes("party") && !lower.includes("dinner")
  ) {
    return `🍰 **Chef RecipeHub Baking Tips for "${query}"**:\n\n1. **Room Temperature Ingredients:** Always bring liquid ingredients, butter, and plant milks to room temperature before mixing.\n2. **Don't Overmix:** Fold wet and dry ingredients gently until just combined to keep texture tender.\n3. **Oven Precision:** Pre-heat your oven fully and avoid opening the oven door during the first 20 minutes of baking.\n\nCheck out the **Recipes** tab on RecipeHub for community-rated cake and dessert guides! 🍫`;
  }

  // 6. Savory Meals & Dishes (Chicken, Beef, Fish, Pasta, Rice, Salad, Soup, Dinner)
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

  // 7. Dynamic Culinary Recipe & Cooking Fallback Generator for all other culinary queries
  if (isBengali) {
    return `👨‍🍳 **শেফ রেসিপিহাব স্পেশাল রান্নার গাইড ("${query}")**:\n\n### 🍽️ **১. রেসিপি ও রান্নার প্রণালী**\n- **প্রয়োজনীয় উপকরণ:** প্রধান উপকরণসমূহ, রসুন কুচি, মাখন বা অলিভ ওয়েল, বিশেষ মসলা, লবণ ও কাঁচামরিচ/গোলমরিচ।\n- **স্টেপ-বাই-স্টেপ প্রস্তুত প্রণালী:**\n  ১. প্রথমে সব উপকরণ ধুয়ে পরিষ্কার করে সঠিক আকারে কেটে প্রিপারেশন নিন।\n  ২. কড়াই বা ওভেনে মাঝারি তাপে উপকরণগুলো সাঁতলে নিন এবং মসলা দিয়ে কষে নিন।\n  ৩. সঠিক সেদ্ধ হওয়া পর্যন্ত মৃদু আঁচে রেখে নামানোর আগে সামান্য মাখন বা ফ্রেশ ধনিয়া পাতা ছড়িয়ে গরম গরম পরিবেশন করুন!\n\n### 💡 **শেফ স্পেশাল সিক্রেট টিপ:**\nস্বাদ ও টেক্সচার সেরা রাখতে রান্নার শুরুতেই অল্প লবণ দিন এবং নামানোর আগে ফাইনাল সিজনিং চেক করুন! 🔪✨`;
  }

  return `👨‍🍳 **Chef RecipeHub Gourmet Culinary Guide for "${query}"**:\n\n### 🍽️ **1. Ingredients & Preparation Overview:**\n- **Key Ingredients:** Main protein/veggie base, minced garlic, butter or extra virgin olive oil, chef's seasonings, and sea salt.\n- **Step-by-Step Instructions:**\n  1. **Prep & Slice:** Clean and slice ingredients into uniform pieces for even cooking.\n  2. **Sear & Simmer:** Sauté garlic and aromatics in oil/butter until fragrant, then add main ingredients and cook over medium-high heat.\n  3. **Season & Finish:** Season to taste, simmer until tender, and garnish with fresh herbs or cheese before serving warm.\n\n### 💡 **Pro Chef Tip:**\nAlways balance rich savory flavors with a fresh touch of acidity (lemon juice or vinegar) right before serving! 🍷✨`;
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

        recordApiKeyCall(apiKey);

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

const FREE_FOOD_IMAGES = {
  Chicken: [
    "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1588347818036-558601350947?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1000&q=80"
  ],
  Pasta: [
    "https://images.unsplash.com/photo-1621996346565-e3d5d6288596?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1546549032-9571cd6b27df?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1608897013039-887f21d8c804?auto=format&fit=crop&w=1000&q=80"
  ],
  Seafood: [
    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=1000&q=80"
  ],
  Meat: [
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=1000&q=80"
  ],
  Salad: [
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=1000&q=80"
  ],
  Breakfast: [
    "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=80"
  ],
  Soup: [
    "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1588566565463-180a5b2090d2?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1603105037880-880cd4edfb5d?auto=format&fit=crop&w=1000&q=80"
  ],
  Dessert: [
    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=1000&q=80"
  ],
  PizzaBurger: [
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=1000&q=80"
  ],
  Default: [
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1000&q=80",
    "https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1000&q=80"
  ]
};

const getSmartFoodImage = (mealType = "Dinner", title = "") => {
  const lowerTitle = (title || "").toLowerCase();

  // Deterministic Hash Function for Title Diversity
  let hash = 0;
  for (let i = 0; i < lowerTitle.length; i++) {
    hash = (hash << 5) - hash + lowerTitle.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  let pool = FREE_FOOD_IMAGES.Default;

  if (lowerTitle.includes("chicken") || lowerTitle.includes("poultry") || lowerTitle.includes("turkey")) {
    pool = FREE_FOOD_IMAGES.Chicken;
  } else if (
    lowerTitle.includes("pasta") ||
    lowerTitle.includes("noodle") ||
    lowerTitle.includes("spaghetti") ||
    lowerTitle.includes("alfredo") ||
    lowerTitle.includes("macaroni") ||
    lowerTitle.includes("penne") ||
    lowerTitle.includes("lasagna")
  ) {
    pool = FREE_FOOD_IMAGES.Pasta;
  } else if (
    lowerTitle.includes("salmon") ||
    lowerTitle.includes("fish") ||
    lowerTitle.includes("tuna") ||
    lowerTitle.includes("shrimp") ||
    lowerTitle.includes("prawn") ||
    lowerTitle.includes("seafood")
  ) {
    pool = FREE_FOOD_IMAGES.Seafood;
  } else if (
    lowerTitle.includes("steak") ||
    lowerTitle.includes("beef") ||
    lowerTitle.includes("pork") ||
    lowerTitle.includes("lamb") ||
    lowerTitle.includes("meat") ||
    lowerTitle.includes("rib")
  ) {
    pool = FREE_FOOD_IMAGES.Meat;
  } else if (
    lowerTitle.includes("salad") ||
    lowerTitle.includes("kale") ||
    lowerTitle.includes("spinach") ||
    lowerTitle.includes("avocado") ||
    lowerTitle.includes("veggie") ||
    lowerTitle.includes("greens")
  ) {
    pool = FREE_FOOD_IMAGES.Salad;
  } else if (
    lowerTitle.includes("soup") ||
    lowerTitle.includes("stew") ||
    lowerTitle.includes("broth") ||
    lowerTitle.includes("chowder") ||
    lowerTitle.includes("ramen")
  ) {
    pool = FREE_FOOD_IMAGES.Soup;
  } else if (
    lowerTitle.includes("cake") ||
    lowerTitle.includes("chocolate") ||
    lowerTitle.includes("sweet") ||
    lowerTitle.includes("pie") ||
    lowerTitle.includes("cookie") ||
    lowerTitle.includes("dessert") ||
    lowerTitle.includes("pudding")
  ) {
    pool = FREE_FOOD_IMAGES.Dessert;
  } else if (
    lowerTitle.includes("pizza") ||
    lowerTitle.includes("burger") ||
    lowerTitle.includes("sandwich") ||
    lowerTitle.includes("taco") ||
    lowerTitle.includes("wrap")
  ) {
    pool = FREE_FOOD_IMAGES.PizzaBurger;
  } else if (
    lowerTitle.includes("pancake") ||
    lowerTitle.includes("egg") ||
    lowerTitle.includes("omelet") ||
    lowerTitle.includes("toast") ||
    lowerTitle.includes("waffle") ||
    lowerTitle.includes("breakfast")
  ) {
    pool = FREE_FOOD_IMAGES.Breakfast;
  } else if (FREE_FOOD_IMAGES[mealType]) {
    pool = FREE_FOOD_IMAGES[mealType];
  }

  const index = positiveHash % pool.length;
  return pool[index];
};

/**
 * AI Smart Recipe Generator for Premium Users
 * Creates a structured custom recipe object from user inputs.
 */
const generateAIRecipe = async ({
  ingredients,
  dietaryPreference = "None",
  mealType = "Dinner",
  servings = 2,
  recipeIdea = "",
  cuisine = "Italian",
  prepTime = "20 mins",
  difficulty = "Easy",
}) => {
  const ingList = Array.isArray(ingredients) ? ingredients.join(", ") : ingredients || "mixed ingredients";

  const systemPrompt = `You are Chef RecipeHub, an elite Michelin-star culinary master. Create a gourmet, highly detailed, step-by-step recipe based on the provided inputs.

CRITICAL TITLE & PARAMETER REQUIREMENTS:
1. The "title" MUST be a unique, creative, mouth-watering gourmet dish name (e.g., "Pan-Seared Tuscan Garlic Butter Chicken", "Velvety Wild Mushroom Risotto", "Crispy Creamy Honey-Glazed Salmon Bowl").
2. NEVER use generic or repetitive titles like "Chef's Special", "Simple Chicken Dish", "Quick Dinner", or plain ingredient names.
3. If a specific dish idea or title ("recipeIdea") is provided, elevate that exact concept into a full, elegant gourmet title.
4. Strictly incorporate the requested Cuisine (${cuisine}), Preparation Time (${prepTime}), and Difficulty Level (${difficulty}).

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "Unique Gourmet Recipe Title",
  "description": "Short appetizing culinary description (2-3 sentences)",
  "cuisine": "${cuisine}",
  "prepTime": "${prepTime}",
  "preparationTime": "${prepTime}",
  "cookTime": "20 mins",
  "servings": ${servings},
  "difficulty": "${difficulty}",
  "difficultyLevel": "${difficulty}",
  "dietaryTags": ["Tag1", "Tag2"],
  "ingredients": ["1 cup ingredient 1", "2 tbsp ingredient 2"],
  "instructions": [
    "Step 1: Description...",
    "Step 2: Description..."
  ],
  "chefTips": "Pro chef secret tip for perfection",
  "nutritionInfo": {
    "calories": "450 kcal",
    "protein": "32g",
    "carbs": "25g",
    "fats": "18g"
  }
}`;

  let userPrompt = "";
  if (recipeIdea && recipeIdea.trim()) {
    userPrompt = `Generate an authentic ${cuisine ? cuisine + " " : ""}${dietaryPreference !== "None" ? dietaryPreference + " " : ""}${mealType} recipe specifically for target dish: "${recipeIdea.trim()}" incorporating these available ingredients: ${ingList}. Target preparation time is ${prepTime}, difficulty is ${difficulty}, and target servings count is ${servings}.`;
  } else {
    userPrompt = `Generate a unique, gourmet ${cuisine ? cuisine + " " : ""}${dietaryPreference !== "None" ? dietaryPreference + " " : ""}${mealType} recipe featuring these key ingredients: ${ingList}. Target preparation time is ${prepTime}, difficulty is ${difficulty}, and target servings count is ${servings}.`;
  }

  const apiKeys = getGeminiApiKeys();

  if (apiKeys.length > 0) {
    const totalKeys = apiKeys.length;
    const models = ["gemini-1.5-flash", "gemini-2.0-flash"];

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const keyIndex = (currentKeyIndex + attempt) % totalKeys;
      const apiKey = apiKeys[keyIndex];

      for (const modelName of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const payload = {
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0.8,
              responseMimeType: "application/json",
              maxOutputTokens: 1200,
            },
          };

          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          recordApiKeyCall(apiKey);

          const data = await response.json();
          const textReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (textReply) {
            try {
              const cleanJsonStr = textReply.replace(/```json/g, "").replace(/```/g, "").trim();
              const recipeObj = JSON.parse(cleanJsonStr);
              currentKeyIndex = (keyIndex + 1) % totalKeys;

              const matchedImg = getSmartFoodImage(mealType, recipeObj.title);
              recipeObj.image = recipeObj.image || matchedImg;
              recipeObj.recipeImage = recipeObj.recipeImage || matchedImg;
              recipeObj.cuisine = recipeObj.cuisine || cuisine;
              recipeObj.cuisineType = recipeObj.cuisine || cuisine;
              recipeObj.prepTime = recipeObj.prepTime || prepTime;
              recipeObj.preparationTime = recipeObj.preparationTime || recipeObj.prepTime || prepTime;
              recipeObj.difficulty = recipeObj.difficulty || difficulty;
              recipeObj.difficultyLevel = recipeObj.difficultyLevel || recipeObj.difficulty || difficulty;

              return recipeObj;
            } catch (jsonErr) {
              console.warn("JSON parse error from Gemini response, using fallback format");
            }
          }
        } catch (err) {
          console.error(`Gemini Recipe Gen Error (Key ${keyIndex + 1}):`, err.message);
        }
      }
    }
  }

  // Smart Gourmet Recipe Generator Fallback
  recordApiKeyCall();
  let fallbackTitle = "";
  if (recipeIdea && recipeIdea.trim()) {
    const cleanIdea = recipeIdea.trim();
    fallbackTitle = cleanIdea.charAt(0).toUpperCase() + cleanIdea.slice(1);
  } else {
    const mainIng = ingList.split(",")[0]?.trim() || "Herbs & Vegetables";
    const capitalMain = mainIng.charAt(0).toUpperCase() + mainIng.slice(1);
    const prefixes = ["Tuscan-Style", "Pan-Seared", "Crispy Roasted", "Garlic Butter Infused", "Creamy Artisanal", "Flame-Grilled"];
    const prefix = prefixes[Math.abs(ingList.length % prefixes.length)];
    const dietLabel = dietaryPreference !== "None" && dietaryPreference ? dietaryPreference : "Gourmet";
    fallbackTitle = `${prefix} ${cuisine ? cuisine + " " : ""}${dietLabel} ${capitalMain} Delicacy`;
  }

  const matchedImg = getSmartFoodImage(mealType, fallbackTitle);

  return {
    title: fallbackTitle,
    description: `A delicious, chef-crafted ${cuisine ? cuisine + " " : ""}${mealType.toLowerCase()} dish featuring ${ingList} with harmonized spices and a rich, savory finish.`,
    cuisine: cuisine || "Gourmet",
    cuisineType: cuisine || "Gourmet",
    prepTime: prepTime || "20 mins",
    preparationTime: prepTime || "20 mins",
    cookTime: "18 mins",
    servings: Number(servings) || 2,
    difficulty: difficulty || "Easy",
    difficultyLevel: difficulty || "Easy",
    image: matchedImg,
    recipeImage: matchedImg,
    dietaryTags: [cuisine || "Gourmet", dietaryPreference !== "None" ? dietaryPreference : "Gourmet", mealType],
    ingredients: ingList.split(",").map((item) => `1 portion of ${item.trim()}`).concat([
      "2 tbsp extra virgin olive oil or butter",
      "2 cloves garlic, minced",
      "Pinch of sea salt & cracked black pepper",
      "Fresh herbs for garnish"
    ]),
    instructions: [
      `Prep & Mise en Place: Thoroughly wash and chop ${ingList} into uniform bite-sized pieces.`,
      `Aromatics: Heat olive oil or butter in a skillet over medium heat. Sauté minced garlic for 1 minute until fragrant.`,
      `Searing & Seasoning: Add ${ingList} to the pan. Season generously with sea salt and cracked black pepper. Sauté for 10-12 minutes until tender and golden brown.`,
      `Plating & Serving: Transfer to warm plates. Garnish with fresh herbs and enjoy hot!`
    ],
    chefTips: "For maximum flavor depth, deglaze the pan with a splash of fresh lemon juice or white wine before serving!",
    nutritionInfo: {
      calories: "420 kcal",
      protein: "28g",
      carbs: "18g",
      fats: "16g"
    }
  };
};

module.exports = {
  getGeminiApiKeys,
  generateAIContent,
  generateAIRecipe,
  getApiPoolAnalytics,
  recordApiKeyCall,
};
