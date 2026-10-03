import { randomUUID } from "node:crypto";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser, type Role } from "@/server/auth/users";
import type { Db } from "@/server/db/db";

/** Legt einen Nutzer mit gültiger Sitzung an und liefert deren Token. */
export async function signIn(db: Db, role: Role = "user"): Promise<string> {
  return signInAs(db, `u-${randomUUID().slice(0, 8)}`, role);
}

/** Wie {@link signIn}, mit dem Nutzernamen `username`. */
export async function signInAs(
  db: Db,
  username: string,
  role: Role = "user",
): Promise<string> {
  const user = await insertUser(db, {
    username,
    passwordHash: await hashPassword("a-very-good-password"),
    role,
  });
  const token = randomUUID();
  await insertSession(db, {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}
