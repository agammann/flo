import { createInventoryApi } from "./server.js";

const port = Number(process.env.INVENTORY_API_PORT ?? 4102);
const host = process.env.INVENTORY_API_HOST ?? "127.0.0.1";
const { app } = createInventoryApi();

app.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", service: "mock-inventory-api", event: "listening", host, port }));
});

export * from "./server.js";
