const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { optionalAuth } = require("../middlewares/authMiddleware");

// Role & Block status check
router.get(
  ["/check-user-role", "/api/check-user-role"],
  optionalAuth,
  userController.checkUserRole
);

// User status (Premium check for profile)
router.get(
  ["/api/user/status", "/user/status"],
  optionalAuth,
  userController.getUserStatus
);

// Update user profile name and image
router.put(
  ["/api/user/update", "/user/update"],
  optionalAuth,
  userController.updateUserProfile
);

// Get user profile details by email
router.get(
  ["/users/:email", "/api/users/:email"],
  optionalAuth,
  userController.getUserByEmail
);

// User dashboard overview statistics
router.get(
  ["/user-stats", "/api/user-stats"],
  optionalAuth,
  userController.getUserStats
);

module.exports = router;
