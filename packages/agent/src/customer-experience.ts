import { z } from "zod";
import type { ShopAdapter } from "@flo/adapters";
import { FloError } from "@flo/shared-types";
import type { WorkOrder } from "@flo/domain";

// Supplied by a trusted identity adapter, never by an MCP tool argument.
export interface CustomerPrincipal { subject: string; customerId: string }
const money = z.number().int().nonnegative();
export const customerRepairSchema = z.object({
  repairNumber: z.string(), vehicle: z.string(), status: z.string(),
  scheduledStart: z.string().nullable(), scheduledEnd: z.string().nullable()
});
export const customerEstimateSchema = z.object({
  repairNumber: z.string(), currency: z.literal("USD"), status: z.string(),
  approvalStatus: z.string(),
  parts: z.array(z.object({ description: z.string(), quantity: z.number().int().positive(), totalCents: money })),
  labor: z.array(z.object({ description: z.string(), totalCents: money })),
  subtotalCents: money, taxCents: money, feesCents: money, discountCents: money, totalCents: money
});
export type CustomerRepair = z.infer<typeof customerRepairSchema>;
export type CustomerEstimate = z.infer<typeof customerEstimateSchema>;

const unavailable = () => new FloError({ code: "REPAIR_UNAVAILABLE", message: "That repair is not available for your account.", retryable: false, recovery: ["Ask for your repair list, or check the repair number with your shop."] });

export class CustomerExperience {
  constructor(private readonly shop: ShopAdapter) {}

  private checkPrincipal(principal: CustomerPrincipal): void {
    if (!principal.subject.trim() || !principal.customerId.trim()) throw unavailable();
  }

  private async ownedRepair(principal: CustomerPrincipal, repairNumber: string): Promise<WorkOrder> {
    this.checkPrincipal(principal);
    let work: WorkOrder;
    try { work = await this.shop.getWorkOrder(repairNumber); }
    catch (error) {
      if (error instanceof FloError && error.code === "NOT_FOUND") throw unavailable();
      throw error;
    }
    if (work.customerId !== principal.customerId) throw unavailable();
    return work;
  }

  private async projectRepair(principal: CustomerPrincipal, work: WorkOrder): Promise<CustomerRepair> {
    const asset = await this.shop.getAsset(work.assetId);
    if (asset.customerId !== principal.customerId || asset.id !== work.assetId) throw unavailable();
    // No VIN, contact details, shop notes, technician IDs, costs, or margins.
    return customerRepairSchema.parse({
      repairNumber: work.workOrderNumber, vehicle: `${asset.year} ${asset.make} ${asset.model}`,
      status: work.status, scheduledStart: work.scheduledStart, scheduledEnd: work.scheduledEnd
    });
  }

  async listRepairs(principal: CustomerPrincipal): Promise<CustomerRepair[]> {
    this.checkPrincipal(principal);
    const work = await this.shop.listWorkOrders();
    return Promise.all(work.filter(item => item.customerId === principal.customerId).map(item => this.projectRepair(principal, item)));
  }

  async getRepair(principal: CustomerPrincipal, repairNumber: string): Promise<CustomerRepair> {
    return this.projectRepair(principal, await this.ownedRepair(principal, repairNumber));
  }

  async getEstimate(principal: CustomerPrincipal, repairNumber: string): Promise<CustomerEstimate> {
    const work = await this.ownedRepair(principal, repairNumber);
    if (work.estimateId === null) throw new FloError({ code: "ESTIMATE_NOT_READY", message: "Your shop has not prepared an estimate yet.", retryable: true, recovery: ["Ask for your repair status or check again later."] });
    const estimate = await this.shop.getEstimate(work.estimateId);
    if (estimate.workOrderId !== work.id || estimate.id !== work.estimateId) throw unavailable();
    return customerEstimateSchema.parse({
      repairNumber: work.workOrderNumber, currency: "USD", status: estimate.status, approvalStatus: estimate.approvalStatus,
      parts: estimate.partItems.map(item => ({ description: item.description, quantity: item.quantity, totalCents: item.lineCustomerPriceCents })),
      labor: estimate.laborItems.map(item => ({ description: item.description, totalCents: item.totalCents })),
      subtotalCents: estimate.subtotalCents, taxCents: estimate.taxCents, feesCents: estimate.feesCents,
      discountCents: estimate.discountCents, totalCents: estimate.totalCents
    });
  }
}
