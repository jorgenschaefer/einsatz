/**
 * Einfaches In-Process-Rate-Limit gegen Brute-Force am Login. Zwei Zähler je
 * Fehlversuch, beide im selben Zeitfenster:
 *
 * - der **Paar-Zähler** (`ip:username`) bremst wiederholtes Raten eines
 *   einzelnen Kontos von einer IP;
 * - der **IP-Zähler** (`ip`) bremst Passwort-Spraying, bei dem ein Angreifer von
 *   einer IP je ein Passwort gegen viele Nutzernamen probiert.
 *
 * Blockiert wird, sobald **einer** der beiden Zähler sein Budget erreicht. Kein
 * Captcha, keine dauerhafte Kontosperre.
 */
export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();
  // Zeitpunkt des letzten Sweeps; steuert die Aufräum-Kadenz (siehe recordFailure).
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly maxPairFailures = 5,
    private readonly maxIpFailures = 20,
    private readonly windowMs = 5 * 60 * 1000,
  ) {}

  private pairKey(ip: string, username: string): string {
    return `pair:${ip}:${username.toLowerCase()}`;
  }

  private ipKey(ip: string): string {
    return `ip:${ip}`;
  }

  /** Anzahl aktuell verfolgter Schlüssel – Beobachtungspunkt für die Speichergröße. */
  get trackedKeyCount(): number {
    return this.failures.size;
  }

  private recent(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter(
      (t) => t > now - this.windowMs,
    );
    this.failures.set(key, kept);
    return kept;
  }

  isBlocked(ip: string, username: string, now: number = Date.now()): boolean {
    return (
      this.recent(this.pairKey(ip, username), now).length >=
        this.maxPairFailures ||
      this.recent(this.ipKey(ip), now).length >= this.maxIpFailures
    );
  }

  recordFailure(ip: string, username: string, now: number = Date.now()): void {
    // Höchstens einmal je Zeitfenster fällig, damit ein Ansturm (Spraying) nicht
    // je Fehlversuch einen O(n)-Sweep auslöst.
    if (now - this.lastSweep >= this.windowMs) this.sweep(now);
    this.recent(this.pairKey(ip, username), now).push(now);
    this.recent(this.ipKey(ip), now).push(now);
  }

  /**
   * Verwirft vollständig veraltete Schlüssel (kein Zeitstempel mehr im Fenster).
   * Ohne diesen Sweep würden Schlüssel, die nie wieder abgefragt werden (z. B.
   * rotierende IPs beim Spraying), unbegrenzt in der Map verbleiben; `recent`
   * bereinigt nur den gerade berührten Schlüssel.
   */
  private sweep(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [key, times] of this.failures) {
      if (times.every((t) => t <= cutoff)) this.failures.delete(key);
    }
    this.lastSweep = now;
  }

  /**
   * Leert bei erfolgreicher Anmeldung **nur** den Paar-Zähler. Der IP-Zähler
   * bleibt bestehen (läuft nur übers Zeitfenster aus), damit ein Angreifer mit
   * einem einzigen gültigen Konto das Spraying-Budget nicht beliebig leeren kann.
   */
  resetPair(ip: string, username: string): void {
    this.failures.delete(this.pairKey(ip, username));
  }
}
