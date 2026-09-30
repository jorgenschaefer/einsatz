import type { StatefulSymbol } from "./placed-symbols";
import type { WorkspaceSymbol } from "./SituationWorkspace";

export const aStatefulSymbol = (
  over: Partial<StatefulSymbol> = {},
): StatefulSymbol => ({
  id: "s1",
  lat: 53.5,
  lng: 9.9,
  composition: {
    grundzeichen: "ortsfeste-stelle",
    organisation: "hilfsorganisation",
  },
  positionSource: "manual",
  reportedAt: null,
  ...over,
});

export const aSymbol = (
  over: Partial<WorkspaceSymbol> = {},
): WorkspaceSymbol => ({
  ...aStatefulSymbol(),
  deviceLinkToken: null,
  ...over,
});
