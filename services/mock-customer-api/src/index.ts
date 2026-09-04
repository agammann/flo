import { createCustomerApi } from "./server.js";

const port = Number(process.env.CUSTOMER_API_PORT ?? 4104);
const host = process.env.CUSTOMER_API_HOST ?? "127.0.0.1";
const { app } = createCustomerApi();

app.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", service: "mock-customer-api", event: "listening", host, port }));
});

export * from "./server.js";
