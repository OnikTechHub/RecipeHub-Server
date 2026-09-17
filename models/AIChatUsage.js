const mongoose = require("mongoose");

const aiChatUsageSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    dateStr: {
      type: String,
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    collection: "ai_chat_usages",
    timestamps: true,
  }
);

aiChatUsageSchema.index({ identifier: 1, dateStr: 1 }, { unique: true });

const AIChatUsage = mongoose.model("AIChatUsage", aiChatUsageSchema);

module.exports = AIChatUsage;
