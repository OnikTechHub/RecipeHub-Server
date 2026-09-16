const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { verifyAdmin } = require("../middlewares/adminMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Submit a recipe report (Public / Authenticated)
router.post(
  ["/reports", "/api/reports"],
  optionalAuth,
  reportController.createReport
);

// Get all reports (Admin protected)
router.get(
  ["/reports", "/api/reports"],
  optionalAuth,
  verifyAdmin,
  reportController.getAllReports
);

// Delete report with optional recipe cascade (Admin protected)
router.delete(
  ["/reports/:id", "/api/reports/:id"],
  validateObjectId("id"),
  optionalAuth,
  verifyAdmin,
  reportController.deleteReport
);

module.exports = router;
