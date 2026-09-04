import { createHttpAdapters } from "@flo/adapters";
import { FloOrchestrator } from "@flo/agent";

const orchestrator = new FloOrchestrator(createHttpAdapters({
  shop: process.env.SHOP_API_URL ?? "http://127.0.0.1:4101",
  inventory: process.env.INVENTORY_API_URL ?? "http://127.0.0.1:4102",
  supplier: process.env.SUPPLIER_API_URL ?? "http://127.0.0.1:4103",
  customer: process.env.CUSTOMER_API_URL ?? "http://127.0.0.1:4104"
}));

await orchestrator.resetDemo();
console.log("Flo demo state reset.");
