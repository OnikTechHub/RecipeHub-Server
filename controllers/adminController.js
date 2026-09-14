const mongoose = require("mongoose");
const User = require("../models/User");
const Recipe = require("../models/Recipe");
const Report = require("../models/Report");
const Payment = require("../models/Payment");

/**
 * Get aggregated statistics for admin dashboard
 * Route: GET /admin-stats
 */
const getAdminStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRecipes = await Recipe.countDocuments();
    const totalPremiumMembers = await User.countDocuments({ isPremium: true });
    const totalReports = await Report.countDocuments();

    res.send({
      success: true,
      data: {
        totalUsers,
        totalRecipes,
        totalPremiumMembers,
        totalReports,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all registered users
 * Route: GET /admin/users
 */
const getUsers = async (req, res, next) => {
  try {
    const result = await User.find({}).lean();
    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Block a user by ID
 * Route: PATCH /admin/users/block/:id
 */
const blockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await User.updateOne(
      { _id: id },
      { $set: { isBlocked: true, updatedAt: new Date() } }
    );

    res.send({
      success: true,
      message: "User blocked successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unblock a user by ID
 * Route: PATCH /admin/users/unblock/:id
 */
const unblockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await User.updateOne(
      { _id: id },
      { $set: { isBlocked: false, updatedAt: new Date() } }
    );

    res.send({
      success: true,
      message: "User unblocked successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all recipes for admin management
 * Route: GET /admin/recipes
 */
const getAdminRecipes = async (req, res, next) => {
  try {
    const result = await Recipe.find({}).lean();
    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a recipe and its associated reports
 * Route: DELETE /admin/recipes/:id
 */
const deleteAdminRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Recipe.deleteOne({ _id: id });
    await Report.deleteMany({ recipeId: id });

    res.send({
      success: true,
      message: "Recipe and its relative reports removed successfully by Admin.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update recipe fields (moderation)
 * Route: PUT /admin/recipes/:id
 */
const updateAdminRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recipeName, category, cuisine, prepTime } = req.body;

    const result = await Recipe.updateOne(
      { _id: id },
      {
        $set: {
          recipeName,
          category,
          cuisine,
          prepTime,
          updatedAt: new Date(),
        },
      }
    );

    res.send({
      success: true,
      message: "Recipe updated successfully with modern parameters",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle featured state of recipe
 * Route: PATCH /admin/recipes/feature/:id
 */
const toggleFeatureRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isFeatured } = req.body;

    const result = await Recipe.updateOne(
      { _id: id },
      {
        $set: {
          isFeatured,
          featuredAt: isFeatured ? new Date() : null,
        },
      }
    );

    res.send({
      success: true,
      message: isFeatured
        ? "Recipe marked as Featured!"
        : "Recipe removed from Featured!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reports formatted for admin with recipe details
 * Route: GET /admin/reports
 */
const getAdminReports = async (req, res, next) => {
  try {
    const pipeline = [
      {
        $addFields: {
          convertedRecipeId: {
            $cond: {
              if: {
                $regexMatch: {
                  input: "$recipeId",
                  regex: /^[0-9a-fA-F]{24}$/,
                },
              },
              then: { $toObjectId: "$recipeId" },
              else: "$recipeId",
            },
          },
        },
      },
      {
        $lookup: {
          from: "recipes",
          localField: "convertedRecipeId",
          foreignField: "_id",
          as: "targetRecipe",
        },
      },
      {
        $addFields: {
          recipeInfo: { $arrayElemAt: ["$targetRecipe", 0] },
        },
      },
      { $project: { targetRecipe: 0, convertedRecipeId: 0 } },
      { $sort: { reportedAt: -1 } },
    ];

    const result = await Report.aggregate(pipeline);
    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dismiss/delete report
 * Route: DELETE /admin/reports/:id
 */
const dismissReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await Report.deleteOne({ _id: id });
    res.send({
      success: true,
      message: "Report dismissed successfully by Admin.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all payment transactions for admin review
 * Route: GET /admin/transactions
 */
const getAdminTransactions = async (req, res, next) => {
  try {
    const transactions = await Payment.find().sort({ paidAt: -1 }).lean();
    res.send(transactions);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminStats,
  getUsers,
  blockUser,
  unblockUser,
  getAdminRecipes,
  deleteAdminRecipe,
  updateAdminRecipe,
  toggleFeatureRecipe,
  getAdminReports,
  dismissReport,
  getAdminTransactions,
};
