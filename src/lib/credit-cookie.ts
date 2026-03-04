/**
 * Client-side Credit Cookie Reader
 *
 * Reads the signed credit cookie set by the server.
 * The cookie is tamper-proof (signed), but we only read it here.
 * No verification needed on client — server validates on API calls.
 */

import { parseSignedCookiePayload } from './cookie-utils';

const COOKIE_NAME = 'webtoon.credits';

export interface CreditPayload {
  bal: number;  // Credit balance
  free: number; // Free downloads remaining
}

/**
 * Parse the credit cookie payload
 */
export function parseCreditCookie(): CreditPayload | null {
  return parseSignedCookiePayload<CreditPayload>(COOKIE_NAME);
}
