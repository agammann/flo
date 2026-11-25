import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const fixture = JSON.parse(readFileSync(new URL("../docs/verification/customer-repair-fixture-plan-2026-09-08.json", import.meta.url), "utf8"));
const repairNumber = "1842";
const workOrderId = "wo-1842";
const stagingCustomer = "staging-customer-a";
const stagingKey = { pk: `customer#${stagingCustomer}`, sk: `repair#${repairNumber}` };

const isUtcTimestamp = value => {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
};

export function prepareStagingRepair1842Update(confirmation) {
  const { workOrder, scheduleSlot, purchaseOrder, auditLogIds } = confirmation ?? {};
  if (workOrder?.id !== workOrderId || workOrder.workOrderNumber !== repairNumber ||
      workOrder.customerId !== "customer-001" || workOrder.status !== "scheduled" || workOrder.bayId !== "bay-2" ||
      scheduleSlot?.workOrderId !== workOrderId || scheduleSlot.bayId !== workOrder.bayId ||
      purchaseOrder?.workOrderId !== workOrderId || purchaseOrder.status !== "placed" ||
      !Array.isArray(auditLogIds) || auditLogIds.length !== 2 ||
      auditLogIds.some(id => typeof id !== "string" || !id.trim()) || auditLogIds[0] === auditLogIds[1]) {
    throw new Error("Expected a confirmed local Bay 2 transaction for fictional repair 1842.");
  }

  const { scheduledStart, scheduledEnd } = workOrder;
  if (!isUtcTimestamp(scheduledStart) || !isUtcTimestamp(scheduledEnd) ||
      Date.parse(scheduledEnd) <= Date.parse(scheduledStart) ||
      scheduleSlot.start !== scheduledStart || scheduleSlot.end !== scheduledEnd) {
    throw new Error("The work order and confirmed slot must have matching, ordered UTC timestamps.");
  }

  const baseline = fixture.records.find(row => row.pk === stagingKey.pk && row.sk === stagingKey.sk);
  if (baseline?.customerId !== stagingCustomer || baseline.repair?.repairNumber !== repairNumber ||
      typeof baseline.repair.vehicle !== "string" || !baseline.repair.vehicle.startsWith("Fictional ") ||
      baseline.repair.status !== "diagnosis" || baseline.repair.scheduledStart !== null ||
      baseline.repair.scheduledEnd !== null || baseline.estimate !== null) {
    throw new Error("The checked-in staging baseline no longer matches fictional repair 1842.");
  }

  const expectedBefore = { ...baseline, repair: { ...baseline.repair } };
  const expectedAfter = {
    ...expectedBefore,
    repair: { ...expectedBefore.repair, status: "scheduled", scheduledStart, scheduledEnd }
  };
  const { account, region, stack, logicalResource, tableName } = fixture;
  return {
    status: "REVIEW_ONLY_NOT_EXECUTED",
    target: { account, region, stack, logicalResource },
    expectedBefore,
    expectedAfter,
    request: {
      TableName: tableName,
      Key: { pk: { S: stagingKey.pk }, sk: { S: stagingKey.sk } },
      UpdateExpression: "SET #repair.#status = :scheduled, #repair.#start = :start, #repair.#end = :end",
      ConditionExpression: "attribute_exists(#pk) AND attribute_exists(#sk) AND #owner = :owner AND #repair = :oldRepair AND #estimate = :null",
      ExpressionAttributeNames: {
        "#pk": "pk", "#sk": "sk", "#owner": "customerId", "#repair": "repair", "#estimate": "estimate",
        "#status": "status", "#start": "scheduledStart", "#end": "scheduledEnd"
      },
      ExpressionAttributeValues: {
        ":owner": { S: stagingCustomer },
        ":oldRepair": { M: {
          repairNumber: { S: repairNumber },
          vehicle: { S: expectedBefore.repair.vehicle },
          status: { S: expectedBefore.repair.status },
          scheduledStart: { NULL: true },
          scheduledEnd: { NULL: true }
        } },
        ":null": { NULL: true },
        ":scheduled": { S: expectedAfter.repair.status },
        ":start": { S: scheduledStart },
        ":end": { S: scheduledEnd }
      },
      ReturnValues: "NONE",
      ReturnValuesOnConditionCheckFailure: "NONE"
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/prepare-staging-repair-1842-update.mjs <local-confirm-response.json>");
    const response = JSON.parse(readFileSync(process.argv[2], "utf8"));
    if (response?.ok !== true || response.view !== "schedule" ||
        !Array.isArray(response.invocations) ||
        !response.invocations.some(call => call?.kind === "mcp" && call.tool === "confirm_transaction" && call.ok === true)) {
      throw new Error("Expected a successful Confirm response from the local Flo shop simulator.");
    }
    const plan = prepareStagingRepair1842Update(response.data);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof SyntaxError ? "The local confirmation file is not valid JSON." : error.message;
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
