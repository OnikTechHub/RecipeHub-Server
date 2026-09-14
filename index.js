require("dotenv").config(); // Reloaded with SMTP configurations
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middlewares/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Initialize database connection
connectDB().catch((err) => {
  console.error("Failed to connect to database during startup:", err.message);
});

// Configure CORS
app.use(
  cors({
    origin: [CLIENT_URL, "http://localhost:3000"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "authorization",
      "x-admin-email",
      "x-user-email",
    ],
  })
);

// Standard Body Parsers & Cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Server health check route
app.get("/", (req, res) => {
  res.send("RecipeHub Production Server is Online!");
});

// Mount domain API routes
app.use(routes);

// Centralized 404 handler
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running smoothly on port: ${PORT}`);
  });
}

// Export for Vercel serverless deployment
module.exports = app;
