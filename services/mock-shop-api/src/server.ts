import { randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  createDemoState,
  diagnosticRecordSchema,
  estimateSchema,
  scheduleSlotSchema,
  workOrderSchema,
  type FloState
} from "@flo/domain";
import { FloError, clone } from "@flo/shared-types";

type MutableShopState = Pick<FloState, "workOrders" | "assets" | "diagnostics" | "estimates" | "schedule" | "auditLogs">;

const patchWorkOrderSchema = workOrderSchema.partial().omit({ id: true, workOrderNumber: true, createdAt: true });

const notFound = (resource: string, id: string): FloError => new FloError({
  code: "NOT_FOUND",
  message: `${resource} ${id} was not found.`,
  retryable: false
});

export interface ShopApi {
  app: Express;
  snapshot(): MutableShopState;
  reset(now?: Date): void;
}

export const createShopApi = (now = new Date()): ShopApi => {
  let state = createDemoState(now);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "128kb" }));

  app.get("/health", (_request, response) => response.json({ ok: true, service: "mock-shop-api" }));
  app.get("/work-orders", (request, response) => {
    const status = typeof request.query.status === "string" ? request.query.status : undefined;
    const search = typeof request.query.search === "string" ? request.query.search.toLocaleLowerCase() : undefined;
    const results = state.workOrders.filter((workOrder) =>
      (status === undefined || workOrder.status === status) &&
      (search === undefined || [workOrder.workOrderNumber, workOrder.complaint, workOrder.diagnosis].join(" ").toLocaleLowerCase().includes(search))
    );
    response.json(results);
  });
  app.post("/work-orders", (request, response) => {
    const workOrder = workOrderSchema.parse(request.body);
    if (state.workOrders.some((item) => item.id === workOrder.id || item.workOrderNumber === workOrder.workOrderNumber)) {
      throw new FloError({ code: "WORK_ORDER_EXISTS", message: "A work order with that ID or number already exists.", retryable: false });
    }
    state.workOrders.push(workOrder);
    response.status(201).json(workOrder);
  });
  app.get("/work-orders/:id", (request, response) => {
    const workOrder = state.workOrders.find((item) => item.id === request.params.id || item.workOrderNumber === request.params.id);
    if (workOrder === undefined) throw notFound("Work order", String(request.params.id));
    response.json(workOrder);
  });
  app.patch("/work-orders/:id", (request, response) => {
    const index = state.workOrders.findIndex((item) => item.id === request.params.id || item.workOrderNumber === request.params.id);
    if (index < 0) throw notFound("Work order", String(request.params.id));
    const current = state.workOrders[index]!;
    const patch = patchWorkOrderSchema.parse(request.body);
    const updated = workOrderSchema.parse({ ...current, ...patch, updatedAt: new Date().toISOString() });
    state.workOrders[index] = updated;
    response.json(updated);
  });
  app.post("/work-orders/:id/diagnostics", (request, response) => {
    const workOrder = state.workOrders.find((item) => item.id === request.params.id || item.workOrderNumber === request.params.id);
    if (workOrder === undefined) throw notFound("Work order", String(request.params.id));
    const body = z.object({ technicianId: z.string().min(1), finding: z.string().min(1).max(2000) }).parse(request.body);
    const diagnostic = diagnosticRecordSchema.parse({
      id: `diagnostic-${randomUUID()}`,
      workOrderId: workOrder.id,
      technicianId: body.technicianId,
      finding: body.finding,
      createdAt: new Date().toISOString()
    });
    state.diagnostics.push(diagnostic);
    workOrder.diagnosis = workOrder.diagnosis.length === 0 ? body.finding : `${workOrder.diagnosis}; ${body.finding}`;
    workOrder.updatedAt = new Date().toISOString();
    response.status(201).json(diagnostic);
  });
  app.get("/work-orders/:id/diagnostics", (request, response) => {
    const workOrder = state.workOrders.find((item) => item.id === request.params.id || item.workOrderNumber === request.params.id);
    if (workOrder === undefined) throw notFound("Work order", String(request.params.id));
    response.json(state.diagnostics.filter((item) => item.workOrderId === workOrder.id));
  });
  app.get("/assets/:id", (request, response) => {
    const asset = state.assets.find((item) => item.id === request.params.id);
    if (asset === undefined) throw notFound("Asset", String(request.params.id));
    response.json(asset);
  });
  app.get("/estimates/:id", (request, response) => {
    const estimate = state.estimates.find((item) => item.id === request.params.id || item.workOrderId === request.params.id);
    if (estimate === undefined) throw notFound("Estimate", String(request.params.id));
    response.json(estimate);
  });
  app.post("/estimates", (request, response) => {
    const estimate = estimateSchema.parse(request.body);
    const index = state.estimates.findIndex((item) => item.id === estimate.id || item.workOrderId === estimate.workOrderId);
    if (index >= 0) state.estimates[index] = estimate;
    else state.estimates.push(estimate);
    const workOrder = state.workOrders.find((item) => item.id === estimate.workOrderId);
    if (workOrder !== undefined) {
      workOrder.estimateId = estimate.id;
      workOrder.status = "estimating";
      workOrder.updatedAt = new Date().toISOString();
    }
    response.status(index >= 0 ? 200 : 201).json(estimate);
  });
  app.patch("/estimates/:id", (request, response) => {
    const index = state.estimates.findIndex((item) => item.id === request.params.id);
    if (index < 0) throw notFound("Estimate", String(request.params.id));
    const updated = estimateSchema.parse({ ...state.estimates[index]!, ...estimateSchema.partial().parse(request.body), updatedAt: new Date().toISOString() });
    state.estimates[index] = updated;
    response.json(updated);
  });
  app.get("/schedule", (request, response) => {
    const bayId = typeof request.query.bayId === "string" ? request.query.bayId : undefined;
    const from = typeof request.query.from === "string" ? request.query.from : undefined;
    const to = typeof request.query.to === "string" ? request.query.to : undefined;
    response.json(state.schedule.filter((slot) =>
      (bayId === undefined || slot.bayId === bayId) &&
      (from === undefined || slot.end > from) &&
      (to === undefined || slot.start < to)
    ));
  });
  app.post("/schedule", (request, response) => {
    const slot = scheduleSlotSchema.parse(request.body);
    const conflict = state.schedule.find((item) => item.bayId === slot.bayId && item.start < slot.end && slot.start < item.end);
    if (conflict !== undefined) {
      throw new FloError({
        code: "BAY_CONFLICT",
        message: `${slot.bayId} is already occupied during that time.`,
        retryable: true,
        recovery: ["Choose another bay.", "Choose another time."],
        details: { conflictingSlotId: conflict.id }
      });
    }
    state.schedule.push(slot);
    const workOrder = state.workOrders.find((item) => item.id === slot.workOrderId);
    if (workOrder !== undefined) {
      workOrder.scheduledStart = slot.start;
      workOrder.scheduledEnd = slot.end;
      workOrder.bayId = slot.bayId;
      workOrder.status = "scheduled";
      workOrder.updatedAt = new Date().toISOString();
    }
    response.status(201).json(slot);
  });
  app.get("/audit-logs", (_request, response) => response.json(state.auditLogs));
  app.post("/audit-logs", (request, response) => {
    state.auditLogs.push(request.body as FloState["auditLogs"][number]);
    response.status(201).json(request.body);
  });
  app.post("/demo/reset", (_request, response) => {
    state = createDemoState(new Date());
    response.json({ ok: true });
  });
  app.get("/demo/state", (_request, response) => response.json({
    workOrders: state.workOrders,
    assets: state.assets,
    diagnostics: state.diagnostics,
    estimates: state.estimates,
    schedule: state.schedule,
    auditLogs: state.auditLogs
  }));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof FloError) {
      response.status(error.code === "NOT_FOUND" ? 404 : error.code.endsWith("CONFLICT") ? 409 : 400).json({ error: error.toStructuredError() });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", retryable: false, details: { issues: error.issues } } });
      return;
    }
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected shop service failure.", retryable: true } });
  });

  return {
    app,
    snapshot: () => clone({
      workOrders: state.workOrders,
      assets: state.assets,
      diagnostics: state.diagnostics,
      estimates: state.estimates,
      schedule: state.schedule,
      auditLogs: state.auditLogs
    }),
    reset: (resetNow = new Date()) => { state = createDemoState(resetNow); }
  };
};
