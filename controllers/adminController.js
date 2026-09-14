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

    // Financial revenue calculations
    const financialStats = await Payment.aggregate([
      { $match: { paymentStatus: "paid" } },
      {
        $group: {
          _id: null,
          grossVolume: { $sum: "$amount" },
          adminEarnings: { $sum: { $ifNull: ["$adminEarnings", "$amount"] } },
          creatorEarnings: { $sum: { $ifNull: ["$creatorEarnings", 0] } },
          totalPaidTransactions: { $sum: 1 },
        },
      },
    ]);

    const grossVolume = financialStats[0]?.grossVolume ? Number(financialStats[0].grossVolume.toFixed(2)) : 0;
    const adminEarnings = financialStats[0]?.adminEarnings ? Number(financialStats[0].adminEarnings.toFixed(2)) : 0;
    const creatorEarnings = financialStats[0]?.creatorEarnings ? Number(financialStats[0].creatorEarnings.toFixed(2)) : 0;

    // Monthly revenue aggregation for charts
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyAggregation = await Payment.aggregate([
      { $match: { paymentStatus: "paid" } },
      {
        $group: {
          _id: {
            year: { $year: { $ifNull: ["$paidAt", "$createdAt"] } },
            month: { $month: { $ifNull: ["$paidAt", "$createdAt"] } },
          },
          gross: { $sum: "$amount" },
          net: { $sum: { $ifNull: ["$adminEarnings", "$amount"] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    let monthlyChartData = monthlyAggregation.map((item) => ({
      month: `${monthNames[(item._id.month || 1) - 1]} ${item._id.year || ''}`.trim(),
      gross: Number((item.gross || 0).toFixed(2)),
      net: Number((item.net || 0).toFixed(2)),
      transactions: item.count || 0,
    }));

    if (monthlyChartData.length === 0) {
      monthlyChartData = [
        { month: "Current", gross: grossVolume, net: adminEarnings, transactions: financialStats[0]?.totalPaidTransactions || 0 }
      ];
    }

    res.send({
      success: true,
      data: {
        totalUsers,
        totalRecipes,
        totalPremiumMembers,
        totalReports,
        grossVolume,
        adminEarnings,
        creatorEarnings,
        monthlyChartData,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get registered users with pagination
 * Route: GET /admin/users
 */
const getUsers = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const totalUsers = await User.countDocuments();

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0;

    let query = User.find({}).sort({ createdAt: -1 });
    if (usePagination) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }

    const result = await query.lean();
    res.send({
      success: true,
      data: result,
      totalUsers,
      totalPages: usePagination ? Math.ceil(totalUsers / limitNum) || 1 : 1,
      currentPage: usePagination ? pageNum : 1,
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
 * Promote a user to Admin by ID
 * Route: PATCH /admin/users/make-admin/:id
 */
const makeUserAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await User.updateOne(
      { _id: id },
      { $set: { role: "admin", updatedAt: new Date() } }
    );

    res.send({
      success: true,
      message: "User successfully promoted to Administrator!",
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
    const { page, limit } = req.query;
    const totalRecipes = await Recipe.countDocuments();

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0;

    let query = Recipe.find({}).sort({ createdAt: -1 });
    if (usePagination) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }

    const result = await query.lean();
    res.send({
      success: true,
      data: result,
      totalRecipes,
      totalPages: usePagination ? Math.ceil(totalRecipes / limitNum) || 1 : 1,
      currentPage: usePagination ? pageNum : 1,
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
    const { page, limit } = req.query;
    const totalReports = await Report.countDocuments();

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0;

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

    if (usePagination) {
      const skip = (pageNum - 1) * limitNum;
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });
    }

    const result = await Report.aggregate(pipeline);
    res.send({
      success: true,
      data: result,
      totalReports,
      totalPages: usePagination ? Math.ceil(totalReports / limitNum) || 1 : 1,
      currentPage: usePagination ? pageNum : 1,
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
    const { page, limit } = req.query;
    const totalTransactions = await Payment.countDocuments();

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0;

    let query = Payment.find({}).sort({ paidAt: -1, createdAt: -1 });
    if (usePagination) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }

    const transactions = await query.lean();

    if (usePagination) {
      res.send({
        success: true,
        data: transactions,
        totalTransactions,
        totalPages: Math.ceil(totalTransactions / limitNum) || 1,
        currentPage: pageNum,
      });
    } else {
      res.send(transactions);
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminStats,
  getUsers,
  blockUser,
  unblockUser,
  makeUserAdmin,
  getAdminRecipes,
  deleteAdminRecipe,
  updateAdminRecipe,
  toggleFeatureRecipe,
  getAdminReports,
  dismissReport,
  getAdminTransactions,
};
