const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { validateObjectId } = require("../middlewares/validateMiddleware");

// Submit a recipe report
router.post("/reports", optionalAuth, reportController.createReport);

// Get all reports (with populated recipe details)
router.get("/reports", optionalAuth, reportController.getAllReports);

// Delete report with optional recipe cascade
router.delete("/reports/:id", validateObjectId("id"), optionalAuth, reportController.deleteReport);

module.exports = router;
