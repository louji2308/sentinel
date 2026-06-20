import rateLimit from "express-rate-limit";

export function rateLimiter(opts: { windowMs: number; max: number }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests",
      code: "RATE_LIMITED",
    },
  });
}
