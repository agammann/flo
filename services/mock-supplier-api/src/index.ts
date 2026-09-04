import { createSupplierApi } from "./server.js";

const port = Number(process.env.SUPPLIER_API_PORT ?? 4103);
const host = process.env.SUPPLIER_API_HOST ?? "127.0.0.1";
const { app } = createSupplierApi();

app.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", service: "mock-supplier-api", event: "listening", host, port }));
});

export * from "./server.js";
