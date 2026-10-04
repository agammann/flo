import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../../apps/alexa-simulator/public/app.js", import.meta.url), "utf8")
  .replace(/^import .* from '.+';\r?\n/gm, "");
const html = readFileSync(new URL("../../../apps/alexa-simulator/public/index.html", import.meta.url), "utf8");
type Listener = (event: { preventDefault(): void }) => void;
class Element {
  innerHTML = ""; textContent = ""; className = ""; value = "";
  disabled = false; hidden = false; scrollTop = 0; scrollHeight = 0;
  listeners = new Map<string, Listener>();
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, listener); }
  querySelector() { return new Element(); }
  append() { /* Transcript rendering is outside these status assertions. */ }
  focus() { /* No real focus in the unit DOM. */ }
  async emit(name: string) { this.listeners.get(name)?.({ preventDefault() {} }); await setImmediate(); }
}
function harness() {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1]!, new Element()]));
  const get = (id: string) => { const element = elements.get(id); assert.ok(element, `Missing HTML element: ${id}`); return element; };
  const pending: unknown[][] = [];
  let finishHealth!: (response: Response) => void;
  const health = new Promise<Response>(resolve => { finishHealth = resolve; });
  runInNewContext(source, {
    document: { querySelector: (selector: string) => get(selector.slice(1)), createElement: () => new Element() },
    window: {}, HTMLButtonElement: Element,
    fetch: (path: string) => { assert.equal(path, "/api/health"); return health; },
    browserRequest: (path: string, options: RequestInit) => {
      assert.equal(path, "/api/command"); assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body as string), { command: "Check narration" });
      const invocations = pending.shift(); assert.ok(invocations, "Unexpected command");
      return Promise.resolve(Response.json({ ok: true, voice: "Test response", view: "help", data: { examples: [] }, invocations }));
    }
  });
  return {
    badge: get("awsStatus"),
    async health(configured: boolean) { finishHealth(Response.json({ bedrockNarration: configured, protocol: "test", toolCount: 0 })); await setImmediate(); },
    async command(invocations: unknown[]) { pending.push(invocations); get("command").value = "Check narration"; await get("commandForm").emit("submit"); }
  };
}
const narration = (ok: unknown) => ({ tool: "amazon_bedrock_narration", kind: "aws", ok, durationMs: 1 });
const live = (badge: Element) => /class="dot live"/.test(badge.innerHTML);

describe("shop narration status reflects results rather than configuration", () => {
  it("requires an actual boolean AWS result and retains it across unrelated commands", async () => {
    const ui = harness(); await ui.health(true);
    assert.match(ui.badge.innerHTML, /awaiting first result/); assert.equal(live(ui.badge), false);
    await ui.command([{ ...narration(true), tool: "other_tool" }, { ...narration(true), kind: "mcp" }, narration("true")]);
    assert.match(ui.badge.innerHTML, /awaiting first result/); assert.equal(live(ui.badge), false);
    await ui.command([narration(true)]);
    assert.match(ui.badge.innerHTML, /last narration succeeded/); assert.equal(live(ui.badge), true);
    await ui.command([]); assert.match(ui.badge.innerHTML, /last narration succeeded/);
    await ui.command([narration(false)]);
    assert.match(ui.badge.innerHTML, /Local fallback/); assert.equal(live(ui.badge), false);
  });
  it("does not let late configured health replace a failed narration", async () => {
    const ui = harness(); await ui.command([narration(false)]); await ui.health(true);
    assert.match(ui.badge.innerHTML, /last Bedrock attempt failed/); assert.equal(live(ui.badge), false);
  });
  it("does not let late unconfigured health erase the last successful narration", async () => {
    const ui = harness(); await ui.command([narration(true)]); await ui.health(false);
    assert.match(ui.badge.innerHTML, /last narration succeeded/); assert.equal(live(ui.badge), true);
  });
});
