import { Router } from "express";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

export const createCustomerRouter = (mcpUrl: string, demoEnabled: boolean): Router => {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    if (!demoEnabled) { response.status(401).json({ ok: false, voice: "Customer account linking is not configured. This demo is unavailable." }); return; }
    next();
  });
  router.post("/command", async (request, response) => {
    const body: unknown = request.body;
    if (typeof body !== "object" || body === null || !("command" in body) || typeof body.command !== "string" || body.command.length > 300 || !("demoConsent" in body) || body.demoConsent !== true || Object.keys(body).some(key => !["command", "demoConsent"].includes(key))) {
      response.status(400).json({ ok: false, voice: "Please acknowledge the synthetic-data demo notice and enter a repair question of up to 300 characters." }); return;
    }
    const command = body.command.trim().toLowerCase();
    if (command.length === 0) {
      response.status(400).json({ ok: false, voice: "Enter a repair question before sending." }); return;
    }
    if (/\b(approve|confirm|pay|buy|order|cancel|change|book|reschedule)\b/.test(command)) {
      response.json({ ok: true, voice: "This customer preview can review repairs and estimates only. It cannot approve work, pay, book, change, or cancel appointments. Nothing has been changed.", data: null, tools: [] }); return;
    }
    if (/^(help|what can you do)[?.!]*$/.test(command)) {
      response.json({ ok: true, voice: "I can list your repairs, check repair status, and review an estimate including fees and taxes. Try: show my repairs, status of repair 1842, or review estimate 1842.", data: null, tools: [] }); return;
    }
    const numbers = [...command.matchAll(/\b\d{4,10}\b/g)].map(match => match[0]);
    if (new Set(numbers).size > 1) {
      response.json({ ok: true, voice: "Which repair number would you like to review? Please ask about one repair at a time.", data: null, tools: [] }); return;
    }
    if (!/\b(repair|repairs|estimate|estimates|status|cost|total|price|vehicle|car|truck|ford)\b/.test(command)) {
      response.json({ ok: true, voice: "This preview understands repair status and estimate questions. Try show my repairs, or review estimate 1842. Nothing has been changed.", data: null, tools: [] }); return;
    }
    const number = numbers[0];
    const name = number === undefined ? "list_my_repairs" : /estimate|cost|total|price/.test(command) ? "get_my_estimate" : "get_my_repair";
    const client = new Client({ name: "flo-customer-preview", version: "0.2.0" }, { versionNegotiation: { mode: "legacy" } });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
      const result = await client.callTool({ name, arguments: number === undefined ? {} : { repairNumber: number } });
      const voice = result.content.filter(item => item.type === "text").map(item => item.text).join(" ");
      const envelope: unknown = result.structuredContent;
      const data = !result.isError && typeof envelope === "object" && envelope !== null && "data" in envelope ? envelope.data : null;
      response.json({ ok: result.isError !== true, voice, data, tools: [name] });
    } catch {
      response.status(503).json({ ok: false, voice: "Your repair information is temporarily unavailable. Please try again shortly.", data: null, tools: [] });
    } finally { await client.close().catch(() => undefined); }
  });
  return router;
};
