const express = require("express");
const router = express.Router();

const userRoutes = require("./userRoutes");
const recipeRoutes = require("./recipeRoutes");
const paymentRoutes = require("./paymentRoutes");
const favoriteRoutes = require("./favoriteRoutes");
const reportRoutes = require("./reportRoutes");
const adminRoutes = require("./adminRoutes");
const authRoutes = require("./authRoutes");
const contactRoutes = require("./contactRoutes");
const aiRoutes = require("./aiRoutes");
const testimonialRoutes = require("./testimonialRoutes");

// Mount all modular routes
router.use(userRoutes);
router.use(recipeRoutes);
router.use(paymentRoutes);
router.use(favoriteRoutes);
router.use(reportRoutes);
router.use(adminRoutes);
router.use(authRoutes);
router.use(contactRoutes);
router.use(aiRoutes);
router.use(testimonialRoutes);

module.exports = router;
