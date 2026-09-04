import { randomUUID } from "node:crypto";
import type { AdapterSet, SupplierSearchResult } from "@flo/adapters";
import { checkCompatibility, rankSupplierOptions, type CompatibilityResult, type RankedSupplierPart } from "@flo/compatibility-engine";
import {
  createDemoDates,
  requirePermission,
  requireWorkOrderRead,
  type Approval,
  type Asset,
  type AuditLog,
  type ContextMemory,
  type DiagnosticRecord,
  type Estimate,
  type Part,
  type PurchaseOrder,
  type ScheduleSlot,
  type SupplierPart,
  type WorkOrder
} from "@flo/domain";
import { applyMarkup, calculateEstimate, defaultEstimatePolicy, formatCurrency } from "@flo/estimate-engine";
import { FloError, clone, type Actor } from "@flo/shared-types";

export interface MemoryStore {
  get(actorId: string): Promise<ContextMemory | undefined>;
  put(memory: ContextMemory): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryJobMemoryStore implements MemoryStore {
  private readonly memories = new Map<string, ContextMemory>();
  async get(actorId: string): Promise<ContextMemory | undefined> { const value = this.memories.get(actorId); return value === undefined ? undefined : clone(value); }
  async put(memory: ContextMemory): Promise<void> { this.memories.set(memory.actorId, clone(memory)); }
  async clear(): Promise<void> { this.memories.clear(); }
}

interface PendingOperation {
  token: string;
  actorId: string;
  workOrderId: string;
  supplierPart: SupplierPart;
  schedule: Omit<ScheduleSlot, "id">;
  idempotencyKey: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface PricedRankedSupplierPart extends RankedSupplierPart {
  landedCostCents: number;
  customerPriceCents: number;
  grossPartMarginCents: number;
}

export interface PartsSearchResult {
  workOrder: WorkOrder;
  asset: Asset;
  compatibility: CompatibilityResult[];
  inventory: Array<{ partId: string; available: number; location: string }>;
  supplierSearch: SupplierSearchResult;
  ranked: PricedRankedSupplierPart[];
  recommendation: PricedRankedSupplierPart | null;
}

export interface JobStatus {
  workOrder: WorkOrder;
  asset: Asset;
  estimate: Estimate | null;
  approval: Approval | null;
  purchaseOrder: PurchaseOrder | null;
  summary: string;
}

export interface TransactionPreparation {
  confirmationToken: string;
  expiresAt: string;
  summary: string;
  requiresConfirmation: true;
}

export interface TransactionResult {
  workOrder: WorkOrder;
  purchaseOrder: PurchaseOrder;
  scheduleSlot: ScheduleSlot;
  auditLogIds: string[];
  summary: string;
}

export class FloOrchestrator {
  private readonly pending = new Map<string, PendingOperation>();
  private readonly ordersByWorkOrder = new Map<string, PurchaseOrder>();

  constructor(
    private readonly adapters: AdapterSet,
    private readonly memory: MemoryStore = new InMemoryJobMemoryStore(),
    private readonly clock: () => Date = () => new Date()
  ) {}

  private async remember(actor: Actor, patch: Partial<ContextMemory>): Promise<ContextMemory> {
    const current = await this.memory.get(actor.id);
    const activeWorkOrderId = patch.activeWorkOrderId ?? current?.activeWorkOrderId ?? null;
    const recent = patch.recentWorkOrderIds ?? current?.recentWorkOrderIds ?? [];
    const next: ContextMemory = {
      actorId: actor.id,
      activeWorkOrderId,
      recentWorkOrderIds: activeWorkOrderId === null ? recent : [activeWorkOrderId, ...recent.filter((id) => id !== activeWorkOrderId)].slice(0, 10),
      recentAssetId: patch.recentAssetId ?? current?.recentAssetId ?? null,
      recentCustomerId: patch.recentCustomerId ?? current?.recentCustomerId ?? null,
      selectedSupplierPart: patch.selectedSupplierPart ?? current?.selectedSupplierPart ?? null,
      pendingApprovalId: patch.pendingApprovalId ?? current?.pendingApprovalId ?? null,
      updatedAt: this.clock().toISOString()
    };
    await this.memory.put(next);
    return next;
  }

