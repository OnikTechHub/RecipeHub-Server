const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Database connected successfully to MongoDB!");

    const db = client.db("RecipeHubDB"); 
    const recipeCollection = db.collection("recipes");

    

  } finally {
    // Keep connection alive
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RecipeHub Server is Running Perfectly!");
});

app.listen(port, () => {
  console.log(`Server is breathing on port: ${port}`);
});