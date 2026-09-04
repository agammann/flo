import { z } from "zod";

const id = z.string().min(1);
const isoDateTime = z.iso.datetime();
const isoDate = z.iso.date();
const cents = z.number().int().nonnegative();

export const workOrderStatusSchema = z.enum([
  "intake",
  "diagnosis",
  "estimating",
  "awaiting_approval",
  "approved",
  "parts_ordered",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled"
]);

export const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const assetTypeSchema = z.enum(["vehicle", "hvac", "appliance", "facility", "equipment", "other"]);
export const qualityTierSchema = z.enum(["budget", "standard", "premium", "oem"]);
export const approvalStatusSchema = z.enum(["not_requested", "pending", "approved", "denied", "expired"]);
export const purchaseOrderStatusSchema = z.enum(["placed", "confirmed", "shipped", "delivered", "cancelled"]);
export const estimateStatusSchema = z.enum(["draft", "sent", "approved", "declined", "expired"]);

export const assetSchema = z.object({
  id,
  type: assetTypeSchema,
  year: z.number().int().min(1900).max(2200).optional(),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  vin: z.string().optional(),
  engine: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
  customerId: id,
  attributes: z.record(z.string(), z.string()).default({})
});

export const customerSchema = z.object({
  id,
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.email(),
  preferredContactMethod: z.enum(["sms", "email", "phone"]),
  approvalPreferences: z.object({
    autoApproveBelowCents: cents.nullable(),
    requireWrittenApproval: z.boolean()
  })
});

export const diagnosticRecordSchema = z.object({
  id,
  workOrderId: id,
  technicianId: id,
  finding: z.string().min(1).max(2000),
  createdAt: isoDateTime
});

export const workOrderSchema = z.object({
  id,
  workOrderNumber: z.string().min(1),
  customerId: id,
  assetId: id,
  status: workOrderStatusSchema,
  priority: prioritySchema,
  complaint: z.string().min(1),
  diagnosis: z.string(),
  recommendedWork: z.array(z.string()),
  assignedTechnicianId: id.nullable(),
  estimateId: id.nullable(),
  scheduledStart: isoDateTime.nullable(),
  scheduledEnd: isoDateTime.nullable(),
  bayId: id.nullable(),
  notes: z.array(z.string()),
  createdAt: isoDateTime,
  updatedAt: isoDateTime
});

export const compatibilityRuleSchema = z.object({
  years: z.array(z.number().int()).min(1),
  makes: z.array(z.string()).min(1),
  models: z.array(z.string()).min(1),
  trims: z.array(z.string()).optional(),
  engines: z.array(z.string()).optional()
});

export const partSchema = z.object({
  id,
  partNumber: z.string().min(1),
  brand: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  compatibilityRules: z.array(compatibilityRuleSchema),
  warrantyMonths: z.number().int().nonnegative(),
  qualityTier: qualityTierSchema
});

export const supplierSchema = z.object({
  id,
  name: z.string().min(1),
  reliabilityScore: z.number().min(0).max(1),
  description: z.string().min(1)
});

export const supplierPartSchema = z.object({
  supplierId: id,
  partId: id,
  supplierSku: z.string().min(1),
  priceCents: cents,
  inventory: z.number().int().nonnegative(),
  deliveryDate: isoDate,
  warrantyMonths: z.number().int().nonnegative(),
  shippingCostCents: cents
});

export const inventoryItemSchema = z.object({
  id,
  partId: id,
  quantityOnHand: z.number().int().nonnegative(),
  quantityReserved: z.number().int().nonnegative(),
  location: z.string().min(1),
  updatedAt: isoDateTime
});

export const laborItemSchema = z.object({
  description: z.string().min(1),
  hours: z.number().nonnegative(),
  rateCentsPerHour: cents,
  totalCents: cents
});

