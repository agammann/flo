import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { type DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { CustomerAuthError, customerEstimateSchema, customerRepairSchema, type CustomerLinkStore, type CustomerPrincipal } from "@flo/agent";
import { FloError } from "@flo/shared-types";
import type { AtomicAuthStore, StoredAuthRecord } from "./durable-customer-auth.js";
import type { CustomerRepairService } from "./customer-tools.js";

const unavailable = () => new CustomerAuthError(503, "SIGN_IN_UNAVAILABLE");
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
export const customerLinkKey = (clientId: string, subject: string): string => sha(JSON.stringify([clientId, subject]));
const authRowSchema = z.object({ id: z.string(), revision: z.string(), expiresAt: z.number().int(), ttl: z.number().int(), encrypted: z.string().max(32768) }).strict();

/** Encrypted values, strong reads, conditional writes. TTL is cleanup, not authorization. */
export class DynamoAuthStore implements AtomicAuthStore {
  private readonly key: Buffer;
  constructor(private readonly client: DynamoDBDocumentClient, private readonly table: string, encryptionKeyHex: string) {
    if (!/^[a-f0-9]{64}$/i.test(encryptionKeyHex) || !table) throw unavailable();
    this.key = Buffer.from(encryptionKeyHex, "hex");
  }
  private aad(id: string, revision: string, expiresAt: number): Buffer { return Buffer.from(JSON.stringify([this.table, id, revision, expiresAt])); }
  async read(id: string): Promise<StoredAuthRecord | undefined> {
    try {
      const result = await this.client.send(new GetCommand({ TableName: this.table, Key: { id }, ConsistentRead: true }));
      if (!result.Item) return undefined;
      const item = authRowSchema.parse(result.Item);
      if (item.id !== id || item.ttl !== Math.ceil(item.expiresAt / 1000)) throw unavailable();
      const encrypted = Buffer.from(item.encrypted, "base64");
      const decipher = createDecipheriv("aes-256-gcm", this.key, encrypted.subarray(0, 12));
      decipher.setAAD(this.aad(id, item.revision, item.expiresAt)); decipher.setAuthTag(encrypted.subarray(12, 28));
      const value: unknown = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString("utf8"));
      return { revision: item.revision, expiresAt: item.expiresAt, value };
    } catch { throw unavailable(); }
  }
  async write(id: string, expectedRevision: string | undefined, record: StoredAuthRecord): Promise<boolean> {
    try {
      const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.key, iv);
      cipher.setAAD(this.aad(id, record.revision, record.expiresAt));
      const payload = Buffer.concat([cipher.update(JSON.stringify(record.value), "utf8"), cipher.final()]);
      const encrypted = Buffer.concat([iv, cipher.getAuthTag(), payload]).toString("base64");
      await this.client.send(new PutCommand({ TableName: this.table,
        Item: authRowSchema.parse({ id, revision: record.revision, expiresAt: record.expiresAt, ttl: Math.ceil(record.expiresAt / 1000), encrypted }),
        ConditionExpression: expectedRevision === undefined ? "attribute_not_exists(id)" : "#revision = :revision",
        ...(expectedRevision === undefined ? {} : { ExpressionAttributeNames: { "#revision": "revision" }, ExpressionAttributeValues: { ":revision": expectedRevision } })
      }));
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") return false;
      throw unavailable();
    }
  }
  async remove(id: string): Promise<void> {
    try { await this.client.send(new DeleteCommand({ TableName: this.table, Key: { id } })); }
    catch { throw unavailable(); }
  }
}

export const verifiedLinkSchema = z.object({
  id: z.string(), version: z.literal(1), clientId: z.string().min(1), amazonUserId: z.string().min(1).max(256),
  customerId: z.string().min(1).max(128), active: z.boolean(), verifiedBy: z.string().min(1).max(128),
  verifiedAt: z.iso.datetime(), evidenceRef: z.string().min(1).max(256)
}).strict();

/** Public execution role gets GetItem only on this separate operator-owned table. */
export class DynamoCustomerLinkStore implements CustomerLinkStore {
  constructor(private readonly client: DynamoDBDocumentClient, private readonly table: string) {}
  async findCustomer(clientId: string, amazonUserId: string): Promise<string | undefined> {
    try {
      const id = customerLinkKey(clientId, amazonUserId);
      const result = await this.client.send(new GetCommand({ TableName: this.table, Key: { id }, ConsistentRead: true }));
      if (!result.Item) return undefined;
      const item = verifiedLinkSchema.parse(result.Item);
      if (item.id !== id || item.clientId !== clientId || item.amazonUserId !== amazonUserId) throw unavailable();
      return item.active ? item.customerId : undefined;
    } catch { throw unavailable(); }
  }
}

export const repairProjectionSchema = z.object({ pk: z.string(), sk: z.string(), customerId: z.string().min(1), repair: customerRepairSchema, estimate: customerEstimateSchema.nullable() }).strict();
const repairUnavailable = () => new FloError({ code: "REPAIR_UNAVAILABLE", message: "That repair is not available for your account.", retryable: false, recovery: ["Check your repair list or contact your shop."] });

/** Customer-keyed read projections only. No staff/shop API is exposed by staging. */
export class DynamoCustomerRepairs implements CustomerRepairService {
  constructor(private readonly client: DynamoDBDocumentClient, private readonly table: string) {}
  private partition(principal: CustomerPrincipal): string {
    if (!principal.subject || !principal.customerId) throw repairUnavailable();
    return `customer#${principal.customerId}`;
  }
  private project(principal: CustomerPrincipal, value: unknown) {
    const row = repairProjectionSchema.parse(value);
    if (row.pk !== this.partition(principal) || row.customerId !== principal.customerId || row.sk !== `repair#${row.repair.repairNumber}` || (row.estimate && row.estimate.repairNumber !== row.repair.repairNumber)) throw repairUnavailable();
    return row;
  }
  async listRepairs(principal: CustomerPrincipal) {
    const result = await this.client.send(new QueryCommand({ TableName: this.table, ConsistentRead: true, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": this.partition(principal) }, Limit: 100 }));
    if (result.LastEvaluatedKey) throw repairUnavailable(); // Never silently return a partial list.
    return (result.Items ?? []).map(row => this.project(principal, row).repair);
  }
  private async get(principal: CustomerPrincipal, repairNumber: string) {
    const result = await this.client.send(new GetCommand({ TableName: this.table, Key: { pk: this.partition(principal), sk: `repair#${repairNumber}` }, ConsistentRead: true }));
    if (!result.Item) throw repairUnavailable();
    const row = this.project(principal, result.Item);
    if (row.repair.repairNumber !== repairNumber) throw repairUnavailable();
    return row;
  }
  async getRepair(principal: CustomerPrincipal, repairNumber: string) { return (await this.get(principal, repairNumber)).repair; }
  async getEstimate(principal: CustomerPrincipal, repairNumber: string) {
    const row = await this.get(principal, repairNumber);
    if (!row.estimate) throw new FloError({ code: "ESTIMATE_NOT_READY", message: "Your shop has not prepared an estimate yet.", retryable: true, recovery: ["Check again later."] });
    return row.estimate;
  }
}
