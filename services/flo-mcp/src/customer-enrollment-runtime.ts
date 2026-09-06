import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { DynamoAuthStore } from "./customer-dynamodb.js";
import { EnrollmentSessionVerifier, createEnrollmentSubjectLookup } from "./customer-enrollment-session.js";

/** Configuration values are supplied privately by deployment. Never log this
 * object or retrieve its encryption-key value through agent tooling. */
export const enrollmentRuntimeConfig = (env: NodeJS.ProcessEnv) => {
  const table = z.string().regex(/^[A-Za-z0-9_.-]{3,255}$/);
  const config = z.object({ region: z.string().regex(/^us-(east|west)-[12]$/), account: z.string().regex(/^\d{12}$/), clientId: z.string().min(1).max(100),
    publicOrigin: z.string().url(), stateKey: z.string().regex(/^[a-f0-9]{64}$/i),
    tables: z.object({ auth: table, requests: table, approvals: table, links: table, audit: table }).strict() }).parse({
    region: env.AWS_REGION, account: env.FLO_AWS_ACCOUNT_ID, clientId: env.LWA_CLIENT_ID, publicOrigin: env.FLO_CUSTOMER_PUBLIC_ORIGIN, stateKey: env.FLO_CUSTOMER_STATE_KEY,
    tables: { auth: env.FLO_CUSTOMER_AUTH_TABLE, requests: env.FLO_ENROLLMENT_REQUESTS_TABLE, approvals: env.FLO_ENROLLMENT_APPROVALS_TABLE, links: env.FLO_CUSTOMER_LINKS_TABLE, audit: env.FLO_ENROLLMENT_AUDIT_TABLE }
  });
  const url = new URL(config.publicOrigin);
  if (url.protocol !== "https:" || url.origin !== config.publicOrigin || new Set(Object.values(config.tables)).size !== 5) throw new Error("Canonical origin and five distinct tables required");
  return config;
};
export const createEnrollmentRuntime = (config: ReturnType<typeof enrollmentRuntimeConfig>) => {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region, maxAttempts: 1, requestHandler: { connectionTimeout: 1000, requestTimeout: 2000 } }));
  const store = new DynamoAuthStore(client, config.tables.auth, config.stateKey);
  const identity = new EnrollmentSessionVerifier(config, { read: store.read.bind(store) }, createEnrollmentSubjectLookup());
  return { client, identity };
};
