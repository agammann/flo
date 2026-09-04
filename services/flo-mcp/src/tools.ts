import { McpServer, type ToolAnnotations } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { FloOrchestrator } from "@flo/agent";
import type { Actor } from "@flo/shared-types";
import { FloError } from "@flo/shared-types";

const outputSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
    recovery: z.array(z.string()).optional(),
    details: z.record(z.string(), z.unknown()).optional()
  }).optional()
});

const readOnly: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const internalMutation: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const externalMutation: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

const humanize = (tool: string, data: unknown): string => {
  if (typeof data === "object" && data !== null && "summary" in data && typeof data.summary === "string") return data.summary;
  if (typeof data === "object" && data !== null && "workOrderNumber" in data) {
    const workOrderNumber = String(data.workOrderNumber);
    const status = "status" in data ? ` Its status is ${String(data.status)}.` : "";
    return `Work order ${workOrderNumber} was retrieved.${status}`;
  }
  return `Flo completed ${tool.replaceAll("_", " ")} and returned structured data.`;
};

const execute = async (tool: string, actor: Actor, operation: () => Promise<unknown>) => {
  const startedAt = performance.now();
  try {
    const data = await operation();
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    console.log(JSON.stringify({ level: "info", event: "mcp.tool.completed", tool, actorId: actor.id, durationMs, success: true }));
    const envelope = { ok: true, data };
    return { content: [{ type: "text" as const, text: humanize(tool, data) }], structuredContent: envelope };
  } catch (error) {
    const structured = error instanceof FloError
      ? error.toStructuredError()
      : { code: "INTERNAL_ERROR", message: "Flo could not complete the tool call.", retryable: true };
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    console.error(JSON.stringify({ level: "error", event: "mcp.tool.completed", tool, actorId: actor.id, durationMs, success: false, errorCode: structured.code }));
    const envelope = { ok: false, error: structured };
    const recovery = structured.recovery?.[0] === undefined ? "" : ` ${structured.recovery[0]}`;
    return { isError: true, content: [{ type: "text" as const, text: `${structured.message}${recovery}` }], structuredContent: envelope };
  }
};

const optionalWorkOrder = z.object({ workOrderIdOrNumber: z.string().min(1).optional() });
const dateTime = z.iso.datetime();

