const mongoose = require("mongoose");
const Recipe = require("../models/Recipe");
const User = require("../models/User");

// Fallback curated seed testimonials if no reviews are featured in DB yet
const DEFAULT_TESTIMONIALS = [
  {
    _id: "default_1",
    userName: "Samantha Reed",
    userEmail: "samantha@recipehub.com",
    userImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    comment: "RecipeHub changed how I cook at home! The step-by-step instructions and secret ingredients save me so much time in the kitchen every single day.",
    recipeName: "Gourmet Home Cooking",
    isFeatured: true,
    verified: true,
  },
  {
    _id: "default_2",
    userName: "Marcus Vance",
    userEmail: "marcus@recipehub.com",
    userImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    comment: "Unlocking Pro Foodie recipes was the best decision! The Beef Wellington guide came out to perfection on my first try. My guests were completely blown away.",
    recipeName: "Classic Beef Wellington",
    isFeatured: true,
    verified: true,
  },
  {
    _id: "default_3",
    userName: "Chef David Chen",
    userEmail: "david@recipehub.com",
    userImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    comment: "As a professional creator, RecipeHub gives me the platform to publish my dessert guides and connect directly with food lovers globally. The UI is world-class.",
    recipeName: "Lava Chocolate Cake",
    isFeatured: true,
    verified: true,
  },
];

/**
 * Get Featured Testimonials for Homepage
 * Route: GET /api/testimonials/featured
 */
const getFeaturedTestimonials = async (req, res, next) => {
  try {
    const recipes = await Recipe.find({
      "reviews.isFeatured": true,
    }).lean();

    const featuredList = [];

    recipes.forEach((recipe) => {
      if (Array.isArray(recipe.reviews)) {
        recipe.reviews.forEach((review) => {
          if (review.isFeatured) {
            featuredList.push({
              _id: review._id ? review._id.toString() : `${recipe._id}_${review.userEmail}`,
              recipeId: recipe._id.toString(),
              recipeName: recipe.recipeName || "Recipe Creation",
              recipeImage: recipe.recipeImage || recipe.image || "",
              userName: review.userName || "Valued Foodie",
              userEmail: review.userEmail || "",
              userImage: review.userImage || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + encodeURIComponent(review.userName || "Foodie"),
              rating: Number(review.rating) || 5,
              comment: review.comment || "",
              isFeatured: true,
              verified: true,
              createdAt: review.createdAt || recipe.createdAt,
            });
          }
        });
      }
    });

    // If admin has featured real customer reviews, return those; otherwise fallback to default seed testimonials
    const result = featuredList.length > 0 ? featuredList : DEFAULT_TESTIMONIALS;

    res.send({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching featured testimonials:", error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch featured testimonials.",
      data: DEFAULT_TESTIMONIALS,
    });
  }
};

/**
 * Get All Reviews Across Platform for Admin Management
 * Route: GET /api/admin/reviews
 */
const getAllReviewsAdmin = async (req, res, next) => {
  try {
    const recipes = await Recipe.find({
      "reviews.0": { $exists: true },
    }).lean();

    const allReviews = [];

    recipes.forEach((recipe) => {
      if (Array.isArray(recipe.reviews)) {
        recipe.reviews.forEach((review) => {
          allReviews.push({
            _id: review._id ? review._id.toString() : `${recipe._id}_${review.userEmail}`,
            reviewId: review._id ? review._id.toString() : null,
            recipeId: recipe._id.toString(),
            recipeName: recipe.recipeName || "Recipe",
            recipeImage: recipe.recipeImage || recipe.image || "",
            userName: review.userName || "Anonymous Foodie",
            userEmail: review.userEmail || "",
            userImage: review.userImage || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + encodeURIComponent(review.userName || "Foodie"),
            rating: Number(review.rating) || 5,
            comment: review.comment || "",
            isFeatured: Boolean(review.isFeatured),
            createdAt: review.createdAt || new Date(),
          });
        });
      }
    });

    // Sort descending by created date
    allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.send({
      success: true,
      totalReviews: allReviews.length,
      data: allReviews,
    });
  } catch (error) {
    console.error("Error fetching admin reviews:", error);
    next(error);
  }
};

/**
 * Toggle Feature Status of a Review
 * Route: PATCH /api/admin/reviews/toggle-feature
 */
const toggleFeatureReview = async (req, res, next) => {
  try {
    const { recipeId, reviewId, userEmail, isFeatured } = req.body;

    if (!recipeId) {
      return res.status(400).send({
        success: false,
        message: "Recipe ID is required.",
      });
    }

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).send({
        success: false,
        message: "Recipe not found.",
      });
    }

    if (!Array.isArray(recipe.reviews) || recipe.reviews.length === 0) {
      return res.status(404).send({
        success: false,
        message: "No reviews found for this recipe.",
      });
    }

    let found = false;

    recipe.reviews = recipe.reviews.map((r) => {
      const matchById = reviewId && r._id && r._id.toString() === reviewId.toString();
      const matchByEmail = userEmail && r.userEmail && r.userEmail.toLowerCase() === userEmail.toLowerCase();

      if (matchById || matchByEmail) {
        found = true;
        return {
          ...r,
          isFeatured: Boolean(isFeatured),
        };
      }
      return r;
    });

    if (!found) {
      return res.status(404).send({
        success: false,
        message: "Target review not found in recipe.",
      });
    }

    recipe.markModified("reviews");
    await recipe.save();

    res.send({
      success: true,
      isFeatured: Boolean(isFeatured),
      message: Boolean(isFeatured)
        ? "Review successfully featured on the Homepage!"
        : "Review removed from Homepage featured testimonials.",
    });
  } catch (error) {
    console.error("Error toggling review feature status:", error);
    next(error);
  }
};

module.exports = {
  getFeaturedTestimonials,
  getAllReviewsAdmin,
  toggleFeatureReview,
};
