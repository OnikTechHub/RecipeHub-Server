const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { verifyAdmin } = require("../middlewares/adminMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Admin Overview & Analytics Statistics (GET /admin-stats and GET /api/admin/analytics)
router.get(
  ["/admin-stats", "/api/admin/analytics", "/admin/analytics", "/api/admin-stats"],
  optionalAuth,
  verifyAdmin,
  adminController.getAdminStats
);

// Manage Users (GET /admin/users and GET /api/admin/users)
router.get(
  ["/admin/users", "/api/admin/users"],
  optionalAuth,
  verifyAdmin,
  adminController.getUsers
);

// Manage Admins
router.get(
  ["/admin/admins", "/api/admin/admins"],
  optionalAuth,
  verifyAdmin,
  adminController.getAdmins
);

router.patch(
  ["/admin/users/block/:id", "/api/admin/users/block/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.blockUser
);

router.patch(
  ["/admin/users/unblock/:id", "/api/admin/users/unblock/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.unblockUser
);

router.patch(
  ["/admin/users/make-admin/:id", "/api/admin/users/make-admin/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.makeUserAdmin
);

// Update user role (supports both /admin/users/role/:id and /api/admin/users/:id/role)
router.patch(
  [
    "/admin/users/role/:id",
    "/api/admin/users/role/:id",
    "/admin/users/:id/role",
    "/api/admin/users/:id/role",
  ],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.updateUserRole
);

// Manage Recipes (GET, PUT, DELETE, and feature toggle)
router.get(
  ["/admin/recipes", "/api/admin/recipes"],
  optionalAuth,
  verifyAdmin,
  adminController.getAdminRecipes
);

router.delete(
  ["/admin/recipes/:id", "/api/admin/recipes/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.deleteAdminRecipe
);

router.put(
  ["/admin/recipes/:id", "/api/admin/recipes/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.updateAdminRecipe
);

router.patch(
  ["/admin/recipes/feature/:id", "/api/admin/recipes/feature/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.toggleFeatureRecipe
);

// Manage Reports (GET /admin/reports and GET /api/admin/reports)
router.get(
  ["/admin/reports", "/api/admin/reports"],
  optionalAuth,
  verifyAdmin,
  adminController.getAdminReports
);

router.delete(
  ["/admin/reports/:id", "/api/admin/reports/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  adminController.dismissReport
);

// Manage Transactions
router.get(
  ["/admin/transactions", "/api/admin/transactions"],
  optionalAuth,
  verifyAdmin,
  adminController.getAdminTransactions
);

// Manage Settings (Platform Commission & Plan Pricing)
router.get(["/pricing-plans", "/api/pricing-plans"], adminController.getPublicPricingPlans);
router.get(
  ["/admin/settings", "/api/admin/settings"],
  optionalAuth,
  verifyAdmin,
  adminController.getAdminSettings
);
router.post(
  ["/admin/settings", "/api/admin/settings"],
  optionalAuth,
  verifyAdmin,
  adminController.updateAdminSettings
);
router.get(
  ["/admin/api-analytics", "/api/admin/api-analytics"],
  optionalAuth,
  verifyAdmin,
  adminController.getAdminApiAnalytics
);

module.exports = router;
