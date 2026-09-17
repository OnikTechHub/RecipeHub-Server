const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authRateLimiter } = require("../middlewares/rateLimitMiddleware");

// SMTP Diagnostic health check endpoint
router.get(
  ["/api/auth/test-smtp", "/auth/test-smtp"],
  authController.testSmtpConnection
);

// Registration OTP dispatch & verification (Rate limited to prevent abuse)
router.post(
  ["/api/auth/send-registration-otp", "/auth/send-registration-otp"],
  authRateLimiter,
  authController.sendRegistrationOtp
);

router.post(
  ["/api/auth/verify-registration-otp", "/auth/verify-registration-otp"],
  authRateLimiter,
  authController.verifyRegistrationOtp
);

router.post(
  ["/api/auth/registration-success", "/auth/registration-success"],
  authController.sendRegistrationSuccessNotification
);

// Successful login notification dispatch
router.post(
  ["/api/auth/login-notification", "/auth/login-notification"],
  authController.sendLoginNotification
);

// Password reset via OTP (Rate limited)
router.post(
  ["/api/auth/forgot-password", "/auth/forgot-password"],
  authRateLimiter,
  authController.forgotPassword
);

router.post(
  ["/api/auth/reset-password", "/auth/reset-password"],
  authRateLimiter,
  authController.resetPassword
);

module.exports = router;
