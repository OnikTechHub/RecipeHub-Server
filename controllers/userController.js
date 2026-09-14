const mongoose = require("mongoose");
const User = require("../models/User");
const Recipe = require("../models/Recipe");
const Favorite = require("../models/Favorite");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@recipehub.com";

/**
 * Check user role and blocked status
 * Route: GET /check-user-role?email=...
 */
const checkUserRole = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email parameter is required",
      });
    }

    const user = await User.findByEmailWithFallback(email);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found in database",
      });
    }

    let finalRole = user.role || "user";
    if (email === ADMIN_EMAIL) {
      finalRole = "admin";
    }

    if (user.isBlocked === true && finalRole !== "admin") {
      return res.send({
        success: true,
        isBlocked: true,
        message: "This account has been blocked by the Administrator.",
      });
    }

    res.send({
      success: true,
      isBlocked: false,
      data: {
        role: finalRole,
        isPremium: user.isPremium || false,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user status (isPremium)
 * Route: GET /api/user/status?email=...
 */
const getUserStatus = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findByEmailWithFallback(email);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).send({
      success: true,
      isPremium: user.isPremium || false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile name and image
 * Route: PUT /api/user/update
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const { email, name, image } = req.body;
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email is required",
      });
    }

    const filter = {
      email: { $regex: `^${email.trim()}$`, $options: "i" },
    };

    const updateDoc = {
      $set: {
        name: name ? name.trim() : "",
        image: image ? image.trim() : "",
        updatedAt: new Date(),
      },
    };

    const result = await User.updateOne(filter, updateDoc);

    if (result.matchedCount === 0 && mongoose.connection.db) {
      const backupResult = await mongoose.connection.db
        .collection("users")
        .updateOne(filter, updateDoc);

      if (backupResult.matchedCount === 0) {
        return res.status(404).send({
          success: false,
          message: "User not found in any collection",
        });
      }
    }

    return res.status(200).send({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by email
 * Route: GET /users/:email
 */
const getUserByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;
    const user = await User.findByEmailWithFallback(email);
    res.send({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard overview statistics for regular user
 * Route: GET /user-stats?email=...
 */
const getUserStats = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email query parameter is required",
      });
    }

    const totalRecipes = await Recipe.countDocuments({ authorEmail: email });
    const totalFavorites = await Favorite.countDocuments({ userEmail: email });

    const recipes = await Recipe.find({ authorEmail: email }).lean();
    const totalLikesReceived = recipes.reduce(
      (sum, r) => sum + (r.likesCount || 0),
      0
    );

    res.send({
      success: true,
      data: {
        totalRecipes,
        totalFavorites,
        totalLikesReceived,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkUserRole,
  getUserStatus,
  updateUserProfile,
  getUserByEmail,
  getUserStats,
};
