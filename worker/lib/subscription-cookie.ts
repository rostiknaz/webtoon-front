/**
 * Signed Subscription Cookie
 *
 * Creates tamper-proof cookies containing subscription expiration.
 * Client can READ but cannot FORGE valid cookies.
 *
 * Format: base64(payload).base64(signature)
 * Payload: { exp: unixTimestamp, pid: planId }
 */

const COOKIE_NAME = 'webtoon.sub';
const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

interface SubscriptionPayload {
  exp: number; // Unix timestamp when subscription expires (0 = no subscription)
  pid: string | null; // Plan ID
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
 * Create a signed subscription cookie value
 *
 * @param expiresAt - Unix timestamp when subscription expires (0 for no subscription)
 * @param planId - Plan ID or null
 * @param secret - Server secret for signing
 * @returns Signed cookie value
 */
export async function createSubscriptionCookie(
  expiresAt: number,
  planId: string | null,
  secret: string
): Promise<string> {
  const payload: SubscriptionPayload = { exp: expiresAt, pid: planId };
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
 * Verify and parse a subscription cookie
 *
 * @param cookieValue - The cookie value to verify
 * @param secret - Server secret for verification
 * @returns Parsed payload if valid, null if invalid/tampered
 */
export async function verifySubscriptionCookie(
  cookieValue: string,
  secret: string
): Promise<SubscriptionPayload | null> {
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

    return JSON.parse(payloadStr) as SubscriptionPayload;
  } catch {
    return null;
  }
}

/**
 * Create Set-Cookie header for subscription
 *
 * @param expiresAt - Unix timestamp when subscription expires
 * @param planId - Plan ID or null
 * @param secret - Server secret for signing
 * @param isSecure - Whether to use Secure flag (HTTPS)
 * @returns Set-Cookie header value
 */
export async function createSubscriptionSetCookie(
  expiresAt: number,
  planId: string | null,
  secret: string,
  isSecure: boolean
): Promise<string> {
  const value = await createSubscriptionCookie(expiresAt, planId, secret);

  // Cookie expires when subscription expires, or in 1 year if no subscription
  const maxAge = expiresAt > 0
    ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
    : 60 * 60 * 24 * 365;

  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    // NOT HttpOnly - client needs to read it
  ];

  if (isSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Create Set-Cookie header to clear subscription cookie
 */
export function clearSubscriptionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Cookie name export for consistency
 */
export { COOKIE_NAME };
