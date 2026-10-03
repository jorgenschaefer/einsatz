/** A username long enough that its own case variant passes the length rule. */
export const POLICY_USERNAME = "anna-maria-admin";

/** One password per rule that every place setting a password must refuse. */
export const REFUSED_PASSWORDS = [
  {
    rule: "the username in other case",
    password: "Anna-Maria-Admin",
    message: "Das Passwort darf nicht dem Nutzernamen gleichen.",
  },
  {
    rule: "longer than 72 bytes",
    password: `a${"ä".repeat(36)}`,
    message:
      "Das Passwort darf höchstens 72 Byte lang sein (Umlaute zählen doppelt).",
  },
];