export const estimatePartItemSchema = z.object({
  partId: id,
  supplierId: id,
  supplierSku: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCostCents: cents,
  markupBasisPoints: z.number().int().nonnegative(),
  unitCustomerPriceCents: cents,
  lineCostCents: cents,
  lineCustomerPriceCents: cents
});

export const estimateSchema = z.object({
  id,
  workOrderId: id,
  laborItems: z.array(laborItemSchema),
  partItems: z.array(estimatePartItemSchema),
  subtotalCents: cents,
  taxableSubtotalCents: cents,
  taxCents: cents,
  feesCents: cents,
  discountCents: cents,
  totalCents: cents,
  shopCostCents: cents,
  grossMarginCents: z.number().int(),
  status: estimateStatusSchema,
  approvalStatus: approvalStatusSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime
});

export const approvalSchema = z.object({
  id,
  workOrderId: id,
  estimateId: id,
  customerId: id,
  status: approvalStatusSchema,
  requestedAt: isoDateTime,
  respondedAt: isoDateTime.nullable(),
  channel: z.enum(["sms", "email", "phone"]),
  messageId: id
});

export const purchaseOrderItemSchema = z.object({
  partId: id,
  supplierSku: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCostCents: cents
});

export const purchaseOrderSchema = z.object({
  id,
  supplierId: id,
  workOrderId: id,
  items: z.array(purchaseOrderItemSchema).min(1),
  totalCents: cents,
  status: purchaseOrderStatusSchema,
  idempotencyKey: z.string().min(8),
  createdAt: isoDateTime
});

export const scheduleSlotSchema = z.object({
  id,
  bayId: id,
  start: isoDateTime,
  end: isoDateTime,
  workOrderId: id,
  technicianId: id
});

export const auditLogSchema = z.object({
  id,
  actorId: id,
  actorRole: z.enum(["technician", "service_advisor", "manager", "administrator", "customer", "system"]),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: id,
  timestamp: isoDateTime,
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const contextMemorySchema = z.object({
  actorId: id,
  activeWorkOrderId: id.nullable(),
  recentWorkOrderIds: z.array(id),
  recentAssetId: id.nullable(),
  recentCustomerId: id.nullable(),
  selectedSupplierPart: supplierPartSchema.nullable(),
  pendingApprovalId: id.nullable(),
  updatedAt: isoDateTime
});

export const pendingActionSchema = z.object({
  token: z.string().uuid(),
  actorId: id,
  action: z.enum(["place_parts_order", "schedule_work", "combined_purchase_and_schedule"]),
  payload: z.record(z.string(), z.unknown()),
  summary: z.string().min(1),
  createdAt: isoDateTime,
  expiresAt: isoDateTime,
  consumedAt: isoDateTime.nullable()
});

export type WorkOrderStatus = z.infer<typeof workOrderStatusSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type DiagnosticRecord = z.infer<typeof diagnosticRecordSchema>;
export type WorkOrder = z.infer<typeof workOrderSchema>;
export type CompatibilityRule = z.infer<typeof compatibilityRuleSchema>;
export type Part = z.infer<typeof partSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type SupplierPart = z.infer<typeof supplierPartSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type LaborItem = z.infer<typeof laborItemSchema>;
export type EstimatePartItem = z.infer<typeof estimatePartItemSchema>;
export type Estimate = z.infer<typeof estimateSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type ContextMemory = z.infer<typeof contextMemorySchema>;
export type PendingAction = z.infer<typeof pendingActionSchema>;

export interface FloState {
  workOrders: WorkOrder[];
  assets: Asset[];
  customers: Customer[];
  diagnostics: DiagnosticRecord[];
  parts: Part[];
  suppliers: Supplier[];
  supplierParts: SupplierPart[];
  inventory: InventoryItem[];
  estimates: Estimate[];
  approvals: Approval[];
  purchaseOrders: PurchaseOrder[];
  schedule: ScheduleSlot[];
  auditLogs: AuditLog[];
  contextMemories: ContextMemory[];
  pendingActions: PendingAction[];
}
