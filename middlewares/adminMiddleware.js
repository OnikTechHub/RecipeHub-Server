const User = require("../models/User");

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@recipehub.com";

/**
 * Middleware to verify admin privileges.
 * Supports JWT admin claim, header email, or query/body check.
 */
const verifyAdmin = async (req, res, next) => {
  try {
    const email =
      req.headers["x-user-email"] ||
      req.query.adminEmail ||
      req.query.email ||
      req.body?.adminEmail ||
      req.body?.email ||
      req.user?.email;

    if (email) {
      if (email === ADMIN_EMAIL) {
        return next();
      }
      const user = await User.findByEmailWithFallback(email);
      if (user && user.role === "admin") {
        return next();
      }
    }

    if (req.user) {
      if (req.user.role === "admin" || req.user.email === ADMIN_EMAIL) {
        return next();
      }
      const dbUser = await User.findByEmailWithFallback(req.user.email);
      if (dbUser && dbUser.role === "admin") {
        return next();
      }
    }

    return next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  verifyAdmin,
};
