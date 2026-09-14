const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    recipeId: {
      type: String,
      required: [true, "Recipe ID is required"],
    },
    userEmail: {
      type: String,
      required: [true, "User email is required"],
      trim: true,
      lowercase: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "favorites",
    strict: false,
    timestamps: true,
  }
);

// Prevent duplicate favorite entries for the same user and recipe
favoriteSchema.index({ recipeId: 1, userEmail: 1 }, { unique: true });

const Favorite = mongoose.model("Favorite", favoriteSchema);

module.exports = Favorite;
