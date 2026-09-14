const express = require("express");
const router = express.Router();
const recipeController = require("../controllers/recipeController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Featured recipes
router.get("/featured-recipes", optionalAuth, recipeController.getFeaturedRecipes);

// User-authored recipes
router.get("/my-recipes", optionalAuth, recipeController.getMyRecipes);

// Recipe count by author
router.get("/recipes-count", optionalAuth, recipeController.getRecipesCount);

// Recipe list with search and filters
router.get("/recipes", optionalAuth, recipeController.getAllRecipes);

// Single recipe by ID
router.get("/recipes/:id", validateObjectId("id"), optionalAuth, recipeController.getRecipeById);

// Create recipe
router.post("/recipes", optionalAuth, recipeController.createRecipe);

// Toggle recipe like
router.patch("/recipes/:id/like", validateObjectId("id"), optionalAuth, recipeController.toggleLike);

// Update recipe
router.patch("/recipes/:id", validateObjectId("id"), optionalAuth, recipeController.updateRecipe);

// Delete recipe
router.delete("/recipes/:id", validateObjectId("id"), optionalAuth, recipeController.deleteRecipe);

module.exports = router;
