import { randomUUID } from "node:crypto";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import type { Db } from "@/server/db/db";

/** Legt einen Nutzer mit gültiger Sitzung an und liefert deren Token. */
export async function signIn(db: Db): Promise<string> {
  const user = await insertUser(db, {
    username: `u-${randomUUID().slice(0, 8)}`,
    passwordHash: await hashPassword("a-very-good-password"),
    role: "user",
  });
  const token = randomUUID();
  await insertSession(db, {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}
