import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateView } from '../apps/alexa-simulator/public/estimate-view.js';
test('shop estimate displays actual selected line prices and description', () => {
  for (const [description, price] of [['OEM-style 220A alternator', 39015], ['Premium aftermarket alternator', 29565]]) {
    const result = estimateView({ partItems: [{ quantity: 1, description, lineCustomerPriceCents: price }], laborItems: [{ totalCents: 12600 }] });
    assert.equal(result.partsCents, price); assert.equal(result.laborCents, 12600);
    assert.equal(result.description, `1 × ${description}`);
  }
});
test('line totals already include quantity and all lines are counted', () => {
  assert.equal(estimateView({ partItems: [{ quantity: 2, description: 'A', lineCustomerPriceCents: 4000 }, { quantity: 1, description: 'B', lineCustomerPriceCents: 1500 }], laborItems: [] }).partsCents, 5500);
});
test('missing prices are unavailable rather than a seeded fallback', () => {
  const missing = estimateView({}); assert.equal(missing.partsCents, null); assert.equal(missing.laborCents, null);
  assert.equal(estimateView({ partItems: [{ customerPriceCents: 29565 }], laborItems: [{ totalCents: -1 }] }).partsCents, null);
});
