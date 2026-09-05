import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { isDemoModeEnabled } from "@flo/mcp";

describe("Flo runtime configuration", () => {
  it("requires an explicit opt-in to expose demo tools in a production runtime", () => {
    assert.equal(isDemoModeEnabled({ NODE_ENV: "production" }), false);
    assert.equal(isDemoModeEnabled({ NODE_ENV: "production", FLO_DEMO_MODE: "false" }), false);
    assert.equal(isDemoModeEnabled({ NODE_ENV: "production", FLO_DEMO_MODE: "true" }), true);
    assert.equal(isDemoModeEnabled({ NODE_ENV: "development" }), true);
  });

  it("keeps the image in production mode while opting the local Docker demo into demo controls", async () => {
    const [dockerfile, compose] = await Promise.all([
      readFile(resolve("Dockerfile"), "utf8"),
      readFile(resolve("docker-compose.yml"), "utf8")
    ]);
    assert.match(dockerfile, /ENV NODE_ENV=production/);
    assert.match(compose, /mcp:[\s\S]*?FLO_DEMO_MODE:\s*["']?true["']?/);
  });

  it("documents the hostname-based origin key consumed by the MCP service", async () => {
    const example = await readFile(resolve(".env.example"), "utf8");
    assert.match(example, /^ALLOWED_ORIGIN_HOSTNAMES=/m);
    assert.doesNotMatch(example, /^ALLOWED_ORIGINS=/m);
  });
});
