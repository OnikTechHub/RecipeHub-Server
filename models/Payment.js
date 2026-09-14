const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userEmail: {
      type: String,
      required: [true, "User email is required"],
      trim: true,
      lowercase: true,
    },
    userId: {
      type: String,
      default: "N/A",
    },
    amount: {
      type: Number,
      required: true,
    },
    recipeId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: "",
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentStatus: {
      type: String,
      default: "paid",
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "payments",
    strict: false,
    timestamps: true,
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
