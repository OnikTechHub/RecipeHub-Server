require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middlewares/errorMiddleware");
const { generalRateLimiter } = require("./middlewares/rateLimitMiddleware");

// Global Process Exception & Rejection Handlers to prevent abrupt crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("🔥 Uncaught Exception caught:", error);
});

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Initialize database connection
connectDB().catch((err) => {
  console.error("Failed to connect to database during startup:", err.message);
});

// Configure CORS with production domains and dynamic vercel origins
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://recipe-hub-client-two.vercel.app",
  "https://recipe-hub-client.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "authorization",
      "x-admin-email",
      "x-user-email",
      "X-Requested-With",
      "Accept",
    ],
  })
);

// Standard Body Parsers & Cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// General API Rate Limiter
app.use(generalRateLimiter);

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
