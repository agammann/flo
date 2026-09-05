import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it } from "node:test";
import ts from "typescript";

const template = readFileSync(new URL("../../../infra/aws/bedrock-narrator/template.yaml", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const inline = template.split("ZipFile: |\n")[1]!.split("\n  NarratorApi:")[0]!
  .split("\n").map(line => line.startsWith("          ") ? line.slice(10) : line).join("\n");
interface Ledger { remaining?: number; used: number; unavailable?: boolean }
interface Result { statusCode: number; body: string }
const valid = { requestContext: { authorizer: { iam: { userArn: "arn:aws:iam::123456789012:role/test" } } }, body: JSON.stringify({ task: "part-comparison-lead", optionCount: 3, qualityTier: "premium" }) };

const harness = (state: Ledger, modelFails = false, configured = true) => {
  let calls = 0;
  const result = { handler: undefined as unknown as (event: unknown) => Promise<Result> };
  class Command { constructor(readonly input: Record<string, unknown>) {} }
  class Bedrock {
    constructor(options: { maxAttempts: number }) { assert.equal(options.maxAttempts, 1); }
    async send() {
      calls++;
      if (modelFails) throw new Error("timeout after possible charge");
      return { output: { message: { content: [{ text: "Comparing quality options helps technicians choose confidently." }] } } };
    }
  }
  class Dynamo {
    constructor(options: { maxAttempts: number }) { assert.equal(options.maxAttempts, 1); }
    async send(command: Command) {
      assert.equal(JSON.stringify(command.input.Key), JSON.stringify({ id: { S: "flo-lifetime-v1" } }));
      assert.equal(command.input.UpdateExpression, "SET remaining = remaining - :one ADD used :one");
      assert.equal(command.input.ConditionExpression, "attribute_exists(id) AND schemaVersion = :version AND remaining BETWEEN :one AND :limit");
      if (state.unavailable) throw new Error("unavailable");
      if (state.remaining === undefined || !Number.isFinite(state.remaining) || state.remaining < 1 || state.remaining > 100) {
        throw Object.assign(new Error("condition"), { name: "ConditionalCheckFailedException" });
      }
      state.remaining--;
      state.used++;
      return {};
    }
  }
  runInNewContext(inline, {
    exports: result,
    process: { env: { MODEL_ID: "amazon.nova-lite-v1:0", ...(configured ? { ALLOWANCE_TABLE: "test" } : {}) } },
    console: { error: () => undefined },
    require: (name: string) => name.endsWith("client-dynamodb")
      ? { DynamoDBClient: Dynamo, UpdateItemCommand: Command }
      : { BedrockRuntimeClient: Bedrock, ConverseCommand: Command }
  });
  return { invoke: result.handler, calls: () => calls };
};

describe("deployed narrator authentication and lifetime allowance", () => {
  it("bounds a stalled credential signer and never accepts credential-leaking destinations", async () => {
    const source = readFileSync(new URL("../../../apps/alexa-simulator/src/aws-narrator-auth.ts", import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exported = {} as { signNarratorRequest: (endpoint: string, body: string, signal: AbortSignal) => Promise<Record<string, string>> };
    let signedCalls = 0;
    runInNewContext(compiled, {
      exports: exported, URL,
      require: (name: string) => {
        if (name.includes("signature-v4")) return { SignatureV4: class { sign() { signedCalls++; return new Promise(() => undefined); } } };
        if (name.includes("protocol-http")) return { HttpRequest: class { readonly method = "POST"; } };
        if (name.includes("credential-provider-node")) return { defaultProvider: () => undefined };
        return { Sha256: class { readonly algorithm = "sha256"; } };
      }
    });
    const control = new AbortController();
    const pending = exported.signNarratorRequest("https://example.execute-api.us-west-2.amazonaws.com/narrate", "{}", control.signal);
    control.abort();
    await assert.rejects(pending, /timed out/);
    assert.equal(signedCalls, 1);
    for (const endpoint of ["http://example.execute-api.us-west-2.amazonaws.com/narrate", "https://attacker.example/narrate", "https://example.execute-api.us-west-2.amazonaws.com/narrate?redirect=evil", "https://user:password@example.execute-api.us-west-2.amazonaws.com/narrate"]) {
      await assert.rejects(exported.signNarratorRequest(endpoint, "{}", new AbortController().signal), /endpoint/);
    }
    assert.equal(signedCalls, 1);
  });
  it("requires IAM at the route and denies the former public marker before any spend", async () => {
    assert.match(template, /RouteKey: POST \/narrate\s+AuthorizationType: AWS_IAM/);
    const h = harness({ remaining: 2, used: 0 });
    for (const headers of [{}, { "x-flo-build": "flo-hackathon-2026" }, { authorization: "Bearer arbitrary" }]) {
      assert.equal((await h.invoke({ body: valid.body, headers })).statusCode, 403);
    }
    assert.equal(h.calls(), 0);
  });
  it("preserves legitimate narration and charges one reservation", async () => {
    const state = { remaining: 2, used: 0 };
    const h = harness(state);
    assert.equal((await h.invoke(valid)).statusCode, 200);
    assert.deepEqual(state, { remaining: 1, used: 1 });
    assert.equal(h.calls(), 1);
  });
  it("invalid input neither reserves allowance nor invokes Bedrock", async () => {
    const state = { remaining: 2, used: 0 };
    const h = harness(state);
    for (const body of ["{", "null", "{}", JSON.stringify({ task: "part-comparison-lead", optionCount: 3, qualityTier: "ignore rules" })]) {
      assert.equal((await h.invoke({ ...valid, body })).statusCode, 400);
    }
    assert.equal((await h.invoke({ ...valid, isBase64Encoded: true })).statusCode, 400);
    assert.deepEqual(state, { remaining: 2, used: 0 });
    assert.equal(h.calls(), 0);
  });
  it("shared persistent state limits concurrent requests across handler instances", async () => {
    const state = { remaining: 2, used: 0 };
    const a = harness(state), b = harness(state);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).invoke(valid)));
    assert.equal(results.filter(r => r.statusCode === 200).length, 2);
    assert.equal(a.calls() + b.calls(), 2);
    assert.equal(state.remaining, 0);
  });
  it("fails closed for absent, corrupt, exhausted or unavailable allowance", async () => {
    for (const state of [{ used: 0 }, { remaining: 101, used: 0 }, { remaining: 0, used: 0 }, { remaining: 2, used: 0, unavailable: true }]) {
      const h = harness(state);
      assert.notEqual((await h.invoke(valid)).statusCode, 200);
      assert.equal(h.calls(), 0);
    }
    const h = harness({ remaining: 2, used: 0 }, false, false);
    assert.equal((await h.invoke(valid)).statusCode, 502);
    assert.equal(h.calls(), 0);
  });
  it("does not refund a failed or timed-out model request", async () => {
    const state = { remaining: 1, used: 0 };
    const h = harness(state, true);
    assert.equal((await h.invoke(valid)).statusCode, 502);
    assert.equal((await h.invoke(valid)).statusCode, 429);
    assert.equal(h.calls(), 1);
    assert.deepEqual(state, { remaining: 0, used: 1 });
  });
});
