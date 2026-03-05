/**
 * Video Token Library
 *
 * HMAC-SHA256 signed tokens for video stream protection.
 * Tokens are lightweight (no DB lookup), validated entirely in the Worker.
 *
 * Format: token = hex(HMAC-SHA256(path:expires, secret))
 */

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const;

/** Default TTLs in seconds */
export const VIDEO_TOKEN_TTL = {
  MANIFEST: 15 * 60,   // 15 minutes for manifests
  SEGMENT: 30 * 60,    // 30 minutes for segments (longer to avoid mid-stream expiry)
} as const;

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify'],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a signed video token for a given path
 */
export async function generateVideoToken(
  path: string,
  expiresAt: number,
  secret: string,
): Promise<string> {
  const message = `${path}:${expiresAt}`;
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(ALGORITHM, key, new TextEncoder().encode(message));
  return toHex(signature);
}

/**
 * Validate a video token
 *
 * Returns true if the token is valid and not expired.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function validateVideoToken(
  path: string,
  token: string,
  expires: number,
  secret: string,
): Promise<boolean> {
  // Check expiration first (cheap)
  if (Date.now() / 1000 > expires) return false;

  // Constant-time comparison via crypto.subtle.verify
  const message = `${path}:${expires}`;
  const key = await getKey(secret);
  const tokenBytes = hexToBytes(token);
  return crypto.subtle.verify(
    ALGORITHM,
    key,
    tokenBytes,
    new TextEncoder().encode(message),
  );
}
