import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

interface ToolEnvelope {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string; recovery?: string[] };
}

interface Invocation {
  tool: string;
  arguments: Record<string, unknown>;
  durationMs: number;
  ok: boolean;
  kind?: "mcp" | "aws";
}

interface CommandResult {
  voice: string;
  view: "work-order" | "parts" | "estimate" | "approval" | "job" | "confirmation" | "cancelled" | "schedule" | "help" | "error";
  data: unknown;
  invocations: Invocation[];
}

const port = Number(process.env.SIMULATOR_PORT ?? 4200);
const host = process.env.SIMULATOR_HOST ?? "127.0.0.1";
const mcpUrl = process.env.MCP_URL ?? "http://127.0.0.1:4100/mcp";
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url)), {
  etag: true,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

let client: Client | undefined;
let transport: StreamableHTTPClientTransport | undefined;
let pendingConfirmationToken: string | undefined;

const connect = async (): Promise<Client> => {
  if (client !== undefined) return client;
  const nextClient = new Client(
    { name: "flo-alexa-simulator", version: "0.1.0" },
    { versionNegotiation: { mode: "legacy" } }
  );
  const nextTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { "x-flo-role": "technician", "x-flo-actor-id": "tech-demo" } }
  });
  try {
    await nextClient.connect(nextTransport);
    client = nextClient;
    transport = nextTransport;
    return nextClient;
  } catch (error) {
    await nextClient.close().catch(() => undefined);
    throw error;
  }
};

const invalidateClient = async (): Promise<void> => {
  const stale = client;
  client = undefined;
  transport = undefined;
  if (stale !== undefined) await stale.close().catch(() => undefined);
};

const invoke = async (name: string, args: Record<string, unknown>, invocations: Invocation[]): Promise<unknown> => {
  const started = performance.now();
  try {
    const active = await connect();
    const result = await active.callTool({ name, arguments: args });
    const textContent = result.content.find((item) => item.type === "text");
    const envelope = (result.structuredContent ?? (textContent?.type === "text" ? JSON.parse(textContent.text) : undefined)) as ToolEnvelope | undefined;
    if (envelope === undefined) throw new Error(`${name} returned no structured result.`);
    invocations.push({ tool: name, arguments: args, durationMs: Math.round((performance.now() - started) * 10) / 10, ok: envelope.ok, kind: "mcp" });
    if (!envelope.ok) {
      const error = new Error(envelope.error?.message ?? `${name} failed.`) as Error & { details?: ToolEnvelope["error"] };
      error.details = envelope.error;
      throw error;
    }
    return envelope.data;
  } catch (error) {
    if (invocations.at(-1)?.tool !== name) {
      invocations.push({ tool: name, arguments: args, durationMs: Math.round((performance.now() - started) * 10) / 10, ok: false, kind: "mcp" });
    }
    if (error instanceof TypeError || (error instanceof Error && /fetch|connect|closed/i.test(error.message))) {
      await invalidateClient();
    }
    throw error;
  }
};

const money = (cents: number): string => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const displayBay = (value: string): string => value.replace(/^bay-/i, "Bay ").replace(/\b\w/g, (letter) => letter.toUpperCase());

interface RankedPart {
  offer: { supplierId: string; supplierSku: string; priceCents: number; shippingCostCents: number; warrantyMonths: number; deliveryDate: string };
  supplier: { name: string };
  part: { brand: string; description: string; qualityTier: string };
  customerPriceCents: number;
  grossPartMarginCents: number;
}

interface ComparisonResult {
  ranked: RankedPart[];
  recommendation: RankedPart | null;
}

const comparisonVoice = (comparison: ComparisonResult, excludeCheapest: boolean): string => {
  const selected = comparison.recommendation;
  if (selected === null) return "I did not find a compatible supplier option within those constraints.";
  const lead = `I found ${comparison.ranked.length} compatible option${comparison.ranked.length === 1 ? "" : "s"}.`;
  const qualifier = excludeCheapest ? "best non-budget choice" : "best balance of warranty, delivery, and margin";
  return `${lead} ${selected.supplier.name} is the ${qualifier} at ${money(selected.offer.priceCents + selected.offer.shippingCostCents)} shop cost, with a ${selected.offer.warrantyMonths}-month warranty and customer part price of ${money(selected.customerPriceCents)}.`;
};

