import { isIP } from "node:net";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { z } from "zod";
import { CustomerEnrollmentRequests, type CustomerEnrollment } from "./customer-enrollment.js";
import { createEnrollmentHttp } from "./customer-enrollment-http.js";
import { DynamoEnrollmentStarter } from "./customer-enrollment-dynamodb-start.js";
import { LambdaEnrollmentRedemption } from "./customer-enrollment-invoke.js";
import { createEnrollmentRuntime, enrollmentRuntimeConfig } from "./customer-enrollment-runtime.js";

const payload = z.object({ version: z.literal("2.0"), rawPath: z.string().max(128), rawQueryString: z.literal(""),
  headers: z.record(z.string().max(128), z.string().max(8192)).default({}), cookies: z.array(z.string().max(4096)).max(20).optional(),
  body: z.string().max(4096).optional(), isBase64Encoded: z.boolean(),
  requestContext: z.object({ apiId: z.string(), stage: z.literal("$default"), http: z.object({ method: z.string().max(16), sourceIp: z.string() }) }) });
const errorResponse = (statusCode: number) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", "content-security-policy": "default-src 'none'; frame-ancestors 'none'" }, body: JSON.stringify({ error: "Pairing is unavailable." }), isBase64Encoded: false as const });

export function createEnrollmentRequestLambda(options: { service: Pick<CustomerEnrollment, "start" | "redeem">; publicOrigin: string; apiId: string; assets: URL }) {
  if (!options.apiId) throw new Error("API identity required");
  const http = createEnrollmentHttp(options.service, options.publicOrigin, async () => new Response(null, { status: 404 }), options.assets);
  return async (event: unknown) => {
    try {
      const input = payload.parse(event);
      if (input.requestContext.apiId !== options.apiId || !isIP(input.requestContext.http.sourceIp)) return errorResponse(403);
      if (!["/pairing", "/pairing.js", "/enrollment/request", "/enrollment/redeem"].includes(input.rawPath)) return errorResponse(404);
      const method = input.requestContext.http.method;
      if (!["GET", "POST"].includes(method)) return errorResponse(405);
      const headers = new Headers();
      for (const [key, value] of Object.entries(input.headers)) {
        if (["host", "cookie", "content-length", "authorization", "forwarded"].includes(key.toLowerCase()) || key.toLowerCase().startsWith("x-")) continue;
        if (headers.has(key)) return errorResponse(400);
        headers.set(key, value);
      }
      if (input.cookies) headers.set("cookie", input.cookies.join("; "));
      const bytes = Buffer.from(input.body ?? "", input.isBase64Encoded ? "base64" : "utf8");
      if (input.isBase64Encoded && bytes.toString("base64") !== (input.body ?? "")) return errorResponse(400);
      if (bytes.byteLength > 2048) return errorResponse(413);
      if (method === "GET" && bytes.byteLength) return errorResponse(400);
      const request = new Request(options.publicOrigin + input.rawPath, { method, headers, ...(method === "POST" ? { body: bytes } : {}) });
      const response = await http(request, input.requestContext.http.sourceIp);
      return { statusCode: response.status, headers: Object.fromEntries(response.headers), body: await response.text(), isBase64Encoded: false as const };
    } catch { return errorResponse(400); }
  };
}
let runtime: ReturnType<typeof createEnrollmentRequestLambda> | undefined;
export const handler = async (event: unknown) => {
  if (process.env.FLO_ENROLLMENT_ENABLED !== "true") return errorResponse(503);
  try {
    if (!runtime) {
      const config = enrollmentRuntimeConfig(process.env);
      const { client, identity } = createEnrollmentRuntime(config);
      const start = new CustomerEnrollmentRequests(identity, new DynamoEnrollmentStarter(client, config.tables));
      const redeem = new LambdaEnrollmentRedemption(new LambdaClient({ region: config.region, maxAttempts: 1, requestHandler: { connectionTimeout: 1000, requestTimeout: 8000 } }), process.env.FLO_REDEMPTION_FUNCTION_ARN ?? "", config.account, config.region);
      runtime = createEnrollmentRequestLambda({ service: { start: start.start.bind(start), redeem: async (session, body) => {
        await identity.enrollmentIdentity(session);
        return redeem.redeem(session, body);
      } }, publicOrigin: config.publicOrigin, apiId: process.env.FLO_CUSTOMER_API_ID ?? "", assets: new URL("./public/", import.meta.url) });
    }
    return await runtime(event);
  } catch { return errorResponse(503); }
};