  private async audit(actor: Actor, action: string, resource: string, resourceId: string, metadata: Record<string, unknown> = {}): Promise<AuditLog> {
    const log: AuditLog = {
      id: `audit-${randomUUID()}`,
      actorId: actor.id,
      actorRole: actor.role,
      action,
      resource,
      resourceId,
      timestamp: this.clock().toISOString(),
      metadata
    };
    return this.adapters.shop.writeAudit(log);
  }

  async getWorkOrder(actor: Actor, idOrNumber: string): Promise<WorkOrder> {
    const workOrder = await this.adapters.shop.getWorkOrder(idOrNumber);
    requireWorkOrderRead(actor, workOrder.id);
    await this.remember(actor, { activeWorkOrderId: workOrder.id, recentAssetId: workOrder.assetId, recentCustomerId: workOrder.customerId });
    return workOrder;
  }

  async listOpenWorkOrders(actor: Actor): Promise<WorkOrder[]> {
    const workOrders = await this.adapters.shop.listWorkOrders();
    return workOrders.filter((item) => !["completed", "cancelled"].includes(item.status)).filter((item) => {
      try { requireWorkOrderRead(actor, item.id); return true; } catch { return false; }
    });
  }

  async searchWorkOrders(actor: Actor, query: string): Promise<WorkOrder[]> {
    const workOrders = await this.adapters.shop.listWorkOrders({ search: query });
    return workOrders.filter((item) => {
      try { requireWorkOrderRead(actor, item.id); return true; } catch { return false; }
    });
  }

  async addWorkOrderNote(actor: Actor, note: string, workOrderIdOrNumber?: string): Promise<WorkOrder> {
    requirePermission(actor, "work_order:write_diagnostic");
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    const updated = await this.adapters.shop.updateWorkOrder(workOrder.id, { notes: [...workOrder.notes, note] });
    await this.audit(actor, "work_order.note_added", "work_order", workOrder.id, { noteLength: note.length });
    return updated;
  }

  async getAsset(actor: Actor, workOrderIdOrNumber?: string): Promise<Asset> {
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    return this.adapters.shop.getAsset(workOrder.assetId);
  }

  async recordDiagnostic(actor: Actor, finding: string, workOrderIdOrNumber?: string): Promise<DiagnosticRecord> {
    requirePermission(actor, "work_order:write_diagnostic");
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    requireWorkOrderRead(actor, workOrder.id);
    const diagnostic = await this.adapters.shop.addDiagnostic(workOrder.id, actor.id, finding);
    await this.audit(actor, "diagnostic.recorded", "work_order", workOrder.id, { diagnosticId: diagnostic.id });
    return diagnostic;
  }

  async getDiagnosticHistory(actor: Actor, workOrderIdOrNumber?: string): Promise<DiagnosticRecord[]> {
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    return this.adapters.shop.getDiagnostics(workOrder.id);
  }

  async checkPartCompatibility(actor: Actor, partIdOrNumber: string, workOrderIdOrNumber?: string): Promise<CompatibilityResult> {
    requirePermission(actor, "parts:search");
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    const [asset, part] = await Promise.all([
      this.adapters.shop.getAsset(workOrder.assetId),
      this.adapters.inventory.getPart(partIdOrNumber)
    ]);
    return checkCompatibility(asset, part);
  }

  async searchParts(actor: Actor, input: { category?: string; query?: string }): Promise<Part[]> {
    requirePermission(actor, "parts:search");
    return this.adapters.inventory.searchParts(input);
  }

