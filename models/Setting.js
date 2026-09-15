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
