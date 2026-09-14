const { SignJWT, jwtVerify } = require("jose");

/**
 * Retrieve secret key securely from process.env
 */
const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined in .env");
  }
  return new TextEncoder().encode(secret);
};

/**
 * Generate a signed JWT token
 * @param {Object} payload - Data to embed in token (e.g. { email, role, id })
 * @param {string} expiresIn - Expiration string (e.g. "7d", "24h")
 */
const generateToken = async (payload, expiresIn = "7d") => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey());
};

/**
 * Verify a JWT token
 * @param {string} token
 * @returns {Promise<Object>} Decoded token payload
 */
const verifyJwtToken = async (token) => {
  const { payload } = await jwtVerify(token, getSecretKey());
  return payload;
};

module.exports = {
  generateToken,
  verifyJwtToken,
};
