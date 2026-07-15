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

  // Reine Leseoperation: die noch im Fenster liegenden Zeitstempel eines
  // Schlüssels. Schreibt bewusst **nicht** in die Map – sonst legte jede
  // `isBlocked`-Prüfung einen (ggf. leeren) Bucket an und die Map wüchse bei
  // fehlerfreier Last unbegrenzt (Aufräumen passiert nur in `recordFailure`).
  private recent(key: string, now: number): number[] {
    return (this.failures.get(key) ?? []).filter(
      (t) => t > now - this.windowMs,
    );
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
    this.record(this.pairKey(ip, username), now);
    this.record(this.ipKey(ip), now);
  }

  /** Hängt einen Fehlversuch an und beschneidet dabei die veralteten Stempel. */
  private record(key: string, now: number): void {
    const times = this.recent(key, now);
    times.push(now);
    this.failures.set(key, times);
  }

  /**
   * Verwirft vollständig veraltete Schlüssel (kein Zeitstempel mehr im Fenster).
   * Ohne diesen Sweep würden Schlüssel, die nie wieder abgefragt werden (z. B.
   * rotierende IPs beim Spraying), unbegrenzt in der Map verbleiben; `record`
   * beschneidet nur den gerade beschriebenen Schlüssel.
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
