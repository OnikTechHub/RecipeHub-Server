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

module.exports = {
  optionalAuth,
  requireAuth,
};
