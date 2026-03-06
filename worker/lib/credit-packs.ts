/**
 * Credit Pack Definitions
 *
 * Static credit pack options for one-time purchases.
 * Prices in cents (Solidgate convention).
 */

export interface CreditPack {
  id: string;
  credits: number;
  price: number; // cents
  currency: string;
  label: string;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  { id: 'pack_10', credits: 10, price: 699, currency: 'USD', label: '10 Credits' },
  { id: 'pack_30', credits: 30, price: 1499, currency: 'USD', label: '30 Credits' },
];

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}
