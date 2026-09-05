import { z, type ZodType } from "zod";
import {
  approvalSchema,
  assetSchema,
  auditLogSchema,
  customerSchema,
  diagnosticRecordSchema,
  estimateSchema,
  inventoryItemSchema,
  partSchema,
  purchaseOrderSchema,
  scheduleSlotSchema,
  supplierPartSchema,
  supplierSchema,
  workOrderSchema,
  type Approval,
  type Asset,
  type AuditLog,
  type Customer,
  type DiagnosticRecord,
  type Estimate,
  type InventoryItem,
  type Part,
  type PurchaseOrder,
  type ScheduleSlot,
  type Supplier,
  type SupplierPart,
  type WorkOrder
} from "@flo/domain";
import { FloError, type StructuredError } from "@flo/shared-types";

interface ErrorEnvelope { error?: StructuredError }

class JsonHttpClient {
  constructor(private readonly baseUrl: string, private readonly timeoutMs = 4000) {}

  async request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = new Headers(init?.headers);
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
      const response = await fetch(new URL(path, this.baseUrl), {
        ...init,
        headers,
        signal: controller.signal
      });
      const body = await response.json() as unknown;
      if (!response.ok) {
        const envelope = body as ErrorEnvelope;
        throw new FloError(envelope.error ?? {
          code: "UPSTREAM_ERROR",
          message: `Upstream service returned HTTP ${response.status}.`,
          retryable: response.status >= 500,
          details: { status: response.status, path }
        });
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new FloError({
          code: "UPSTREAM_SCHEMA_MISMATCH",
          message: "An upstream service returned an invalid response.",
          retryable: false,
          details: { path, issues: parsed.error.issues }
        });
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof FloError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new FloError({ code: "UPSTREAM_TIMEOUT", message: `Timed out calling ${path}.`, retryable: true, recovery: ["Retry the request."] });
      }
      throw new FloError({ code: "UPSTREAM_UNAVAILABLE", message: `Could not reach ${path}.`, retryable: true, recovery: ["Verify the mock service is running."], details: { cause: error instanceof Error ? error.message : String(error) } });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface ShopAdapter {
  listWorkOrders(filters?: { status?: string; search?: string }): Promise<WorkOrder[]>;
  getWorkOrder(idOrNumber: string): Promise<WorkOrder>;
  updateWorkOrder(idOrNumber: string, patch: Partial<WorkOrder>): Promise<WorkOrder>;
  addDiagnostic(workOrderId: string, technicianId: string, finding: string): Promise<DiagnosticRecord>;
  getDiagnostics(workOrderId: string): Promise<DiagnosticRecord[]>;
  getAsset(id: string): Promise<Asset>;
  saveEstimate(estimate: Estimate): Promise<Estimate>;
  updateEstimate(id: string, patch: Partial<Estimate>): Promise<Estimate>;
  getEstimate(idOrWorkOrderId: string): Promise<Estimate>;
  getSchedule(filters?: { bayId?: string; from?: string; to?: string }): Promise<ScheduleSlot[]>;
  schedule(slot: ScheduleSlot): Promise<ScheduleSlot>;
  writeAudit(log: AuditLog): Promise<AuditLog>;
  reset(): Promise<void>;
}

export class HttpShopAdapter implements ShopAdapter {
  private readonly http: JsonHttpClient;
  constructor(baseUrl: string) { this.http = new JsonHttpClient(baseUrl); }

