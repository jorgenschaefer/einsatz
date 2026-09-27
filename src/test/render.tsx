import { MantineProvider } from "@mantine/core";
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
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterContext.Provider value={stubRouter}>
      {/* env="test": keine Transitions/Portale, und Popover blenden sich nicht
          aus, weil jsdom alles mit 0×0 misst (sonst Flake unter Last). */}
      <MantineProvider theme={theme} env="test">
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
