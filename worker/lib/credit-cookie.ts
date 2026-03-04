/**
 * Signed Credit Cookie
 *
 * Creates tamper-proof cookies containing credit balance.
 * Client can READ but cannot FORGE valid cookies.
 *
 * Format: base64(payload).base64(signature)
 * Payload: { bal: number, free: number }
 *
 * Follows the exact same pattern as subscription-cookie.ts.
 */

const COOKIE_NAME = 'webtoon.credits';
const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

interface CreditPayload {
  bal: number;  // Credit balance
  free: number; // Free downloads remaining
}

/**
 * Create HMAC key from secret
 */
async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    ALGORITHM,
    false,
    ['sign', 'verify']
  );
}

/**
 * Base64 encode (URL-safe)
 */
function b64Encode(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64 decode (URL-safe)
 */
function b64Decode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

/**
 * Create a signed credit cookie value
 */
export async function createCreditCookie(
  balance: number,
  freeDownloads: number,
  secret: string,
): Promise<string> {
  const payload: CreditPayload = { bal: balance, free: freeDownloads };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = b64Encode(payloadStr);

  const key = await getKey(secret);
  const signature = await crypto.subtle.sign(
    ALGORITHM,
    key,
    new TextEncoder().encode(payloadStr)
  );

  return `${payloadB64}.${b64Encode(signature)}`;
}

/**
 * Verify and parse a credit cookie
 */
export async function verifyCreditCookie(
  cookieValue: string,
  secret: string,
): Promise<CreditPayload | null> {
  try {
    const [payloadB64, sigB64] = cookieValue.split('.');
    if (!payloadB64 || !sigB64) return null;

    const payloadBytes = b64Decode(payloadB64);
    const payloadStr = new TextDecoder().decode(payloadBytes);
    const signature = b64Decode(sigB64);

    const key = await getKey(secret);
    const valid = await crypto.subtle.verify(
      ALGORITHM,
      key,
      signature,
      payloadBytes
    );

    if (!valid) return null;

    return JSON.parse(payloadStr) as CreditPayload;
  } catch {
    return null;
  }
}

/**
 * Create Set-Cookie header for credits
 */
export async function createCreditSetCookie(
  balance: number,
  freeDownloads: number,
  secret: string,
  isSecure: boolean,
): Promise<string> {
  const value = await createCreditCookie(balance, freeDownloads, secret);

  // Cookie lasts 7 days (re-set on every auth event)
  const maxAge = 60 * 60 * 24 * 7;

  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    // NOT HttpOnly — client needs to read it
  ];

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Create Set-Cookie header to clear credit cookie
 */
export function clearCreditCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export { COOKIE_NAME };
