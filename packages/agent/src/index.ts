import { createHash, randomUUID } from "node:crypto";
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
  type EstimatePartItem,
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
  approvalId: string;
  estimateId: string;
  supplierPart: SupplierPart;
  schedule: Omit<ScheduleSlot, "id">;
  idempotencyKey: string;
  expiresAt: string;
  executionAttemptedAt: string | null;
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

const fingerprintEstimate = (estimate: Estimate): string => createHash("sha256").update(JSON.stringify({
  workOrderId: estimate.workOrderId,
  laborItems: estimate.laborItems,
  partItems: estimate.partItems,
  subtotalCents: estimate.subtotalCents,
  taxableSubtotalCents: estimate.taxableSubtotalCents,
  taxCents: estimate.taxCents,
  feesCents: estimate.feesCents,
  discountCents: estimate.discountCents,
  totalCents: estimate.totalCents,
  shopCostCents: estimate.shopCostCents,
  grossMarginCents: estimate.grossMarginCents
})).digest("hex");

export class FloOrchestrator {
  private readonly pending = new Map<string, PendingOperation>();
  private readonly ordersByWorkOrder = new Map<string, PurchaseOrder>();
  private readonly estimateMutationTails = new Map<string, Promise<void>>();
  private readonly confirmationsInFlight = new Set<string>();

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

