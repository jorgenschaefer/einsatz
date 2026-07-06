import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { AppFooter, isFullscreenMapPath } from "./AppFooter";

const usePathname = vi.fn<() => string | null>();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("isFullscreenMapPath", () => {
  it("erkennt Lageansicht, Geräteansicht und Ansichtslink", () => {
    expect(isFullscreenMapPath("/operations/abc")).toBe(true);
    expect(isFullscreenMapPath("/device/tok123")).toBe(true);
    expect(isFullscreenMapPath("/view/tok123")).toBe(true);
  });

  it("lässt Nicht-Kartenseiten unberührt", () => {
    expect(isFullscreenMapPath("/operations")).toBe(false);
    expect(isFullscreenMapPath("/account")).toBe(false);
    expect(isFullscreenMapPath("/login")).toBe(false);
    expect(isFullscreenMapPath(null)).toBe(false);
  });
});

describe("AppFooter", () => {
  it("verlinkt Impressum und Datenschutzerklärung auf Nicht-Kartenseiten", () => {
    usePathname.mockReturnValue("/operations");
    render(<AppFooter />);
    expect(screen.getByRole("link", { name: "Impressum" })).toHaveAttribute(
      "href",
      "/impressum",
    );
    expect(
      screen.getByRole("link", { name: "Datenschutzerklärung" }),
    ).toHaveAttribute("href", "/datenschutz");
  });

  it("wird auf der Vollbild-Karte nicht gerendert", () => {
    usePathname.mockReturnValue("/operations/abc");
    render(<AppFooter />);
    expect(screen.queryByRole("link", { name: "Impressum" })).toBeNull();
  });
});
