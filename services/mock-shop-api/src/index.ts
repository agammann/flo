import { createShopApi } from "./server.js";

const port = Number(process.env.SHOP_API_PORT ?? 4101);
const host = process.env.SHOP_API_HOST ?? "127.0.0.1";
const { app } = createShopApi();

app.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", service: "mock-shop-api", event: "listening", host, port }));
});

export * from "./server.js";