  async searchInventory(actor: Actor, partId?: string): Promise<Array<{ partId: string; available: number; location: string }>> {
    requirePermission(actor, "parts:search");
    const rows = await this.adapters.inventory.searchInventory(partId);
    return rows.map((row) => ({ partId: row.partId, available: row.quantityOnHand - row.quantityReserved, location: row.location }));
  }

  async searchSuppliers(actor: Actor, input: { partIds: string[]; latestDeliveryDate?: string; maximumLandedCostCents?: number }): Promise<SupplierSearchResult> {
    requirePermission(actor, "parts:search");
    return this.adapters.supplier.searchParts(input);
  }

  async findCompatibleParts(actor: Actor, input: { workOrderIdOrNumber?: string; category: string; maximumLandedCostCents?: number; latestDeliveryDate?: string; excludeCheapest?: boolean }): Promise<PartsSearchResult> {
    requirePermission(actor, "parts:search");
    const workOrder = input.workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, input.workOrderIdOrNumber);
    const asset = await this.adapters.shop.getAsset(workOrder.assetId);
    const parts = await this.adapters.inventory.searchParts({ category: input.category });
    const compatibility = parts.map((part) => checkCompatibility(asset, part));
    const compatiblePartIds = compatibility.filter((result) => result.compatible === true).map((result) => result.partId);
    if (compatiblePartIds.length === 0) {
      throw new FloError({ code: "NO_COMPATIBLE_PARTS", message: `No deterministic compatibility match was found for ${input.category}.`, retryable: false, recovery: ["Verify the asset configuration.", "Escalate to a parts specialist."] });
    }
    const [supplierSearch, inventoryRows] = await Promise.all([
      this.adapters.supplier.searchParts({ partIds: compatiblePartIds, ...(input.latestDeliveryDate === undefined ? {} : { latestDeliveryDate: input.latestDeliveryDate }), ...(input.maximumLandedCostCents === undefined ? {} : { maximumLandedCostCents: input.maximumLandedCostCents }) }),
      Promise.all(compatiblePartIds.map((partId) => this.adapters.inventory.searchInventory(partId)))
    ]);
    const ranked = rankSupplierOptions({
      offers: supplierSearch.offers,
      parts: supplierSearch.parts,
      suppliers: supplierSearch.suppliers,
      ...(input.latestDeliveryDate === undefined ? {} : { latestDeliveryDate: input.latestDeliveryDate }),
      ...(input.maximumLandedCostCents === undefined ? {} : { maximumLandedCostCents: input.maximumLandedCostCents }),
      excludeCheapest: input.excludeCheapest ?? false
    }).map((item): PricedRankedSupplierPart => {
      const landedCostCents = item.offer.priceCents + item.offer.shippingCostCents;
      const customerPriceCents = applyMarkup(item.offer.priceCents, defaultEstimatePolicy.partMarkupBasisPoints) + item.offer.shippingCostCents;
      return {
        ...item,
        landedCostCents,
        customerPriceCents,
        grossPartMarginCents: customerPriceCents - landedCostCents
      };
    });
    const recommendation = ranked[0] ?? null;
    if (recommendation !== null) await this.remember(actor, { activeWorkOrderId: workOrder.id, recentAssetId: asset.id, selectedSupplierPart: recommendation.offer });
    return {
      workOrder,
      asset,
      compatibility,
      inventory: inventoryRows.flat().map((row) => ({ partId: row.partId, available: row.quantityOnHand - row.quantityReserved, location: row.location })),
      supplierSearch,
      ranked,
      recommendation
    };
  }

  async compareParts(actor: Actor, input: { workOrderIdOrNumber?: string; category: string; maximumLandedCostCents?: number; latestDeliveryDate?: string; excludeCheapest?: boolean }): Promise<PartsSearchResult> {
    return this.findCompatibleParts(actor, input);
  }

