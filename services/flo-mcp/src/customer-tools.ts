import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { customerRepairSchema, customerEstimateSchema, type CustomerExperience, type CustomerPrincipal } from "@flo/agent";
import { FloError } from "@flo/shared-types";

export type CustomerRepairService = Pick<CustomerExperience, "listRepairs" | "getRepair" | "getEstimate">;
export const createCustomerMcpServer = (experience: CustomerRepairService, principal: CustomerPrincipal, revalidate?: () => Promise<void>): McpServer => {
  const server = new McpServer({ name: "flo-customer", version: "0.2.0" }, {
    instructions: "Vehicle-owner repair status and estimate review. Read only. Never claim approval, payment, booking, or cancellation occurred. Never request contact details or a VIN by voice. Ask which repair when more than one matches."
  });
  const register = <I extends z.ZodRawShape, O extends z.ZodType>(name: string, description: string, inputSchema: z.ZodObject<I>, output: O, operation: (input: z.infer<z.ZodObject<I>>) => Promise<z.infer<O>>, summarize: (data: z.infer<O>) => string) => {
    server.registerTool(name, {
      description, inputSchema, outputSchema: z.object({ ok: z.literal(true), data: output }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    }, async input => {
      try {
        await revalidate?.();
        const data = output.parse(await operation(input));
        await revalidate?.();
        return { content: [{ type: "text" as const, text: summarize(data) }], structuredContent: { ok: true, data } };
      } catch (error) {
        const known = error instanceof FloError && ["REPAIR_UNAVAILABLE", "ESTIMATE_NOT_READY"].includes(error.code);
        const message = known ? `${error.message} ${error.recovery[0] ?? ""}` : "Repair information is temporarily unavailable. Please try again shortly.";
        return { isError: true, content: [{ type: "text" as const, text: message }], structuredContent: { ok: false, error: { code: known ? error.code : "SERVICE_UNAVAILABLE", message } } };
      }
    });
  };
  const repairInput = z.object({ repairNumber: z.string().min(1).max(32).describe("Repair number returned by list_my_repairs. Ask which repair if ambiguous.") }).strict();
  register("list_my_repairs", "List only repairs owned by the authenticated vehicle owner. No internal shop information.", z.object({}).strict(), z.array(customerRepairSchema), () => experience.listRepairs(principal), rows => rows.length === 0 ? "There are no repairs available for your account. Check with your shop." : `You have ${rows.length} repair${rows.length === 1 ? "" : "s"}. ${rows.slice(0, 5).map(row => `${row.vehicle}, repair ${row.repairNumber}: ${row.status}.`).join(" ")}${rows.length > 1 ? " Which repair would you like?" : ""}`);
  const serviceTime = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
  register("get_my_repair", "Read current repair and scheduled service status for a repair belonging to the authenticated vehicle owner. Demo service times are explicitly reported in UTC.", repairInput, customerRepairSchema, input => experience.getRepair(principal, input.repairNumber), row => `${row.vehicle}, repair ${row.repairNumber}: ${row.status.replaceAll("_", " ")}. ${row.scheduledStart === null ? "No service time is scheduled yet." : `Service starts ${serviceTime(row.scheduledStart)}${row.scheduledEnd === null ? "; an end time has not been set" : ` and ends ${serviceTime(row.scheduledEnd)}`}.`}`);
  const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  register("get_my_estimate", "Review customer prices, taxes, fees, discounts and total for your repair. Subtotal already includes fees. This does not approve work, pay, or order parts.", repairInput, customerEstimateSchema, input => experience.getEstimate(principal, input.repairNumber), row => `Repair ${row.repairNumber}: subtotal ${dollars(row.subtotalCents)}, including ${dollars(row.feesCents)} in fees; tax ${dollars(row.taxCents)}; discount ${dollars(row.discountCents)}; total ${dollars(row.totalCents)}. Approval status: ${row.approvalStatus}. This review has not approved work or charged you.`);
  return server;
};
