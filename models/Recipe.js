const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    recipeName: {
      type: String,
      required: [true, "Recipe name is required"],
      trim: true,
    },
    authorEmail: {
      type: String,
      required: [true, "Author email is required"],
      trim: true,
      lowercase: true,
    },
    category: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    cuisine: {
      type: String,
      default: "",
    },
    prepTime: {
      type: String,
      default: "",
    },
    recipeImage: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    likedUsers: {
      type: [String],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    featuredAt: {
      type: Date,
      default: null,
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
    collection: "recipes",
    strict: false,
    timestamps: true,
  }
);

const Recipe = mongoose.model("Recipe", recipeSchema);

module.exports = Recipe;
