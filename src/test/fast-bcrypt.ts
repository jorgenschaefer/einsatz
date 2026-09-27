import { vi } from "vitest";

// bcryptjs ist reines JS: Kostenfaktor 12 braucht je Hash ~1 s, unter Last
// mehr. Tests prüfen, *dass* gehasht und verglichen wird, nicht wie teuer –
// daher hier den Minimal-Kostenfaktor. Den produktiven Faktor 12 pinnt
// `password.test.ts`, das diesen Mock per `vi.unmock` abwählt.
const TEST_COST = 4;

vi.mock("bcryptjs", async (importOriginal) => {
  const { default: bcrypt } = await importOriginal<typeof import("bcryptjs")>();
  const fast = {
    ...bcrypt,
    hash: (password: string) => bcrypt.hash(password, TEST_COST),
    hashSync: (password: string) => bcrypt.hashSync(password, TEST_COST),
  };
  return { ...fast, default: fast };
});
