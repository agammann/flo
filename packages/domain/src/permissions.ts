import { FloError, type Actor, type Permission, type Role } from "@flo/shared-types";

const rolePermissions: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  technician: new Set([
    "work_order:read_assigned",
    "work_order:write_diagnostic",
    "estimate:read",
    "estimate:write",
    "customer:read",
    "customer:message",
    "approval:request",
    "parts:search",
    "purchase:prepare",
    "purchase:execute",
    "schedule:read",
    "schedule:request",
    "schedule:write"
  ]),
  service_advisor: new Set([
    "work_order:read_all",
    "estimate:read",
    "estimate:write",
    "customer:read",
    "customer:message",
    "approval:request",
    "parts:search",
    "purchase:prepare",
    "purchase:execute",
    "schedule:read",
    "schedule:request",
    "schedule:write"
  ]),
  manager: new Set([
    "work_order:read_all",
    "work_order:write_diagnostic",
    "work_order:close",
    "estimate:read",
    "estimate:write",
    "customer:read",
    "customer:message",
    "approval:request",
    "parts:search",
    "purchase:prepare",
    "purchase:execute",
    "purchase:approve_exception",
    "schedule:read",
    "schedule:request",
    "schedule:write",
    "audit:read"
  ]),
  administrator: new Set([
    "work_order:read_all",
    "work_order:write_diagnostic",
    "work_order:close",
    "estimate:read",
    "estimate:write",
    "customer:read",
    "customer:message",
    "approval:request",
    "parts:search",
    "purchase:prepare",
    "purchase:execute",
    "purchase:approve_exception",
    "schedule:read",
    "schedule:request",
    "schedule:write",
    "configuration:write",
    "audit:read"
  ])
};

export const hasPermission = (actor: Actor, permission: Permission): boolean => rolePermissions[actor.role].has(permission);

export const requirePermission = (actor: Actor, permission: Permission): void => {
  if (!hasPermission(actor, permission)) {
    throw new FloError({
      code: "PERMISSION_DENIED",
      message: `${actor.role} does not have ${permission}`,
      retryable: false,
      recovery: ["Ask an authorized service advisor or manager to perform this action."],
      details: { actorId: actor.id, role: actor.role, permission }
    });
  }
};

export const canReadWorkOrder = (actor: Actor, workOrderId: string): boolean =>
  hasPermission(actor, "work_order:read_all") ||
  (hasPermission(actor, "work_order:read_assigned") && actor.assignedWorkOrderIds.includes(workOrderId));

export const requireWorkOrderRead = (actor: Actor, workOrderId: string): void => {
  if (!canReadWorkOrder(actor, workOrderId)) {
    throw new FloError({
      code: "WORK_ORDER_ACCESS_DENIED",
      message: "This work order is not assigned to the current actor.",
      retryable: false,
      recovery: ["Ask a service advisor to assign the work order or retrieve it."],
      details: { actorId: actor.id, workOrderId }
    });
  }
};
