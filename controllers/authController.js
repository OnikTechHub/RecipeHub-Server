const mongoose = require("mongoose");
const crypto = require("crypto");
const { hashPassword } = require("@better-auth/utils/password");
const User = require("../models/User");
const Otp = require("../models/Otp");
const {
  sendRegistrationOtpEmail,
  sendRegistrationSuccessEmail,
  sendPasswordResetOtpEmail,
  sendLoginSuccessEmail,
} = require("../services/emailService");

/**
 * Generate and send 6-digit registration OTP strictly to user's real email
 * Route: POST /api/auth/send-registration-otp
 */
const sendRegistrationOtp = async (req, res, next) => {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email address is required",
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Strict Duplicate Email Validation: Check if email is already registered
    const existingUser = await User.findByEmailWithFallback(cleanEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        isDuplicate: true,
        message: "This email is already registered. Please login or use another email.",
      });
    }

    // 2. Email is unique: Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Remove any previous registration OTP for this email
    await Otp.deleteMany({ email: cleanEmail, type: "registration" });

    // Store new OTP in database
    await Otp.create({
      email: cleanEmail,
      otp,
      type: "registration",
      expiresAt,
    });

    // Send email strictly to user's real email inbox
    await sendRegistrationOtpEmail(cleanEmail, name, otp);

    return res.status(200).json({
      success: true,
      message: "Verification code has been sent directly to your email address.",
    });
  } catch (error) {
    // If email delivery failed, purge the unverified OTP
    await Otp.deleteMany({ email: cleanEmail, type: "registration" });
    console.error("Registration email dispatch error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message.includes("SMTP")
        ? error.message
        : "Failed to deliver verification code to your email. Please check your SMTP configuration.",
    });
  }
};

/**
 * Verify registration OTP
 * Route: POST /api/auth/verify-registration-otp
 */
const verifyRegistrationOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP code are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const otpRecord = await Otp.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      type: "registration",
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP code. Please request a new one.",
      });
    }

    // OTP is valid - consume/remove it so it cannot be reused
    await Otp.deleteOne({ _id: otpRecord._id });

    // Clean up any stale duplicate records for this verified email so Better-Auth can insert the fresh user cleanly
    if (mongoose.connection.db) {
      const existingUser = await User.findByEmailWithFallback(cleanEmail);
      if (existingUser) {
        await mongoose.connection.db.collection("account").deleteMany({
          $or: [
            { userId: existingUser._id },
            { userId: existingUser._id.toString() },
            { accountId: cleanEmail },
            { accountId: existingUser._id.toString() },
          ],
        });
        await mongoose.connection.db.collection("user").deleteMany({ email: cleanEmail });
        await mongoose.connection.db.collection("users").deleteMany({ email: cleanEmail });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send security notification email after successful login
 * Route: POST /api/auth/login-notification
 */
const sendLoginNotification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findByEmailWithFallback(cleanEmail);

    // Send email strictly to user's registered inbox
    await sendLoginSuccessEmail(cleanEmail, user?.name);

    return res.status(200).json({
      success: true,
      message: "Login alert delivered to user inbox.",
    });
  } catch (error) {
    console.error("Login alert dispatch error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to dispatch login alert email.",
    });
  }
};

/**
 * Send welcome / registration success email after successful registration
 * Route: POST /api/auth/registration-success
 */
const sendRegistrationSuccessNotification = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findByEmailWithFallback(cleanEmail);

    // Send email strictly to user's registered inbox
    await sendRegistrationSuccessEmail(cleanEmail, name || user?.name);

    return res.status(200).json({
      success: true,
      message: "Registration success email delivered to user inbox.",
    });
  } catch (error) {
    console.error("Registration success email dispatch error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to dispatch registration success email.",
    });
  }
};

/**
 * Send OTP code for forgot password
 * Route: POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email address is required",
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const user = await User.findByEmailWithFallback(cleanEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No registered account found with this email address.",
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Remove previous forgot password OTP
    await Otp.deleteMany({ email: cleanEmail, type: "forgot_password" });

    // Store new OTP
    await Otp.create({
      email: cleanEmail,
      otp,
      type: "forgot_password",
      expiresAt,
    });

    // Send recovery email strictly to user's real email inbox
    await sendPasswordResetOtpEmail(cleanEmail, otp);

    return res.status(200).json({
      success: true,
      message: "Password reset code sent directly to your email address.",
    });
  } catch (error) {
    await Otp.deleteMany({ email: cleanEmail, type: "forgot_password" });
    console.error("Password reset email dispatch error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message.includes("SMTP")
        ? error.message
        : "Failed to deliver password reset code to your email. Please check your SMTP configuration.",
    });
  }
};

/**
 * Verify OTP and reset password
 * Route: POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP code, and new password are required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const otpRecord = await Otp.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      type: "forgot_password",
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code.",
      });
    }

    // Find the user
    const user = await User.findByEmailWithFallback(cleanEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found.",
      });
    }

    // Hash password with Better-Auth's exact hash format
    const hashedPassword = await hashPassword(newPassword);

    // Build flexible query matching both ObjectId and string representation of user ID
    const userIdObj = mongoose.Types.ObjectId.isValid(user._id)
      ? new mongoose.Types.ObjectId(user._id)
      : null;
    const userIdStr = user._id ? user._id.toString() : "";

    const userQueryConditions = [];
    if (userIdObj) {
      userQueryConditions.push({ userId: userIdObj });
      userQueryConditions.push({ accountId: userIdObj });
    }
    if (userIdStr) {
      userQueryConditions.push({ userId: userIdStr });
      userQueryConditions.push({ accountId: userIdStr });
    }
    userQueryConditions.push({ accountId: cleanEmail });

    // Update or link credential account in Better-Auth account collection
    const accountCollection = mongoose.connection.db.collection("account");
    
    // First check for an existing credential account
    let existingCredentialAccount = await accountCollection.findOne({
      $or: userQueryConditions,
      providerId: "credential",
    });

    if (existingCredentialAccount) {
      await accountCollection.updateOne(
        { _id: existingCredentialAccount._id },
        {
          $set: {
            password: hashedPassword,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // If user signed up with Google OAuth or hasn't got a credential record yet, link one
      await accountCollection.insertOne({
        accountId: userIdStr,
        providerId: "credential",
        userId: userIdObj || userIdStr,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Delete used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendRegistrationOtp,
  verifyRegistrationOtp,
  sendRegistrationSuccessNotification,
  sendLoginNotification,
  forgotPassword,
  resetPassword,
};
