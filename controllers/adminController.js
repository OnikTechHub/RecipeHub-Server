const mongoose = require("mongoose");
const User = require("../models/User");
const Recipe = require("../models/Recipe");
const Report = require("../models/Report");
const Payment = require("../models/Payment");
const Setting = require("../models/Setting");

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

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@recipehub.com";

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
 * Dynamic User Role Update (Promote / Demote)
 * Route: PATCH /admin/users/role/:id
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["admin", "user"].includes(role)) {
      return res.status(400).send({
        success: false,
        message: "Invalid role specified. Must be 'admin' or 'user'.",
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).send({
        success: false,
        message: "User not found.",
      });
    }

    if (targetUser.email === ADMIN_EMAIL || targetUser.email === "admin@recipehub.com") {
      return res.status(400).send({
        success: false,
        message: "System Root Administrator role cannot be modified or demoted.",
      });
    }

    const result = await User.updateOne(
      { _id: id },
      { $set: { role: role, updatedAt: new Date() } }
    );

    res.send({
      success: true,
      message: `User role successfully updated to ${role === "admin" ? "Administrator" : "Regular User"}.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all platform administrators
 * Route: GET /admin/admins
 */
const getAdmins = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;

    let filter = {
      $or: [
        { role: "admin" },
        { email: ADMIN_EMAIL },
        { email: "admin@recipehub.com" }
      ]
    };

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filter = {
        $and: [
          {
            $or: [
              { role: "admin" },
              { email: ADMIN_EMAIL },
              { email: "admin@recipehub.com" }
            ]
          },
          {
            $or: [
              { name: { $regex: q, $options: "i" } },
              { email: { $regex: q, $options: "i" } }
            ]
          }
        ]
      };
    }

    const totalAdmins = await User.countDocuments(filter);

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0;

    let query = User.find(filter).sort({ createdAt: -1 });
    if (usePagination) {
      const skip = (pageNum - 1) * limitNum;
      query = query.skip(skip).limit(limitNum);
    }

    const result = await query.lean();
    res.send({
      success: true,
      data: result,
      totalAdmins,
      totalPages: usePagination ? Math.ceil(totalAdmins / limitNum) || 1 : 1,
      currentPage: usePagination ? pageNum : 1,
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
/**
 * Get reports formatted for admin aggregated/grouped by recipeId
 * Route: GET /admin/reports
 */
const getAdminReports = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    // Get count of unique reported recipes
    const distinctRecipeIds = await Report.distinct("recipeId");
    const totalReports = distinctRecipeIds.length;
    const totalReportEntries = await Report.countDocuments();

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0;

    const pipeline = [
      // 1. Group all report entries by recipeId
      {
        $group: {
          _id: "$recipeId",
          recipeId: { $first: "$recipeId" },
          recipeName: { $first: "$recipeName" },
          latestReportedAt: { $max: "$reportedAt" },
          reportCount: { $sum: 1 },
          allRecipeReports: {
            $push: {
              _id: "$_id",
              reporterEmail: "$reporterEmail",
              reason: "$reason",
              details: "$details",
              reportedAt: "$reportedAt",
            },
          },
        },
      },
      // 2. Convert recipeId to ObjectId if 24-char hex string
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
      // 3. Lookup target recipe details
      {
        $lookup: {
          from: "recipes",
          localField: "convertedRecipeId",
          foreignField: "_id",
          as: "targetRecipe",
        },
      },
      // 4. Format output document
      {
        $addFields: {
          recipeInfo: { $arrayElemAt: ["$targetRecipe", 0] },
          recipeReportCount: "$reportCount",
          reporterEmail: {
            $arrayElemAt: ["$allRecipeReports.reporterEmail", 0],
          },
          reason: {
            $arrayElemAt: ["$allRecipeReports.reason", 0],
          },
          details: {
            $arrayElemAt: ["$allRecipeReports.details", 0],
          },
          reportedAt: "$latestReportedAt",
        },
      },
      { $project: { targetRecipe: 0, convertedRecipeId: 0 } },
      { $sort: { latestReportedAt: -1, _id: -1 } },
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
      totalReportEntries,
      totalPages: usePagination ? Math.ceil(totalReports / limitNum) || 1 : 1,
      currentPage: usePagination ? pageNum : 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Dismiss/delete report flag(s)
 * Route: DELETE /admin/reports/:id (id can be report _id or recipeId)
 */
const dismissReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recipeId } = req.query;

    const targetRecipeId = recipeId || id;

    // Delete all report entries for the recipe OR by single _id
    const result = await Report.deleteMany({
      $or: [{ _id: id }, { recipeId: targetRecipeId }],
    });

    res.send({
      success: true,
      message: "Report flag(s) dismissed successfully by Admin.",
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

/**
 * Get global settings (commission rate)
 * Route: GET /admin/settings
 */
const getAdminSettings = async (req, res, next) => {
  try {
    let setting = await Setting.findOne({ key: "global_settings" }).lean();
    if (!setting) {
      setting = await Setting.create({
        key: "global_settings",
        commissionRate: 20,
        updatedBy: "admin",
      });
    }
    res.send({
      success: true,
      settings: setting,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update global settings (commission rate)
 * Route: POST /admin/settings
 */
const updateAdminSettings = async (req, res, next) => {
  try {
    const { commissionRate } = req.body;
    const rate = Number(commissionRate);

    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).send({
        success: false,
        message: "Commission rate must be a number between 0 and 100",
      });
    }

    const updated = await Setting.findOneAndUpdate(
      { key: "global_settings" },
      {
        $set: {
          commissionRate: rate,
          updatedBy: req.user?.email || "admin",
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    res.send({
      success: true,
      message: `Global platform commission updated to ${rate}%!`,
      settings: updated,
    });
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
  updateUserRole,
  getAdmins,
  getAdminRecipes,
  deleteAdminRecipe,
  updateAdminRecipe,
  toggleFeatureRecipe,
  getAdminReports,
  dismissReport,
  getAdminTransactions,
  getAdminSettings,
  updateAdminSettings,
};
