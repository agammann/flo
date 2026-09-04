import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { createDemoState, type InventoryItem, type Part } from "@flo/domain";
import { FloError, clone } from "@flo/shared-types";

export interface InventorySnapshot { parts: Part[]; inventory: InventoryItem[] }
export interface InventoryApi { app: Express; snapshot(): InventorySnapshot; reset(now?: Date): void }

export const createInventoryApi = (now = new Date()): InventoryApi => {
  let seeded = createDemoState(now);
  let state: InventorySnapshot = { parts: seeded.parts, inventory: seeded.inventory };
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => response.json({ ok: true, service: "mock-inventory-api" }));
  app.get("/parts", (request, response) => {
    const category = typeof request.query.category === "string" ? request.query.category.toLocaleLowerCase() : undefined;
    const query = typeof request.query.query === "string" ? request.query.query.toLocaleLowerCase() : undefined;
    response.json(state.parts.filter((part) =>
      (category === undefined || part.category.toLocaleLowerCase() === category) &&
      (query === undefined || [part.partNumber, part.brand, part.description].join(" ").toLocaleLowerCase().includes(query))
    ));
  });
  app.get("/parts/:id", (request, response) => {
    const part = state.parts.find((item) => item.id === request.params.id || item.partNumber === request.params.id);
    if (part === undefined) throw new FloError({ code: "PART_NOT_FOUND", message: `Part ${String(request.params.id)} was not found.`, retryable: false });
    response.json(part);
  });
  app.get("/inventory", (request, response) => {
    const partId = typeof request.query.partId === "string" ? request.query.partId : undefined;
    response.json(state.inventory.filter((item) => partId === undefined || item.partId === partId));
  });
  app.post("/inventory/:partId/reserve", (request, response) => {
    const body = z.object({ quantity: z.number().int().positive() }).parse(request.body);
    const item = state.inventory.find((candidate) => candidate.partId === request.params.partId);
    if (item === undefined) throw new FloError({ code: "INVENTORY_NOT_FOUND", message: "No inventory record exists for this part.", retryable: false });
    const available = item.quantityOnHand - item.quantityReserved;
    if (available < body.quantity) throw new FloError({ code: "INVENTORY_CHANGED", message: "Available inventory is lower than the requested reservation.", retryable: true, recovery: ["Refresh supplier availability."] });
    item.quantityReserved += body.quantity;
    item.updatedAt = new Date().toISOString();
    response.json(item);
  });
  app.post("/demo/reset", (_request, response) => {
    seeded = createDemoState(new Date());
    state = { parts: seeded.parts, inventory: seeded.inventory };
    response.json({ ok: true });
  });
  app.get("/demo/state", (_request, response) => response.json(state));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof FloError) {
      response.status(error.code.endsWith("NOT_FOUND") ? 404 : 409).json({ error: error.toStructuredError() });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", retryable: false, details: { issues: error.issues } } });
      return;
    }
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected inventory service failure.", retryable: true } });
  });

  return {
    app,
    snapshot: () => clone(state),
    reset: (resetNow = new Date()) => {
      seeded = createDemoState(resetNow);
      state = { parts: seeded.parts, inventory: seeded.inventory };
    }
  };
};
