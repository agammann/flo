import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { it } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../../apps/alexa-simulator/public/app.js", import.meta.url), "utf8")
  .replace(/^import .* from '.+';\r?\n/gm, "");
const html = readFileSync(new URL("../../../apps/alexa-simulator/public/index.html", import.meta.url), "utf8");
class Element {
  innerHTML = ""; textContent = ""; className = ""; value = "";
  disabled = false; hidden = false; scrollTop = 0; scrollHeight = 0;
  addEventListener() { /* No human events in this isolated page-tool contract test. */ }
  querySelector() { return new Element(); }
  append() { /* Rendering remains covered by actual browser acceptance. */ }
  focus() { /* No real DOM focus in this unit harness. */ }
}
interface Tool { name: string; execute(input: unknown): unknown }

it("restores both page tools after cached return without duplicates and reads current visible command state", async () => {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1]!, new Element()]));
  const tools = new Map<string, Tool>(), signals: AbortSignal[] = [];
  const events = new Map<string, (event: { persisted: boolean }) => void>();
  const commands: string[] = [];
  let registrations = 0;
  runInNewContext(source, {
    AbortController, HTMLButtonElement: Element,
    document: {
      querySelector: (selector: string) => { const element = elements.get(selector.slice(1)); assert.ok(element); return element; },
      createElement: () => new Element(),
      modelContext: {
        registerTool(tool: Tool, options: { signal: AbortSignal }) {
          assert.equal(tools.has(tool.name), false, "Duplicate live registration");
          tools.set(tool.name, tool); signals.push(options.signal); registrations++;
          options.signal.addEventListener("abort", () => { if (tools.get(tool.name) === tool) tools.delete(tool.name); });
          return Promise.resolve();
        }
      }
    },
    window: { addEventListener: (name: string, listener: (event: { persisted: boolean }) => void) => events.set(name, listener) },
    fetch: () => Promise.resolve(Response.json({ protocol: "fixture", toolCount: 28, bedrockNarration: false })),
    browserRequest: (path: string, options: RequestInit) => {
      assert.equal(path, "/api/command");
      const body = JSON.parse(options.body as string) as { command: string }; commands.push(body.command);
      return Promise.resolve(Response.json({ ok: true, voice: "Fictional current response", view: "help", data: { examples: [] }, invocations: [] }));
    }
  });
  await setImmediate();
  assert.deepEqual([...tools.keys()].sort(), ["get_flo_session_summary", "run_flo_command"]);
  const first = tools.get("get_flo_session_summary");
  events.get("pagehide")!({ persisted: true });
  assert.equal(tools.size, 0); assert.ok(signals.every(signal => signal.aborted));
  events.get("pageshow")!({ persisted: true });
  assert.equal(tools.size, 2); assert.notEqual(tools.get("get_flo_session_summary"), first);
  assert.equal(signals.at(-1)?.aborted, false);
  events.get("pageshow")!({ persisted: true }); assert.equal(registrations, 4);
  await tools.get("run_flo_command")!.execute({ command: "Read fictional state" });
  assert.deepEqual(commands, ["Read fictional state"]);
  const summary = tools.get("get_flo_session_summary")!.execute({}) as { latestVoiceResponse: string };
  assert.equal(summary.latestVoiceResponse, "Fictional current response");
  events.get("pagehide")!({ persisted: false }); assert.equal(tools.size, 0);
});
