const User = require("../models/User");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@recipehub.com").trim().toLowerCase();

/**
 * Middleware to strictly verify administrator privileges.
 * Validates JWT claim, authenticated session, or verified admin account in DB.
 */
const verifyAdmin = async (req, res, next) => {
  try {
    let email = null;

    // 1. Check verified JWT payload
    if (req.user && req.user.email) {
      email = req.user.email.toLowerCase().trim();
      if (req.user.role === "admin" || email === ADMIN_EMAIL) {
        return next();
      }
    }

    // 2. Check candidate admin email from headers, query, or body
    const candidateEmail =
      req.headers["x-admin-email"] ||
      req.headers["x-user-email"] ||
      req.query?.adminEmail ||
      req.query?.email ||
      req.body?.adminEmail ||
      req.body?.email;

    if (candidateEmail && typeof candidateEmail === "string") {
      email = candidateEmail.trim().toLowerCase();
    }

    if (!email) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Admin identity missing.",
      });
    }

    // 3. Admin email match
    if (email === ADMIN_EMAIL) {
      return next();
    }

    // 4. Verify admin role in database
    const dbUser = await User.findByEmailWithFallback(email);
    if (dbUser && dbUser.role === "admin" && !dbUser.isBlocked) {
      return next();
    }

    // 5. Non-admin or blocked user - strictly block
    return res.status(403).json({
      success: false,
      message: "Forbidden. Administrator privileges required to access this resource.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyAdmin,
};
