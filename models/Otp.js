const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    otp: {
      type: String,
      required: [true, "OTP is required"],
    },
    type: {
      type: String,
      enum: ["registration", "forgot_password"],
      default: "registration",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically deleted by MongoDB after expiration
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "otps",
    timestamps: true,
  }
);

const Otp = mongoose.model("Otp", otpSchema);

module.exports = Otp;
