const express = require("express");
const router = express.Router();
const {
  getFeaturedTestimonials,
  getAllReviewsAdmin,
  toggleFeatureReview,
} = require("../controllers/testimonialController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { verifyAdmin } = require("../middlewares/adminMiddleware");

// Public API: Get featured testimonials for Homepage
router.get("/api/testimonials/featured", getFeaturedTestimonials);
router.get("/testimonials/featured", getFeaturedTestimonials);

// Admin APIs: Manage and feature reviews
router.get("/api/admin/reviews", optionalAuth, verifyAdmin, getAllReviewsAdmin);
router.get("/admin/reviews", optionalAuth, verifyAdmin, getAllReviewsAdmin);
router.patch("/api/admin/reviews/toggle-feature", optionalAuth, verifyAdmin, toggleFeatureReview);
router.patch("/admin/reviews/toggle-feature", optionalAuth, verifyAdmin, toggleFeatureReview);

module.exports = router;
