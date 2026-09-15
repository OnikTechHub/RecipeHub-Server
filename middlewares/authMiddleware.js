const { verifyJwtToken } = require("../utils/jwt");

/**
 * Optional authentication middleware.
 * If Authorization header or cookie exists, verifies and attaches req.user.
 * If not present, allows the request to continue (crucial for frontend compatibility).
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = await verifyJwtToken(token);
        req.user = decoded;
      } catch (err) {
        // Token invalid or expired - continue without attaching user
        console.warn("Invalid JWT in optionalAuth:", err.message);
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Mandatory authentication middleware.
 * Requires a valid JWT token.
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication token is missing.",
      });
    }

    try {
      const decoded = await verifyJwtToken(token);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }
  } catch (error) {
    next(error);
  }
};

const User = require("../models/User");

/**
 * Premium Membership middleware.
 * Verifies JWT token or email parameter and ensures user has Premium / Admin access.
 */
const requirePremium = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    let userEmail = req.body?.userEmail || req.body?.email || req.query?.email || null;

    if (token) {
      try {
        const decoded = await verifyJwtToken(token);
        req.user = decoded;
        if (!userEmail) userEmail = decoded.email;
      } catch (err) {
        console.warn("Token verification warning in requirePremium:", err.message);
      }
    }

    if (!userEmail && !req.user) {
      return res.status(401).json({
        success: false,
        isPremiumRequired: true,
        message: "Access denied. Authentication token or user email is missing.",
      });
    }

    const emailToSearch = (userEmail || req.user?.email || "").trim().toLowerCase();
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@recipehub.com").trim().toLowerCase();

    if (emailToSearch === adminEmail || req.user?.role === "admin") {
      return next();
    }

    const userDoc = await User.findByEmailWithFallback(emailToSearch);
    const isPremiumUser =
      userDoc && (userDoc.isPremium === true || userDoc.role === "premium" || userDoc.role === "admin");

    if (!isPremiumUser && (!req.user || (!req.user.isPremium && req.user.role !== "premium" && req.user.role !== "admin"))) {
      return res.status(403).json({
        success: false,
        isPremiumRequired: true,
        message: "Exclusive Premium Feature. Please upgrade to RecipeHub Premium to access the AI Smart Recipe Generator!",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  optionalAuth,
  requireAuth,
  requirePremium,
};
