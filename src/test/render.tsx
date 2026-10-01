import { MantineProvider, mergeThemeOverrides } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import {
  type RenderOptions,
  render as rtlRender,
} from "@testing-library/react";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import { ActionNotifications } from "@/app/ActionNotifications";
import { theme } from "@/app/theme";

// Stub-Router, damit Client-Komponenten mit useRouter() (z. B. router.refresh) in Tests laufen.
export const routerRefresh = vi.fn();
const stubRouter: AppRouterInstance = {
  refresh: routerRefresh,
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  bfcacheId: "stub",
};

// Benachrichtigungen verschwinden ohne Ausblenden, wie die übrigen
// Transitions unter env="test".
const testTheme = mergeThemeOverrides(theme, {
  components: {
    Notifications: Notifications.extend({
      defaultProps: { transitionDuration: 0 },
    }),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterContext.Provider value={stubRouter}>
      {/* env="test": keine Transitions/Portale, und Popover blenden sich nicht
          aus, weil jsdom alles mit 0×0 misst (sonst Flake unter Last). */}
      <MantineProvider theme={testTheme} env="test">
        <ActionNotifications />
        {children}
      </MantineProvider>
    </AppRouterContext.Provider>
  );
}

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
