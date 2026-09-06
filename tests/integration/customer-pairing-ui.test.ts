import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../../services/flo-mcp/public/pairing.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../../services/flo-mcp/public/pairing.html", import.meta.url), "utf8");
type Listener = (event: { preventDefault(): void }) => void | Promise<void>;
class Element {
  hidden = false; disabled = false; checked = false; textContent = ""; value = "";
  listeners = new Map<string, Listener>();
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, listener); }
  async emit(name: string) { await this.listeners.get(name)?.({ preventDefault() {} }); await setImmediate(); }
}
const unlinked = () => Response.json({ code: "CUSTOMER_NOT_LINKED" }, { status: 403 });
const linked = () => Response.json({ signedIn: true, linked: true });
const created = () => Response.json({ requestCode: "r".repeat(43), expiresAt: 1_900_000_000_000, status: "awaiting_operator_verification" });
const redeemed = () => Response.json({ linked: true, scope: "fictional_staging_customer" });
function harness() {
  const elements = new Map<string, Element>();
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element(); element.hidden = /\bhidden\b/.test(match[0]); element.disabled = /\bdisabled\b/.test(match[0]); elements.set(match[1]!, element);
  }
  const get = (id: string) => { const element = elements.get(id); assert.ok(element, `Missing HTML element: ${id}`); return element; };
  const window = new Element(); const document = Object.assign(new Element(), { visibilityState: "visible", getElementById: get });
  const replies: (Response | Promise<Response>)[] = []; const requests: { path: string; options: RequestInit }[] = [];
  runInNewContext(source, { document, window, AbortController, fetch: async (path: string, options: RequestInit) => {
    requests.push({ path, options }); const reply = replies.shift(); assert.ok(reply, `Unexpected request: ${path}`); return reply;
  } });
  const refresh = async (response: Response) => { replies.push(response); await window.emit("pageshow"); };
  const fill = () => { get("request-input").value = "r".repeat(43); get("invitation").value = "i".repeat(43); get("redeem-consent").checked = true; };
  return { get, window, document, replies, requests, refresh, fill };
}
describe("opt-in customer pairing browser state", () => {
  it("keeps unlinked customers signed in but blocks repairs and customer-ID selection", async () => {
    const ui = harness(); await ui.refresh(unlinked());
    assert.equal(ui.get("pairing").hidden, false); assert.equal(ui.get("logout").hidden, false);
    assert.equal(ui.get("signin").hidden, true); assert.equal(ui.get("complete").hidden, true);
    assert.equal(ui.get("request").disabled, true); assert.equal(ui.get("redeem").disabled, true);
    assert.doesNotMatch(html, /name="customerId"|id="customerId"/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|console\.|location\.|\/enrollment\/approve/);
  });
  it("requires consent, sends only request consent, and displays a pending code without claiming a link", async () => {
    const ui = harness(); await ui.refresh(unlinked());
    await ui.get("request").emit("click"); assert.equal(ui.requests.length, 1);
    ui.get("request-consent").checked = true; await ui.get("request-consent").emit("change");
    ui.replies.push(created()); await ui.get("request").emit("click");
    assert.equal(ui.get("request-code").textContent, "r".repeat(43)); assert.equal(ui.get("request-result").hidden, false);
    assert.equal(ui.get("complete").hidden, true); assert.match(ui.get("status").textContent, /repair access is still blocked/);
    assert.deepEqual(JSON.parse(ui.requests[1]!.options.body as string), { consent: true });
    assert.equal(ui.requests[1]!.options.credentials, "same-origin"); assert.equal(ui.requests[1]!.options.cache, "no-store");
  });
  it("checks the actual session after redemption before displaying a verified connection", async () => {
    const ui = harness(); await ui.refresh(unlinked()); ui.fill();
    ui.replies.push(redeemed(), linked()); await ui.get("redeem-form").emit("submit");
    assert.deepEqual(ui.requests.map(row => row.path), ["/auth/session", "/enrollment/redeem", "/auth/session"]);
    assert.equal(ui.get("complete").hidden, false); assert.equal(ui.get("pairing").hidden, true); assert.equal(ui.get("logout").hidden, false);
    assert.equal(ui.get("request-input").value, ""); assert.equal(ui.get("invitation").value, "");
    const body = JSON.parse(ui.requests[1]!.options.body as string) as unknown;
    assert.deepEqual(body, { requestCode: "r".repeat(43), invitation: "i".repeat(43), consent: true });
  });
  it("does not infer authorization from redemption success or malformed session responses", async () => {
    for (const response of [unlinked(), Response.json({ signedIn: true }), Response.json({ error: "unavailable" }, { status: 503 })]) {
      const ui = harness(); await ui.refresh(unlinked()); ui.fill(); ui.replies.push(redeemed(), response);
      await ui.get("redeem-form").emit("submit"); assert.equal(ui.get("complete").hidden, true);
      assert.equal(ui.get("invitation").value, "");
    }
  });
  it("rejects bad or missing consent and handles rejected, expired and invalid redemption", async () => {
    const ui = harness(); await ui.refresh(unlinked()); ui.fill(); ui.get("redeem-consent").checked = false;
    await ui.get("redeem-form").emit("submit"); assert.equal(ui.requests.length, 1);
    for (const response of [Response.json({ linked: true }, { status: 403 }), Response.json({ linked: false }), Response.json({ code: "UNAUTHORIZED" }, { status: 401 })]) {
      ui.fill(); ui.replies.push(response); await ui.get("redeem-form").emit("submit");
      assert.equal(ui.get("complete").hidden, true); assert.equal(ui.get("invitation").value, "");
    }
    assert.equal(ui.get("signin").hidden, false); assert.equal(ui.get("pairing").hidden, true); assert.equal(ui.get("logout").hidden, true);
  });
  it("clears codes on visibility change and ignores late responses", async () => {
    const ui = harness(); await ui.refresh(unlinked()); ui.fill();
    let finish!: (response: Response) => void;
    ui.replies.push(new Promise<Response>(resolve => { finish = resolve; }));
    const pending = ui.get("redeem-form").emit("submit");
    ui.document.visibilityState = "hidden"; await ui.document.emit("visibilitychange"); finish(redeemed()); await pending;
    assert.equal(ui.get("invitation").value, ""); assert.equal(ui.get("request-input").value, ""); assert.equal(ui.get("complete").hidden, true);
    assert.equal(ui.requests.length, 2); // No follow-up session request after invalidation.
  });
  it("allows logout while a request is in flight without restoring the pairing code", async () => {
    const ui = harness(); await ui.refresh(unlinked()); ui.get("request-consent").checked = true;
    let finish!: (response: Response) => void; ui.replies.push(new Promise<Response>(resolve => { finish = resolve; }));
    const pending = ui.get("request").emit("click");
    ui.replies.push(Response.json({ signedIn: false })); await ui.get("logout").emit("click"); finish(created()); await pending;
    assert.equal(ui.get("request-code").textContent, ""); assert.equal(ui.get("pairing").hidden, true); assert.equal(ui.get("signin").hidden, false);
    assert.match(ui.get("status").textContent, /Signed out of Flo/);
  });
  it("retains logout retry and blocks pairing after a failed logout", async () => {
    const ui = harness(); await ui.refresh(unlinked()); ui.fill();
    ui.replies.push(Response.json({ error: "failed" }, { status: 503 })); await ui.get("logout").emit("click");
    assert.equal(ui.get("logout").hidden, false); assert.equal(ui.get("pairing").hidden, true); assert.equal(ui.get("invitation").value, "");
    assert.match(ui.get("status").textContent, /could not be confirmed/);
  });
});
