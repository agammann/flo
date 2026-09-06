const element = id => document.getElementById(id);
let epoch = 0;
let activeRequest;
let available = false;
const clearPrivate = () => {
  epoch++;
  activeRequest?.abort();
  window.speechSynthesis?.cancel();
  element("voice").textContent = "";
  element("details").textContent = "";
  element("details").hidden = true;
  element("tools").textContent = "";
  element("command").value = "";
  element("repairs").hidden = true;
  element("unlinked").hidden = true;
};
const api = async (path, body, signal) => {
  const response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || "Request unavailable."); error.status = response.status; error.code = data.code; throw error; }
  return data;
};
const refresh = async () => {
  const ticket = epoch;
  try {
    await api("/auth/session");
    if (ticket !== epoch) return;
    available = true;
    element("signin").hidden = true;
    element("unlinked").hidden = true;
    element("repairs").hidden = false;
    element("logout").hidden = false;
    element("status").textContent = "Signed in to Flo. Your shop-linked repairs are available.";
  } catch (error) {
    if (ticket !== epoch) return;
    clearPrivate();
    const unlinked = error.status === 403 && error.code === "CUSTOMER_NOT_LINKED";
    available = !unlinked && error.status !== 503;
    element("signin").hidden = unlinked;
    element("unlinked").hidden = !unlinked;
    element("logout").hidden = error.status !== 403;
    element("status").textContent = unlinked ? "You’re signed in. Shop verification is required. No repair information is available yet." : error.message;
  }
  element("login").disabled = !available || !element("consent").checked;
};
element("consent").addEventListener("change", () => { element("login").disabled = !available || !element("consent").checked; });
element("login").addEventListener("click", async () => {
  element("login").disabled = true;
  try { const data = await api("/auth/lwa/start", { consent: element("consent").checked }); window.location.assign(data.authorizationUrl); }
  catch (error) { element("status").textContent = error.message; element("login").disabled = false; }
});
element("logout").addEventListener("click", async () => {
  clearPrivate();
  element("signin").hidden = false;
  try { await api("/auth/logout", {}); available = true; element("login").disabled = !element("consent").checked; element("logout").hidden = true; element("status").textContent = "Signed out of Flo. This does not sign you out of Amazon."; }
  catch { element("status").textContent = "Details cleared, but server sign-out could not be confirmed. Retry sign out."; }
});
element("command-form").addEventListener("submit", async event => {
  event.preventDefault();
  activeRequest?.abort();
  const ticket = ++epoch;
  activeRequest = new AbortController();
  element("status").textContent = "Checking your repair…";
  try {
    const data = await api("/api/customer/command", { command: element("command").value }, activeRequest.signal);
    if (ticket !== epoch) return;
    element("voice").textContent = data.voice;
    element("details").textContent = data.data ? JSON.stringify(data.data.data, null, 2) : "";
    element("details").hidden = !data.data;
    element("tools").textContent = data.tools.length ? `MCP tools executed: ${data.tools.join(", ")}` : "No tool executed.";
    element("status").textContent = data.ok === false ? "Repair information was not available." : "Response ready.";
  } catch (error) {
    if (ticket !== epoch || error.name === "AbortError") return;
    clearPrivate();
    element("status").textContent = error.message;
    await refresh();
  }
});
window.addEventListener("pagehide", clearPrivate);
window.addEventListener("pageshow", () => { void refresh(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearPrivate(); else void refresh();
});