  async createEstimate(actor: Actor, input: { workOrderIdOrNumber?: string; supplierSku?: string; laborHours?: number }): Promise<Estimate> {
    requirePermission(actor, "estimate:write");
    const workOrder = input.workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, input.workOrderIdOrNumber);
    const memory = await this.memory.get(actor.id);
    let selected = memory?.selectedSupplierPart ?? null;
    if (input.supplierSku !== undefined && selected?.supplierSku !== input.supplierSku) {
      const parts = await this.adapters.inventory.searchParts({ category: "alternator" });
      const search = await this.adapters.supplier.searchParts({ partIds: parts.map((part) => part.id) });
      selected = search.offers.find((offer) => offer.supplierSku === input.supplierSku) ?? null;
    }
    if (selected === null) throw new FloError({ code: "NO_SELECTED_PART", message: "No supplier part has been selected for the estimate.", retryable: false, recovery: ["Search and compare compatible parts first."] });
    const part = await this.adapters.inventory.getPart(selected.partId);
    const estimate = calculateEstimate({ id: workOrder.estimateId ?? `estimate-${randomUUID()}`, workOrderId: workOrder.id, part, offer: selected, ...(input.laborHours === undefined ? {} : { laborHours: input.laborHours }), now: this.clock() });
    const saved = await this.adapters.shop.saveEstimate(estimate);
    await this.audit(actor, "estimate.created", "estimate", saved.id, { workOrderId: workOrder.id, totalCents: saved.totalCents });
    return saved;
  }

