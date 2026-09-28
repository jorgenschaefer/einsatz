// REPL driver for the einsatz web app: drives a headless Chromium via
// Playwright, one command per line. Usage (from einsatz/):
//   node --env-file=.env .claude/skills/run-einsatz/driver.mjs < cmds.txt
//   node --env-file=.env .claude/skills/run-einsatz/driver.mjs --serve
// --serve listens on 127.0.0.1:$DRIVER_PORT (9223); POST command lines, the
// response holds their results (HTTP 422 if any failed).
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "/tmp/einsatz-shots";
const PORT = Number(process.env.DRIVER_PORT ?? 9223);
mkdirSync(SHOTS, { recursive: true });

// TOUCH=1 starts a phone context (390×844, touch events, mobile UA
// behaviour) for the tap/touch-drag/pinch commands.
const TOUCH = Boolean(process.env.TOUCH);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: TOUCH ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  locale: "de-DE",
  hasTouch: TOUCH,
  isMobile: TOUCH,
});
const page = await context.newPage();
const cdp = TOUCH ? await context.newCDPSession(page) : null;
const touch = (type, points) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y], id) => ({ x, y, id })),
  });
// Moves each finger from its start to its end point in `steps` steps.
async function gesture(starts, ends, steps = 15) {
  const at = (t) =>
    starts.map(([x, y], i) => [
      x + (ends[i][0] - x) * t,
      y + (ends[i][1] - y) * t,
    ]);
  await touch("touchStart", starts);
  for (let s = 1; s <= steps; s++) {
    await touch("touchMove", at(s / steps));
    await page.waitForTimeout(16);
  }
  await touch("touchEnd", []);
  await page.waitForTimeout(400);
}
const nums = (rest) => rest.trim().split(/\s+/).map(Number);
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
  async tap(sel) {
    await loc(sel).tap();
  },
  // Screen coordinates, e.g. on the map; `box` finds them.
  async "tap-xy"(rest) {
    const [x, y] = nums(rest);
    await page.touchscreen.tap(x, y);
  },
  async "click-xy"(rest) {
    const [x, y] = nums(rest);
    await page.mouse.click(x, y);
  },
  async "touch-drag"(rest) {
    const [x1, y1, x2, y2] = nums(rest);
    await gesture([[x1, y1]], [[x2, y2]]);
  },
  // pinch <cx> <cy> <from> <to>: two fingers, horizontal distance from→to
  // (to > from zooms in).
  async pinch(rest) {
    const [cx, cy, from, to] = nums(rest);
    await gesture(
      [
        [cx - from / 2, cy],
        [cx + from / 2, cy],
      ],
      [
        [cx - to / 2, cy],
        [cx + to / 2, cy],
      ],
    );
  },
  async "mouse-drag"(rest) {
    const [x1, y1, x2, y2] = nums(rest);
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 15 });
    await page.mouse.up();
  },
  // Split mouse drag, to look at the page while the button is held.
  async "mouse-down"(rest) {
    const [x, y] = nums(rest);
    await page.mouse.move(x, y);
    await page.mouse.down();
  },
  async "mouse-move"(rest) {
    const [x, y] = nums(rest);
    await page.mouse.move(x, y, { steps: 15 });
  },
  async "mouse-up"() {
    await page.mouse.up();
  },
  // Bounding box of the first match: {x, y, width, height, cx, cy}.
  async box(sel) {
    const b = await loc(sel).boundingBox();
    return JSON.stringify(
      b && { ...b, cx: b.x + b.width / 2, cy: b.y + b.height / 2 },
    );
  },
  async fill(rest) {
    const [sel, value] = splitSel(rest);
    await loc(sel).fill(value);
  },
  async upload(rest) {
    const [sel, path] = splitSel(rest);
    await loc(sel).setInputFiles(path);
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
    server?.close();
    process.exit(0);
  },
};

// Runs one input line; returns its result line, or null for blanks/comments.
async function run(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const i = trimmed.indexOf(" ");
  const [cmd, rest] =
    i < 0 ? [trimmed, ""] : [trimmed.slice(0, i), trimmed.slice(i + 1)];
  const fn = commands[cmd];
  try {
    if (!fn)
      throw new Error(
        `unknown command: ${cmd} (${Object.keys(commands).join(", ")})`,
      );
    // quit exits the process; answer first so the sender gets a reply.
    if (cmd === "quit") return "ok quit";
    const result = await fn(rest);
    return `ok ${cmd}${result ? ` → ${result}` : ""}`;
  } catch (e) {
    return `ERR ${cmd}: ${e.message.split("\n")[0]}`;
  }
}

let server;
if (process.argv.includes("--serve")) {
  let queue = Promise.resolve();
  server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    // Requests queue up, so concurrent sends never interleave commands.
    queue = queue.then(async () => {
      const out = [];
      let quit = false;
      for (const line of body.split("\n")) {
        const result = await run(line);
        if (result === null) continue;
        console.log(`> ${line.trim()}\n${result}`);
        out.push(result);
        if (result === "ok quit") {
          quit = true;
          break;
        }
      }
      // 422, not 5xx: curl --retry would silently re-run a failed command.
      const failed = out.some((r) => r.startsWith("ERR"));
      res.writeHead(failed ? 422 : 200, { "content-type": "text/plain" });
      res.end(`${out.join("\n")}\n`, quit ? () => commands.quit() : undefined);
    });
  });
  server.listen(PORT, "127.0.0.1", () =>
    console.log(
      `driver ready on http://127.0.0.1:${PORT} (${BASE}, shots → ${SHOTS})`,
    ),
  );
} else {
  console.log(`driver ready (${BASE}, shots → ${SHOTS})`);
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.setPrompt("> ");
  rl.prompt();
  for await (const line of rl) {
    const result = await run(line);
    if (result) console.log(result);
    if (result === "ok quit") await commands.quit();
    if (!rl.closed) rl.prompt();
  }
  await browser.close();
}
