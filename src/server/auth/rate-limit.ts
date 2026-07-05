/**
 * Einfaches In-Process-Rate-Limit gegen Brute-Force am Login: nach zu vielen
 * Fehlversuchen je Schlüssel (z. B. IP+Nutzername) innerhalb eines Zeitfensters
 * wird blockiert. Kein Captcha, keine dauerhafte Kontosperre.
 */
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 5 * 60 * 1000,
  ) {}

  private recent(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter(
      (t) => t > now - this.windowMs,
    );
    this.failures.set(key, kept);
    return kept;
  }

  isBlocked(key: string, now: number = Date.now()): boolean {
    return this.recent(key, now).length >= this.maxFailures;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    this.recent(key, now).push(now);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}