  async calculateEstimatePreview(actor: Actor, input: { workOrderIdOrNumber?: string; supplierSku?: string; laborHours?: number }): Promise<Estimate> {
    requirePermission(actor, "estimate:read");
    const workOrder = input.workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, input.workOrderIdOrNumber);
    const memory = await this.memory.get(actor.id);
    let selected = memory?.selectedSupplierPart ?? null;
    if (input.supplierSku !== undefined && selected?.supplierSku !== input.supplierSku) {
      const parts = await this.adapters.inventory.searchParts({});
      const result = await this.adapters.supplier.searchParts({ partIds: parts.map((part) => part.id) });
      selected = result.offers.find((offer) => offer.supplierSku === input.supplierSku) ?? null;
    }
    if (selected === null) throw new FloError({ code: "NO_SELECTED_PART", message: "No supplier part has been selected for an estimate preview.", retryable: false, recovery: ["Search and compare compatible parts first."] });
    const part = await this.adapters.inventory.getPart(selected.partId);
    return calculateEstimate({ id: `preview-${randomUUID()}`, workOrderId: workOrder.id, part, offer: selected, ...(input.laborHours === undefined ? {} : { laborHours: input.laborHours }), now: this.clock() });
  }

  async getEstimate(actor: Actor, idOrWorkOrderId?: string): Promise<Estimate> {
    requirePermission(actor, "estimate:read");
    const reference = idOrWorkOrderId ?? (await this.resolveWorkOrder(actor, "active job")).id;
    const estimate = await this.adapters.shop.getEstimate(reference);
    requireWorkOrderRead(actor, estimate.workOrderId);
    return estimate;
  }

  async requestCustomerApproval(actor: Actor, workOrderIdOrNumber?: string): Promise<Approval> {
    requirePermission(actor, "approval:request");
    requirePermission(actor, "customer:message");
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    const estimate = await this.adapters.shop.getEstimate(workOrder.id);
    const customer = await this.adapters.customer.getCustomer(workOrder.customerId);
    const approval = await this.adapters.customer.requestApproval({
      workOrderId: workOrder.id,
      estimateId: estimate.id,
      customerId: customer.id,
      summary: `Please approve estimate ${estimate.id} for ${formatCurrency(estimate.totalCents)} on work order ${workOrder.workOrderNumber}.`
    });
    await Promise.all([
      this.adapters.shop.updateEstimate(estimate.id, { status: "sent", approvalStatus: "pending" }),
      this.adapters.shop.updateWorkOrder(workOrder.id, { status: "awaiting_approval" })
    ]);
    await this.remember(actor, { activeWorkOrderId: workOrder.id, pendingApprovalId: approval.id });
    await this.audit(actor, "approval.requested", "approval", approval.id, { workOrderId: workOrder.id, channel: approval.channel });
    return approval;
  }

  async getCustomer(actor: Actor, workOrderIdOrNumber?: string) {
    requirePermission(actor, "customer:read");
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    return this.adapters.customer.getCustomer(workOrder.customerId);
  }

  async sendCustomerMessage(actor: Actor, body: string, workOrderIdOrNumber?: string) {
    requirePermission(actor, "customer:message");
    const workOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    const customer = await this.adapters.customer.getCustomer(workOrder.customerId);
    const message = await this.adapters.customer.sendMessage({ customerId: customer.id, channel: customer.preferredContactMethod, body });
    await this.audit(actor, "customer.message_sent", "customer", customer.id, { workOrderId: workOrder.id, channel: customer.preferredContactMethod, messageId: message.id });
    return message;
  }

  async getCustomerApprovalStatus(actor: Actor, reference?: string): Promise<Approval> {
    const workOrder = await this.resolveWorkOrder(actor, reference ?? "active job");
    const memory = await this.memory.get(actor.id);
    const approval = await this.adapters.customer.getApprovalStatus(memory?.pendingApprovalId ?? workOrder.id);
    if (approval.status === "approved" || approval.status === "denied") {
      await Promise.all([
        this.adapters.shop.updateEstimate(approval.estimateId, { status: approval.status === "approved" ? "approved" : "declined", approvalStatus: approval.status }),
        this.adapters.shop.updateWorkOrder(workOrder.id, { status: approval.status === "approved" ? "approved" : "estimating" })
      ]);
    }
    return approval;
  }

  async simulateCustomerApproval(actor: Actor, status: "approved" | "denied", approvalId?: string): Promise<Approval> {
    if (process.env.NODE_ENV === "production") throw new FloError({ code: "DEMO_ONLY", message: "Customer approval simulation is disabled in production.", retryable: false });
    const memory = await this.memory.get(actor.id);
    const id = approvalId ?? memory?.pendingApprovalId;
    if (id === undefined || id === null) throw new FloError({ code: "APPROVAL_NOT_FOUND", message: "No pending approval is in context.", retryable: false });
    const approval = await this.adapters.customer.simulateApproval(id, status);
    await this.getCustomerApprovalStatus(actor, approval.workOrderId);
    await this.audit({ ...actor, id: "demo-customer", role: actor.role }, `approval.${status}`, "approval", approval.id, { simulated: true });
    return approval;
  }

  async getSchedule(actor: Actor, input: { bayId?: string; from?: string; to?: string } = {}): Promise<ScheduleSlot[]> {
    requirePermission(actor, "schedule:read");
    return this.adapters.shop.getSchedule(input);
  }

  async findAvailableSlot(actor: Actor, input: { bayId: string; start: string; end: string }): Promise<{ available: boolean; conflicts: ScheduleSlot[] }> {
    requirePermission(actor, "schedule:read");
    const conflicts = await this.adapters.shop.getSchedule({ bayId: input.bayId, from: input.start, to: input.end });
    return { available: conflicts.length === 0, conflicts };
  }

  async preparePurchaseAndSchedule(actor: Actor, input: { workOrderIdOrNumber?: string; bayId: string; start: string; end: string; supplierSku?: string; idempotencyKey?: string }): Promise<TransactionPreparation> {
    requirePermission(actor, "purchase:prepare");
    requirePermission(actor, "schedule:request");
    const workOrder = input.workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, input.workOrderIdOrNumber);
    let approval: Approval;
    try {
      approval = await this.getCustomerApprovalStatus(actor, workOrder.id);
    } catch (error) {
      if (!(error instanceof FloError) || error.code !== "APPROVAL_NOT_FOUND") throw error;
      throw new FloError({ code: "APPROVAL_REQUIRED", message: "Customer approval has not been requested; purchase cannot be prepared.", retryable: false, recovery: ["Create an estimate and request customer approval."] });
    }
    if (approval.status !== "approved") throw new FloError({ code: "APPROVAL_REQUIRED", message: `Customer approval is ${approval.status}; purchase cannot be prepared.`, retryable: false, recovery: ["Wait for customer approval."] });
    const memory = await this.memory.get(actor.id);
    const supplierPart = memory?.selectedSupplierPart;
    if (supplierPart === undefined || supplierPart === null || (input.supplierSku !== undefined && supplierPart.supplierSku !== input.supplierSku)) {
      throw new FloError({ code: "NO_SELECTED_PART", message: "The selected supplier offer is missing or changed.", retryable: false, recovery: ["Search and compare parts again."] });
    }
    const availability = await this.findAvailableSlot(actor, { bayId: input.bayId, start: input.start, end: input.end });
    if (!availability.available) throw new FloError({ code: "BAY_CONFLICT", message: `${input.bayId} is occupied during the requested time.`, retryable: true, recovery: ["Choose another bay.", "Choose another time."], details: { conflicts: availability.conflicts } });
    const token = randomUUID();
    const expiresAt = new Date(this.clock().getTime() + 5 * 60 * 1000).toISOString();
    const pending: PendingOperation = {
      token,
      actorId: actor.id,
      workOrderId: workOrder.id,
      supplierPart,
      schedule: { bayId: input.bayId, start: input.start, end: input.end, workOrderId: workOrder.id, technicianId: workOrder.assignedTechnicianId ?? actor.id },
      idempotencyKey: input.idempotencyKey ?? `flo-${workOrder.id}-${supplierPart.supplierSku}`,
      expiresAt,
      consumedAt: null
    };
    this.pending.set(token, pending);
    const supplierName = (await this.adapters.supplier.searchParts({ partIds: [supplierPart.partId] })).suppliers.find((item) => item.id === supplierPart.supplierId)?.name ?? supplierPart.supplierId;
    return {
      confirmationToken: token,
      expiresAt,
      requiresConfirmation: true,
      summary: `Ready to order ${supplierPart.supplierSku} from ${supplierName} for ${formatCurrency(supplierPart.priceCents + supplierPart.shippingCostCents)} and schedule work order ${workOrder.workOrderNumber} in ${input.bayId} from ${input.start} to ${input.end}. No action has been executed.`
    };
  }

  async confirmTransaction(actor: Actor, confirmationToken: string): Promise<TransactionResult> {
    requirePermission(actor, "purchase:execute");
    requirePermission(actor, "schedule:write");
    const pending = this.pending.get(confirmationToken);
    if (pending === undefined || pending.actorId !== actor.id) throw new FloError({ code: "CONFIRMATION_INVALID", message: "The confirmation token is invalid for this actor.", retryable: false });
    if (pending.consumedAt !== null) throw new FloError({ code: "CONFIRMATION_ALREADY_USED", message: "This confirmation has already been used.", retryable: false });
    if (new Date(pending.expiresAt).getTime() <= this.clock().getTime()) throw new FloError({ code: "CONFIRMATION_EXPIRED", message: "The confirmation expired before execution.", retryable: false, recovery: ["Prepare the transaction again."] });
    const workOrder = await this.getWorkOrder(actor, pending.workOrderId);
    const approval = await this.getCustomerApprovalStatus(actor, workOrder.id);
    if (approval.status !== "approved") throw new FloError({ code: "APPROVAL_REQUIRED", message: "Customer approval is no longer valid.", retryable: false });
    const availability = await this.findAvailableSlot(actor, { bayId: pending.schedule.bayId, start: pending.schedule.start, end: pending.schedule.end });
    if (!availability.available) throw new FloError({ code: "BAY_CONFLICT", message: "The requested bay became unavailable before confirmation.", retryable: true, recovery: ["Prepare the transaction with another slot."] });

    const orderResult = await this.adapters.supplier.placeOrder({
      supplierId: pending.supplierPart.supplierId,
      workOrderId: workOrder.id,
      supplierSku: pending.supplierPart.supplierSku,
      quantity: 1,
      idempotencyKey: pending.idempotencyKey
    });
    let slot: ScheduleSlot;
    try {
      slot = await this.adapters.shop.schedule({ id: `slot-${randomUUID()}`, ...pending.schedule });
    } catch (scheduleError) {
      try {
        await this.adapters.supplier.cancelOrder(orderResult.order.id);
        await this.audit(actor, "purchase_order.cancelled_after_schedule_failure", "purchase_order", orderResult.order.id, {
          workOrderId: workOrder.id,
          idempotencyKey: pending.idempotencyKey
        });
      } catch (cancellationError) {
        throw new FloError({
          code: "TRANSACTION_PARTIAL_FAILURE",
          message: `Order ${orderResult.order.id} was placed, but scheduling failed and automatic cancellation could not be confirmed.`,
          retryable: false,
          recovery: [`Check order ${orderResult.order.id} with the supplier before retrying.`, "Choose another schedule slot after the order state is resolved."],
          details: {
            orderId: orderResult.order.id,
            scheduleError: scheduleError instanceof Error ? scheduleError.message : String(scheduleError),
            cancellationError: cancellationError instanceof Error ? cancellationError.message : String(cancellationError)
          }
        });
      }
      throw new FloError({
        code: "TRANSACTION_ROLLED_BACK",
        message: `Scheduling failed, so order ${orderResult.order.id} was automatically cancelled. No schedule was created.`,
        retryable: true,
        recovery: ["Choose another bay or time, then prepare the transaction again."],
        details: { orderId: orderResult.order.id, scheduleError: scheduleError instanceof Error ? scheduleError.message : String(scheduleError) }
      });
    }
    const updatedWorkOrder = await this.adapters.shop.updateWorkOrder(workOrder.id, { status: "scheduled", bayId: slot.bayId, scheduledStart: slot.start, scheduledEnd: slot.end });
    pending.consumedAt = this.clock().toISOString();
    this.ordersByWorkOrder.set(workOrder.id, orderResult.order);
    const purchaseAudit = await this.audit(actor, "purchase_order.placed", "purchase_order", orderResult.order.id, { workOrderId: workOrder.id, idempotencyKey: pending.idempotencyKey });
    const scheduleAudit = await this.audit(actor, "work.scheduled", "schedule_slot", slot.id, { workOrderId: workOrder.id, bayId: slot.bayId });
    return {
      workOrder: updatedWorkOrder,
      purchaseOrder: orderResult.order,
      scheduleSlot: slot,
      auditLogIds: [purchaseAudit.id, scheduleAudit.id],
      summary: `Order ${orderResult.order.id} was placed and work order ${workOrder.workOrderNumber} was scheduled in ${slot.bayId}.`
    };
  }

  async getOrderStatus(actor: Actor, idOrIdempotencyKey: string): Promise<PurchaseOrder> {
    requirePermission(actor, "purchase:prepare");
    return this.adapters.supplier.getOrderStatus(idOrIdempotencyKey);
  }

  async getJobStatus(actor: Actor, reference = "active job"): Promise<JobStatus> {
    const workOrder = await this.resolveWorkOrder(actor, reference);
    const asset = await this.adapters.shop.getAsset(workOrder.assetId);
    let estimate: Estimate | null = null;
    let approval: Approval | null = null;
    if (workOrder.estimateId !== null) {
      try { estimate = await this.adapters.shop.getEstimate(workOrder.estimateId); } catch (error) { if (!(error instanceof FloError) || error.code !== "NOT_FOUND") throw error; }
      try { approval = await this.adapters.customer.getApprovalStatus(workOrder.id); } catch (error) { if (!(error instanceof FloError) || error.code !== "APPROVAL_NOT_FOUND") throw error; }
    }
    const order = this.ordersByWorkOrder.get(workOrder.id) ?? null;
    const approvalSummary = approval === null ? "No customer approval has been requested." : `Customer approval is ${approval.status}.`;
    const orderSummary = order === null ? "No parts order has been placed." : `Parts order ${order.id} is ${order.status}.`;
    return { workOrder, asset, estimate, approval, purchaseOrder: order, summary: `${asset.year ?? ""} ${asset.make} ${asset.model}: work order ${workOrder.workOrderNumber} is ${workOrder.status}. ${approvalSummary} ${orderSummary}`.trim() };
  }

  async resolveWorkOrder(actor: Actor, reference: string): Promise<WorkOrder> {
    const normalized = reference.trim().toLocaleLowerCase();
    if (/^(?:wo-)?\d+$/.test(normalized)) return this.getWorkOrder(actor, normalized.replace(/^wo-/, ""));
    const memory = await this.memory.get(actor.id);
    if (["active", "active job", "current", "current job"].includes(normalized) && memory?.activeWorkOrderId !== null && memory?.activeWorkOrderId !== undefined) return this.getWorkOrder(actor, memory.activeWorkOrderId);
    if (memory?.activeWorkOrderId !== null && memory?.activeWorkOrderId !== undefined) {
      const recentWorkOrder = await this.adapters.shop.getWorkOrder(memory.activeWorkOrderId);
      const recentAsset = await this.adapters.shop.getAsset(recentWorkOrder.assetId);
      const recentDescription = [recentWorkOrder.workOrderNumber, recentWorkOrder.complaint, recentWorkOrder.diagnosis, recentAsset.make, recentAsset.model, `${recentAsset.year ?? ""} ${recentAsset.make} ${recentAsset.model}`]
        .join(" ")
        .toLocaleLowerCase();
      if (recentDescription.includes(normalized)) return this.getWorkOrder(actor, recentWorkOrder.id);
    }
    const candidates = await this.listOpenWorkOrders(actor);
    const withAssets = await Promise.all(candidates.map(async (workOrder) => ({ workOrder, asset: await this.adapters.shop.getAsset(workOrder.assetId) })));
    const matches = withAssets.filter(({ workOrder, asset }) => [workOrder.workOrderNumber, workOrder.complaint, workOrder.diagnosis, asset.make, asset.model, `${asset.year ?? ""} ${asset.make} ${asset.model}`].join(" ").toLocaleLowerCase().includes(normalized));
    if (matches.length === 1) return this.getWorkOrder(actor, matches[0]!.workOrder.id);
    if (matches.length > 1) throw new FloError({ code: "AMBIGUOUS_REFERENCE", message: `“${reference}” matches multiple open work orders.`, retryable: false, recovery: matches.map(({ workOrder, asset }) => `Specify work order ${workOrder.workOrderNumber} for ${asset.year ?? ""} ${asset.make} ${asset.model}.`) });
    throw new FloError({ code: "WORK_ORDER_NOT_FOUND", message: `No open work order matched “${reference}”.`, retryable: false, recovery: ["Use a work order number.", "List assigned open work orders."] });
  }

  async getDefaultTomorrowMorning(): Promise<{ start: string; end: string }> {
    const dates = createDemoDates(this.clock());
    return { start: dates.tomorrowMorningStart, end: dates.tomorrowMorningEnd };
  }

  async resetDemo(): Promise<void> {
    await Promise.all([this.adapters.shop.reset(), this.adapters.inventory.reset(), this.adapters.supplier.reset(), this.adapters.customer.reset()]);
    await this.memory.clear();
    this.pending.clear();
    this.ordersByWorkOrder.clear();
  }
}

export type { Actor, Part };
