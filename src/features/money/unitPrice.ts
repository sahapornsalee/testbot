export interface PriceItem {
  label: string;
  price: number;
  quantity: number;
}

export interface UnitPriceRow extends PriceItem {
  unitPrice: number | null;
  cheapest: boolean;
  /** Percent more expensive than the cheapest valid item. */
  extraPercent: number | null;
}

/** Price per unit for each item, marking the cheapest. Invalid rows get null. */
export function compareUnitPrices(items: readonly PriceItem[]): UnitPriceRow[] {
  const unitPrices = items.map((item) =>
    Number.isFinite(item.price) && Number.isFinite(item.quantity) && item.price >= 0 && item.quantity > 0
      ? item.price / item.quantity
      : null,
  );
  const valid = unitPrices.filter((p): p is number => p !== null);
  const min = valid.length >= 1 ? Math.min(...valid) : null;
  return items.map((item, i) => {
    const unitPrice = unitPrices[i] ?? null;
    return {
      ...item,
      unitPrice,
      cheapest: unitPrice !== null && min !== null && valid.length > 1 && unitPrice === min,
      extraPercent: unitPrice !== null && min !== null && min > 0 ? Math.round(((unitPrice - min) / min) * 1000) / 10 : null,
    };
  });
}
