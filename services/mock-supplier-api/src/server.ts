import { randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { createDemoState, purchaseOrderSchema, type Part, type PurchaseOrder, type Supplier, type SupplierPart } from "@flo/domain";
import { FloError, clone } from "@flo/shared-types";

const searchSchema = z.object({
  partIds: z.array(z.string().min(1)).min(1),
  latestDeliveryDate: z.iso.date().optional(),
  maximumLandedCostCents: z.number().int().nonnegative().optional()
});

const placeOrderSchema = z.object({
  supplierId: z.string().min(1),
  workOrderId: z.string().min(1),
  supplierSku: z.string().min(1),
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().min(8)
});

interface SupplierState { suppliers: Supplier[]; parts: Part[]; offers: SupplierPart[]; orders: PurchaseOrder[] }
export interface SupplierApi { app: Express; snapshot(): SupplierState; reset(now?: Date): void }

export const createSupplierApi = (now = new Date()): SupplierApi => {
  const makeState = (at: Date): SupplierState => {
    const seeded = createDemoState(at);
    return { suppliers: seeded.suppliers, parts: seeded.parts, offers: seeded.supplierParts, orders: [] };
  };
  let state = makeState(now);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => response.json({ ok: true, service: "mock-supplier-api" }));
  app.get("/suppliers", (_request, response) => response.json(state.suppliers));
  app.post("/search", (request, response) => {
    const input = searchSchema.parse(request.body);
    const offers = state.offers.filter((offer) =>
      input.partIds.includes(offer.partId) &&
      offer.inventory > 0 &&
      (input.latestDeliveryDate === undefined || offer.deliveryDate <= input.latestDeliveryDate) &&
      (input.maximumLandedCostCents === undefined || offer.priceCents + offer.shippingCostCents <= input.maximumLandedCostCents)
    );
    response.json({ offers, suppliers: state.suppliers, parts: state.parts.filter((part) => input.partIds.includes(part.id)) });
  });
  app.post("/orders", (request, response) => {
    const input = placeOrderSchema.parse(request.body);
    const existing = state.orders.find((order) => order.idempotencyKey === input.idempotencyKey);
    if (existing !== undefined) {
      response.json({ order: existing, idempotentReplay: true });
      return;
    }
    const offer = state.offers.find((item) => item.supplierId === input.supplierId && item.supplierSku === input.supplierSku);
    if (offer === undefined) throw new FloError({ code: "OFFER_NOT_FOUND", message: "The selected supplier offer no longer exists.", retryable: true, recovery: ["Search suppliers again."] });
    if (offer.inventory < input.quantity) throw new FloError({ code: "INVENTORY_CHANGED", message: "Supplier inventory changed before the order could be placed.", retryable: true, recovery: ["Search suppliers again."] });
    offer.inventory -= input.quantity;
    const order = purchaseOrderSchema.parse({
      id: `po-${randomUUID()}`,
      supplierId: input.supplierId,
      workOrderId: input.workOrderId,
      items: [{ partId: offer.partId, supplierSku: offer.supplierSku, quantity: input.quantity, unitCostCents: offer.priceCents }],
      totalCents: offer.priceCents * input.quantity + offer.shippingCostCents,
      status: "placed",
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString()
    });
    state.orders.push(order);
    response.status(201).json({ order, idempotentReplay: false });
  });
  app.get("/orders/:id", (request, response) => {
    const order = state.orders.find((item) => item.id === request.params.id || item.idempotencyKey === request.params.id);
    if (order === undefined) throw new FloError({ code: "ORDER_NOT_FOUND", message: "Purchase order was not found.", retryable: false });
    response.json(order);
  });
  app.post("/orders/:id/cancel", (request, response) => {
    const order = state.orders.find((item) => item.id === request.params.id);
    if (order === undefined) throw new FloError({ code: "ORDER_NOT_FOUND", message: "Purchase order was not found.", retryable: false });
    if (order.status === "delivered") throw new FloError({ code: "ORDER_NOT_CANCELLABLE", message: "A delivered order cannot be cancelled.", retryable: false });
    order.status = "cancelled";
    response.json(order);
  });
  app.post("/demo/reset", (_request, response) => { state = makeState(new Date()); response.json({ ok: true }); });
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
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected supplier service failure.", retryable: true } });
  });

  return { app, snapshot: () => clone(state), reset: (resetNow = new Date()) => { state = makeState(resetNow); } };
};