export const createFloMcpServer = (orchestrator: FloOrchestrator, actor: Actor, options: { demoMode?: boolean } = {}): McpServer => {
  const demoMode = options.demoMode ?? process.env.NODE_ENV !== "production";
  const server = new McpServer(
    { name: "flo", version: "0.1.0" },
    {
      instructions: "Flo is a hands-free operations layer. Use tools for all work-order, part, estimate, approval, purchase, and scheduling state. Never assert a transaction succeeded unless confirm_transaction returns success."
    }
  );

  server.registerTool("get_work_order", {
    title: "Get work order",
    description: "Retrieve one structured work order by its ID or human work-order number and set it as the current job context.",
    inputSchema: z.object({ idOrNumber: z.string().min(1) }), outputSchema, annotations: readOnly
  }, (input) => execute("get_work_order", actor, () => orchestrator.getWorkOrder(actor, input.idOrNumber)));

  server.registerTool("list_open_work_orders", {
    title: "List open work orders",
    description: "List non-completed work orders visible to the current role.",
    inputSchema: z.object({}), outputSchema, annotations: readOnly
  }, () => execute("list_open_work_orders", actor, () => orchestrator.listOpenWorkOrders(actor)));

  server.registerTool("search_work_orders", {
    title: "Search work orders",
    description: "Search visible work orders by work-order number, complaint, or diagnosis text.",
    inputSchema: z.object({ query: z.string().min(1) }), outputSchema, annotations: readOnly
  }, (input) => execute("search_work_orders", actor, () => orchestrator.searchWorkOrders(actor, input.query)));

  server.registerTool("add_work_order_note", {
    title: "Add work order note",
    description: "Append a non-diagnostic note to the current or specified work order.",
    inputSchema: optionalWorkOrder.extend({ note: z.string().min(1).max(2000) }), outputSchema, annotations: internalMutation
  }, (input) => execute("add_work_order_note", actor, () => orchestrator.addWorkOrderNote(actor, input.note, input.workOrderIdOrNumber)));

  server.registerTool("get_asset", {
    title: "Get asset",
    description: "Retrieve the structured asset associated with the current or specified work order.",
    inputSchema: optionalWorkOrder, outputSchema, annotations: readOnly
  }, (input) => execute("get_asset", actor, () => orchestrator.getAsset(actor, input.workOrderIdOrNumber)));

  server.registerTool("record_diagnostic", {
    title: "Record diagnostic",
    description: "Persist a technician diagnostic finding on the current or specified work order.",
    inputSchema: optionalWorkOrder.extend({ finding: z.string().min(1).max(2000) }), outputSchema, annotations: internalMutation
  }, (input) => execute("record_diagnostic", actor, () => orchestrator.recordDiagnostic(actor, input.finding, input.workOrderIdOrNumber)));

  server.registerTool("get_diagnostic_history", {
    title: "Get diagnostic history",
    description: "Read diagnostic records for the current or specified work order.",
    inputSchema: optionalWorkOrder, outputSchema, annotations: readOnly
  }, (input) => execute("get_diagnostic_history", actor, () => orchestrator.getDiagnosticHistory(actor, input.workOrderIdOrNumber)));

  server.registerTool("search_parts", {
    title: "Search parts catalog",
    description: "Search deterministic catalog data. This does not decide compatibility.",
    inputSchema: z.object({ category: z.string().min(1).optional(), query: z.string().min(1).optional() }), outputSchema, annotations: readOnly
  }, (input) => execute("search_parts", actor, () => orchestrator.searchParts(actor, {
    ...(input.category === undefined ? {} : { category: input.category }),
    ...(input.query === undefined ? {} : { query: input.query })
  })));

  server.registerTool("check_part_compatibility", {
    title: "Check part compatibility",
    description: "Run the deterministic compatibility engine for one part and the current or specified asset. Returns compatible, incompatible, or unknown with an explanation code.",
    inputSchema: optionalWorkOrder.extend({ partIdOrNumber: z.string().min(1) }), outputSchema, annotations: readOnly
  }, (input) => execute("check_part_compatibility", actor, () => orchestrator.checkPartCompatibility(actor, input.partIdOrNumber, input.workOrderIdOrNumber)));

  server.registerTool("search_inventory", {
    title: "Search shop inventory",
    description: "Read on-hand and reserved inventory for one part or all seeded parts.",
    inputSchema: z.object({ partId: z.string().min(1).optional() }), outputSchema, annotations: readOnly
  }, (input) => execute("search_inventory", actor, () => orchestrator.searchInventory(actor, input.partId)));

  server.registerTool("search_suppliers", {
    title: "Search simulated suppliers",
    description: "Query structured offers across three simulated suppliers with delivery and landed-cost filters.",
    inputSchema: z.object({ partIds: z.array(z.string().min(1)).min(1), latestDeliveryDate: z.iso.date().optional(), maximumLandedCostCents: z.number().int().nonnegative().optional() }), outputSchema, annotations: { ...readOnly, openWorldHint: true }
  }, (input) => execute("search_suppliers", actor, () => orchestrator.searchSuppliers(actor, {
    partIds: input.partIds,
    ...(input.latestDeliveryDate === undefined ? {} : { latestDeliveryDate: input.latestDeliveryDate }),
    ...(input.maximumLandedCostCents === undefined ? {} : { maximumLandedCostCents: input.maximumLandedCostCents })
  })));

  server.registerTool("compare_parts", {
    title: "Compare compatible supplier parts",
    description: "Run compatibility, inventory, supplier search, and deterministic ranking. Can exclude the cheapest option when balancing warranty and margin.",
    inputSchema: optionalWorkOrder.extend({ category: z.string().min(1), maximumLandedCostCents: z.number().int().nonnegative().optional(), latestDeliveryDate: z.iso.date().optional(), excludeCheapest: z.boolean().optional() }), outputSchema, annotations: { ...readOnly, openWorldHint: true }
  }, (input) => execute("compare_parts", actor, () => orchestrator.compareParts(actor, {
    category: input.category,
    ...(input.workOrderIdOrNumber === undefined ? {} : { workOrderIdOrNumber: input.workOrderIdOrNumber }),
    ...(input.maximumLandedCostCents === undefined ? {} : { maximumLandedCostCents: input.maximumLandedCostCents }),
    ...(input.latestDeliveryDate === undefined ? {} : { latestDeliveryDate: input.latestDeliveryDate }),
    ...(input.excludeCheapest === undefined ? {} : { excludeCheapest: input.excludeCheapest })
  })));

  server.registerTool("calculate_estimate", {
    title: "Calculate estimate preview",
    description: "Calculate an unsaved deterministic estimate preview using integer cents, configured markup, labor, fees, and tax.",
    inputSchema: optionalWorkOrder.extend({ supplierSku: z.string().min(1).optional(), laborHours: z.number().nonnegative().optional() }), outputSchema, annotations: readOnly
  }, (input) => execute("calculate_estimate", actor, () => orchestrator.calculateEstimatePreview(actor, {
    ...(input.workOrderIdOrNumber === undefined ? {} : { workOrderIdOrNumber: input.workOrderIdOrNumber }),
    ...(input.supplierSku === undefined ? {} : { supplierSku: input.supplierSku }),
    ...(input.laborHours === undefined ? {} : { laborHours: input.laborHours })
  })));

  server.registerTool("create_estimate", {
    title: "Create estimate",
    description: "Persist a deterministic estimate for the selected supplier offer.",
    inputSchema: optionalWorkOrder.extend({ supplierSku: z.string().min(1).optional(), laborHours: z.number().nonnegative().optional() }), outputSchema, annotations: internalMutation
  }, (input) => execute("create_estimate", actor, () => orchestrator.createEstimate(actor, {
    ...(input.workOrderIdOrNumber === undefined ? {} : { workOrderIdOrNumber: input.workOrderIdOrNumber }),
    ...(input.supplierSku === undefined ? {} : { supplierSku: input.supplierSku }),
    ...(input.laborHours === undefined ? {} : { laborHours: input.laborHours })
  })));

  server.registerTool("get_estimate", {
    title: "Get estimate",
    description: "Read an estimate by estimate ID, work-order ID, or current work-order context.",
    inputSchema: z.object({ idOrWorkOrderId: z.string().min(1).optional() }), outputSchema, annotations: readOnly
  }, (input) => execute("get_estimate", actor, () => orchestrator.getEstimate(actor, input.idOrWorkOrderId)));

  server.registerTool("get_customer", {
    title: "Get customer",
    description: "Read the customer associated with the current or specified work order, subject to role permissions.",
    inputSchema: optionalWorkOrder, outputSchema, annotations: readOnly
  }, (input) => execute("get_customer", actor, () => orchestrator.getCustomer(actor, input.workOrderIdOrNumber)));

  server.registerTool("send_customer_message", {
    title: "Send customer message",
    description: "Send a customer message through the simulated customer service. This is externally visible and must be explicitly requested by the user.",
    inputSchema: optionalWorkOrder.extend({ body: z.string().min(1).max(2000) }), outputSchema, annotations: externalMutation
  }, (input) => execute("send_customer_message", actor, () => orchestrator.sendCustomerMessage(actor, input.body, input.workOrderIdOrNumber)));

  server.registerTool("request_customer_approval", {
    title: "Request customer approval",
    description: "Send the current estimate to the simulated customer and persist a pending approval. This is an external side effect.",
    inputSchema: optionalWorkOrder, outputSchema, annotations: { ...externalMutation, idempotentHint: true }
  }, (input) => execute("request_customer_approval", actor, () => orchestrator.requestCustomerApproval(actor, input.workOrderIdOrNumber)));

  server.registerTool("get_customer_approval_status", {
    title: "Get approval status",
    description: "Read and synchronize the current customer approval status.",
    inputSchema: z.object({ reference: z.string().min(1).optional() }), outputSchema, annotations: readOnly
  }, (input) => execute("get_customer_approval_status", actor, () => orchestrator.getCustomerApprovalStatus(actor, input.reference)));

  if (demoMode) {
    server.registerTool("simulate_customer_approval", {
      title: "Simulate customer approval",
      description: "Demo-only control that simulates the customer approving or denying a pending estimate.",
      inputSchema: z.object({ status: z.enum(["approved", "denied"]), approvalId: z.string().min(1).optional() }), outputSchema, annotations: internalMutation
    }, (input) => execute("simulate_customer_approval", actor, () => orchestrator.simulateCustomerApproval(actor, input.status, input.approvalId)));
  }

  server.registerTool("get_schedule", {
    title: "Get schedule",
    description: "Read schedule slots, optionally filtered by bay and time window.",
    inputSchema: z.object({ bayId: z.string().min(1).optional(), from: dateTime.optional(), to: dateTime.optional() }), outputSchema, annotations: readOnly
  }, (input) => execute("get_schedule", actor, () => orchestrator.getSchedule(actor, {
    ...(input.bayId === undefined ? {} : { bayId: input.bayId }),
    ...(input.from === undefined ? {} : { from: input.from }),
    ...(input.to === undefined ? {} : { to: input.to })
  })));

  server.registerTool("find_available_slot", {
    title: "Find available slot",
    description: "Deterministically check a bay for overlapping schedule slots.",
    inputSchema: z.object({ bayId: z.string().min(1), start: dateTime, end: dateTime }), outputSchema, annotations: readOnly
  }, (input) => execute("find_available_slot", actor, () => orchestrator.findAvailableSlot(actor, input)));

  server.registerTool("prepare_purchase_and_schedule", {
    title: "Prepare purchase and schedule",
    description: "Validate approval, supplier selection, permissions, and bay availability, then return a short-lived confirmation token. It does not place an order or schedule work.",
    inputSchema: optionalWorkOrder.extend({ bayId: z.string().min(1), start: dateTime, end: dateTime, supplierSku: z.string().min(1).optional(), idempotencyKey: z.string().min(8).optional() }), outputSchema, annotations: internalMutation
  }, (input) => execute("prepare_purchase_and_schedule", actor, () => orchestrator.preparePurchaseAndSchedule(actor, {
    bayId: input.bayId,
    start: input.start,
    end: input.end,
    ...(input.workOrderIdOrNumber === undefined ? {} : { workOrderIdOrNumber: input.workOrderIdOrNumber }),
    ...(input.supplierSku === undefined ? {} : { supplierSku: input.supplierSku }),
    ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey })
  })));

  server.registerTool("confirm_transaction", {
    title: "Confirm purchase and schedule",
    description: "Execute the exact purchase and schedule operation represented by a valid confirmation token. Re-checks approval, authorization, offer state, and bay availability server-side.",
    inputSchema: z.object({ confirmationToken: z.string().uuid() }), outputSchema, annotations: externalMutation
  }, (input) => execute("confirm_transaction", actor, () => orchestrator.confirmTransaction(actor, input.confirmationToken)));

  server.registerTool("get_order_status", {
    title: "Get purchase order status",
    description: "Read a purchase order by ID or idempotency key.",
    inputSchema: z.object({ idOrIdempotencyKey: z.string().min(1) }), outputSchema, annotations: { ...readOnly, openWorldHint: true }
  }, (input) => execute("get_order_status", actor, () => orchestrator.getOrderStatus(actor, input.idOrIdempotencyKey)));

  server.registerTool("get_job_status", {
    title: "Get job status",
    description: "Resolve a work-order reference such as a number, vehicle, or recent job and return combined work-order, asset, estimate, approval, and purchase state. Asks for clarification when evidence is ambiguous.",
    inputSchema: z.object({ reference: z.string().min(1).default("active job") }), outputSchema, annotations: readOnly
  }, (input) => execute("get_job_status", actor, () => orchestrator.getJobStatus(actor, input.reference)));

  if (demoMode) {
    server.registerTool("get_demo_time_window", {
      title: "Get demo tomorrow morning window",
      description: "Return the deterministic tomorrow-morning ISO time range used by the simulator.",
      inputSchema: z.object({}), outputSchema, annotations: readOnly
    }, () => execute("get_demo_time_window", actor, () => orchestrator.getDefaultTomorrowMorning()));

    server.registerTool("reset_demo", {
      title: "Reset demo state",
      description: "Reset all synthetic services, approvals, orders, scheduling, and agent memory.",
      inputSchema: z.object({ confirmation: z.literal("RESET FLO DEMO") }), outputSchema, annotations: { ...externalMutation, openWorldHint: false }
    }, () => execute("reset_demo", actor, async () => {
      await orchestrator.resetDemo();
      return { reset: true };
    }));
  }

  return server;
};
