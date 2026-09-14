const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    recipeId: {
      type: String,
      required: [true, "Recipe ID is required"],
    },
    recipeName: {
      type: String,
      default: "Unknown Recipe",
    },
    reporterEmail: {
      type: String,
      default: "Anonymous",
      trim: true,
      lowercase: true,
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
    },
    details: {
      type: String,
      default: "",
    },
    reportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "reports",
    strict: false,
    timestamps: true,
  }
);

const Report = mongoose.model("Report", reportSchema);

module.exports = Report;
