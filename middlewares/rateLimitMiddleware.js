/**
 * Lightweight, in-memory sliding window rate limiter middleware.
 * Prevents DDoS, brute-force OTP guessing, and AI API abuse without third-party dependencies.
 */
const rateLimitStore = new Map();

// Periodic cleanup every 5 minutes to prevent memory leaks
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Prevent cleanup interval from holding Node.js process open
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  message = "Too many requests. Please slow down.",
}) => {
  return (req, res, next) => {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      "global";
    const key = `${req.baseUrl || ""}${req.path}_${ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: retryAfterSeconds,
      });
    }

    record.count += 1;
    next();
  };
};

// Rate limiter for OTP & Auth operations (10 requests per 5 minutes per IP)
const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: "Too many authentication attempts. Please wait 5 minutes before trying again.",
});

// Rate limiter for AI recipe generation and chatbot (20 requests per minute per IP)
const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "AI request quota limit reached for this minute. Please wait a moment before sending more requests.",
});

// General API rate limiter (150 requests per minute per IP)
const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 150,
  message: "Too many requests. Please slow down.",
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  aiRateLimiter,
  generalRateLimiter,
};
