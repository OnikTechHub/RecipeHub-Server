const mongoose = require("mongoose");

/**
 * Middleware to validate MongoDB ObjectId in req.params[paramName]
 * @param {string} paramName - Name of parameter (default: "id")
 */
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format. Must be a valid 24-character hexadecimal ObjectId.`,
      });
    }
    next();
  };
};

module.exports = {
  validateObjectId,
};
