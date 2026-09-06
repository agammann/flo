import { isIP } from "node:net";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createLwaProvider } from "@flo/agent";
import { z } from "zod";
import { createCustomerHttp, type CustomerHttpOptions } from "./customer-http.js";
import { DurableCustomerWebsiteAuth } from "./durable-customer-auth.js";
import { DynamoAuthStore, DynamoCustomerLinkStore, DynamoCustomerRepairs } from "./customer-dynamodb.js";

const eventSchema = z.object({ version: z.literal("2.0"), rawPath: z.string().max(2048), rawQueryString: z.string().max(4096),
  headers: z.record(z.string(), z.string()).default({}), cookies: z.array(z.string().max(4096)).max(20).optional(),
  body: z.string().max(12000).optional(), isBase64Encoded: z.boolean(),
  requestContext: z.object({ apiId: z.string(), stage: z.literal("$default"), http: z.object({ method: z.enum(["GET", "POST", "HEAD", "OPTIONS", "DELETE", "PUT", "PATCH"]), sourceIp: z.string() }) })
});
export interface CustomerLambdaResponse { statusCode: number; headers: Record<string, string>; cookies: string[]; body: string; isBase64Encoded: false }
const failure = (): CustomerLambdaResponse => ({ statusCode: 503, headers: { "content-type": "application/json", "cache-control": "no-store" }, cookies: [], body: JSON.stringify({ error: "Customer sign-in is temporarily unavailable." }), isBase64Encoded: false });

export const createCustomerLambda = (options: CustomerHttpOptions & { publicOrigin: string; apiId: string }) => {
  const origin = new URL(options.publicOrigin);
  if (origin.protocol !== "https:" || origin.origin !== options.publicOrigin || !options.apiId) throw new Error("Invalid customer staging origin");
  const http = createCustomerHttp(options);
  return async (rawEvent: unknown): Promise<CustomerLambdaResponse> => {
    try {
      const event = eventSchema.parse(rawEvent);
      if (event.requestContext.apiId !== options.apiId || !isIP(event.requestContext.http.sourceIp) || !event.rawPath.startsWith("/") || event.rawPath.startsWith("//") || /[?#\\]/.test(event.rawPath)) return failure();
      const headers = new Headers();
      for (const [name, value] of Object.entries(event.headers)) {
        // Transport identity comes exclusively from API Gateway's request context.
        if (["host", "content-length", "cookie", "x-flo-client-ip", "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto"].includes(name.toLowerCase())) continue;
        headers.append(name, value);
      }
      if (event.cookies) headers.set("cookie", event.cookies.join("; "));
      const body = Buffer.from(event.body ?? "", event.isBase64Encoded ? "base64" : "utf8");
      if (body.byteLength > 8192) return { ...failure(), statusCode: 413 };
      const method = event.requestContext.http.method;
      const request = new Request(`${options.publicOrigin}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`, { method, headers, ...(!["GET", "HEAD"].includes(method) ? { body } : {}) });
      const response = await http(request, event.requestContext.http.sourceIp);
      const resultHeaders = Object.fromEntries(response.headers.entries()); delete resultHeaders["set-cookie"];
      return { statusCode: response.status, headers: resultHeaders, cookies: response.headers.getSetCookie(), body: await response.text(), isBase64Encoded: false };
    } catch { return failure(); } // Never log event, cookie, provider URL, secret or exception.
  };
};

let runtime: ReturnType<typeof createCustomerLambda> | undefined;
/** API Gateway payload-v2 Lambda handler; no app.listen(), timers or loopback dependency. */
export const handler = async (event: unknown): Promise<CustomerLambdaResponse> => {
  try {
    if (!runtime) {
      const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error("Missing staging configuration"); return value; };
      const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: required("AWS_REGION"), maxAttempts: 2, requestHandler: { connectionTimeout: 2000, requestTimeout: 3000 } }));
      const publicOrigin = required("FLO_CUSTOMER_PUBLIC_ORIGIN");
      const config = { publicOrigin, clientId: process.env.LWA_CLIENT_ID ?? "", clientSecret: process.env.LWA_CLIENT_SECRET ?? "" };
      const auth = process.env.LWA_ENABLED === "true" ? new DurableCustomerWebsiteAuth(config, createLwaProvider(config),
        new DynamoCustomerLinkStore(client, required("FLO_CUSTOMER_LINKS_TABLE")),
        new DynamoAuthStore(client, required("FLO_CUSTOMER_AUTH_TABLE"), required("FLO_CUSTOMER_STATE_KEY"))) : undefined;
      runtime = createCustomerLambda({ publicOrigin, apiId: required("FLO_CUSTOMER_API_ID"), ...(auth ? { auth } : {}), experience: new DynamoCustomerRepairs(client, required("FLO_CUSTOMER_REPAIRS_TABLE")), assets: new URL("./public/", import.meta.url) });
    }
    return await runtime(event);
  } catch { return failure(); }
};
