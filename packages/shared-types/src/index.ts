export const roles = ["technician", "service_advisor", "manager", "administrator"] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "work_order:read_assigned",
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
] as const;

export type Permission = (typeof permissions)[number];

export interface Actor {
  id: string;
  displayName: string;
  role: Role;
  assignedWorkOrderIds: string[];
}

export interface StructuredError {
  code: string;
  message: string;
  retryable: boolean;
  recovery?: string[];
  details?: Record<string, unknown>;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: StructuredError };

export class FloError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly recovery: string[];
  readonly details: Record<string, unknown> | undefined;

  constructor(error: StructuredError) {
    super(error.message);
    this.name = "FloError";
    this.code = error.code;
    this.retryable = error.retryable;
    this.recovery = error.recovery ?? [];
    this.details = error.details;
  }

  toStructuredError(): StructuredError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      recovery: this.recovery,
      ...(this.details === undefined ? {} : { details: this.details })
    };
  }
}

export const assertNever = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};

export const nowIso = (): string => new Date().toISOString();

export const clone = <T>(value: T): T => structuredClone(value);
