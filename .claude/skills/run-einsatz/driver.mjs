// REPL driver for the einsatz web app: reads one command per line from stdin,
// drives a headless Chromium via Playwright. Pipe a heredoc or run under tmux.
// Usage (from einsatz/): node --env-file=.env .claude/skills/run-einsatz/driver.mjs
import { mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "/tmp/einsatz-shots";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: "de-DE",
});
const page = await context.newPage();
const errors = [];
const watch = (p) => {
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  p.on("pageerror", (e) => errors.push(String(e)));
};
watch(page);
let shotNo = 0;

// Selector syntax: anything page.locator() accepts (css, text=…,
// role=button[name="…"]), plus label=<substring of a form label>.
const loc = (sel) => {
  sel = sel.replace(/^'(.*)'$/, "$1");
  if (sel.startsWith("label=")) return page.getByLabel(sel.slice(6)).first();
  return page.locator(sel).first();
};
const splitSel = (rest) => {
  // "<selector> <value…>"; quote the selector with '…' if it contains spaces.
  if (rest.startsWith("'")) {
    const end = rest.indexOf("'", 1);
    return [rest.slice(1, end), rest.slice(end + 2)];
  }
  const i = rest.indexOf(" ");
  return i < 0 ? [rest, ""] : [rest.slice(0, i), rest.slice(i + 1)];
};

const commands = {
  async nav(path) {
    await page.goto(new URL(path || "/", BASE).href, { waitUntil: "load" });
    return page.url();
  },
  async login() {
    await commands.nav("/login");
    await page
      .locator("input[name=username]")
      .fill(process.env.ADMIN_USERNAME ?? "admin");
    await page
      .locator("input[name=password]")
      .fill(process.env.ADMIN_PASSWORD ?? "");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.waitForURL("**/operations", { timeout: 30_000 });
    return page.url();
  },
  async click(sel) {
    await loc(sel).click();
  },
  async fill(rest) {
    const [sel, value] = splitSel(rest);
    await loc(sel).fill(value);
  },
  async press(key) {
    await page.keyboard.press(key);
  },
  async "wait-for"(sel) {
    await loc(sel).waitFor({ timeout: 30_000 });
  },
  async "wait-url"(pattern) {
    await page.waitForURL(pattern, { timeout: 30_000 });
    return page.url();
  },
  async "wait-fn"(js) {
    await page.waitForFunction(js, null, { timeout: 30_000 });
  },
  async "wait-tiles"() {
    // Leaflet adds .leaflet-tile-loaded per tile; the SSE stream means
    // "networkidle" never settles, so poll the DOM instead.
    await commands["wait-fn"](
      "document.querySelector('.leaflet-tile') && !document.querySelector('.leaflet-tile:not(.leaflet-tile-loaded)')",
    );
  },
  async ss(name) {
    const file = `${SHOTS}/${String(++shotNo).padStart(2, "0")}-${name || "shot"}.png`;
    await page.screenshot({ path: file });
    return file;
  },
  async viewport(size) {
    const [width, height] = size.split("x").map(Number);
    await page.setViewportSize({ width, height });
    // Mantine AppShell animates navbar/footer on breakpoint changes.
    await page.waitForTimeout(500);
  },
  async text(sel) {
    return (await loc(sel || "body").innerText()).slice(0, 2000);
  },
  async eval(js) {
    return JSON.stringify(await page.evaluate(js));
  },
  async url() {
    return page.url();
  },
  async errors() {
    const out = errors.splice(0);
    return out.length ? out.join("\n") : "(no console errors)";
  },
  async quit() {
    await browser.close();
    process.exit(0);
  },
};

console.log(`driver ready (${BASE}, shots → ${SHOTS})`);
const rl = createInterface({ input: process.stdin, terminal: false });
rl.setPrompt("> ");
rl.prompt();
for await (const line of rl) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const i = trimmed.indexOf(" ");
    const [cmd, rest] =
      i < 0 ? [trimmed, ""] : [trimmed.slice(0, i), trimmed.slice(i + 1)];
    const fn = commands[cmd];
    try {
      if (!fn)
        throw new Error(
          `unknown command: ${cmd} (${Object.keys(commands).join(", ")})`,
        );
      const result = await fn(rest);
      console.log(`ok ${cmd}${result ? ` → ${result}` : ""}`);
    } catch (e) {
      console.log(`ERR ${cmd}: ${e.message.split("\n")[0]}`);
    }
  }
  if (!rl.closed) rl.prompt();
}
await browser.close();
