const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Recipe = require("../models/Recipe");

// Lazy initialize Stripe instance with environment secret
const getStripe = () => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY is not defined in .env");
  }
  return require("stripe")(stripeKey);
};

/**
 * Create Stripe Checkout Session
 * Route: POST /create-checkout-session
 */
const createCheckoutSession = async (req, res, next) => {
  try {
    const { recipeId, title, image, price, userEmail, userId } = req.body;

    if (!title || price === undefined || price === null) {
      return res.status(400).send({
        success: false,
        message: "Missing title or price",
      });
    }

    const clientOrigin = process.env.CLIENT_URL;
    if (!clientOrigin) {
      return res.status(500).send({
        success: false,
        message: "CLIENT_URL is missing in environment variables (.env)",
      });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: title,
              images: image ? [image] : [],
            },
            unit_amount: Math.round(Number(price) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        recipeId: recipeId || "membership_upgrade",
        userEmail: userEmail,
        userId: userId || "N/A",
      },
      success_url: `${clientOrigin}/dashboard/purchased-recipes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientOrigin}/browse-recipes`,
    });

    res.send({
      success: true,
      id: session.id,
      url: session.url,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify payment after Stripe redirect
 * Route: POST /verify-payment
 */
const verifyPayment = async (req, res, next) => {
  try {
    const { sessionId, userId } = req.body;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === "paid") {
      const existingPayment = await Payment.findOne({
        transactionId: session.payment_intent,
      });

      if (existingPayment) {
        return res.send({
          success: true,
          message: "Payment already processed",
        });
      }

      const paymentData = {
        userEmail: session.metadata.userEmail,
        userId: userId || session.metadata.userId || "N/A",
        amount: session.amount_total / 100,
        recipeId: session.metadata.recipeId,
        transactionId: session.payment_intent,
        paymentStatus: "paid",
        paidAt: new Date(),
      };

      const result = await Payment.create(paymentData);

      if (session.metadata.recipeId === "membership_upgrade") {
        await User.updateOne(
          { email: session.metadata.userEmail },
          { $set: { isPremium: true, updatedAt: new Date() } }
        );
      }

      return res.send({
        success: true,
        insertedId: result._id,
      });
    }

    res.status(400).send({
      success: false,
      message: "Payment status unverified",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user transaction history with joined recipe details
 * Route: GET /transactions?email=...
 */
const getTransactions = async (req, res, next) => {
  try {
    const userEmail = req.query.email;
    let matchStage = {};
    if (userEmail) {
      matchStage = { userEmail: userEmail };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $addFields: {
          convertedRecipeId: {
            $cond: {
              if: { $eq: ["$recipeId", "membership_upgrade"] },
              then: null,
              else: {
                $cond: {
                  if: {
                    $regexMatch: {
                      input: "$recipeId",
                      regex: /^[0-9a-fA-F]{24}$/,
                    },
                  },
                  then: { $toObjectId: "$recipeId" },
                  else: "$recipeId",
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "recipes",
          localField: "convertedRecipeId",
          foreignField: "_id",
          as: "recipeDetails",
        },
      },
      {
        $addFields: {
          recipeInfo: { $arrayElemAt: ["$recipeDetails", 0] },
        },
      },
      {
        $project: {
          recipeDetails: 0,
          convertedRecipeId: 0,
        },
      },
      { $sort: { paidAt: -1 } },
    ];

    const result = await Payment.aggregate(pipeline);
    res.send({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get purchased details for a specific recipe
 * Route: GET /purchased-details/:id?email=...
 */
const getPurchasedDetails = async (req, res, next) => {
  try {
    const id = req.params.id; // recipeId
    const email = req.query.email;

    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email query parameter is required!",
      });
    }

    const paymentRecord = await Payment.findOne({
      recipeId: id,
      userEmail: email,
    });

    if (!paymentRecord) {
      return res.status(404).send({
        success: false,
        message: "Purchase history not found in database!",
      });
    }

    const recipeRecord = await Recipe.findOne({
      _id: mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id,
    });

    res.send({
      success: true,
      message: "Purchase and Recipe verified successfully!",
      data: {
        transactionId: paymentRecord.transactionId,
        userEmail: paymentRecord.userEmail,
        amount: paymentRecord.amount,
        paidAt: paymentRecord.paidAt || paymentRecord.createdAt,
        recipeImage: recipeRecord?.recipeImage || recipeRecord?.image || null,
        likesCount: recipeRecord?.likesCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Payment success webhook for membership upgrades
 * Route: POST /api/payment-success-webhook
 */
const paymentSuccessWebhook = async (req, res, next) => {
  try {
    const session = req.body;
    const userEmail = session?.userEmail || session?.metadata?.userEmail;
    const transactionId = session?.id || session?.payment_intent;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: "Missing user email",
      });
    }

    const existingPayment = await Payment.findOne({ transactionId });
    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: "Already processed",
      });
    }

    await Payment.create({
      userEmail,
      recipeId: "membership_upgrade",
      title: "RecipeHub Pro Premium Membership",
      price: 19.99,
      amount: 19.99,
      transactionId,
      paymentStatus: "paid",
      paidAt: new Date(),
    });

    await User.updateOne(
      { email: userEmail },
      {
        $set: {
          isPremium: true,
          role: "premium",
          updatedAt: new Date(),
        },
      }
    );

    console.log(`User ${userEmail} successfully upgraded to Premium!`);
    return res.status(200).json({
      success: true,
      message: "Membership upgraded successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCheckoutSession,
  verifyPayment,
  getTransactions,
  getPurchasedDetails,
  paymentSuccessWebhook,
};
