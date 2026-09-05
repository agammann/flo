import { z } from "zod";
import {
  approvalSchema,
  assetSchema,
  customerSchema,
  diagnosticRecordSchema,
  estimateSchema,
  partSchema,
  purchaseOrderSchema,
  scheduleSlotSchema,
  supplierPartSchema,
  supplierSchema,
  workOrderSchema
} from "@flo/domain";

// MCP 2025-11-25 requires structuredContent to have an object root. Keeping the
// success value under `data` gives every tool an exact, required success shape.
// Failed calls use MCP's `isError` path, which the SDK intentionally excludes
// from output-schema validation, while retaining Flo's structured error details.
const toolEnvelopeSchema = <DataSchema extends z.ZodType>(dataSchema: DataSchema) => z.object({
  ok: z.literal(true),
  data: dataSchema
});

const compatibilityResultSchema = z.object({
  assetId: z.string().min(1),
  partId: z.string().min(1),
  partNumber: z.string().min(1),
  status: z.enum(["compatible", "incompatible", "unknown"]),
  compatible: z.boolean().nullable(),
  reasonCode: z.string().min(1),
  reason: z.string().min(1)
});

const inventoryAvailabilitySchema = z.object({
  partId: z.string().min(1),
  available: z.number().int(),
  location: z.string().min(1)
});

const supplierSearchResultSchema = z.object({
  offers: z.array(supplierPartSchema),
  suppliers: z.array(supplierSchema),
  parts: z.array(partSchema)
});

const rankedSupplierPartSchema = z.object({
  offer: supplierPartSchema,
  supplier: supplierSchema,
  part: partSchema,
  score: z.number(),
  reasons: z.array(z.string()),
  landedCostCents: z.number().int().nonnegative(),
  customerPriceCents: z.number().int().nonnegative(),
  grossPartMarginCents: z.number().int()
});

const partsSearchResultSchema = z.object({
  workOrder: workOrderSchema,
  asset: assetSchema,
  compatibility: z.array(compatibilityResultSchema),
  inventory: z.array(inventoryAvailabilitySchema),
  supplierSearch: supplierSearchResultSchema,
  ranked: z.array(rankedSupplierPartSchema),
  recommendation: rankedSupplierPartSchema.nullable()
});

const customerMessageSchema = z.object({
  id: z.string().min(1),
  sentAt: z.iso.datetime()
});

const slotAvailabilitySchema = z.object({
  available: z.boolean(),
  conflicts: z.array(scheduleSlotSchema)
});

const transactionPreparationSchema = z.object({
  confirmationToken: z.string().uuid(),
  expiresAt: z.iso.datetime(),
  summary: z.string().min(1),
  requiresConfirmation: z.literal(true)
});

const transactionResultSchema = z.object({
  workOrder: workOrderSchema,
  purchaseOrder: purchaseOrderSchema,
  scheduleSlot: scheduleSlotSchema,
  auditLogIds: z.array(z.string().min(1)),
  summary: z.string().min(1)
});

const jobStatusSchema = z.object({
  workOrder: workOrderSchema,
  asset: assetSchema,
  estimate: estimateSchema.nullable(),
  approval: approvalSchema.nullable(),
  purchaseOrder: purchaseOrderSchema.nullable(),
  summary: z.string().min(1)
});

const demoTimeWindowSchema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime()
});

export const toolOutputSchemas = {
  workOrder: toolEnvelopeSchema(workOrderSchema),
  workOrders: toolEnvelopeSchema(z.array(workOrderSchema)),
  asset: toolEnvelopeSchema(assetSchema),
  diagnostic: toolEnvelopeSchema(diagnosticRecordSchema),
  diagnostics: toolEnvelopeSchema(z.array(diagnosticRecordSchema)),
  parts: toolEnvelopeSchema(z.array(partSchema)),
  compatibility: toolEnvelopeSchema(compatibilityResultSchema),
  inventory: toolEnvelopeSchema(z.array(inventoryAvailabilitySchema)),
  supplierSearch: toolEnvelopeSchema(supplierSearchResultSchema),
  partsComparison: toolEnvelopeSchema(partsSearchResultSchema),
  estimate: toolEnvelopeSchema(estimateSchema),
  customer: toolEnvelopeSchema(customerSchema),
  customerMessage: toolEnvelopeSchema(customerMessageSchema),
  approval: toolEnvelopeSchema(approvalSchema),
  schedule: toolEnvelopeSchema(z.array(scheduleSlotSchema)),
  slotAvailability: toolEnvelopeSchema(slotAvailabilitySchema),
  transactionPreparation: toolEnvelopeSchema(transactionPreparationSchema),
  transactionResult: toolEnvelopeSchema(transactionResultSchema),
  purchaseOrder: toolEnvelopeSchema(purchaseOrderSchema),
  jobStatus: toolEnvelopeSchema(jobStatusSchema),
  demoTimeWindow: toolEnvelopeSchema(demoTimeWindowSchema),
  demoReset: toolEnvelopeSchema(z.object({ reset: z.literal(true) }))
} as const;
