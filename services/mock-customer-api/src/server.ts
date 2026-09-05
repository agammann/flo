import { randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { approvalSchema, createDemoState, type Approval, type Customer } from "@flo/domain";
import { FloError, clone } from "@flo/shared-types";

interface CustomerMessage {
  id: string;
  customerId: string;
  channel: "sms" | "email" | "phone";
  body: string;
  sentAt: string;
}

interface CustomerState { customers: Customer[]; approvals: Approval[]; messages: CustomerMessage[] }
export interface CustomerApi { app: Express; snapshot(): CustomerState; reset(now?: Date): void }

const requestApprovalSchema = z.object({
  workOrderId: z.string().min(1),
  estimateId: z.string().min(1),
  estimateFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  customerId: z.string().min(1),
  summary: z.string().min(1).max(2000)
});

export const createCustomerApi = (now = new Date()): CustomerApi => {
  const makeState = (at: Date): CustomerState => ({ customers: createDemoState(at).customers, approvals: [], messages: [] });
  let state = makeState(now);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => response.json({ ok: true, service: "mock-customer-api" }));
  app.get("/customers/:id", (request, response) => {
    const customer = state.customers.find((item) => item.id === request.params.id);
    if (customer === undefined) throw new FloError({ code: "CUSTOMER_NOT_FOUND", message: "Customer was not found.", retryable: false });
    response.json(customer);
  });
  app.post("/messages", (request, response) => {
    const body = z.object({ customerId: z.string().min(1), channel: z.enum(["sms", "email", "phone"]), body: z.string().min(1).max(2000) }).parse(request.body);
    if (!state.customers.some((item) => item.id === body.customerId)) throw new FloError({ code: "CUSTOMER_NOT_FOUND", message: "Customer was not found.", retryable: false });
    const message: CustomerMessage = { id: `message-${randomUUID()}`, ...body, sentAt: new Date().toISOString() };
    state.messages.push(message);
    response.status(201).json(message);
  });
  app.post("/approvals", (request, response) => {
    const input = requestApprovalSchema.parse(request.body);
    const customer = state.customers.find((item) => item.id === input.customerId);
    if (customer === undefined) throw new FloError({ code: "CUSTOMER_NOT_FOUND", message: "Customer was not found.", retryable: false });
    const existing = state.approvals.find((item) => item.estimateId === input.estimateId && item.status === "pending");
    if (existing !== undefined) {
      response.json(existing);
      return;
    }
    const message: CustomerMessage = {
      id: `message-${randomUUID()}`,
      customerId: customer.id,
      channel: customer.preferredContactMethod,
      body: input.summary,
      sentAt: new Date().toISOString()
    };
    state.messages.push(message);
    const approval = approvalSchema.parse({
      id: `approval-${randomUUID()}`,
      workOrderId: input.workOrderId,
      estimateId: input.estimateId,
      estimateFingerprint: input.estimateFingerprint,
      customerId: input.customerId,
      status: "pending",
      requestedAt: new Date().toISOString(),
      respondedAt: null,
      channel: customer.preferredContactMethod,
      messageId: message.id
    });
    state.approvals.push(approval);
    response.status(201).json(approval);
  });
  app.get("/approvals/:id", (request, response) => {
    const exact = state.approvals.find((item) => item.id === request.params.id);
    const approval = exact ?? [...state.approvals].reverse().find((item) => item.workOrderId === request.params.id || item.estimateId === request.params.id);
    if (approval === undefined) throw new FloError({ code: "APPROVAL_NOT_FOUND", message: "Customer approval was not found.", retryable: false });
    response.json(approval);
  });
  app.post("/approvals/:id/simulate", (request, response) => {
    const body = z.object({ status: z.enum(["approved", "denied"]), actor: z.literal("demo-customer") }).parse(request.body);
    const approval = state.approvals.find((item) => item.id === request.params.id);
    if (approval === undefined) throw new FloError({ code: "APPROVAL_NOT_FOUND", message: "Customer approval was not found.", retryable: false });
    if (approval.status !== "pending") throw new FloError({ code: "APPROVAL_ALREADY_RESOLVED", message: `Approval is already ${approval.status}.`, retryable: false });
    approval.status = body.status;
    approval.respondedAt = new Date().toISOString();
    response.json(approval);
  });
  app.post("/demo/reset", (_request, response) => { state = makeState(new Date()); response.json({ ok: true }); });
  app.get("/demo/state", (_request, response) => response.json(state));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof FloError) {
      response.status(error.code.endsWith("NOT_FOUND") ? 404 : 409).json({ error: error.toStructuredError() });
      return;
    }
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed.", retryable: false, details: { issues: error.issues } } });
      return;
    }
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected customer service failure.", retryable: true } });
  });

  return { app, snapshot: () => clone(state), reset: (resetNow = new Date()) => { state = makeState(resetNow); } };
};
