/** Compact number formatting (1234 → "1.2K", 1234567 → "1.2M") */
export function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

/** Format byte count to human-readable (1048576 → "1.0 MB") */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format seconds to m:ss display (125 → "2:05") */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format price with Intl currency (9.99, "USD" → "$9.99"). Returns "Free" for 0. */
export function formatPrice(price: number, currency: string): string {
  if (price === 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

/** Format price from cents (699 → "$6.99") */
export function formatPriceFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
