import { browserRequest } from './browser-request.js';
const $ = (selector) => document.querySelector(selector);
const transcript = $("#transcript");
const form = $("#commandForm");
const input = $("#command");
const canvas = $("#canvas");
const statusPill = $("#statusPill");
const connection = $("#connection");
const trace = $("#trace");
const traceItems = $("#traceItems");
const contextList = $("#contextList");
const send = form.querySelector(".send");
const talk = $("#talk");
const state = { workOrder: null, asset: null, approval: "Not requested", pending: "None" };
let lastResult = null;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const dollars = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents ?? 0) / 100);
const time = (value) => value ? new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";

function addMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  article.innerHTML = `<div class="speaker">${role === "assistant" ? "B" : "T"}</div><div><span>${role === "assistant" ? "Flo" : "Technician"}</span><p>${escapeHtml(text)}</p></div>`;
  transcript.append(article);
  transcript.scrollTop = transcript.scrollHeight;
}

function setContext() {
  contextList.innerHTML = `
    <div><dt>Active job</dt><dd>${state.workOrder ? `WO ${escapeHtml(state.workOrder.workOrderNumber)}` : "None"}</dd></div>
    <div><dt>Asset</dt><dd>${state.asset ? `${escapeHtml(state.asset.year)} ${escapeHtml(state.asset.make)} ${escapeHtml(state.asset.model)}` : "—"}</dd></div>
    <div><dt>Approval</dt><dd>${escapeHtml(state.approval)}</dd></div>
    <div><dt>Pending action</dt><dd>${escapeHtml(state.pending)}</dd></div>`;
}

function renderTrace(items = []) {
  $("#traceCount").textContent = `${items.length} call${items.length === 1 ? "" : "s"}`;
  traceItems.innerHTML = items.length ? items.map((item, index) => `
    <div class="trace-item"><code>${index + 1}. ${escapeHtml((item.kind ?? "mcp").toUpperCase())} · ${escapeHtml(item.tool)}</code><div class="trace-meta"><span>${item.ok ? "SUCCESS" : "FAILED"}</span><span>${escapeHtml(item.durationMs)} ms</span></div></div>`).join("") : `<p class="muted">No tools invoked in this turn.</p>`;
}

function offersFrom(data) {
  const ranked = data?.ranked ?? data?.recommendations ?? data?.offers ?? [];
  if (!Array.isArray(ranked)) return [];
  return ranked.map((entry) => ({
    part: entry.part ?? entry,
    offer: entry.offer ?? entry.supplierPart ?? entry,
    supplier: entry.supplier,
    customerPriceCents: entry.customerPriceCents,
    marginCents: entry.marginCents,
    grossPartMarginCents: entry.grossPartMarginCents,
    landedCostCents: entry.landedCostCents,
    recommended: Boolean(entry.recommended) || entry.offer?.supplierSku === data?.recommendation?.offer?.supplierSku
  }));
}