const bedrockNarrationLead = async (comparison: ComparisonResult, invocations: Invocation[]): Promise<string | null> => {
  const endpoint = process.env.BEDROCK_NARRATOR_URL;
  if (endpoint === undefined || endpoint.length === 0 || comparison.recommendation === null) return null;
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-flo-build": "flo-hackathon-2026" },
      body: JSON.stringify({
        task: "part-comparison-lead",
        optionCount: comparison.ranked.length,
        qualityTier: comparison.recommendation.part.qualityTier
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Amazon Bedrock narrator returned HTTP ${response.status}.`);
    const value = await response.json() as { lead?: unknown; modelId?: unknown };
    const lead = typeof value.lead === "string" ? value.lead.trim() : "";
    if (lead.length < 8 || lead.length > 160 || /[$\d]/.test(lead)) throw new Error("Amazon Bedrock returned a narration lead outside the safe display contract.");
    invocations.push({ tool: "amazon_bedrock_narration", arguments: { task: "part-comparison-lead" }, durationMs: Math.round((performance.now() - started) * 10) / 10, ok: true, kind: "aws" });
    return lead;
  } catch {
    invocations.push({ tool: "amazon_bedrock_narration", arguments: { task: "part-comparison-lead" }, durationMs: Math.round((performance.now() - started) * 10) / 10, ok: false, kind: "aws" });
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const narratedComparisonVoice = async (comparison: ComparisonResult, excludeCheapest: boolean, invocations: Invocation[]): Promise<string> => {
  const deterministic = comparisonVoice(comparison, excludeCheapest);
  const lead = await bedrockNarrationLead(comparison, invocations);
  return lead === null ? deterministic : `${lead} ${deterministic}`;
};

const handleCommand = async (command: string): Promise<CommandResult> => {
  const text = command.trim();
  const normalized = text.toLowerCase();
  const invocations: Invocation[] = [];
  if (text.length === 0) throw new Error("Say or type a command first.");

  if (/open (?:work order|job)/i.test(text)) {
    const number = text.match(/\b\d{3,}\b/)?.[0] ?? "1842";
    const workOrder = await invoke("get_work_order", { idOrNumber: number }, invocations) as Record<string, unknown>;
    const asset = await invoke("get_asset", {}, invocations) as Record<string, unknown>;
    return {
      voice: `Work order ${String(workOrder.workOrderNumber)} is a ${String(asset.year)} ${String(asset.make)} ${String(asset.model)} with ${String(workOrder.complaint).toLowerCase()}. It is assigned to you and currently in ${String(workOrder.status)}.`,
      view: "work-order", data: { workOrder, asset }, invocations
    };
  }

  if (normalized.includes("alternator failed") && !normalized.includes("find")) {
    const diagnostic = await invoke("record_diagnostic", { finding: "Alternator failed." }, invocations);
    return { voice: "I added alternator failure to the diagnosis.", view: "job", data: diagnostic, invocations };
  }

  if (normalized.includes("find") && (normalized.includes("alternator") || normalized.includes("compatible replacement"))) {
    if (normalized.includes("failed")) await invoke("record_diagnostic", { finding: "Alternator failed." }, invocations);
    const window = await invoke("get_demo_time_window", {}, invocations) as { start: string };
    const comparison = await invoke("compare_parts", {
      category: "alternator",
      maximumLandedCostCents: 30000,
      latestDeliveryDate: window.start.slice(0, 10),
      excludeCheapest: false
    }, invocations) as ComparisonResult;
    return {
      voice: await narratedComparisonVoice(comparison, false, invocations),
      view: "parts", data: comparison, invocations
    };
  }

  if (normalized.includes("best margin") || normalized.includes("without using the cheapest")) {
    const window = await invoke("get_demo_time_window", {}, invocations) as { start: string };
    const comparison = await invoke("compare_parts", {
      category: "alternator",
      maximumLandedCostCents: 30000,
      latestDeliveryDate: window.start.slice(0, 10),
      excludeCheapest: true
    }, invocations) as ComparisonResult;
    return {
      voice: await narratedComparisonVoice(comparison, true, invocations),
      view: "parts", data: comparison, invocations
    };
  }

  if (normalized.includes("add it") && normalized.includes("approval")) {
    const estimate = await invoke("create_estimate", {}, invocations) as { totalCents: number };
    const approval = await invoke("request_customer_approval", {}, invocations);
    return {
      voice: `The estimate is ${money(estimate.totalCents)}. I sent the approval request and it is pending.`,
      view: "estimate", data: { estimate, approval }, invocations
    };
  }

  if ((normalized.includes("simulate") || normalized.includes("customer")) && normalized.includes("approv")) {
    const approval = await invoke("simulate_customer_approval", { status: "approved" }, invocations);
    return { voice: "The simulated customer approved the estimate.", view: "approval", data: approval, invocations };
  }

  if (normalized.includes("what happened") || normalized.includes("status")) {
    const reference = normalized.includes("ford") ? "Ford" : "active job";
    const status = await invoke("get_job_status", { reference }, invocations) as { summary?: string };
    return {
      voice: status.summary ?? "I retrieved the current job status.",
      view: "job", data: status, invocations
    };
  }

  if (normalized.includes("order") && normalized.includes("bay")) {
    const window = await invoke("get_demo_time_window", {}, invocations) as { start: string; end: string };
    const prepared = await invoke("prepare_purchase_and_schedule", {
      bayId: normalized.includes("bay 1") ? "bay-1" : "bay-2",
      start: window.start,
      end: window.end,
      idempotencyKey: `sim-${randomUUID()}`
    }, invocations) as { confirmationToken: string; summary: string };
    pendingConfirmationToken = prepared.confirmationToken;
    return { voice: prepared.summary, view: "confirmation", data: prepared, invocations };
  }

  if (/^(alexa[, ]+)?confirm(?: it)?[.!]?$/i.test(text)) {
    if (pendingConfirmationToken === undefined) throw new Error("There is no prepared transaction to confirm.");
    const completed = await invoke("confirm_transaction", { confirmationToken: pendingConfirmationToken }, invocations) as {
      summary?: string;
      workOrder?: { workOrderNumber?: string };
      scheduleSlot?: { bayId?: string; start?: string };
    };
    pendingConfirmationToken = undefined;
    return {
      voice: completed.summary ?? `Confirmed. The order is placed${completed.scheduleSlot?.bayId === undefined ? "" : ` and the work is scheduled in ${displayBay(completed.scheduleSlot.bayId)}`}.`,
      view: "schedule", data: completed, invocations
    };
  }

  if (/^(alexa[, ]+)?(?:cancel|do not proceed|don't proceed)(?: it| the transaction)?[.!]?$/i.test(text)) {
    const hadPendingTransaction = pendingConfirmationToken !== undefined;
    pendingConfirmationToken = undefined;
    return {
      voice: hadPendingTransaction
        ? "Cancelled. No order was placed and no schedule was changed."
        : "There is no prepared transaction to cancel.",
      view: "cancelled",
      data: { hadPendingTransaction },
      invocations
    };
  }

  if (/^(alexa[, ]+)?start over[.!]?$/i.test(text)) {
    pendingConfirmationToken = undefined;
    return {
      voice: "Starting a new conversation. Your saved job state is still available when you ask about it.",
      view: "help",
      data: { examples: ["Open work order 1842", "What happened with the Ford?", "Find compatible replacements under $300 that can arrive tomorrow"] },
      invocations
    };
  }

  return {
    voice: "Try opening work order 1842, recording the alternator diagnosis, finding replacement parts, or asking what happened with the Ford.",
    view: "help",
    data: { examples: ["Open work order 1842", "The alternator failed", "Find compatible replacements under $300 that can arrive tomorrow"] },
    invocations
  };
};

app.get("/api/health", async (_request, response) => {
  try {
    const active = await connect();
    const tools = await active.listTools();
    response.json({ ok: true, service: "alexa-simulator", mcp: "connected", protocol: transport?.protocolVersion, toolCount: tools.tools.length, bedrockNarration: Boolean(process.env.BEDROCK_NARRATOR_URL) });
  } catch (error) {
    response.status(503).json({ ok: false, service: "alexa-simulator", mcp: "unavailable", message: error instanceof Error ? error.message : "Connection failed" });
  }
});

app.post("/api/command", async (request, response) => {
  try {
    const body = request.body as unknown;
    const commandValue = typeof body === "object" && body !== null && "command" in body
      ? (body as { command?: unknown }).command
      : undefined;
    const command = typeof commandValue === "string" ? commandValue : "";
    response.json({ ok: true, ...(await handleCommand(command)) });
  } catch (error) {
    const details = error instanceof Error && "details" in error ? (error as Error & { details?: ToolEnvelope["error"] }).details : undefined;
    response.status(400).json({
      ok: false,
      voice: error instanceof Error ? error.message : "Flo could not complete that request.",
      view: "error",
      data: details ?? null,
      invocations: []
    });
  }
});

app.post("/api/new-conversation", (_request, response) => {
  pendingConfirmationToken = undefined;
  response.json({ ok: true });
});

app.post("/api/reset", async (_request, response) => {
  try {
    const invocations: Invocation[] = [];
    const data = await invoke("reset_demo", { confirmation: "RESET FLO DEMO" }, invocations);
    pendingConfirmationToken = undefined;
    response.json({ ok: true, data, invocations });
  } catch (error) {
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : "Reset failed." });
  }
});

const server = app.listen(port, host, () => {
  console.log(`Flo Alexa simulator listening on http://${host}:${port}`);
});

const shutdown = async (): Promise<void> => {
  await invalidateClient();
  await new Promise<void>((resolve) => server.close(() => { resolve(); }));
};

process.once("SIGINT", () => { void shutdown().then(() => process.exit(0)); });
process.once("SIGTERM", () => { void shutdown().then(() => process.exit(0)); });
