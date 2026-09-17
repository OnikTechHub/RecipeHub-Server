const express = require("express");
const router = express.Router();
const recipeController = require("../controllers/recipeController");
const reportController = require("../controllers/reportController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Public home page stats & category counts
router.get(["/public-stats", "/api/public-stats"], recipeController.getPublicHomeStats);

// Featured recipes
router.get(["/featured-recipes", "/api/featured-recipes"], optionalAuth, recipeController.getFeaturedRecipes);

// User-authored recipes
router.get(["/my-recipes", "/api/my-recipes"], optionalAuth, recipeController.getMyRecipes);

// Recipe count by author
router.get(["/recipes-count", "/api/recipes-count"], optionalAuth, recipeController.getRecipesCount);

// Recipe list with search and filters (GET /recipes and GET /api/recipes)
router.get(["/recipes", "/api/recipes"], optionalAuth, recipeController.getAllRecipes);

// Single recipe by ID (GET /recipes/:id and GET /api/recipes/:id)
router.get(["/recipes/:id", "/api/recipes/:id"], validateObjectId("id"), optionalAuth, recipeController.getRecipeById);

// Check access status for recipe
router.get(["/recipes/:id/access", "/api/recipes/:id/access"], validateObjectId("id"), optionalAuth, recipeController.checkRecipeAccess);

// Create recipe (POST /recipes and POST /api/recipes)
router.post(["/recipes", "/api/recipes"], optionalAuth, recipeController.createRecipe);

// Submit recipe rating & review
router.post(["/recipes/:id/reviews", "/api/recipes/:id/reviews"], validateObjectId("id"), optionalAuth, recipeController.addRecipeReview);

// Toggle recipe like (PATCH /recipes/:id/like and PATCH /api/recipes/:id/like)
router.patch(["/recipes/:id/like", "/api/recipes/:id/like"], validateObjectId("id"), optionalAuth, recipeController.toggleLike);

// Submit recipe report (POST /recipes/:id/report and POST /api/recipes/:id/report)
router.post(["/recipes/:id/report", "/api/recipes/:id/report"], validateObjectId("id"), optionalAuth, (req, res, next) => {
  req.body.recipeId = req.params.id;
  reportController.createReport(req, res, next);
});

// Update recipe (PUT/PATCH /recipes/:id and PUT/PATCH /api/recipes/:id)
router.put(["/recipes/:id", "/api/recipes/:id"], validateObjectId("id"), optionalAuth, recipeController.updateRecipe);
router.patch(["/recipes/:id", "/api/recipes/:id"], validateObjectId("id"), optionalAuth, recipeController.updateRecipe);

// Delete recipe (DELETE /recipes/:id and DELETE /api/recipes/:id)
router.delete(["/recipes/:id", "/api/recipes/:id"], validateObjectId("id"), optionalAuth, recipeController.deleteRecipe);

module.exports = router;