const displayBay = (value) => String(value ?? "Unassigned").replace(/^bay-/i, "Bay ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const displayStatus = (value) => String(value ?? "Unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function render(view, data) {
  if (view === "work-order") {
    state.workOrder = data.workOrder; state.asset = data.asset; state.pending = "None";
    statusPill.textContent = String(data.workOrder.status); statusPill.className = "status-pill pending";
    canvas.innerHTML = `<div class="asset-title"><div><span class="eyebrow">${escapeHtml(data.asset.type)}</span><h3>${escapeHtml(data.asset.year)} ${escapeHtml(data.asset.make)} ${escapeHtml(data.asset.model)}</h3><p>${escapeHtml(data.asset.engine)} · ${Number(data.asset.mileage).toLocaleString()} mi</p></div><strong class="wo-number">WO ${escapeHtml(data.workOrder.workOrderNumber)}</strong></div>
      <div class="overview-grid"><div class="metric"><span>Status</span><strong>${escapeHtml(data.workOrder.status)}</strong></div><div class="metric"><span>Priority</span><strong>${escapeHtml(data.workOrder.priority)}</strong></div><div class="metric"><span>Assigned bay</span><strong>${escapeHtml(data.workOrder.bayId ?? "Unassigned")}</strong></div></div>
      <div class="detail-grid"><div class="detail"><label>Customer concern</label><p>${escapeHtml(data.workOrder.complaint)}</p></div><div class="detail"><label>Diagnosis</label><p>${escapeHtml(data.workOrder.diagnosis || "Not recorded")}</p></div><div class="detail"><label>VIN</label><p>${escapeHtml(data.asset.vin)}</p></div><div class="detail"><label>Trim</label><p>${escapeHtml(data.asset.trim)}</p></div></div>`;
  } else if (view === "parts") {
    const rows = offersFrom(data);
    const selected = rows.find((row) => row.recommended) ?? rows[0];
    statusPill.textContent = "Options ready"; statusPill.className = "status-pill good"; state.pending = "Part selected";
    canvas.innerHTML = `<div class="summary-card"><span class="eyebrow">Recommendation</span><h3>${escapeHtml(selected?.part?.brand ?? "Compatible part")} · ${escapeHtml(selected?.supplier?.name ?? selected?.offer?.supplierId ?? "Supplier")}</h3><p>${selected ? `${escapeHtml(selected.part?.qualityTier ?? "Quality")} option with ${escapeHtml(selected.offer?.warrantyMonths)}-month warranty, arriving ${escapeHtml(selected.offer?.deliveryDate)}.` : "No option met the current constraints."}</p></div>
      <div class="parts-carousel" aria-label="Compatible part options">${rows.map((row) => `<article class="part-card ${row.recommended ? "recommended" : ""}">${row.recommended ? `<span class="recommend">Recommended</span>` : ""}<h3>${escapeHtml(row.part?.brand ?? row.offer?.brand ?? "Part")}</h3><p class="part-subtitle">${escapeHtml(row.part?.partNumber ?? row.offer?.partNumber ?? row.offer?.supplierSku)} · ${escapeHtml(row.supplier?.name ?? row.offer?.supplierId ?? "Supplier")}</p><div class="part-price"><strong>${dollars(row.customerPriceCents ?? row.offer?.priceCents)}</strong><span>Customer part price · ${dollars(row.landedCostCents ?? row.offer?.priceCents)} shop cost</span></div><dl class="part-facts"><div><dt>Margin</dt><dd>${dollars(row.grossPartMarginCents ?? 0)}</dd></div><div><dt>Warranty</dt><dd>${escapeHtml(row.offer?.warrantyMonths ?? row.part?.warrantyMonths ?? "—")} mo</dd></div><div><dt>Delivery</dt><dd>${escapeHtml(row.offer?.deliveryDate ?? "—")}</dd></div><div><dt>Available</dt><dd>${escapeHtml(row.offer?.inventory ?? "—")}</dd></div></dl></article>`).join("")}</div>`;
  } else if (view === "estimate") {
    const estimate = data.estimate; state.approval = String(data.approval?.status ?? "pending"); state.pending = "Customer approval"; statusPill.textContent = "Approval pending"; statusPill.className = "status-pill pending";
    canvas.innerHTML = `<div class="summary-card"><span class="eyebrow">Estimate</span><h3>Alternator replacement</h3><p>Supplier B premium aftermarket alternator with 1.2 labor hours and configured shop pricing.</p></div><div class="money-list"><div class="money-row"><span>Part customer price</span><strong>${dollars(estimate.partItems?.[0]?.customerPriceCents ?? 29565)}</strong></div><div class="money-row"><span>Labor</span><strong>${dollars(estimate.laborItems?.reduce((sum, item) => sum + item.totalCents, 0) ?? 12600)}</strong></div><div class="money-row"><span>Shop supplies</span><strong>${dollars(estimate.feesCents ?? 1200)}</strong></div><div class="money-row"><span>Tax</span><strong>${dollars(estimate.taxCents)}</strong></div><div class="money-row total"><span>Total</span><strong>${dollars(estimate.totalCents)}</strong></div></div>`;
  } else if (view === "approval") {
    const approvalStatus = displayStatus(data?.status ?? "approved");
    state.approval = approvalStatus; state.pending = "None"; statusPill.textContent = approvalStatus; statusPill.className = data?.status === "denied" ? "status-pill" : "status-pill good";
    canvas.innerHTML = `<div class="summary-card ${data?.status === "denied" ? "" : "good"}"><span class="eyebrow">Customer decision</span><h3>Estimate ${escapeHtml(approvalStatus.toLowerCase())}</h3><p>The customer response is stored. No supplier order or schedule change has been executed.</p></div><div class="overview-grid"><div class="metric"><span>Status</span><strong>${escapeHtml(approvalStatus)}</strong></div><div class="metric"><span>Approval</span><strong>${escapeHtml(data?.id ?? "Recorded")}</strong></div><div class="metric"><span>Transaction</span><strong>Not executed</strong></div></div>`;
  } else if (view === "confirmation") {
    const bayMatch = String(data?.summary ?? "").match(/\b(?:bay-|Bay )([a-z0-9-]+)/i);
    state.pending = `Order + ${bayMatch ? `Bay ${bayMatch[1]}` : "schedule"}`; statusPill.textContent = "Confirmation required"; statusPill.className = "status-pill pending";
    canvas.innerHTML = `<div class="summary-card"><span class="eyebrow">Action review</span><h3>Confirm purchase and schedule</h3><p>${escapeHtml(data.summary)}</p></div><div class="detail-grid"><div class="detail"><label>Safety state</label><p>No action executed</p></div><div class="detail"><label>Confirmation expires</label><p>${time(data.expiresAt)}</p></div></div><div class="transaction-actions" role="group" aria-label="Transaction decision"><button class="primary-action" type="button" data-command="Confirm">Confirm purchase and schedule</button><button class="secondary-action" type="button" data-command="Cancel">Cancel</button></div><p class="transaction-note">Confirm executes the exact order and appointment shown above. Cancel leaves both systems unchanged.</p>`;
  } else if (view === "cancelled") {
    state.pending = "None"; statusPill.textContent = "Not executed"; statusPill.className = "status-pill";
    canvas.innerHTML = `<div class="summary-card"><span class="eyebrow">Transaction cancelled</span><h3>No action was taken</h3><p>${data?.hadPendingTransaction ? "The prepared purchase and schedule were discarded. No supplier order was placed and no bay was reserved." : "There was no prepared purchase or schedule to cancel."}</p></div>`;
  } else if (view === "schedule") {
    state.pending = "None"; statusPill.textContent = "Scheduled"; statusPill.className = "status-pill good";
    canvas.innerHTML = `<div class="summary-card good"><span class="eyebrow">Transaction complete</span><h3>Order placed · ${escapeHtml(displayBay(data.scheduleSlot?.bayId))} reserved</h3><p>${escapeHtml(data.summary ?? "The supplier order and schedule were confirmed. Audit records were created for both actions.")}</p></div><div class="overview-grid"><div class="metric"><span>Order</span><strong>${escapeHtml(displayStatus(data.purchaseOrder?.status ?? "Placed"))}</strong></div><div class="metric"><span>Bay</span><strong>${escapeHtml(displayBay(data.scheduleSlot?.bayId))}</strong></div><div class="metric"><span>Job</span><strong>${escapeHtml(displayStatus(data.workOrder?.status ?? "Scheduled"))}</strong></div></div><div class="detail-grid"><div class="detail"><label>Scheduled start</label><p>${time(data.scheduleSlot?.start)}</p></div><div class="detail"><label>Purchase order</label><p>${escapeHtml(data.purchaseOrder?.id ?? "Confirmed")}</p></div></div>`;
  } else if (view === "job") {
    const wo = data.workOrder ?? state.workOrder; const asset = data.asset ?? state.asset; if (wo) state.workOrder = wo; if (asset) state.asset = asset; if (data.approval?.status) state.approval = data.approval.status;
    statusPill.textContent = data.approval?.status === "approved" ? "Approved" : "Job updated"; statusPill.className = data.approval?.status === "approved" ? "status-pill good" : "status-pill pending";
    canvas.innerHTML = `<div class="summary-card ${data.approval?.status === "approved" ? "good" : ""}"><span class="eyebrow">Job status</span><h3>${wo ? `Work order ${escapeHtml(wo.workOrderNumber)}` : "Diagnostic recorded"}</h3><p>${escapeHtml(data.summary ?? (data.approval?.status === "approved" ? "Customer approval is complete." : "The diagnostic record is stored on the active work order."))}</p></div>${wo ? `<div class="overview-grid"><div class="metric"><span>Job</span><strong>${escapeHtml(displayStatus(wo.status))}</strong></div><div class="metric"><span>Approval</span><strong>${escapeHtml(displayStatus(data.approval?.status ?? "Not requested"))}</strong></div><div class="metric"><span>Parts order</span><strong>${escapeHtml(displayStatus(data.purchaseOrder?.status ?? "Not placed"))}</strong></div></div>` : ""}`;
  } else if (view === "error") {
    statusPill.textContent = "Needs attention"; statusPill.className = "status-pill";
    canvas.innerHTML = `<div class="summary-card"><span class="eyebrow">Could not continue</span><h3>Review the request</h3><p>${escapeHtml(data?.message ?? "Flo returned a structured error. Use a recovery option or try again.")}</p></div>`;
  } else if (view === "help") {
    statusPill.textContent = "Ready"; statusPill.className = "status-pill";
    canvas.innerHTML = `<div class="summary-card"><span class="eyebrow">Try a workflow</span><h3>Run a real shop operation</h3><p>Each command below invokes the live MCP server and updates the same visible job state.</p></div><div class="quick-commands">${(data?.examples ?? []).map((example) => `<button type="button" data-command="${escapeHtml(example)}">${escapeHtml(example)}</button>`).join("")}</div>`;
  }
  setContext();
}

async function runCommand(command) {
  addMessage("user", command); input.value = ""; input.disabled = true; send.disabled = true; talk.disabled = true;
  try {
    const response = await browserRequest("/api/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command }) });
    const result = await response.json();
    lastResult = result;
    addMessage("assistant", result.voice); renderTrace(result.invocations); render(result.view, result.data);
    return { ok: result.ok, voice: result.voice, view: result.view, tools: result.invocations?.map((item) => item.tool) ?? [] };
  } catch (error) {
    addMessage("assistant", "The Flo service is unavailable. Check the local service connection and try again.");
    renderTrace([]);
    throw error;
  } finally { input.disabled = false; send.disabled = false; talk.disabled = false; input.focus(); }
}

form.addEventListener("submit", (event) => { event.preventDefault(); if (input.value.trim()) void runCommand(input.value.trim()); });
$("#quickCommands").addEventListener("click", (event) => { if (event.target instanceof HTMLButtonElement) void runCommand(event.target.textContent.trim()); });
canvas.addEventListener("click", (event) => { const button = event.target instanceof HTMLButtonElement ? event.target : null; if (button?.matches("[data-command]")) void runCommand(button.dataset.command ?? button.textContent.trim()); });
$("#debugToggle").addEventListener("click", () => { trace.hidden = !trace.hidden; $("#debugToggle").setAttribute("aria-pressed", String(!trace.hidden)); });
$("#themeToggle").addEventListener("click", () => { const next = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = next; $("#themeToggle").textContent = next === "light" ? "☾" : "☼"; $("#themeToggle").setAttribute("aria-label", `Switch to ${next === "light" ? "dark" : "light"} theme`); });
$("#focusToggle").addEventListener("click", () => { const focused = document.body.classList.toggle("focus-mode"); $("#focusToggle").setAttribute("aria-pressed", String(focused)); $("#focusToggle").setAttribute("aria-label", focused ? "Exit expanded visual result" : "Expand visual result"); });
$("#newConversation").addEventListener("click", async () => {
  try {
    const response = await browserRequest("/api/new-conversation", { method: "POST" });
    if (!response.ok) throw new Error("New conversation request denied. Reload and try again.");
    transcript.innerHTML = ""; addMessage("assistant", "New conversation started. Long-term job context is still available.");
  } catch (error) { addMessage("assistant", error.message); }
});
$("#reset").addEventListener("click", async () => {
  const button = $("#reset"); button.disabled = true;
  try { const response = await browserRequest("/api/reset", { method: "POST" }); if (response.ok) location.reload(); else addMessage("assistant", "The demo reset failed or was denied. Reload and try again."); }
  catch { addMessage("assistant", "The demo reset could not be completed."); }
  finally { button.disabled = false; }
});

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Recognition) {
  const recognition = new Recognition(); recognition.lang = "en-US"; recognition.interimResults = false;
  recognition.addEventListener("start", () => talk.classList.add("listening"));
  recognition.addEventListener("end", () => talk.classList.remove("listening"));
  recognition.addEventListener("result", (event) => { const command = event.results[0][0].transcript; input.value = command; void runCommand(command); });
  talk.addEventListener("click", () => recognition.start());
} else { talk.hidden = true; $("#voiceNote").textContent = "Type a command to run the voice-first demo workflow."; }

fetch("/api/health").then(async (response) => {
  const health = await response.json();
  connection.className = `connection ${response.ok ? "ready" : "offline"}`;
  connection.innerHTML = `<i></i>${response.ok ? `MCP ${escapeHtml(health.protocol)} · ${health.toolCount} tools` : "MCP unavailable"}`;
  const awsStatus = $("#awsStatus");
  if (awsStatus) awsStatus.innerHTML = `<i class="dot ${health.bedrockNarration ? "live" : ""}"></i>${health.bedrockNarration ? "Amazon Bedrock narration" : "AWS optional"}`;
}).catch(() => { connection.className = "connection offline"; connection.innerHTML = "<i></i>MCP unavailable"; });

const modelContext = document.modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const reportRegistrationError = (error) => console.warn("Flo WebMCP registration failed", error);
  const register = (tool) => {
    try { void Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(reportRegistrationError); }
    catch (error) { reportRegistrationError(error); }
  };
  register({
    name: "run_flo_command",
    title: "Run Flo command",
    description: "Run one technician command through the visible Flo simulator. This uses the same command path, transcript, operational view, MCP server, and state as the human interface. Transaction preparation does not execute until a separate Confirm command.",
    inputSchema: {
      type: "object",
      properties: { command: { type: "string", minLength: 1, maxLength: 500 } },
      required: ["command"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(value) {
      if (!value || typeof value !== "object" || typeof value.command !== "string" || !value.command.trim() || value.command.length > 500) throw new TypeError("command must be a non-empty string of at most 500 characters");
      return runCommand(value.command.trim());
    }
  });
  register({
    name: "get_flo_session_summary",
    title: "Get Flo session summary",
    description: "Read the job, asset, approval, pending action, latest response, and visible MCP tools for the current simulator session without changing state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute(value) {
      if (value && (typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 0)) throw new TypeError("This tool accepts an empty object only");
      return {
        activeWorkOrder: state.workOrder?.workOrderNumber ?? null,
        asset: state.asset ? `${state.asset.year} ${state.asset.make} ${state.asset.model}` : null,
        approval: state.approval,
        pendingAction: state.pending,
        latestVoiceResponse: lastResult?.voice ?? null,
        latestMcpTools: lastResult?.invocations?.map((item) => item.tool) ?? []
      };
    }
  });
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
