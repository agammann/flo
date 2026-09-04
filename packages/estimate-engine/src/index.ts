import { z } from "zod";
import type { Estimate, EstimatePartItem, LaborItem, Part, SupplierPart } from "@flo/domain";

export const estimatePolicySchema = z.object({
  partMarkupBasisPoints: z.number().int().min(0).max(50000),
  laborRateCentsPerHour: z.number().int().positive(),
  taxRateBasisPoints: z.number().int().min(0).max(10000),
  shopFeeCents: z.number().int().nonnegative(),
  taxableLabor: z.boolean(),
  taxableFees: z.boolean()
});

export type EstimatePolicy = z.infer<typeof estimatePolicySchema>;

export const defaultEstimatePolicy: EstimatePolicy = {
  partMarkupBasisPoints: 3500,
  laborRateCentsPerHour: 10500,
  taxRateBasisPoints: 825,
  shopFeeCents: 1200,
  taxableLabor: false,
  taxableFees: true
};

const percentage = (cents: number, basisPoints: number): number => Math.round((cents * basisPoints) / 10000);

export const applyMarkup = (costCents: number, markupBasisPoints: number): number =>
  costCents + percentage(costCents, markupBasisPoints);

export interface CalculateEstimateInput {
  id: string;
  workOrderId: string;
  part: Part;
  offer: SupplierPart;
  quantity?: number;
  laborDescription?: string;
  laborHours?: number;
  discountCents?: number;
  policy?: EstimatePolicy;
  now?: Date;
}

export const calculateEstimate = (input: CalculateEstimateInput): Estimate => {
  const policy = estimatePolicySchema.parse(input.policy ?? defaultEstimatePolicy);
  const quantity = input.quantity ?? 1;
  const laborHours = input.laborHours ?? 1.2;
  const discountCents = input.discountCents ?? 0;
  const unitCustomerPriceCents = applyMarkup(input.offer.priceCents, policy.partMarkupBasisPoints);
  const lineCostCents = input.offer.priceCents * quantity + input.offer.shippingCostCents;
  const lineCustomerPriceCents = unitCustomerPriceCents * quantity + input.offer.shippingCostCents;
  const partItem: EstimatePartItem = {
    partId: input.part.id,
    supplierId: input.offer.supplierId,
    supplierSku: input.offer.supplierSku,
    description: input.part.description,
    quantity,
    unitCostCents: input.offer.priceCents,
    markupBasisPoints: policy.partMarkupBasisPoints,
    unitCustomerPriceCents,
    lineCostCents,
    lineCustomerPriceCents
  };
  const laborTotalCents = Math.round(laborHours * policy.laborRateCentsPerHour);
  const laborItem: LaborItem = {
    description: input.laborDescription ?? `Replace ${input.part.category}`,
    hours: laborHours,
    rateCentsPerHour: policy.laborRateCentsPerHour,
    totalCents: laborTotalCents
  };
  const subtotalCents = lineCustomerPriceCents + laborTotalCents + policy.shopFeeCents;
  const taxableSubtotalCents = lineCustomerPriceCents +
    (policy.taxableLabor ? laborTotalCents : 0) +
    (policy.taxableFees ? policy.shopFeeCents : 0);
  const taxCents = percentage(Math.max(0, taxableSubtotalCents - discountCents), policy.taxRateBasisPoints);
  const totalCents = Math.max(0, subtotalCents - discountCents) + taxCents;
  const now = (input.now ?? new Date()).toISOString();

  return {
    id: input.id,
    workOrderId: input.workOrderId,
    laborItems: [laborItem],
    partItems: [partItem],
    subtotalCents,
    taxableSubtotalCents,
    taxCents,
    feesCents: policy.shopFeeCents,
    discountCents,
    totalCents,
    shopCostCents: lineCostCents,
    grossMarginCents: subtotalCents - lineCostCents,
    status: "draft",
    approvalStatus: "not_requested",
    createdAt: now,
    updatedAt: now
  };
};

export const formatCurrency = (cents: number, currency = "USD"): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
