const mongoose = require("mongoose");
const Recipe = require("../models/Recipe");
const User = require("../models/User");
const Payment = require("../models/Payment");

/**
 * Get recipes with search, category filtering, and pagination
 * Route: GET /recipes
 */
const getAllRecipes = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 6 } = req.query;
    let query = {};

    if (search) {
      query.recipeName = { $regex: search, $options: "i" };
    }
    if (category && category !== "All") {
      query.category = { $in: [category] };
    }

    const totalRecipes = await Recipe.countDocuments(query);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const result = await Recipe.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.send({
      success: true,
      data: result,
      totalRecipes,
      totalPages: Math.ceil(totalRecipes / limitNum),
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
    } else {
      newRecipe.isPaid = false;
      newRecipe.price = 0;
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
    const result = await Recipe.find({ isFeatured: true })
      .sort({ featuredAt: -1, createdAt: -1 })
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

    // Strict Free vs Paid recipe check
    const isPaidRecipe =
      recipe.recipeType === "Paid" ||
      recipe.isPaid === true ||
      Number(recipe.price || 0) > 0;

    if (!isPaidRecipe) {
      return res.send({
        success: true,
        hasAccess: true,
        reason: "free",
      });
    }

    // Unauthenticated user attempting to access a paid recipe
    if (!email || !email.trim()) {
      return res.send({
        success: true,
        hasAccess: false,
        reason: "unauthenticated",
        price: recipe.price || 5,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Author of the recipe
    if (recipe.authorEmail && recipe.authorEmail.toLowerCase() === normalizedEmail) {
      return res.send({
        success: true,
        hasAccess: true,
        reason: "author",
      });
    }

    // Admin user access
    const userDoc = await User.findByEmailWithFallback(normalizedEmail);
    if (
      normalizedEmail === ADMIN_EMAIL.toLowerCase() ||
      normalizedEmail === "admin@recipehub.com" ||
      (userDoc && userDoc.role === "admin")
    ) {
      return res.send({
        success: true,
        hasAccess: true,
        reason: "admin",
      });
    }

    // Check if user purchased THIS SPECIFIC recipe
    const purchased = await Payment.findOne({
      userEmail: normalizedEmail,
      recipeId: id.toString(),
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
      reason: "locked",
      price: recipe.price || 5,
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
  getRecipesCount,
  deleteRecipe,
  updateRecipe,
};
