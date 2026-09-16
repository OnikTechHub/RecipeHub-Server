const express = require("express");
const router = express.Router();
const favoriteController = require("../controllers/favoriteController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Add to favorites (POST /favorites and POST /api/favorites)
router.post(
  ["/favorites", "/api/favorites"],
  optionalAuth,
  favoriteController.addFavorite
);

// Get favorites for user (GET /favorites and GET /api/favorites)
router.get(
  ["/favorites", "/api/favorites"],
  optionalAuth,
  favoriteController.getFavorites
);

// Remove from favorites by ID (DELETE /favorites/:id and DELETE /api/favorites/:id)
router.delete(
  ["/favorites/:id", "/api/favorites/:id"],
  validateObjectId("id"),
  optionalAuth,
  favoriteController.deleteFavorite
);

module.exports = router;
