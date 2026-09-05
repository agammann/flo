import type { Asset, Part, Supplier, SupplierPart } from "@flo/domain";

export type CompatibilityStatus = "compatible" | "incompatible" | "unknown";

export interface CompatibilityResult {
  assetId: string;
  partId: string;
  partNumber: string;
  status: CompatibilityStatus;
  compatible: boolean | null;
  reasonCode: string;
  reason: string;
}

const normalize = (value: string): string => value.trim().toLocaleLowerCase();
const includesNormalized = (values: string[], candidate: string): boolean =>
  values.some((value) => normalize(value) === normalize(candidate));

export const checkCompatibility = (asset: Asset, part: Part): CompatibilityResult => {
  if (asset.type !== "vehicle") {
    return {
      assetId: asset.id,
      partId: part.id,
      partNumber: part.partNumber,
      status: "unknown",
      compatible: null,
      reasonCode: "UNSUPPORTED_ASSET_TYPE",
      reason: `Compatibility rules for ${asset.type} assets are not installed.`
    };
  }

  if (asset.year === undefined || asset.engine === undefined) {
    return {
      assetId: asset.id,
      partId: part.id,
      partNumber: part.partNumber,
      status: "unknown",
      compatible: null,
      reasonCode: "ASSET_DATA_INCOMPLETE",
      reason: "The vehicle year and engine are required for a deterministic compatibility decision."
    };
  }

  const baseMatches = part.compatibilityRules.filter((rule) =>
    rule.years.includes(asset.year as number) &&
    includesNormalized(rule.makes, asset.make) &&
    includesNormalized(rule.models, asset.model) &&
    (rule.engines === undefined || includesNormalized(rule.engines, asset.engine as string))
  );
  const normalizedTrim = asset.trim?.trim();
  const matches = baseMatches.some((rule) =>
    rule.trims === undefined || (normalizedTrim !== undefined && normalizedTrim.length > 0 && includesNormalized(rule.trims, normalizedTrim))
  );

  if (!matches && (normalizedTrim === undefined || normalizedTrim.length === 0) && baseMatches.some((rule) => rule.trims !== undefined)) {
    return {
      assetId: asset.id,
      partId: part.id,
      partNumber: part.partNumber,
      status: "unknown",
      compatible: null,
      reasonCode: "ASSET_DATA_INCOMPLETE",
      reason: `The vehicle trim is required to determine whether ${part.partNumber} is compatible.`
    };
  }

  if (!matches) {
    return {
      assetId: asset.id,
      partId: part.id,
      partNumber: part.partNumber,
      status: "incompatible",
      compatible: false,
      reasonCode: "NO_MATCHING_RULE",
      reason: `${part.partNumber} has no compatibility rule for ${asset.year} ${asset.make} ${asset.model} ${asset.engine}.`
    };
  }

  return {
    assetId: asset.id,
    partId: part.id,
    partNumber: part.partNumber,
    status: "compatible",
    compatible: true,
    reasonCode: "EXACT_RULE_MATCH",
    reason: `${part.partNumber} supports ${asset.year} ${asset.make} ${asset.model} ${asset.engine}.`
  };
};

export interface RankedSupplierPart {
  offer: SupplierPart;
  supplier: Supplier;
  part: Part;
  score: number;
  reasons: string[];
}

export interface RankSupplierOptionsInput {
  offers: SupplierPart[];
  parts: Part[];
  suppliers: Supplier[];
  latestDeliveryDate?: string;
  maximumLandedCostCents?: number;
  excludeCheapest?: boolean;
}

export const rankSupplierOptions = (input: RankSupplierOptionsInput): RankedSupplierPart[] => {
  const enriched = input.offers.flatMap((offer): RankedSupplierPart[] => {
    const part = input.parts.find((candidate) => candidate.id === offer.partId);
    const supplier = input.suppliers.find((candidate) => candidate.id === offer.supplierId);
    if (part === undefined || supplier === undefined || offer.inventory < 1) return [];
    const landedCost = offer.priceCents + offer.shippingCostCents;
    if (input.maximumLandedCostCents !== undefined && landedCost > input.maximumLandedCostCents) return [];
    if (input.latestDeliveryDate !== undefined && offer.deliveryDate > input.latestDeliveryDate) return [];

    const warrantyScore = Math.min(offer.warrantyMonths / 36, 1) * 25;
    const reliabilityScore = supplier.reliabilityScore * 30;
    const priceScore = Math.max(0, 30 - landedCost / 1000);
    const tierScore = part.qualityTier === "premium" ? 15 : part.qualityTier === "oem" ? 13 : part.qualityTier === "standard" ? 10 : 4;
    return [{
      offer,
      supplier,
      part,
      score: Number((warrantyScore + reliabilityScore + priceScore + tierScore).toFixed(2)),
      reasons: [
        `${offer.warrantyMonths}-month warranty`,
        `${Math.round(supplier.reliabilityScore * 100)}% supplier reliability`,
        `${part.qualityTier} quality tier`,
        `delivery ${offer.deliveryDate}`
      ]
    }];
  });

  const cheapest = enriched.reduce<RankedSupplierPart | undefined>((current, item) => {
    if (current === undefined) return item;
    const currentCost = current.offer.priceCents + current.offer.shippingCostCents;
    const itemCost = item.offer.priceCents + item.offer.shippingCostCents;
    return itemCost < currentCost ? item : current;
  }, undefined);

  return enriched
    .filter((item) => !input.excludeCheapest || cheapest === undefined || item.offer.supplierSku !== cheapest.offer.supplierSku)
    .sort((left, right) => right.score - left.score || left.offer.priceCents - right.offer.priceCents);
};
