const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global_settings",
    },
    commissionRate: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    proFoodiePrice: {
      type: Number,
      default: 9.99,
      min: 0,
    },
    proFoodieDesc: {
      type: String,
      default: "Unlock premium gourmet recipes, chef secrets, and ad-free experience.",
    },
    masterChefPrice: {
      type: Number,
      default: 19.99,
      min: 0,
    },
    masterChefDesc: {
      type: String,
      default: "Designed for professional culinary creators and restaurant chefs.",
    },
    updatedBy: {
      type: String,
      default: "admin",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "settings",
    timestamps: true,
  }
);

const Setting = mongoose.model("Setting", settingSchema);

module.exports = Setting;
