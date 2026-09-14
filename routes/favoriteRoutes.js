const express = require("express");
const router = express.Router();
const favoriteController = require("../controllers/favoriteController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Add to favorites
router.post("/favorites", optionalAuth, favoriteController.addFavorite);

// Get favorites for user
router.get("/favorites", optionalAuth, favoriteController.getFavorites);

// Remove from favorites by ID
router.delete("/favorites/:id", validateObjectId("id"), optionalAuth, favoriteController.deleteFavorite);

module.exports = router;
