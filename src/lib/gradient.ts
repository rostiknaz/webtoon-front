const GRADIENT_COUNT = 5;

/** Stable djb2 hash → gradient index from any string ID. Same ID always gets same color. */
export function getGradientIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % GRADIENT_COUNT;
}

/** Returns the CSS class name for a clip's brand gradient background. */
export function getGradientClass(id: string): string {
  return `brand-gradient-${getGradientIndex(id)}`;
}