  listWorkOrders(filters: { status?: string; search?: string } = {}): Promise<WorkOrder[]> {
    const query = new URLSearchParams();
    if (filters.status !== undefined) query.set("status", filters.status);
    if (filters.search !== undefined) query.set("search", filters.search);
    return this.http.request(`/work-orders?${query.toString()}`, z.array(workOrderSchema));
  }
  getWorkOrder(idOrNumber: string): Promise<WorkOrder> { return this.http.request(`/work-orders/${encodeURIComponent(idOrNumber)}`, workOrderSchema); }
  updateWorkOrder(idOrNumber: string, patch: Partial<WorkOrder>): Promise<WorkOrder> { return this.http.request(`/work-orders/${encodeURIComponent(idOrNumber)}`, workOrderSchema, { method: "PATCH", body: JSON.stringify(patch) }); }
  addDiagnostic(workOrderId: string, technicianId: string, finding: string): Promise<DiagnosticRecord> { return this.http.request(`/work-orders/${encodeURIComponent(workOrderId)}/diagnostics`, diagnosticRecordSchema, { method: "POST", body: JSON.stringify({ technicianId, finding }) }); }
  getDiagnostics(workOrderId: string): Promise<DiagnosticRecord[]> { return this.http.request(`/work-orders/${encodeURIComponent(workOrderId)}/diagnostics`, z.array(diagnosticRecordSchema)); }
  getAsset(id: string): Promise<Asset> { return this.http.request(`/assets/${encodeURIComponent(id)}`, assetSchema); }
  saveEstimate(estimate: Estimate): Promise<Estimate> { return this.http.request("/estimates", estimateSchema, { method: "POST", body: JSON.stringify(estimate) }); }
  updateEstimate(id: string, patch: Partial<Estimate>): Promise<Estimate> { return this.http.request(`/estimates/${encodeURIComponent(id)}`, estimateSchema, { method: "PATCH", body: JSON.stringify(patch) }); }
  getEstimate(idOrWorkOrderId: string): Promise<Estimate> { return this.http.request(`/estimates/${encodeURIComponent(idOrWorkOrderId)}`, estimateSchema); }
  getSchedule(filters: { bayId?: string; from?: string; to?: string } = {}): Promise<ScheduleSlot[]> {
    const query = new URLSearchParams();
    if (filters.bayId !== undefined) query.set("bayId", filters.bayId);
    if (filters.from !== undefined) query.set("from", filters.from);
    if (filters.to !== undefined) query.set("to", filters.to);
    return this.http.request(`/schedule?${query.toString()}`, z.array(scheduleSlotSchema));
  }
  schedule(slot: ScheduleSlot): Promise<ScheduleSlot> { return this.http.request("/schedule", scheduleSlotSchema, { method: "POST", body: JSON.stringify(slot) }); }
  writeAudit(log: AuditLog): Promise<AuditLog> { return this.http.request("/audit-logs", auditLogSchema, { method: "POST", body: JSON.stringify(log) }); }
  async reset(): Promise<void> { await this.http.request("/demo/reset", z.object({ ok: z.literal(true) }), { method: "POST" }); }
}

export interface InventoryAdapter {
  searchParts(input: { category?: string; query?: string }): Promise<Part[]>;
  getPart(idOrNumber: string): Promise<Part>;
  searchInventory(partId?: string): Promise<InventoryItem[]>;
  reserve(partId: string, quantity: number): Promise<InventoryItem>;
  reset(): Promise<void>;
}

export class HttpInventoryAdapter implements InventoryAdapter {
  private readonly http: JsonHttpClient;
  constructor(baseUrl: string) { this.http = new JsonHttpClient(baseUrl); }
  searchParts(input: { category?: string; query?: string }): Promise<Part[]> {
    const query = new URLSearchParams();
    if (input.category !== undefined) query.set("category", input.category);
    if (input.query !== undefined) query.set("query", input.query);
    return this.http.request(`/parts?${query.toString()}`, z.array(partSchema));
  }
  getPart(idOrNumber: string): Promise<Part> { return this.http.request(`/parts/${encodeURIComponent(idOrNumber)}`, partSchema); }
  searchInventory(partId?: string): Promise<InventoryItem[]> { return this.http.request(`/inventory${partId === undefined ? "" : `?partId=${encodeURIComponent(partId)}`}`, z.array(inventoryItemSchema)); }
  reserve(partId: string, quantity: number): Promise<InventoryItem> { return this.http.request(`/inventory/${encodeURIComponent(partId)}/reserve`, inventoryItemSchema, { method: "POST", body: JSON.stringify({ quantity }) }); }
  async reset(): Promise<void> { await this.http.request("/demo/reset", z.object({ ok: z.literal(true) }), { method: "POST" }); }
}

export interface SupplierSearchResult { offers: SupplierPart[]; suppliers: Supplier[]; parts: Part[] }
const supplierSearchResultSchema = z.object({ offers: z.array(supplierPartSchema), suppliers: z.array(supplierSchema), parts: z.array(partSchema) });
const placeOrderResultSchema = z.object({ order: purchaseOrderSchema, idempotentReplay: z.boolean() });
export interface PlaceOrderResult { order: PurchaseOrder; idempotentReplay: boolean }

export interface SupplierAdapter {
  searchParts(input: { partIds: string[]; latestDeliveryDate?: string; maximumLandedCostCents?: number }): Promise<SupplierSearchResult>;
  placeOrder(input: { supplierId: string; workOrderId: string; supplierSku: string; quantity: number; idempotencyKey: string }): Promise<PlaceOrderResult>;
  getOrderStatus(idOrIdempotencyKey: string): Promise<PurchaseOrder>;
  cancelOrder(id: string): Promise<PurchaseOrder>;
  reset(): Promise<void>;
}

export class HttpSupplierAdapter implements SupplierAdapter {
  private readonly http: JsonHttpClient;
  constructor(baseUrl: string) { this.http = new JsonHttpClient(baseUrl); }
  searchParts(input: { partIds: string[]; latestDeliveryDate?: string; maximumLandedCostCents?: number }): Promise<SupplierSearchResult> { return this.http.request("/search", supplierSearchResultSchema, { method: "POST", body: JSON.stringify(input) }); }
  placeOrder(input: { supplierId: string; workOrderId: string; supplierSku: string; quantity: number; idempotencyKey: string }): Promise<PlaceOrderResult> { return this.http.request("/orders", placeOrderResultSchema, { method: "POST", body: JSON.stringify(input) }); }
  getOrderStatus(idOrIdempotencyKey: string): Promise<PurchaseOrder> { return this.http.request(`/orders/${encodeURIComponent(idOrIdempotencyKey)}`, purchaseOrderSchema); }
  cancelOrder(id: string): Promise<PurchaseOrder> { return this.http.request(`/orders/${encodeURIComponent(id)}/cancel`, purchaseOrderSchema, { method: "POST" }); }
  async reset(): Promise<void> { await this.http.request("/demo/reset", z.object({ ok: z.literal(true) }), { method: "POST" }); }
}

export interface CustomerAdapter {
  getCustomer(id: string): Promise<Customer>;
  sendMessage(input: { customerId: string; channel: "sms" | "email" | "phone"; body: string }): Promise<{ id: string; sentAt: string }>;
  requestApproval(input: { workOrderId: string; estimateId: string; estimateFingerprint: string; customerId: string; summary: string }): Promise<Approval>;
  getApprovalStatus(idOrReference: string): Promise<Approval>;
  simulateApproval(id: string, status: "approved" | "denied"): Promise<Approval>;
  reset(): Promise<void>;
}

const messageResultSchema = z.object({ id: z.string(), sentAt: z.iso.datetime() });
export class HttpCustomerAdapter implements CustomerAdapter {
  private readonly http: JsonHttpClient;
  constructor(baseUrl: string) { this.http = new JsonHttpClient(baseUrl); }
  getCustomer(id: string): Promise<Customer> { return this.http.request(`/customers/${encodeURIComponent(id)}`, customerSchema); }
  sendMessage(input: { customerId: string; channel: "sms" | "email" | "phone"; body: string }): Promise<{ id: string; sentAt: string }> { return this.http.request("/messages", messageResultSchema, { method: "POST", body: JSON.stringify(input) }); }
  requestApproval(input: { workOrderId: string; estimateId: string; estimateFingerprint: string; customerId: string; summary: string }): Promise<Approval> { return this.http.request("/approvals", approvalSchema, { method: "POST", body: JSON.stringify(input) }); }
  getApprovalStatus(idOrReference: string): Promise<Approval> { return this.http.request(`/approvals/${encodeURIComponent(idOrReference)}`, approvalSchema); }
  simulateApproval(id: string, status: "approved" | "denied"): Promise<Approval> { return this.http.request(`/approvals/${encodeURIComponent(id)}/simulate`, approvalSchema, { method: "POST", body: JSON.stringify({ status, actor: "demo-customer" }) }); }
  async reset(): Promise<void> { await this.http.request("/demo/reset", z.object({ ok: z.literal(true) }), { method: "POST" }); }
}

export interface AdapterSet { shop: ShopAdapter; inventory: InventoryAdapter; supplier: SupplierAdapter; customer: CustomerAdapter }

export const createHttpAdapters = (urls: { shop: string; inventory: string; supplier: string; customer: string }): AdapterSet => ({
  shop: new HttpShopAdapter(urls.shop),
  inventory: new HttpInventoryAdapter(urls.inventory),
  supplier: new HttpSupplierAdapter(urls.supplier),
  customer: new HttpCustomerAdapter(urls.customer)
});
