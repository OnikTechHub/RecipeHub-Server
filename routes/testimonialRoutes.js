const express = require("express");
const router = express.Router();
const {
  getFeaturedTestimonials,
  getAllReviewsAdmin,
  toggleFeatureReview,
} = require("../controllers/testimonialController");
const { optionalAuth } = require("../middlewares/authMiddleware");
const { verifyAdmin } = require("../middlewares/adminMiddleware");

// Public API: Get testimonials (supports /api/testimonials, /testimonials, and /testimonials/featured)
router.get(
  ["/api/testimonials", "/testimonials", "/api/testimonials/featured", "/testimonials/featured"],
  getFeaturedTestimonials
);

// Admin APIs: Manage and feature reviews
router.get(
  ["/api/admin/reviews", "/admin/reviews"],
  optionalAuth,
  verifyAdmin,
  getAllReviewsAdmin
);

router.patch(
  ["/api/admin/reviews/toggle-feature", "/admin/reviews/toggle-feature"],
  optionalAuth,
  verifyAdmin,
  toggleFeatureReview
);

module.exports = router;
