const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    image: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "admin", "premium"],
      default: "user",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "user",
    strict: false,
    timestamps: true,
  }
);

// Fallback search to handle cases where Better-Auth might use 'users' collection
userSchema.statics.findByEmailWithFallback = async function (email) {
  if (!email) return null;
  const regexEmail = new RegExp(`^${email.trim()}$`, "i");
  let user = await this.findOne({ email: regexEmail });
  if (!user && mongoose.connection.db) {
    user = await mongoose.connection.db.collection("users").findOne({ email: regexEmail });
  }
  return user;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
