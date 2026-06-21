require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL].filter(Boolean),
    credentials: true,
  }),
);
app.use(express.json());

const uri = process.env.MONGO_DB_URI || process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Database connected successfully to MongoDB!");

    const db = client.db("RecipeHubDB");

    const userCollection = db.collection("user");
    const recipeCollection = db.collection("recipes");
    const paymentCollection = db.collection("payments");
    const favoriteCollection = db.collection("favorites");
    const reportCollection = db.collection("reports");

    // ROLE CHECK API

    app.get("/check-user-role", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ success: false, message: "Email parameter is required" });
        }

        const user = await userCollection.findOne({ email: email });
        if (!user) {
          return res
            .status(404)
            .send({ success: false, message: "User not found in database" });
        }

        res.send({
          success: true,
          data: {
            role: user.role || "user",
            isPremium: user.isPremium || false,
          },
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // Recipe GET API (With Category & Search Filtering)
    app.get("/recipes", async (req, res) => {
      try {
        const { search, category } = req.query;
        let query = {};

        if (search) {
          query.recipeName = { $regex: search, $options: "i" };
        }

        if (category && category !== "All") {
          query.category = { $in: [category] };
        }

        const result = await recipeCollection.find(query).toArray();
        res.send({ success: true, data: result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // Single Recipe API
    app.get("/recipes/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: "Invalid Recipe ID format" });
        }
        const query = { _id: new ObjectId(id) };
        const result = await recipeCollection.findOne(query);

        if (!result) {
          return res
            .status(404)
            .send({ success: false, message: "Recipe not found" });
        }
        res.send({ success: true, data: result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // Recipe Post API
    app.post("/recipes", async (req, res) => {
      try {
        const newRecipe = req.body;
        const result = await recipeCollection.insertOne(newRecipe);
        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // STRIPE CHECKOUT & VERIFICATION APIS
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const { recipeId, title, image, price, userEmail } = req.body;

        if (!title || !price) {
          return res
            .status(400)
            .send({ success: false, message: "Missing title or price" });
        }

        const clientOrigin = process.env.CLIENT_URL;
        if (!clientOrigin) {
          return res
            .status(500)
            .send({ success: false, message: "CLIENT_URL is missing in .env" });
        }

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
          },
          success_url: `${clientOrigin}/dashboard/purchased-recipes?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientOrigin}/browse-recipes`,
        });

        res.send({ success: true, id: session.id, url: session.url });
      } catch (error) {
        console.error("Stripe Checkout error:", error);
        res.status(500).send({ success: false, message: error.message });
      }
    });

    app.post("/verify-payment", async (req, res) => {
      try {
        const { sessionId } = req.body;
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === "paid") {
          const existingPayment = await paymentCollection.findOne({
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
            amount: session.amount_total / 100,
            recipeId: session.metadata.recipeId,
            transactionId: session.payment_intent,
            paymentStatus: "paid",
            paidAt: new Date(),
          };

          const result = await paymentCollection.insertOne(paymentData);

          if (session.metadata.recipeId === "membership_upgrade") {
            await userCollection.updateOne(
              { email: session.metadata.userEmail },
              { $set: { isPremium: true, updatedAt: new Date() } },
            );
          }

          return res.send({ success: true, insertedId: result.insertedId });
        }

        res
          .status(400)
          .send({ success: false, message: "Payment status unverified" });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // USER OVERVIEW STATS
    app.get("/user-stats", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res.status(400).send({
            success: false,
            message: "Email query parameter is required",
          });
        }

        const totalRecipes = await recipeCollection.countDocuments({
          authorEmail: email,
        });
        const totalFavorites = await favoriteCollection.countDocuments({
          userEmail: email,
        });

        const recipes = await recipeCollection
          .find({ authorEmail: email })
          .toArray();
        const totalLikesReceived = recipes.reduce(
          (sum, r) => sum + (r.likesCount || 0),
          0,
        );

        res.send({
          success: true,
          data: { totalRecipes, totalFavorites, totalLikesReceived },
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });
  } catch (error) {
    console.error("MongoDB engine initialization crash:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RecipeHub Production Server is Online!");
});

app.listen(port, () => {
  console.log(`Server running smoothly on port: ${port}`);
});
