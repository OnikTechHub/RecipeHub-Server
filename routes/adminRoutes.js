const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { verifyAdmin } = require("../middlewares/adminMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Admin Overview Statistics
router.get("/admin-stats", optionalAuth, verifyAdmin, adminController.getAdminStats);

// Manage Users
router.get("/admin/users", optionalAuth, verifyAdmin, adminController.getUsers);
router.patch(
  "/admin/users/block/:id",
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.blockUser
);
router.patch(
  "/admin/users/unblock/:id",
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.unblockUser
);
router.patch(
  "/admin/users/make-admin/:id",
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.makeUserAdmin
);

// Manage Recipes
router.get("/admin/recipes", optionalAuth, verifyAdmin, adminController.getAdminRecipes);
router.delete(
  "/admin/recipes/:id",
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.deleteAdminRecipe
);
router.put(
  "/admin/recipes/:id",
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.updateAdminRecipe
);
router.patch(
  "/admin/recipes/feature/:id",
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.toggleFeatureRecipe
);

// Manage Reports
router.get("/admin/reports", optionalAuth, verifyAdmin, adminController.getAdminReports);
router.delete(
  "/admin/reports/:id",
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.dismissReport
);

// Manage Transactions
router.get("/admin/transactions", optionalAuth, verifyAdmin, adminController.getAdminTransactions);

module.exports = router;
