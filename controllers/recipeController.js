const mongoose = require("mongoose");
const Recipe = require("../models/Recipe");
const User = require("../models/User");
const Payment = require("../models/Payment");

/**
 * Get recipes with search, category filtering, and pagination
 * Route: GET /recipes
 */
/**
 * Get recipes with search, category filtering, access/pricing filtering, and deterministic pagination
 * Route: GET /recipes
 */
const getAllRecipes = async (req, res, next) => {
  try {
    const { search, category, filter = "all", email, page = 1, limit = 6 } = req.query;
    const andConditions = [];

    // 1. Search Query Filter
    if (search && search.trim()) {
      andConditions.push({ recipeName: { $regex: search.trim(), $options: "i" } });
    }

    // 2. Category Filter
    if (category && category !== "All") {
      const catTrim = category.trim();
      const baseCat = catTrim.replace(/s$/i, "");
      const catRegex = new RegExp("^" + baseCat + "s?$", "i");

      andConditions.push({
        $or: [
          { category: { $in: [catTrim, baseCat, `${baseCat}s`, catRegex] } },
          { category: catRegex },
          { cuisine: catRegex },
        ],
      });
    }

    // 3. Access & Pricing Filter (Free, Paid, Purchased)
    const cleanFilter = (filter || "all").toLowerCase().trim();

    if (cleanFilter === "free") {
      andConditions.push({
        $or: [
          { recipeType: "Free" },
          { isPaid: false },
          { isPaid: { $exists: false } },
          { price: 0 },
          { price: { $exists: false } },
        ],
      });
    } else if (cleanFilter === "paid") {
      andConditions.push({
        $or: [
          { recipeType: "Paid" },
          { isPaid: true },
          { price: { $gt: 0 } },
        ],
      });
    } else if (cleanFilter === "purchased") {
      if (!email || !email.trim()) {
        return res.send({
          success: true,
          data: [],
          totalRecipes: 0,
          totalPages: 1,
          currentPage: 1,
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const userDoc = await User.findByEmailWithFallback(normalizedEmail);
      const isAdminUser =
        normalizedEmail === (process.env.ADMIN_EMAIL || "admin@recipehub.com").toLowerCase() ||
        normalizedEmail === "admin@recipehub.com" ||
        (userDoc && userDoc.role === "admin");

      if (isAdminUser) {
        andConditions.push({
          $or: [
            { recipeType: "Paid" },
            { isPaid: true },
            { price: { $gt: 0 } },
          ],
        });
      } else {
        const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        const emailRegex = new RegExp("^" + escapeRegex(normalizedEmail) + "$", "i");

        const payments = await Payment.find({
          userEmail: emailRegex,
          paymentStatus: { $ne: "failed" },
        }).select("recipeId items").lean();

        const purchasedIds = [];
        payments.forEach((p) => {
          if (p.recipeId) purchasedIds.push(p.recipeId.toString());
          if (Array.isArray(p.items)) {
            p.items.forEach((item) => {
              if (item.recipeId) purchasedIds.push(item.recipeId.toString());
              if (item._id) purchasedIds.push(item._id.toString());
            });
          }
        });

        // Also query recipes authored by the user
        const userAuthored = await Recipe.find({
          $or: [
            { authorEmail: emailRegex },
            { userEmail: emailRegex },
            { email: emailRegex },
          ],
        }).select("_id").lean();

        userAuthored.forEach((r) => {
          if (r && r._id) purchasedIds.push(r._id.toString());
        });

        const uniquePurchasedObjectIds = Array.from(new Set(purchasedIds))
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        andConditions.push({
          $or: [
            { authorEmail: emailRegex },
            { userEmail: emailRegex },
            { email: emailRegex },
            { _id: { $in: uniquePurchasedObjectIds } },
          ],
        });

      }
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const totalRecipes = await Recipe.countDocuments(query);
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 6);
    const skip = (pageNum - 1) * limitNum;

    // Tie-break with _id: -1 for deterministic pagination (prevents duplicate items across pages)
    const result = await Recipe.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Deduplicate result by _id
    const uniqueMap = new Map();
    result.forEach((item) => {
      const idStr = item._id.toString();
      if (!uniqueMap.has(idStr)) {
        uniqueMap.set(idStr, item);
      }
    });
    const uniqueResult = Array.from(uniqueMap.values());

    res.send({
      success: true,
      data: uniqueResult,
      totalRecipes,
      totalPages: Math.ceil(totalRecipes / limitNum) || 1,
      currentPage: pageNum,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single recipe by ID
 * Route: GET /recipes/:id
 */
const getRecipeById = async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await Recipe.findById(id).lean();

    if (!result) {
      return res.status(404).send({
        success: false,
        message: "Recipe not found",
      });
    }

    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new recipe (with 2-recipe limit check for non-premium users)
 * Route: POST /recipes
 */
const createRecipe = async (req, res, next) => {
  try {
    const newRecipe = req.body;
    if (newRecipe.isPaid) {
      newRecipe.isPaid = true;
      newRecipe.price = Math.max(0, Number(newRecipe.price) || 0);
      newRecipe.recipeType = "Paid";
    } else {
      newRecipe.isPaid = false;
      newRecipe.price = 0;
      newRecipe.recipeType = "Free";
    }

    if (!newRecipe.recipeImage && newRecipe.image) {
      newRecipe.recipeImage = newRecipe.image;
    } else if (!newRecipe.image && newRecipe.recipeImage) {
      newRecipe.image = newRecipe.recipeImage;
    }

    const user = await User.findByEmailWithFallback(newRecipe.authorEmail);
    const existingRecipesCount = await Recipe.countDocuments({
      authorEmail: newRecipe.authorEmail,
    });

    if (!user?.isPremium && existingRecipesCount >= 2) {
      return res.status(403).send({
        success: false,
        message:
          "Standard accounts have a 2-recipe limit! Upgrade to Premium to unlock unlimited creations.",
      });
    }

    // Duplicate Recipe Name Prevention Check (Case-Insensitive)
    const targetTitle = (newRecipe.recipeName || newRecipe.title || "").trim();
    if (targetTitle) {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const titleRegex = new RegExp(`^${escapeRegex(targetTitle)}$`, "i");

      const duplicateRecipe = await Recipe.findOne({
        $or: [{ recipeName: titleRegex }, { title: titleRegex }],
      });

      if (duplicateRecipe) {
        return res.status(400).send({
          success: false,
          message: `A recipe named "${targetTitle}" already exists! Please choose a unique title.`,
        });
      }
    }

    // Direct Database Query for AI Recipe Weekly Quota Check (Max 2 saved in last 7 days)
    if (newRecipe.isAiGenerated && newRecipe.authorEmail) {
      const cleanEmail = newRecipe.authorEmail.trim().toLowerCase();
      const adminEmail = (process.env.ADMIN_EMAIL || "admin@recipehub.com").trim().toLowerCase();
      const isAdminUser = cleanEmail === adminEmail || user?.role === "admin";

      if (!isAdminUser) {
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const emailRegex = new RegExp(`^${escapeRegex(cleanEmail)}$`, "i");
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const aiSavedCount = await Recipe.countDocuments({
          $or: [{ authorEmail: emailRegex }, { userEmail: emailRegex }],
          isAiGenerated: true,
          createdAt: { $gte: sevenDaysAgo },
        });

        if (aiSavedCount >= 2) {
          return res.status(403).send({
            success: false,
            limitReached: true,
            message: "Weekly AI generation limit (2 recipes) reached!",
          });
        }
      }
    }

    const result = await Recipe.create(newRecipe);
    res.status(201).send({
      success: true,
      insertedId: result._id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle like on a recipe
 * Route: PATCH /recipes/:id/like
 */
const toggleLike = async (req, res, next) => {
  try {
    const id = req.params.id;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).send({
        success: false,
        message: "Missing user email.",
      });
    }

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).send({
        success: false,
        message: "Recipe not found",
      });
    }

    const likedUsers = recipe.likedUsers || [];
    const hasLiked = likedUsers.includes(userEmail);

    let updateDoc = {};
    if (hasLiked) {
      updateDoc = {
        $pull: { likedUsers: userEmail },
        $inc: { likesCount: -1 },
      };
    } else {
      updateDoc = {
        $addToSet: { likedUsers: userEmail },
        $inc: { likesCount: 1 },
      };
    }

    await Recipe.updateOne({ _id: id }, updateDoc);
    res.send({
      success: true,
      isLiked: !hasLiked,
      likesCount: hasLiked ? Math.max(0, (recipe.likesCount || 1) - 1) : (recipe.likesCount || 0) + 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get featured recipes
 * Route: GET /featured-recipes
 */
const getFeaturedRecipes = async (req, res, next) => {
  try {
    const limitNum = parseInt(req.query.limit) || 8;
    const result = await Recipe.find({ isFeatured: true })
      .sort({ featuredAt: -1, createdAt: -1 })
      .limit(limitNum)
      .lean();

    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recipes authored by a user with LIFO sorting and pagination
 * Route: GET /my-recipes?email=...&page=...&limit=...
 */
const getMyRecipes = async (req, res, next) => {
  try {
    const email = req.query.email;
    const { page = 1, limit = 8 } = req.query;

    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email query parameter is required!",
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalRecipes = await Recipe.countDocuments({ authorEmail: email });
    const result = await Recipe.find({ authorEmail: email })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.send({
      success: true,
      message: "Recipes fetched successfully!",
      data: result,
      totalRecipes,
      totalPages: Math.ceil(totalRecipes / limitNum) || 1,
      currentPage: pageNum,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if a user has access to full recipe contents
 * Route: GET /recipes/:id/access?email=...
 */
const checkRecipeAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    const recipe = await Recipe.findById(id).lean();
    if (!recipe) {
      return res.status(404).send({
        success: false,
        message: "Recipe not found",
      });
    }

    const isPaidRecipe =
      recipe.recipeType === "Paid" ||
      recipe.isPaid === true ||
      Number(recipe.price || 0) > 0;

    // Unauthenticated user attempting to access any recipe
    if (!email || !email.trim()) {
      return res.send({
        success: true,
        hasAccess: false,
        reason: "unauthenticated",
        price: recipe.price || 0,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Author / Creator of the recipe (Access to own recipes)
    const authorEmails = [
      recipe.authorEmail,
      recipe.userEmail,
      recipe.creatorEmail,
      recipe.email,
      recipe.createdBy,
    ]
      .filter(Boolean)
      .map((e) => e.toString().toLowerCase().trim());

    if (authorEmails.includes(normalizedEmail)) {
      return res.send({
        success: true,
        hasAccess: true,
        reason: "author",
      });
    }

    const userDoc = await User.findByEmailWithFallback(normalizedEmail);
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@recipehub.com").toLowerCase();

    // Admin user access (Universal 100% lifetime free access for all admins)
    if (
      normalizedEmail === ADMIN_EMAIL ||
      normalizedEmail === "admin@recipehub.com" ||
      (userDoc && userDoc.role === "admin") ||
      req.user?.role === "admin"
    ) {
      return res.send({
        success: true,
        hasAccess: true,
        reason: "admin",
      });
    }

    const isPremiumUser = userDoc && (userDoc.isPremium === true || userDoc.role === "premium");

    if (isPremiumUser) {
      // Standard/Free recipe unlocked automatically for Premium members
      if (!isPaidRecipe) {
        return res.send({
          success: true,
          hasAccess: true,
          reason: "premium",
        });
      }

      // Exclusive paid recipe: check if Premium user purchased this specific paid recipe
      const purchased = await Payment.findOne({
        userEmail: { $regex: new RegExp("^" + normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + "$", "i") },
        recipeId: { $in: [id.toString(), id] },
        paymentStatus: "paid",
      });

      if (purchased) {
        return res.send({
          success: true,
          hasAccess: true,
          reason: "purchased",
        });
      }

      return res.send({
        success: true,
        hasAccess: false,
        reason: "paid_locked",
        price: recipe.price || 5,
      });
    }

    // Standard Free User (Not Premium, Not Admin, Not Author)
    // All recipes are locked by default until they upgrade to Premium Membership or purchase
    const purchased = await Payment.findOne({
      userEmail: { $regex: new RegExp("^" + normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + "$", "i") },
      recipeId: { $in: [id.toString(), id] },
      paymentStatus: "paid",
    });

    if (purchased) {
      return res.send({
        success: true,
        hasAccess: true,
        reason: "purchased",
      });
    }

    return res.send({
      success: true,
      hasAccess: false,
      reason: "membership_required",
      price: recipe.price || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit review & rating for a recipe and recalculate global average rating
 * Route: POST /recipes/:id/reviews
 */
const addRecipeReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment, userName, userEmail, userImage } = req.body;

    if (!userEmail) {
      return res.status(401).send({
        success: false,
        message: "You must be logged in to submit a review.",
      });
    }

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).send({
        success: false,
        message: "Please select a valid rating between 1 and 5 stars.",
      });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).send({
        success: false,
        message: "Please write a review comment.",
      });
    }

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).send({
        success: false,
        message: "Recipe not found.",
      });
    }

    const newReview = {
      userName: userName || userEmail.split("@")[0],
      userEmail: userEmail.trim().toLowerCase(),
      userImage: userImage || "",
      rating: numRating,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    const existingReviews = recipe.reviews || [];
    const existingIdx = existingReviews.findIndex(
      (r) => r.userEmail && r.userEmail.toLowerCase() === userEmail.trim().toLowerCase()
    );

    if (existingIdx >= 0) {
      existingReviews[existingIdx] = newReview;
    } else {
      existingReviews.push(newReview);
    }

    const totalStars = existingReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
    const avgRating = Number((totalStars / existingReviews.length).toFixed(1));

    recipe.reviews = existingReviews;
    recipe.ratings = avgRating;
    recipe.reviewCount = existingReviews.length;

    await recipe.save();

    res.send({
      success: true,
      message: "Thank you for your rating & review!",
      data: {
        ratings: recipe.ratings,
        reviewCount: recipe.reviewCount,
        reviews: recipe.reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recipe count by user email
 * Route: GET /recipes-count?email=...
 */
const getRecipesCount = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email parameter required",
      });
    }

    const count = await Recipe.countDocuments({ authorEmail: email });
    res.send({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user's own recipe by ID
 * Route: DELETE /recipes/:id
 */
const deleteRecipe = async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await Recipe.deleteOne({ _id: id });

    if (result.deletedCount === 1) {
      res.send({
        success: true,
        message: "Recipe deleted successfully!",
      });
    } else {
      res.status(404).send({
        success: false,
        message: "Recipe not found!",
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Update user's recipe by ID
 * Route: PATCH /recipes/:id
 */
const updateRecipe = async (req, res, next) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    delete updatedData._id;

    if (updatedData.isPaid !== undefined) {
      if (updatedData.isPaid) {
        updatedData.price = Math.max(0, Number(updatedData.price) || 0);
      } else {
        updatedData.price = 0;
      }
    }

    const result = await Recipe.updateOne({ _id: id }, { $set: updatedData });

    if (result.modifiedCount > 0 || result.matchedCount > 0) {
      res.send({
        success: true,
        message: "Recipe updated successfully!",
      });
    } else {
      res.status(400).send({
        success: false,
        message: "No changes were made.",
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  toggleLike,
  getFeaturedRecipes,
  getMyRecipes,
  checkRecipeAccess,
  addRecipeReview,
  getRecipesCount,
  deleteRecipe,
  updateRecipe,
};
