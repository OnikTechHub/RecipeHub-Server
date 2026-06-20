const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

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
    const recipeCollection = db.collection("recipes");
    const paymentCollection = db.collection("payments");

    // Recipe GET API
    app.get("/recipes", async (req, res) => {
      try {
        const { search, category } = req.query;
        let query = {};

        if (search) {
          query.recipeName = { $regex: search, $options: "i" };
        }

        if (category && category !== "All") {
          query.category = category;
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

    // 3. Recipe Post API
    app.post("/recipes", async (req, res) => {
      try {
        const newRecipe = req.body;
        const result = await recipeCollection.insertOne(newRecipe);
        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // 4.Create a Checkout Session API
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
          return res.status(500).send({
            success: false,
            message: "CLIENT_URL is not defined in .env",
          });
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
            recipeId: recipeId,
            userEmail: userEmail,
          },
          success_url: `${clientOrigin}/dashboard/purchased-recipes?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientOrigin}/browse-recipes/${recipeId}`,
        });

        res.send({ success: true, id: session.id, url: session.url });
      } catch (error) {
        console.error("Stripe Session Error:", error);
        res.status(500).send({ success: false, message: error.message });
      }
    });

   
          const result = await paymentCollection.insertOne(paymentData);
          return res.send({ success: true, insertedId: result.insertedId });
        }

        res
          .status(400)
          .send({ success: false, message: "Payment not verified" });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });
  } catch (error) {
    console.error("Database connection error:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RecipeHub Server is Running Perfectly!");
});

app.listen(port, () => {
  console.log(`Server is breathing on port: ${port}`);
});
