import { createHttpAdapters } from "@flo/adapters";
import { CustomerWebsiteAuth, FileCustomerLinkStore, createLwaProvider } from "@flo/agent";
import { createCustomerWebsite } from "./customer-website.js";

const config = { clientId: process.env.LWA_CLIENT_ID ?? "", clientSecret: process.env.LWA_CLIENT_SECRET ?? "", publicOrigin: process.env.FLO_CUSTOMER_PUBLIC_ORIGIN ?? "" };
const enabled = process.env.LWA_ENABLED === "true";
const trustedProxyAddresses = (process.env.FLO_CUSTOMER_TRUSTED_PROXY_ADDRESSES ?? "").split(",").filter(Boolean);
// This entrypoint is loopback-only behind a TLS proxy. Require an explicit trust
// configuration instead of silently putting all remote customers in one quota.
if (enabled && (trustedProxyAddresses.length === 0 || trustedProxyAddresses.some(address => !["127.0.0.1", "::1"].includes(address)))) {
  throw new Error("Configure the trusted loopback TLS proxy and overwrite X-Flo-Client-IP before enabling customer sign-in.");
}
const auth = enabled ? new CustomerWebsiteAuth(config, createLwaProvider(config), new FileCustomerLinkStore(process.env.FLO_CUSTOMER_LINKS_FILE ?? "")) : undefined;
const adapters = createHttpAdapters({ shop: process.env.SHOP_API_URL ?? "http://127.0.0.1:4101", inventory: "http://127.0.0.1:4102", supplier: "http://127.0.0.1:4103", customer: "http://127.0.0.1:4104" });
const server = createCustomerWebsite({ ...(auth ? { auth } : {}), shop: adapters.shop, trustedProxyAddresses });
// TLS terminates at a trusted local reverse proxy. Never bind the raw shop demo publicly.
server.listen(Number(process.env.FLO_CUSTOMER_PORT ?? 4400), "127.0.0.1", () => {
  console.info(JSON.stringify({ service: "flo-customer-website", signInConfigured: enabled, officialAlexaAccountLinking: false }));
});