  private async withEstimateMutationLock<Result>(workOrderId: string, operation: () => Promise<Result>): Promise<Result> {
    const previous = this.estimateMutationTails.get(workOrderId) ?? Promise.resolve();
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => gate);
    this.estimateMutationTails.set(workOrderId, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.estimateMutationTails.get(workOrderId) === tail) this.estimateMutationTails.delete(workOrderId);
    }
  }

  private async requireCompatiblePart(workOrder: WorkOrder, offer: SupplierPart): Promise<Part> {
    const [asset, part] = await Promise.all([
      this.adapters.shop.getAsset(workOrder.assetId),
      this.adapters.inventory.getPart(offer.partId)
    ]);
    if (part.id !== offer.partId) {
      throw new FloError({
        code: "UPSTREAM_DATA_MISMATCH",
        message: "The inventory provider returned a different part than the supplier offer references.",
        retryable: false,
        details: { expectedPartId: offer.partId, actualPartId: part.id, supplierSku: offer.supplierSku }
      });
    }
    const compatibility = checkCompatibility(asset, part);
    if (compatibility.compatible !== true) {
      throw new FloError({
        code: compatibility.compatible === false ? "PART_INCOMPATIBLE" : "PART_COMPATIBILITY_UNKNOWN",
        message: compatibility.compatible === false
          ? `${part.partNumber} is not compatible with the asset on work order ${workOrder.workOrderNumber}.`
          : `Compatibility for ${part.partNumber} cannot be determined from the asset data on work order ${workOrder.workOrderNumber}.`,
        retryable: false,
        recovery: compatibility.compatible === false
          ? ["Search and compare compatible parts for this work order."]
          : ["Complete the asset fitment data, then check compatibility again."],
        details: { workOrderId: workOrder.id, partId: part.id, reasonCode: compatibility.reasonCode }
      });
    }
    return part;
  }

  private async resolveEstimateSelection(
    actor: Actor,
    workOrder: WorkOrder,
    supplierSku: string | undefined,
    missingMessage: string
  ): Promise<{ offer: SupplierPart; part: Part }> {
    const memory = await this.memory.get(actor.id);
    let offer = memory?.selectedSupplierPart ?? null;
    if (supplierSku !== undefined && offer?.supplierSku !== supplierSku) {
      const parts = await this.adapters.inventory.searchParts({});
      const result = parts.length === 0
        ? null
        : await this.adapters.supplier.searchParts({ partIds: parts.map((part) => part.id) });
      offer = result?.offers.find((candidate) => candidate.supplierSku === supplierSku) ?? null;
    }
    if (offer === null) {
      throw new FloError({
        code: "NO_SELECTED_PART",
        message: missingMessage,
        retryable: false,
        recovery: ["Search and compare compatible parts first."]
      });
    }
    const part = await this.requireCompatiblePart(workOrder, offer);
    await this.remember(actor, { activeWorkOrderId: workOrder.id, recentAssetId: workOrder.assetId, selectedSupplierPart: offer });
    return { offer, part };
  }

  private async resolveApprovedEstimateSelection(
    workOrder: WorkOrder,
    approval: Approval,
    requestedSupplierSku?: string
  ): Promise<{ estimate: Estimate; partItem: EstimatePartItem; offer: SupplierPart }> {
    if (approval.workOrderId !== workOrder.id || approval.customerId !== workOrder.customerId) {
      throw new FloError({
        code: "APPROVAL_SCOPE_MISMATCH",
        message: "The approval does not belong to the requested work order and customer.",
        retryable: false
      });
    }
    const estimate = await this.adapters.shop.getEstimate(approval.estimateId);
    if (estimate.workOrderId !== workOrder.id) {
      throw new FloError({
        code: "APPROVAL_SCOPE_MISMATCH",
        message: "The approved estimate does not belong to the requested work order.",
        retryable: false
      });
    }
    if (approval.estimateFingerprint !== fingerprintEstimate(estimate)) {
      throw new FloError({
        code: "APPROVED_ESTIMATE_CHANGED",
        message: "The estimate contents changed after the customer approval was created.",
        retryable: false,
        recovery: ["Create an immutable estimate revision and request customer approval again."],
        details: { approvalId: approval.id, estimateId: estimate.id }
      });
    }
    if (estimate.status !== "approved" || estimate.approvalStatus !== "approved") {
      throw new FloError({
        code: "APPROVAL_REQUIRED",
        message: "The estimate is not in an approved state.",
        retryable: false,
        recovery: ["Request approval for the current estimate."]
      });
    }
    if (estimate.partItems.length !== 1 || estimate.partItems[0]?.quantity !== 1) {
      throw new FloError({
        code: "APPROVED_ESTIMATE_UNSUPPORTED",
        message: "This transaction requires exactly one approved part item with quantity one.",
        retryable: false,
        recovery: ["Review the approved estimate before preparing the transaction."]
      });
    }
    const partItem = estimate.partItems[0];
    if (requestedSupplierSku !== undefined && requestedSupplierSku !== partItem.supplierSku) {
      throw new FloError({
        code: "APPROVED_ESTIMATE_MISMATCH",
        message: `Supplier SKU ${requestedSupplierSku} is not the SKU approved on estimate ${estimate.id}.`,
        retryable: false,
        recovery: [`Use approved supplier SKU ${partItem.supplierSku}.`, "Create and request approval for a revised estimate."]
      });
    }
    const search = await this.adapters.supplier.searchParts({ partIds: [partItem.partId] });
    const offer = search.offers.find((candidate) =>
      candidate.partId === partItem.partId &&
      candidate.supplierId === partItem.supplierId &&
      candidate.supplierSku === partItem.supplierSku
    );
    if (offer === undefined) {
      throw new FloError({
        code: "INVENTORY_CHANGED",
        message: "The supplier offer approved on the estimate is no longer available.",
        retryable: true,
        recovery: ["Search suppliers again and request approval for an updated estimate."]
      });
    }
    if (offer.priceCents !== partItem.unitCostCents || offer.priceCents + offer.shippingCostCents !== partItem.lineCostCents) {
      throw new FloError({
        code: "APPROVED_ESTIMATE_STALE",
        message: "The supplier cost changed after the estimate was approved.",
        retryable: true,
        recovery: ["Create and request approval for an updated estimate."],
        details: { estimateId: estimate.id, supplierSku: partItem.supplierSku }
      });
    }
    await this.requireCompatiblePart(workOrder, offer);
    return { estimate, partItem, offer };
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

  async findCompatibleParts(actor: Actor, input: { workOrderIdOrNumber?: string; category: string; maximumLandedCostCents?: number; latestDeliveryDate?: string; excludeCheapest?: boolean; ranking?: "balanced" | "gross_part_margin" }): Promise<PartsSearchResult> {
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
    if (input.ranking === "gross_part_margin") {
      ranked.sort((left, right) => right.grossPartMarginCents - left.grossPartMarginCents || right.score - left.score || left.offer.supplierSku.localeCompare(right.offer.supplierSku));
      for (const item of ranked) item.reasons.unshift("Ranked by gross part profit in cents, not margin percentage; shipping is passed through at cost.");
    }
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

  async compareParts(actor: Actor, input: { workOrderIdOrNumber?: string; category: string; maximumLandedCostCents?: number; latestDeliveryDate?: string; excludeCheapest?: boolean; ranking?: "balanced" | "gross_part_margin" }): Promise<PartsSearchResult> {
    return this.findCompatibleParts(actor, input);
  }

  async createEstimate(actor: Actor, input: { workOrderIdOrNumber?: string; supplierSku?: string; laborHours?: number }): Promise<Estimate> {
    requirePermission(actor, "estimate:write");
    const selectedWorkOrder = input.workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, input.workOrderIdOrNumber);
    return this.withEstimateMutationLock(selectedWorkOrder.id, async () => {
      const workOrder = await this.adapters.shop.getWorkOrder(selectedWorkOrder.id);
      if (workOrder.estimateId !== null) {
        const existing = await this.adapters.shop.getEstimate(workOrder.estimateId);
        if (existing.status !== "draft" || existing.approvalStatus !== "not_requested") {
          throw new FloError({
            code: "ESTIMATE_LOCKED",
            message: `Estimate ${existing.id} cannot be replaced after customer approval has been requested.`,
            retryable: false,
            recovery: ["Keep the approved estimate unchanged.", "Add estimate revision support before requesting a different approval."]
          });
        }
      }
      const { offer, part } = await this.resolveEstimateSelection(actor, workOrder, input.supplierSku, "No supplier part has been selected for the estimate.");
      const estimate = calculateEstimate({ id: workOrder.estimateId ?? `estimate-${randomUUID()}`, workOrderId: workOrder.id, part, offer, ...(input.laborHours === undefined ? {} : { laborHours: input.laborHours }), now: this.clock() });
      const saved = await this.adapters.shop.saveEstimate(estimate);
      await this.audit(actor, "estimate.created", "estimate", saved.id, { workOrderId: workOrder.id, totalCents: saved.totalCents });
      return saved;
    });
  }

  async calculateEstimatePreview(actor: Actor, input: { workOrderIdOrNumber?: string; supplierSku?: string; laborHours?: number }): Promise<Estimate> {
    requirePermission(actor, "estimate:read");
    const workOrder = input.workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, input.workOrderIdOrNumber);
    const { offer, part } = await this.resolveEstimateSelection(actor, workOrder, input.supplierSku, "No supplier part has been selected for an estimate preview.");
    return calculateEstimate({ id: `preview-${randomUUID()}`, workOrderId: workOrder.id, part, offer, ...(input.laborHours === undefined ? {} : { laborHours: input.laborHours }), now: this.clock() });
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
    const selectedWorkOrder = workOrderIdOrNumber === undefined ? await this.resolveWorkOrder(actor, "active job") : await this.getWorkOrder(actor, workOrderIdOrNumber);
    return this.withEstimateMutationLock(selectedWorkOrder.id, async () => {
      const workOrder = await this.adapters.shop.getWorkOrder(selectedWorkOrder.id);
      const estimate = await this.adapters.shop.getEstimate(workOrder.id);
      const estimateFingerprint = fingerprintEstimate(estimate);
      if (estimate.status !== "draft" || estimate.approvalStatus !== "not_requested") {
        const existing = await this.adapters.customer.getApprovalStatus(workOrder.id);
        if (
          existing.workOrderId !== workOrder.id ||
          existing.customerId !== workOrder.customerId ||
          existing.estimateId !== estimate.id ||
          existing.estimateFingerprint !== estimateFingerprint
        ) {
          throw new FloError({ code: "APPROVAL_SCOPE_MISMATCH", message: "The current approval does not match this work order and estimate.", retryable: false });
        }
        await this.remember(actor, { activeWorkOrderId: workOrder.id, pendingApprovalId: existing.id });
        return existing;
      }

      await Promise.all([
        this.adapters.shop.updateEstimate(estimate.id, { status: "sent", approvalStatus: "pending" }),
        this.adapters.shop.updateWorkOrder(workOrder.id, { status: "awaiting_approval" })
      ]);
      let approval: Approval;
      try {
        const customer = await this.adapters.customer.getCustomer(workOrder.customerId);
        approval = await this.adapters.customer.requestApproval({
          workOrderId: workOrder.id,
          estimateId: estimate.id,
          estimateFingerprint,
          customerId: customer.id,
          summary: `Please approve estimate ${estimate.id} for ${formatCurrency(estimate.totalCents)} on work order ${workOrder.workOrderNumber}.`
        });
        if (
          approval.workOrderId !== workOrder.id ||
          approval.customerId !== customer.id ||
          approval.estimateId !== estimate.id ||
          approval.estimateFingerprint !== estimateFingerprint
        ) {
          throw new FloError({ code: "APPROVAL_SCOPE_MISMATCH", message: "The approval provider returned a record for a different estimate or customer.", retryable: false });
        }
      } catch (error) {
        await Promise.all([
          this.adapters.shop.updateEstimate(estimate.id, { status: "draft", approvalStatus: "not_requested" }),
          this.adapters.shop.updateWorkOrder(workOrder.id, { status: workOrder.status })
        ]);
        throw error;
      }
      await this.remember(actor, { activeWorkOrderId: workOrder.id, pendingApprovalId: approval.id });
      await this.audit(actor, "approval.requested", "approval", approval.id, { workOrderId: workOrder.id, channel: approval.channel, estimateFingerprint });
      return approval;
    });
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
    const approval = await this.adapters.customer.getApprovalStatus(workOrder.id);
    if (approval.workOrderId !== workOrder.id || approval.customerId !== workOrder.customerId) {
      throw new FloError({ code: "APPROVAL_SCOPE_MISMATCH", message: "The approval service returned an approval for a different work order or customer.", retryable: false });
    }
    const estimate = await this.adapters.shop.getEstimate(approval.estimateId);
    if (estimate.workOrderId !== workOrder.id) {
      throw new FloError({ code: "APPROVAL_SCOPE_MISMATCH", message: "The approval service returned an estimate for a different work order.", retryable: false });
    }
    if (approval.estimateFingerprint !== fingerprintEstimate(estimate)) {
      throw new FloError({ code: "APPROVED_ESTIMATE_CHANGED", message: "The estimate contents no longer match the customer approval.", retryable: false, recovery: ["Create an immutable estimate revision and request approval again."] });
    }
    if (approval.status === "approved" || approval.status === "denied") {
      await Promise.all([
        this.adapters.shop.updateEstimate(approval.estimateId, { status: approval.status === "approved" ? "approved" : "declined", approvalStatus: approval.status }),
        this.adapters.shop.updateWorkOrder(workOrder.id, { status: approval.status === "approved" ? "approved" : "estimating" })
      ]);
    }
    await this.remember(actor, { activeWorkOrderId: workOrder.id, pendingApprovalId: approval.id });
    return approval;
  }

  async simulateCustomerApproval(actor: Actor, status: "approved" | "denied", approvalId?: string): Promise<Approval> {
    if (process.env.NODE_ENV === "production" && process.env.FLO_DEMO_MODE !== "true") throw new FloError({ code: "DEMO_ONLY", message: "Customer approval simulation is disabled in production.", retryable: false });
    const memory = await this.memory.get(actor.id);
    const id = approvalId ?? memory?.pendingApprovalId;
    if (id === undefined || id === null) throw new FloError({ code: "APPROVAL_NOT_FOUND", message: "No pending approval is in context.", retryable: false });
    const candidate = await this.adapters.customer.getApprovalStatus(id);
    const workOrder = await this.getWorkOrder(actor, candidate.workOrderId);
    const estimate = await this.adapters.shop.getEstimate(candidate.estimateId);
    if (
      candidate.workOrderId !== workOrder.id ||
      candidate.customerId !== workOrder.customerId ||
      estimate.workOrderId !== workOrder.id ||
      candidate.estimateFingerprint !== fingerprintEstimate(estimate)
    ) {
      throw new FloError({ code: "APPROVAL_SCOPE_MISMATCH", message: "The approval cannot be simulated because it does not match the authorized work order and estimate.", retryable: false });
    }
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
    const { estimate, offer: supplierPart } = await this.resolveApprovedEstimateSelection(workOrder, approval, input.supplierSku);
    const availability = await this.findAvailableSlot(actor, { bayId: input.bayId, start: input.start, end: input.end });
    if (!availability.available) throw new FloError({ code: "BAY_CONFLICT", message: `${input.bayId} is occupied during the requested time.`, retryable: true, recovery: ["Choose another bay.", "Choose another time."], details: { conflicts: availability.conflicts } });
    const token = randomUUID();
    const expiresAt = new Date(this.clock().getTime() + 5 * 60 * 1000).toISOString();
    const pending: PendingOperation = {
      token,
      actorId: actor.id,
      workOrderId: workOrder.id,
      approvalId: approval.id,
      estimateId: estimate.id,
      supplierPart,
      schedule: { bayId: input.bayId, start: input.start, end: input.end, workOrderId: workOrder.id, technicianId: workOrder.assignedTechnicianId ?? actor.id },
      idempotencyKey: input.idempotencyKey ?? `flo-${workOrder.id}-${supplierPart.supplierSku}-${randomUUID()}`,
      expiresAt,
      executionAttemptedAt: null,
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
    if (this.confirmationsInFlight.has(confirmationToken)) {
      throw new FloError({ code: "CONFIRMATION_IN_PROGRESS", message: "This confirmation is already being executed.", retryable: true, recovery: ["Wait for the current confirmation attempt to finish."] });
    }
    this.confirmationsInFlight.add(confirmationToken);
    try {
      return await this.confirmTransactionExclusive(actor, confirmationToken);
    } finally {
      this.confirmationsInFlight.delete(confirmationToken);
    }
  }

  private async confirmTransactionExclusive(actor: Actor, confirmationToken: string): Promise<TransactionResult> {
    requirePermission(actor, "purchase:execute");
    requirePermission(actor, "schedule:write");
    const pending = this.pending.get(confirmationToken);
    if (pending === undefined || pending.actorId !== actor.id) throw new FloError({ code: "CONFIRMATION_INVALID", message: "The confirmation token is invalid for this actor.", retryable: false });
    if (pending.consumedAt !== null) throw new FloError({ code: "CONFIRMATION_ALREADY_USED", message: "This confirmation has already been used.", retryable: false });
    if (new Date(pending.expiresAt).getTime() <= this.clock().getTime()) throw new FloError({ code: "CONFIRMATION_EXPIRED", message: "The confirmation expired before execution.", retryable: false, recovery: ["Prepare the transaction again."] });
    const workOrder = await this.getWorkOrder(actor, pending.workOrderId);
    const approval = await this.getCustomerApprovalStatus(actor, workOrder.id);
    if (approval.status !== "approved") throw new FloError({ code: "APPROVAL_REQUIRED", message: "Customer approval is no longer valid.", retryable: false });
    if (approval.id !== pending.approvalId || approval.estimateId !== pending.estimateId) {
      throw new FloError({ code: "APPROVAL_CHANGED", message: "The customer approval changed after this transaction was prepared.", retryable: false, recovery: ["Prepare the transaction again from the current approved estimate."] });
    }
    const currentSelection = await this.resolveApprovedEstimateSelection(workOrder, approval, pending.supplierPart.supplierSku);
    if (
      currentSelection.offer.partId !== pending.supplierPart.partId ||
      currentSelection.offer.supplierId !== pending.supplierPart.supplierId ||
      currentSelection.offer.priceCents !== pending.supplierPart.priceCents ||
      currentSelection.offer.shippingCostCents !== pending.supplierPart.shippingCostCents
    ) {
      throw new FloError({ code: "APPROVED_ESTIMATE_STALE", message: "The approved supplier offer changed after this transaction was prepared.", retryable: true, recovery: ["Prepare the transaction again from a current approved estimate."] });
    }
    const availability = await this.findAvailableSlot(actor, { bayId: pending.schedule.bayId, start: pending.schedule.start, end: pending.schedule.end });
    if (!availability.available) throw new FloError({ code: "BAY_CONFLICT", message: "The requested bay became unavailable before confirmation.", retryable: true, recovery: ["Prepare the transaction with another slot."] });

    const isPlaceOrderRetry = pending.executionAttemptedAt !== null;
    pending.executionAttemptedAt ??= this.clock().toISOString();
    const orderResult = await this.adapters.supplier.placeOrder({
      supplierId: pending.supplierPart.supplierId,
      workOrderId: workOrder.id,
      supplierSku: pending.supplierPart.supplierSku,
      quantity: 1,
      idempotencyKey: pending.idempotencyKey
    });
    const orderItem = orderResult.order.items[0];
    const responseMatchesApprovedPurchase =
      orderResult.order.idempotencyKey === pending.idempotencyKey &&
      orderResult.order.supplierId === pending.supplierPart.supplierId &&
      orderResult.order.workOrderId === workOrder.id &&
      orderResult.order.items.length === 1 &&
      orderItem?.partId === pending.supplierPart.partId &&
      orderItem.supplierSku === pending.supplierPart.supplierSku &&
      orderItem.quantity === 1 &&
      orderItem.unitCostCents === pending.supplierPart.priceCents &&
      orderResult.order.totalCents === pending.supplierPart.priceCents + pending.supplierPart.shippingCostCents;
    if (!responseMatchesApprovedPurchase) {
      pending.consumedAt = this.clock().toISOString();
      throw new FloError({
        code: "UPSTREAM_DATA_MISMATCH",
        message: "The supplier returned an order that does not match the approved purchase.",
        retryable: false,
        recovery: ["Do not schedule the work; reconcile the supplier order manually."],
        details: { expectedWorkOrderId: workOrder.id, returnedOrderId: orderResult.order.id }
      });
    }
    if (orderResult.idempotentReplay && !isPlaceOrderRetry) {
      pending.consumedAt = this.clock().toISOString();
      throw new FloError({ code: "IDEMPOTENCY_KEY_ALREADY_USED", message: "This idempotency key belongs to an earlier purchase attempt.", retryable: false, recovery: ["Prepare the transaction again with a new idempotency key."] });
    }
    if (orderResult.order.status === "cancelled") {
      throw new FloError({ code: "ORDER_CANCELLED", message: "A cancelled purchase order cannot satisfy this transaction.", retryable: false, recovery: ["Prepare the transaction again with a new idempotency key."] });
    }
    pending.consumedAt = this.clock().toISOString();
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
    const order = await this.adapters.supplier.getOrderStatus(idOrIdempotencyKey);
    requireWorkOrderRead(actor, order.workOrderId);
    return order;
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
export * from "./customer-experience.js";
export * from "./customer-identity.js";
