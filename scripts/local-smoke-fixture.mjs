// Disposable production-mode HTTP fixture. No cloud calls or existing demo reset.
import { createShopApi } from '../services/mock-shop-api/dist/server.js';
import { createInventoryApi } from '../services/mock-inventory-api/dist/server.js';
import { createSupplierApi } from '../services/mock-supplier-api/dist/server.js';
import { createCustomerApi } from '../services/mock-customer-api/dist/server.js';
import { createHttpAdapters } from '../packages/adapters/dist/index.js';
import { createFloHttpServer } from '../services/flo-mcp/dist/server.js';

const services = [createShopApi(), createInventoryApi(), createSupplierApi(), createCustomerApi()];
const started = await Promise.all(services.map(({ app }) => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  server.on('error', reject);
})));
const [shop, inventory, supplier, customer] = started.map(item => item.url);
const mcp = createFloHttpServer({ adapters: createHttpAdapters({ shop, inventory, supplier, customer }), demoMode: true });
await new Promise(resolve => mcp.server.listen(0, '127.0.0.1', resolve));
process.env.MCP_URL = `http://127.0.0.1:${mcp.server.address().port}/mcp`;
process.env.NODE_ENV = 'production';
process.env.FLO_DEMO_MODE = 'true';
process.env.SIMULATOR_HOST = '127.0.0.1';
process.env.SIMULATOR_PORT = process.env.FLO_FIXTURE_PORT ?? '4550';
process.env.BEDROCK_NARRATOR_URL = '';
await import('../apps/alexa-simulator/dist/server.js');
console.log('Disposable fixture: production environment, explicit demo opt-in, AWS disabled.');
