const dns = require("node:dns");
const mongoose = require("mongoose");

// Set reliable DNS servers to avoid SRV lookup failures on Windows/ISPs
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  const mongoUri = process.env.MONGO_DB_URI;
  if (!mongoUri) {
    throw new Error("MONGO_DB_URI is missing in environment variables (.env)");
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      dbName: "RecipeHubDB",
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB connection disconnected.");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection event error:", err.message);
});

module.exports = connectDB;
