import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../../services/flo-mcp/public/signin.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../../services/flo-mcp/public/signin.html", import.meta.url), "utf8");
type Listener = () => void | Promise<void>;
class Element {
  hidden = false;
  disabled = false;
  checked = false;
  textContent = "";
  value = "";
  listeners = new Map<string, Listener>();
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, listener); }
  async emit(name: string) { await this.listeners.get(name)?.(); await setImmediate(); }
}
const unlinkedResponse = () => Response.json({ code: "CUSTOMER_NOT_LINKED", error: "Contact your shop." }, { status: 403 });
const linkedResponse = () => Response.json({ signedIn: true, linked: true });
function harness() {
  const elements = new Map<string, Element>();
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const element = new Element();
    element.hidden = /\bhidden\b/.test(match[0]);
    element.disabled = /\bdisabled\b/.test(match[0]);
    elements.set(match[1]!, element);
  }
  const get = (id: string) => { const element = elements.get(id); assert.ok(element, `Missing HTML element: ${id}`); return element; };
  const window = new Element();
  const document = new Element();
  const requests: string[] = [];
  const replies: (Response | Promise<Response>)[] = [];
  runInNewContext(source, {
    document: Object.assign(document, { getElementById: get }),
    window: Object.assign(window, { location: { assign: () => assert.fail("Unexpected OAuth redirect") } }),
    AbortController,
    fetch: async (path: string) => {
      requests.push(path);
      const reply = replies.shift();
      assert.ok(reply, `Unexpected request: ${path}`);
      return reply;
    }
  });
  const refresh = async (reply: Response) => { replies.push(reply); await window.emit("pageshow"); };
  return { get, window, replies, requests, refresh };
}

describe("customer sign-in UI uses authenticated unlinked state without granting repair access", () => {
  it("has the requested accessible copy and retains Sign out without restarting OAuth", async () => {
    assert.match(html, /id="unlinked" aria-labelledby="unlinked-heading" hidden/);
    assert.match(html, /You’re signed in\. Shop verification is required\./);
    assert.match(html, /Your Amazon account is connected, but your shop has not linked it to a customer record\. No repair information is available yet\./);
    const ui = harness();
    for (let attempt = 0; attempt < 2; attempt++) {
      await ui.refresh(unlinkedResponse());
      assert.equal(ui.get("signin").hidden, true);
      assert.equal(ui.get("unlinked").hidden, false);
      assert.equal(ui.get("logout").hidden, false);
      assert.equal(ui.get("repairs").hidden, true);
      assert.equal(ui.get("login").disabled, true);
      assert.match(ui.get("status").textContent, /Shop verification is required/);
    }
    assert.deepEqual(ui.requests, ["/auth/session", "/auth/session"]);
  });
  it("does not infer a signed-in unlinked account from other errors or a mismatched status", async () => {
    for (const [status, code] of [[403, "FORBIDDEN"], [401, "CUSTOMER_NOT_LINKED"], [503, "SIGN_IN_UNAVAILABLE"]] as const) {
      const ui = harness();
      await ui.refresh(Response.json({ code, error: "Access unavailable." }, { status }));
      assert.equal(ui.get("unlinked").hidden, true);
      assert.equal(ui.get("signin").hidden, false);
      assert.equal(ui.get("repairs").hidden, true);
      assert.equal(ui.get("status").textContent, "Access unavailable.");
    }
  });
  it("clears stale repair information when a previously linked account becomes unlinked", async () => {
    const ui = harness();
    await ui.refresh(linkedResponse());
    assert.equal(ui.get("repairs").hidden, false);
    assert.equal(ui.get("signin").hidden, true);
    assert.equal(ui.get("unlinked").hidden, true);
    for (const id of ["voice", "details", "tools"]) ui.get(id).textContent = "Private repair information";
    ui.get("command").value = "Show my repairs";
    await ui.refresh(unlinkedResponse());
    for (const id of ["voice", "details", "tools"]) assert.equal(ui.get(id).textContent, "");
    assert.equal(ui.get("command").value, "");
    assert.equal(ui.get("details").hidden, true);
    assert.equal(ui.get("repairs").hidden, true);
    assert.equal(ui.get("logout").hidden, false);
  });
  it("returns to sign-in when the unlinked session expires", async () => {
    const ui = harness();
    await ui.refresh(unlinkedResponse());
    await ui.refresh(Response.json({ code: "UNAUTHORIZED", error: "Sign in again." }, { status: 401 }));
    assert.equal(ui.get("unlinked").hidden, true);
    assert.equal(ui.get("signin").hidden, false);
    assert.equal(ui.get("logout").hidden, true);
    assert.equal(ui.get("repairs").hidden, true);
  });
  it("allows an unlinked account to sign out and then sign in again with consent", async () => {
    const ui = harness();
    await ui.refresh(unlinkedResponse());
    ui.get("consent").checked = true;
    ui.replies.push(Response.json({ signedIn: false }));
    await ui.get("logout").emit("click");
    assert.equal(ui.get("unlinked").hidden, true);
    assert.equal(ui.get("signin").hidden, false);
    assert.equal(ui.get("logout").hidden, true);
    assert.equal(ui.get("repairs").hidden, true);
    assert.equal(ui.get("login").disabled, false);
    assert.match(ui.get("status").textContent, /Signed out of Flo/);
    assert.deepEqual(ui.requests, ["/auth/session", "/auth/logout"]);
  });
  it("keeps Sign out available for retry when server logout fails", async () => {
    const ui = harness();
    await ui.refresh(unlinkedResponse());
    ui.replies.push(Response.json({ error: "Unavailable" }, { status: 503 }));
    await ui.get("logout").emit("click");
    assert.equal(ui.get("logout").hidden, false);
    assert.equal(ui.get("repairs").hidden, true);
    assert.match(ui.get("status").textContent, /server sign-out could not be confirmed/);
  });
  it("ignores a late session response after logout", async () => {
    const ui = harness();
    await ui.refresh(unlinkedResponse());
    let complete!: (response: Response) => void;
    ui.replies.push(new Promise<Response>(resolve => { complete = resolve; }));
    await ui.window.emit("pageshow");
    ui.replies.push(Response.json({ signedIn: false }));
    await ui.get("logout").emit("click");
    complete(unlinkedResponse());
    await setImmediate();
    assert.equal(ui.get("unlinked").hidden, true);
    assert.equal(ui.get("signin").hidden, false);
    assert.equal(ui.get("logout").hidden, true);
    assert.equal(ui.get("repairs").hidden, true);
    assert.match(ui.get("status").textContent, /Signed out of Flo/);
  });
});
