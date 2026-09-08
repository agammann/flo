// Read prices from the returned estimate, never from a seeded recommendation.
export function estimateView(estimate) {
  const sum = (items, key) => Array.isArray(items) && items.every(item => Number.isSafeInteger(item[key]) && item[key] >= 0)
    ? items.reduce((total, item) => total + item[key], 0) : null;
  const parts = estimate.partItems;
  return {
    description: Array.isArray(parts) && parts.length > 0
      ? parts.map(item => `${item.quantity} × ${item.description}`).join('; ')
      : 'Part details unavailable',
    partsCents: sum(parts, 'lineCustomerPriceCents'),
    laborCents: sum(estimate.laborItems, 'totalCents')
  };
}
