import rateLimit from "express-rate-limit";

// Rate limiter for auth routes (login, register)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        success: false,
        message: "Too many requests, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false
});

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per minute
    message: {
        success: false,
        message: "Too many requests, please slow down"
    },
    standardHeaders: true,
    legacyHeaders: false
});

export default { authLimiter, apiLimiter };
