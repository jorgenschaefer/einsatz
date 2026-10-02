import { type Groups, parseIpv6 } from "@/server/http/ip-address";

/** Antwort an Nutzer, deren Versuch das Login-Limit verweigert. */
export const RATE_LIMITED_MESSAGE =
  "Zu viele Fehlversuche. Bitte einen Moment warten und erneut versuchen.";

/** Ein vorab gezählter Versuch; wer ihn nicht als Fehlversuch werten will, gibt ihn zurück. */
interface LoginReservation {
  release(): void;
}

/**
 * Einfaches In-Process-Rate-Limit gegen Brute-Force am Login. Zwei Zähler je
 * Versuch, beide im selben Zeitfenster:
 *
 * - der **Paar-Zähler** (`ip:username`) bremst wiederholtes Raten eines
 *   einzelnen Kontos von einer IP;
 * - der **IP-Zähler** (`ip`) bremst Passwort-Spraying, bei dem ein Angreifer von
 *   einer IP je ein Passwort gegen viele Nutzernamen probiert.
 *
 * Ein Versuch wird **vor** der Passwortprüfung reserviert (`tryReserve` prüft
 * und zählt in einem synchronen Schritt), damit gleichzeitige Anfragen nicht
 * alle an der Prüfung vorbeikommen, bevor die erste zählt. Ein erfolgreicher
 * Versuch gibt seine Reservierung zurück (`attempt`). Anmeldung und
 * Passwortwechsel zählen gegen dieselben Zähler. IPv6-Adressen zählen je /64.
 * Kein Captcha, keine dauerhafte Kontosperre.
 */
export class LoginRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  // Zeitpunkt des letzten Sweeps; steuert die Aufräum-Kadenz (siehe tryReserve).
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly maxPairAttempts = 5,
    private readonly maxIpAttempts = 20,
    private readonly windowMs = 5 * 60 * 1000,
  ) {}

  /** Anzahl aktuell verfolgter Schlüssel – Beobachtungspunkt für die Speichergröße. */
  get trackedKeyCount(): number {
    return this.attempts.size;
  }

  /**
   * Führt die Prüfung eines Versuchs innerhalb des Limits aus: verweigert ohne
   * Prüfung, wenn ein Budget aufgebraucht ist; ein falsy Ergebnis bleibt als
   * Fehlversuch gezählt; ein Erfolg oder eine werfende Prüfung zählt nicht.
   */
  async attempt<T>(
    ip: string,
    username: string,
    check: () => Promise<T>,
  ): Promise<{ status: "rate-limited" } | { status: "checked"; result: T }> {
    const reservation = this.tryReserve(ip, username);
    if (!reservation) return { status: "rate-limited" };

    let result: T;
    try {
      result = await check();
    } catch (error) {
      reservation.release();
      throw error;
    }
    if (result) {
      reservation.release();
      this.resetPair(ip, username);
    }
    return { status: "checked", result };
  }

  /**
   * Zählt einen Versuch, wenn beide Budgets ihn noch erlauben; sonst `null`.
   * Ein verweigerter Versuch zählt nicht.
   */
  tryReserve(
    ip: string,
    username: string,
    now: number = Date.now(),
  ): LoginReservation | null {
    const keys = [pairKey(ip, username), ipKey(ip)];
    if (
      this.recent(keys[0], now).length >= this.maxPairAttempts ||
      this.recent(keys[1], now).length >= this.maxIpAttempts
    ) {
      return null;
    }
    // Höchstens einmal je Zeitfenster fällig, damit ein Ansturm (Spraying) nicht
    // je Versuch einen O(n)-Sweep auslöst.
    if (now - this.lastSweep >= this.windowMs) this.sweep(now);
    for (const key of keys) this.record(key, now);

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        for (const key of keys) this.unrecord(key, now);
      },
    };
  }

  /**
   * Leert bei erfolgreicher Anmeldung **nur** den Paar-Zähler. Der IP-Zähler
   * bleibt bestehen (läuft nur übers Zeitfenster aus), damit ein Angreifer mit
   * einem einzigen gültigen Konto das Spraying-Budget nicht beliebig leeren kann.
   */
  resetPair(ip: string, username: string): void {
    this.attempts.delete(pairKey(ip, username));
  }

  // Reine Leseoperation: die noch im Fenster liegenden Zeitstempel eines
  // Schlüssels. Schreibt bewusst **nicht** in die Map – sonst legte jeder
  // verweigerte Versuch einen (ggf. leeren) Bucket an.
  private recent(key: string, now: number): number[] {
    return (this.attempts.get(key) ?? []).filter(
      (t) => t > now - this.windowMs,
    );
  }

  /** Hängt einen Versuch an und beschneidet dabei die veralteten Stempel. */
  private record(key: string, now: number): void {
    const times = this.recent(key, now);
    times.push(now);
    this.attempts.set(key, times);
  }

  private unrecord(key: string, time: number): void {
    const times = this.attempts.get(key);
    if (!times) return;
    const index = times.indexOf(time);
    if (index >= 0) times.splice(index, 1);
    if (times.length === 0) this.attempts.delete(key);
  }

  /**
   * Verwirft vollständig veraltete Schlüssel (kein Zeitstempel mehr im Fenster).
   * Ohne diesen Sweep würden Schlüssel, die nie wieder abgefragt werden (z. B.
   * rotierende IPs beim Spraying), unbegrenzt in der Map verbleiben; `record`
   * beschneidet nur den gerade beschriebenen Schlüssel.
   */
  private sweep(now: number): void {
    const cutoff = now - this.windowMs;
    for (const [key, times] of this.attempts) {
      if (times.every((t) => t <= cutoff)) this.attempts.delete(key);
    }
    this.lastSweep = now;
  }
}

function pairKey(ip: string, username: string): string {
  return `pair:${limiterAddress(ip)}:${username.toLowerCase()}`;
}

function ipKey(ip: string): string {
  return `ip:${limiterAddress(ip)}`;
}

/**
 * Die Adresse, unter der das Limit zählt: bei IPv6 das /64 (ein Anschluss
 * bekommt meist ein ganzes /64 und kann darin beliebig wechseln), bei
 * IPv4-gemappten Adressen (`::ffff:203.0.113.7`) die IPv4-Adresse. Alles, was
 * keine IPv6-Adresse ist (IPv4, `"local"`), bleibt unverändert.
 */
export function limiterAddress(ip: string): string {
  const hextets = parseIpv6(ip);
  if (!hextets) return ip;
  if (isIpv4Mapped(hextets)) {
    return [
      hextets[6] >> 8,
      hextets[6] & 0xff,
      hextets[7] >> 8,
      hextets[7] & 0xff,
    ].join(".");
  }
  return `${hextets
    .slice(0, 4)
    .map((h) => h.toString(16))
    .join(":")}::/64`;
}

function isIpv4Mapped(hextets: Groups): boolean {
  return hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff;
}
