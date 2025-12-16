import rateLimit from "express-rate-limit";

/**
 * Rate limit configuration
 */
export const RATE_LIMITS = {
  default: { windowMs: 15 * 60 * 1000, max: 50 },
  contributor: { windowMs: 15 * 60 * 1000, max: 100 },
  verifier: { windowMs: 15 * 60 * 1000, max: 200 },
  admin: { windowMs: 15 * 60 * 1000, max: 500 },
};

/**
 * Factory (USED ONLY AT INIT)
 */
function buildLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: true,
    message: {
      success: false,
      message,
    },
    keyGenerator: (req) => {
      if (req.user?._id) {
        return `user:${req.user._id}:${req.user.role}`;
      }
      return req.ip;
    },
    handler: (req, res) => {
      const rl = req.rateLimit;
      const retryAfter = Math.ceil((rl.resetTime - Date.now()) / 1000);

      res.set({
        "Retry-After": retryAfter.toString(),
      });

      res.status(429).json({
        success: false,
        message,
        rateLimit: {
          limit: rl.limit,
          remaining: rl.remaining,
          reset: rl.resetTime,
          retryAfter,
        },
      });
    },
  });
}

/**
 * ✅ CREATE ALL LIMITERS AT MODULE LOAD
 */
const LIMITERS = {
  default: buildLimiter({
    ...RATE_LIMITS.default,
    message: "Too many requests, please try again later.",
  }),

  contributor: buildLimiter({
    ...RATE_LIMITS.contributor,
    message: "Too many requests for contributor role.",
  }),

  verifier: buildLimiter({
    ...RATE_LIMITS.verifier,
    message: "Too many requests for verifier role.",
  }),

  admin: buildLimiter({
    ...RATE_LIMITS.admin,
    message: "Too many requests for admin role.",
  }),
};

/**
 * ✅ Role-based rate limiter (SAFE)
 */
export function roleBasedRateLimiter(req, res, next) {
  const role = req.user?.role || "default";
  const limiter = LIMITERS[role] || LIMITERS.default;
  limiter(req, res, next);
}

/**
 * ✅ Role-specific limiter (SAFE)
 */
export function roleSpecificRateLimiter(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    const role = req.user?.role;

    if (role && allowedRoles.includes(role)) {
      return LIMITERS[role](req, res, next);
    }

    return LIMITERS.default(req, res, next);
  };
}

/**
 * ✅ IP-only limiter (SAFE)
 */
export const ipRateLimiter = LIMITERS.default;
export const userRateLimiter = roleBasedRateLimiter;

