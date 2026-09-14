const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Registration OTP dispatch & verification
router.post("/api/auth/send-registration-otp", authController.sendRegistrationOtp);
router.post("/api/auth/verify-registration-otp", authController.verifyRegistrationOtp);
router.post("/api/auth/registration-success", authController.sendRegistrationSuccessNotification);

// Successful login notification dispatch
router.post("/api/auth/login-notification", authController.sendLoginNotification);

// Password reset via OTP
router.post("/api/auth/forgot-password", authController.forgotPassword);
router.post("/api/auth/reset-password", authController.resetPassword);

module.exports = router;
