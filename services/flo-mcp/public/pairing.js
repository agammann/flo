"use strict";
(() => {
  const el = id => document.getElementById(id);
  let epoch = 0;
  let controller;
  let unlinked = false;
  let busy = false;
  const code = /^[A-Za-z0-9_-]{43}$/;
  const status = text => { el("status").textContent = text; };
  function buttons() {
    el("request").disabled = !unlinked || busy || !el("request-consent").checked;
    el("redeem").disabled = !unlinked || busy || !el("redeem-consent").checked;
  }
  function clearCodes() {
    for (const id of ["request-input", "invitation"]) el(id).value = "";
    for (const id of ["request-code", "expiry"]) el(id).textContent = "";
    el("request-result").hidden = true;
    el("request-consent").checked = false;
    el("redeem-consent").checked = false;
  }
  function invalidate() {
    epoch++;
    controller?.abort();
    controller = new AbortController();
    clearCodes(); unlinked = false; busy = false;
    for (const id of ["pairing", "complete", "signin"]) el(id).hidden = true;
    buttons();
    return epoch;
  }
  async function api(path, body) {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", signal: controller.signal,
      ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    const data = await response.json();
    return { response, data };
  }
  function signedOut(message) {
    invalidate(); el("logout").hidden = true; el("signin").hidden = false; status(message);
  }
  function sessionState(result) {
    const { response, data } = result;
    if (response.status === 401) { signedOut("Sign in to Flo to continue. Repair access is blocked."); return; }
    if (response.status === 403 && data.code === "CUSTOMER_NOT_LINKED") {
      unlinked = true; el("logout").hidden = false; el("pairing").hidden = false;
      status("You’re signed in. Shop verification is required. No repair information is available yet."); buttons(); return;
    }
    if (response.ok && data.signedIn === true && data.linked === true) {
      unlinked = false; clearCodes(); el("pairing").hidden = true; el("logout").hidden = false; el("complete").hidden = false;
      status("Your linked customer access has been verified by the server."); buttons(); return;
    }
    throw new Error("Session unavailable");
  }
  async function refresh() {
    const turn = invalidate(); status("Checking your session…");
    try { const result = await api("/auth/session"); if (turn === epoch) sessionState(result); }
    catch { if (turn === epoch) { el("logout").hidden = false; status("Session verification is unavailable. Repair access is blocked. You can still try signing out."); } }
  }
  async function action(path, body, apply) {
    if (busy || !unlinked) return;
    busy = true; buttons(); const turn = epoch;
    try {
      const result = await api(path, body);
      if (turn !== epoch) return;
      if (result.response.status === 401) { signedOut("Your session expired. Sign in again before requesting a new connection."); return; }
      if (!result.response.ok) throw new Error("Pairing rejected");
      await apply(result.data, turn);
    } catch {
      if (turn === epoch) { el("invitation").value = ""; status("The connection could not be confirmed. No repair access is claimed. Contact the operator; do not repeatedly retry an uncertain request."); }
    } finally { if (turn === epoch) { busy = false; buttons(); } }
  }
  el("request-consent").addEventListener("change", buttons);
  el("redeem-consent").addEventListener("change", buttons);
  el("request").addEventListener("click", () => {
    if (!el("request-consent").checked) return;
    return action("/enrollment/request", { consent: true }, async data => {
      if (data.status !== "awaiting_operator_verification" || !code.test(data.requestCode) || !Number.isFinite(data.expiresAt)) throw new Error("Invalid response");
      el("request-code").textContent = data.requestCode; el("request-input").value = data.requestCode;
      el("expiry").textContent = `Expires ${new Date(data.expiresAt).toLocaleTimeString()}. Server expiry is authoritative.`;
      el("request-result").hidden = false;
      status("Request created. Wait for independent operator verification; repair access is still blocked.");
    });
  });
  el("redeem-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!el("redeem-consent").checked || !code.test(el("request-input").value) || !code.test(el("invitation").value)) return;
    const body = { requestCode: el("request-input").value, invitation: el("invitation").value, consent: true };
    el("invitation").value = "";
    return action("/enrollment/redeem", body, async (data, turn) => {
      if (data.linked !== true || data.scope !== "fictional_staging_customer") throw new Error("Invalid response");
      clearCodes(); unlinked = false; el("pairing").hidden = true; buttons();
      const current = await api("/auth/session");
      if (turn === epoch) sessionState(current); // Never infer a repair principal from a redemption response alone.
    });
  });
  el("logout").addEventListener("click", async () => {
    const turn = invalidate(); status("Signing out…");
    try {
      const result = await api("/auth/logout", {});
      if (turn !== epoch) return;
      if (!result.response.ok || result.data.signedIn !== false) throw new Error("Logout unconfirmed");
      signedOut("Signed out of Flo. Pairing codes have been cleared.");
    } catch { if (turn === epoch) { el("logout").hidden = false; status("Server sign-out could not be confirmed. Retry Sign out; local codes have been cleared."); } }
  });
  window.addEventListener("pageshow", () => { void refresh(); });
  window.addEventListener("pagehide", () => { invalidate(); status("Pairing information cleared."); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { invalidate(); status("Pairing information cleared. Return to recheck your session."); }
    else { void refresh(); }
  });
})();
