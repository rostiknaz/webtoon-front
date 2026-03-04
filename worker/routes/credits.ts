/**
 * Credits API Routes
 *
 * Handles credit balance checking. Returns current credit state
 * and refreshes the signed credit cookie for client-side display.
 */

import { Hono } from 'hono';
import { getOrInitializeCredits } from '../db/services/credits.service';
import { createCreditSetCookie } from '../lib/credit-cookie';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';

const creditsRoute = new Hono<AppEnvWithDB>();

/**
 * GET /api/credits/balance
 *
 * Returns user's current credit balance and refreshes the credit cookie.
 * This ensures admin-side balance changes propagate to the client.
 */
creditsRoute.get('/balance', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    throw Errors.unauthorized();
  }

  const userCredits = await getOrInitializeCredits(c.get('db'), userId);
  const balance = userCredits.balance;
  const freeDownloads = userCredits.freeDownloadsRemaining;

  // Always refresh the cookie so admin changes propagate
  const cookie = await createCreditSetCookie(
    balance,
    freeDownloads,
    c.env.BETTER_AUTH_SECRET,
    c.env.BETTER_AUTH_URL.startsWith('https'),
  );

  return c.json(
    { balance, freeDownloads },
    200,
    { 'Set-Cookie': cookie },
  );
});

export default creditsRoute;
