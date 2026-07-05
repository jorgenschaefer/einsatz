import { LoginRateLimiter } from "./rate-limit";

// Ein prozessweiter Zähler (eine Container-Instanz), stabil über HMR hinweg.
const globalForLimiter = globalThis as unknown as {
  einsatzLoginLimiter?: LoginRateLimiter;
};

globalForLimiter.einsatzLoginLimiter ??= new LoginRateLimiter();
export const loginRateLimiter = globalForLimiter.einsatzLoginLimiter;
