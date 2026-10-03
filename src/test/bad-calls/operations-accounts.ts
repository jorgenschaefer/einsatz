import { changePasswordAction } from "@/app/account/actions";
import {
  createAccountAction,
  deleteAccountAction,
  resetPasswordAction,
  setRoleAction,
} from "@/app/admin/users/actions";
import { loginAction } from "@/app/login/actions";
import { geocodeAddressAction } from "@/app/operations/[id]/geocode-actions";
import { createOperationAction } from "@/app/operations/actions";
import {
  closeOperationAction,
  deleteOperationAction,
  reopenOperationAction,
} from "@/app/operations/lifecycle-actions";
import {
  type Bad,
  type BadCalls,
  INVALID_ID,
  NOT_A_UUID,
  noHits,
  rejects,
  text,
  tooLong,
} from "./bad-call";
import { PASSWORD } from "./fixture";

const INVALID_FORM_DATA = "Ungültige Formulardaten.";
const NEW_PASSWORD = "brand-new-password";

const form = (fields: Record<string, string | Blob>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
};
const aFile = () => new File(["x"], "x.txt");

/**
 * Einsatz anlegen und abschließen, Kartensuche, Nutzerverwaltung, Konto und
 * Anmeldung mit falschen Eingaben (AC-22).
 */
export const OPERATIONS_ACCOUNTS_BAD_CALLS: BadCalls = {
  createOperationAction: [
    rejects("no FormData", INVALID_FORM_DATA, () =>
      createOperationAction({}, "name=x" as Bad),
    ),
    rejects("a Bezeichnung as a file", "Die Bezeichnung muss Text sein.", () =>
      createOperationAction({}, form({ name: aFile() })),
    ),
    rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), () =>
      createOperationAction({}, form({ name: text(201) })),
    ),
    rejects(
      "a Beschreibung as a file",
      "Die Beschreibung muss Text sein.",
      () =>
        createOperationAction({}, form({ name: "Lage", description: aFile() })),
    ),
    rejects(
      "a Beschreibung of 2,001",
      tooLong("Die Beschreibung", "2.000"),
      () =>
        createOperationAction(
          {},
          form({ name: "Lage", description: text(2001) }),
        ),
    ),
  ],
  closeOperationAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      closeOperationAction(NOT_A_UUID),
    ),
    rejects("an Einsatz-ID as a number", INVALID_ID, () =>
      closeOperationAction(7 as Bad),
    ),
  ],
  reopenOperationAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      reopenOperationAction(NOT_A_UUID),
    ),
    rejects("an Einsatz-ID of null", INVALID_ID, () =>
      reopenOperationAction(null as Bad),
    ),
  ],
  deleteOperationAction: [
    rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
      deleteOperationAction(NOT_A_UUID),
    ),
    rejects("an Einsatz-ID as an object", INVALID_ID, () =>
      deleteOperationAction({} as Bad),
    ),
  ],
  geocodeAddressAction: [
    noHits("a query of null", () => geocodeAddressAction(null as Bad)),
    noHits("a query as an object", () => geocodeAddressAction({} as Bad)),
    noHits("a query of 201", () => geocodeAddressAction(`Ha${text(199)}`)),
  ],
  createAccountAction: [
    rejects("a Nutzername as a number", "Der Nutzername muss Text sein.", () =>
      createAccountAction(7 as Bad, NEW_PASSWORD, false),
    ),
    rejects("a Nutzername of 201", tooLong("Der Nutzername", "200"), () =>
      createAccountAction(text(201), NEW_PASSWORD, false),
    ),
    rejects("a password of null", "Das Passwort muss Text sein.", () =>
      createAccountAction("anna", null as Bad, false),
    ),
    rejects(
      'admin as "yes"',
      "„Administrator“ muss wahr oder falsch sein.",
      () => createAccountAction("anna", NEW_PASSWORD, "yes" as Bad),
    ),
  ],
  setRoleAction: [
    rejects("a non-UUID Konto-ID", INVALID_ID, () =>
      setRoleAction(NOT_A_UUID, "admin"),
    ),
    rejects('the role "root"', "Unbekannte Rolle.", (f) =>
      setRoleAction(f.userId, "root" as Bad),
    ),
  ],
  resetPasswordAction: [
    rejects("a non-UUID Konto-ID", INVALID_ID, () =>
      resetPasswordAction(NOT_A_UUID, NEW_PASSWORD),
    ),
    rejects("a password as a number", "Das Passwort muss Text sein.", (f) =>
      resetPasswordAction(f.userId, 7 as Bad),
    ),
  ],
  deleteAccountAction: [
    rejects("a non-UUID Konto-ID", INVALID_ID, () =>
      deleteAccountAction(NOT_A_UUID),
    ),
  ],
  changePasswordAction: [
    rejects("no FormData", INVALID_FORM_DATA, () =>
      changePasswordAction({}, null as Bad),
    ),
    rejects(
      "a current password as a file",
      "Das aktuelle Passwort muss Text sein.",
      () =>
        changePasswordAction(
          {},
          form({ currentPassword: aFile(), password: NEW_PASSWORD }),
        ),
    ),
    rejects(
      "a new password as a file",
      "Das neue Passwort muss Text sein.",
      () =>
        changePasswordAction(
          {},
          form({ currentPassword: PASSWORD, password: aFile() }),
        ),
    ),
  ],
  logoutAction: "takes no input",
  logoutOtherSessionsAction: "takes no input",
  loginAction: [
    rejects("no FormData", INVALID_FORM_DATA, () =>
      loginAction({}, "username=a" as Bad),
    ),
    rejects("a Nutzername as a file", "Der Nutzername muss Text sein.", () =>
      loginAction({}, form({ username: aFile(), password: PASSWORD })),
    ),
    rejects("a password as a file", "Das Passwort muss Text sein.", () =>
      loginAction({}, form({ username: "anna", password: aFile() })),
    ),
    rejects(
      "a Nutzername longer than any account's",
      "Anmeldung fehlgeschlagen. Bitte Nutzername und Passwort prüfen.",
      () => loginAction({}, form({ username: text(201), password: PASSWORD })),
    ),
  ],
};
