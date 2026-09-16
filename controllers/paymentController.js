const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Recipe = require("../models/Recipe");
const Setting = require("../models/Setting");

// Helper: fetch dynamic platform commission rate (%) from settings DB
const getCommissionRate = async () => {
  try {
    const setting = await Setting.findOne({ key: "global_settings" }).lean();
    if (setting && typeof setting.commissionRate === "number") {
      return setting.commissionRate;
    }
  } catch (err) {
    console.error("Error reading commission rate setting:", err.message);
  }
  return 20; // Default 20%
};

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
    const { items, recipeId, title, image, price, userEmail, email, userId } = req.body;

    const clientOrigin = process.env.CLIENT_URL || "http://localhost:3000";
    const targetEmail = (userEmail || email || req.user?.email || "").trim().toLowerCase();

    // Block purchase for Admin users (Admins have lifetime free access to all recipes)
    if (targetEmail) {
      const userDoc = await User.findByEmailWithFallback(targetEmail);
      const adminEmailEnv = (process.env.ADMIN_EMAIL || "admin@recipehub.com").toLowerCase();
      if (
        targetEmail === adminEmailEnv ||
        targetEmail === "admin@recipehub.com" ||
        (userDoc && userDoc.role === "admin") ||
        req.user?.role === "admin"
      ) {
        return res.status(400).send({
          success: false,
          message: "As an Administrator, you have full free lifetime access to all recipes. Purchases are disabled for admins.",
        });
      }
    }

    // Multi-item Cart Checkout
    if (Array.isArray(items) && items.length > 0) {
      const lineItems = items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.recipeName || item.title || "Premium Recipe",
            images: item.image ? [item.image] : [],
          },
          unit_amount: Math.round(Number(item.price || 5) * 100),
        },
        quantity: 1,
      }));

      const cartItemsPayload = items.map((item) => ({
        recipeId: item._id || item.recipeId,
        title: item.recipeName || item.title || "Premium Recipe",
        price: Number(item.price || 5),
        creatorEmail: (item.authorEmail || item.creatorEmail || "").toLowerCase(),
      }));

      const sessionConfig = {
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        metadata: {
          isCartCheckout: "true",
          userEmail: targetEmail,
          userId: userId || "N/A",
          cartItemsJson: JSON.stringify(cartItemsPayload),
        },
        success_url: `${clientOrigin}/dashboard/purchased-recipes?session_id={CHECKOUT_SESSION_ID}&cart_cleared=true`,
        cancel_url: `${clientOrigin}/browse-recipes`,
      };

      if (targetEmail) {
        sessionConfig.customer_email = targetEmail;
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create(sessionConfig);

      return res.send({
        success: true,
        id: session.id,
        url: session.url,
      });
    }

    // Single Item Checkout
    if (!title || price === undefined || price === null) {
      return res.status(400).send({
        success: false,
        message: "Missing title or price",
      });
    }

    let finalTitle = title;
    let finalPrice = Number(price);
    let creatorEmail = "";
    let isPaidRecipe = false;

    if (recipeId && recipeId !== "membership_upgrade") {
      isPaidRecipe = true;
      const targetRecipe = await Recipe.findById(recipeId).lean();
      if (targetRecipe) {
        finalTitle = targetRecipe.recipeName || title;
        finalPrice = Number(targetRecipe.price) || finalPrice || 5;
        creatorEmail = (targetRecipe.authorEmail || "").toLowerCase();
      }
    }

    // Dynamic Revenue breakdown based on global commission setting (%)
    const commissionRate = await getCommissionRate();
    const commissionFraction = commissionRate / 100;
    let creatorAmount = 0;
    let adminAmount = finalPrice;
    if (isPaidRecipe && creatorEmail) {
      adminAmount = Number((finalPrice * commissionFraction).toFixed(2));
      creatorAmount = Number((finalPrice - adminAmount).toFixed(2));
    }

    const sessionConfig = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: finalTitle,
              images: image ? [image] : [],
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        recipeId: recipeId || "membership_upgrade",
        title: finalTitle,
        userEmail: targetEmail,
        userId: userId || "N/A",
        creatorEmail: creatorEmail,
        creatorEarnings: String(creatorAmount),
        adminEarnings: String(adminAmount),
        isPaidRecipe: isPaidRecipe ? "true" : "false",
      },
      success_url: `${clientOrigin}/dashboard/purchased-recipes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientOrigin}/browse-recipes`,
    };

    if (targetEmail) {
      sessionConfig.customer_email = targetEmail;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(sessionConfig);

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
      const userEmail = (session.metadata.userEmail || "").toLowerCase();

      // Multi-item Cart Checkout Verification
      if (session.metadata.isCartCheckout === "true" && session.metadata.cartItemsJson) {
        const cartItems = JSON.parse(session.metadata.cartItemsJson);
        const createdPayments = [];
        const commissionRate = await getCommissionRate();
        const commissionFraction = commissionRate / 100;

        for (let i = 0; i < cartItems.length; i++) {
          const item = cartItems[i];
          const txId = `${session.payment_intent}_${item.recipeId || i}`;

          const existing = await Payment.findOne({ transactionId: txId });
          if (existing) continue;

          const itemPrice = Number(item.price || 5);
          let creatorEarnings = 0;
          let adminEarnings = itemPrice;

          if (item.creatorEmail) {
            adminEarnings = Number((itemPrice * commissionFraction).toFixed(2));
            creatorEarnings = Number((itemPrice - adminEarnings).toFixed(2));
          }

          const paymentRecord = await Payment.create({
            userEmail,
            userId: userId || session.metadata.userId || "N/A",
            amount: itemPrice,
            recipeId: item.recipeId,
            title: item.title || "Premium Recipe",
            creatorEmail: item.creatorEmail || "",
            creatorEarnings,
            adminEarnings,
            isPaidRecipe: true,
            transactionId: txId,
            paymentStatus: "paid",
            paidAt: new Date(),
          });
          createdPayments.push(paymentRecord);
        }

        return res.send({
          success: true,
          message: "Cart items processed successfully",
          count: createdPayments.length,
        });
      }

      // Single Item Verification
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
        userEmail: (session.metadata.userEmail || "").toLowerCase(),
        userId: userId || session.metadata.userId || "N/A",
        amount: session.amount_total / 100,
        recipeId: session.metadata.recipeId,
        title: session.metadata.title || "Premium Recipe Access",
        creatorEmail: (session.metadata.creatorEmail || "").toLowerCase(),
        creatorEarnings: Number(session.metadata.creatorEarnings || 0),
        adminEarnings: Number(session.metadata.adminEarnings || 0),
        isPaidRecipe: session.metadata.isPaidRecipe === "true",
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
 * Get IDs of all paid recipes purchased by a user
 * Route: GET /user-purchased-ids?email=...
 */
const getUserPurchasedRecipeIds = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email || !email.trim()) {
      return res.send({ success: true, purchasedRecipeIds: [] });
    }
    const cleanEmail = email.trim().toLowerCase();
    const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const emailRegex = new RegExp("^" + escapeRegex(cleanEmail) + "$", "i");

    const payments = await Payment.find({
      userEmail: emailRegex,
      paymentStatus: { $ne: "failed" },
    }).select("recipeId items").lean();

    const purchasedSet = new Set();
    payments.forEach((p) => {
      if (p.recipeId) purchasedSet.add(p.recipeId.toString());
      if (Array.isArray(p.items)) {
        p.items.forEach((item) => {
          if (item.recipeId) purchasedSet.add(item.recipeId.toString());
          if (item._id) purchasedSet.add(item._id.toString());
        });
      }
    });

    // Also include user authored / created recipe IDs
    const userAuthored = await Recipe.find({
      $or: [
        { authorEmail: emailRegex },
        { userEmail: emailRegex },
        { email: emailRegex },
      ],
    }).select("_id").lean();

    userAuthored.forEach((r) => {
      if (r && r._id) purchasedSet.add(r._id.toString());
    });

    res.send({
      success: true,
      purchasedRecipeIds: Array.from(purchasedSet),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user transaction history with joined recipe details, LIFO and pagination
 * Route: GET /transactions?email=...&page=...&limit=...
 */
const getTransactions = async (req, res, next) => {
  try {
    const userEmail = req.query.email;
    const { page, limit } = req.query;

    let matchStage = {};
    if (userEmail) {
      matchStage = { userEmail: userEmail.toLowerCase() };
    }

    const totalTransactions = await Payment.countDocuments(matchStage);

    let pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    const usePagination = !isNaN(pageNum) && !isNaN(limitNum) && limitNum > 0;

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
      { $sort: { paidAt: -1, createdAt: -1 } },
    ];

    if (usePagination) {
      const skip = (pageNum - 1) * limitNum;
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });
    }

    const result = await Payment.aggregate(pipeline);
    res.send({
      success: true,
      data: result,
      totalTransactions,
      totalPages: usePagination ? Math.ceil(totalTransactions / limitNum) || 1 : 1,
      currentPage: usePagination ? pageNum : 1,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Creator revenue & commission statistics
 * Route: GET /creator-earnings?email=...
 */
const getCreatorEarnings = async (req, res, next) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).send({
        success: false,
        message: "Email query parameter is required",
      });
    }

    const creatorEmail = email.toLowerCase();
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Total sales count & total earnings
    const stats = await Payment.aggregate([
      {
        $match: {
          creatorEmail: creatorEmail,
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$creatorEarnings" },
          totalSales: { $sum: 1 },
          grossSalesVolume: { $sum: "$amount" },
        },
      },
    ]);

    const totalSales = stats[0]?.totalSales || 0;
    const totalEarnings = stats[0]?.totalEarnings ? Number(stats[0].totalEarnings.toFixed(2)) : 0;
    const grossSalesVolume = stats[0]?.grossSalesVolume ? Number(stats[0].grossSalesVolume.toFixed(2)) : 0;

    // Paginated sales list
    const sales = await Payment.find({
      creatorEmail: creatorEmail,
      paymentStatus: "paid",
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.send({
      success: true,
      data: {
        totalEarnings,
        totalSales,
        grossSalesVolume,
        sales,
        currentPage: pageNum,
        totalPages: Math.ceil(totalSales / limitNum) || 1,
      },
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
      userEmail: email.toLowerCase(),
      paymentStatus: "paid",
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
        creatorEarnings: paymentRecord.creatorEarnings || 0,
        adminEarnings: paymentRecord.adminEarnings || 0,
        paidAt: paymentRecord.paidAt || paymentRecord.createdAt,
        recipeImage: recipeRecord?.recipeImage || recipeRecord?.image || null,
        recipeName: recipeRecord?.recipeName || "Premium Recipe",
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

    if (!userEmail || !transactionId) {
      return res.status(400).json({
        success: false,
        message: "Missing user email or transaction identifier.",
      });
    }

    // Verify transaction authenticity with Stripe before upgrading account
    try {
      const stripe = getStripe();
      if (typeof transactionId === "string" && transactionId.startsWith("cs_")) {
        const stripeSession = await stripe.checkout.sessions.retrieve(transactionId);
        if (stripeSession.payment_status !== "paid") {
          return res.status(400).json({
            success: false,
            message: "Transaction has not been completed on Stripe.",
          });
        }
      } else if (typeof transactionId === "string" && transactionId.startsWith("pi_")) {
        const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
        if (paymentIntent.status !== "succeeded") {
          return res.status(400).json({
            success: false,
            message: "Payment intent has not succeeded.",
          });
        }
      }
    } catch (stripeErr) {
      console.warn("Stripe verification check in webhook:", stripeErr.message);
      return res.status(400).json({
        success: false,
        message: "Unable to verify transaction with Stripe.",
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
      userEmail: userEmail.toLowerCase(),
      recipeId: "membership_upgrade",
      title: "RecipeHub Pro Premium Membership",
      price: 19.99,
      amount: 19.99,
      adminEarnings: 19.99,
      creatorEarnings: 0,
      isPaidRecipe: false,
      transactionId,
      paymentStatus: "paid",
      paidAt: new Date(),
    });

    await User.updateOne(
      { email: userEmail.toLowerCase() },
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
  getCreatorEarnings,
  getPurchasedDetails,
  paymentSuccessWebhook,
  getUserPurchasedRecipeIds,
};
