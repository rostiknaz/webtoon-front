/**
 * Credits API Routes
 *
 * Handles credit balance checking and credit pack purchases.
 * Returns current credit state and refreshes the signed credit cookie.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { getOrInitializeCredits } from '../db/services/credits.service';
import { createCreditSetCookie } from '../lib/credit-cookie';
import { getCreditPack } from '../lib/credit-packs';
import { createPaymentLink } from '../lib/solidgate';
import type { AppEnvWithDB } from '../db/types';
import { Errors } from '../lib/errors';
import { validationHook } from '../lib/schemas';

const purchaseBodySchema = z.object({
  packId: z.string().min(1),
  clipId: z.string().optional(),
});

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

/**
 * POST /api/credits/purchase
 *
 * Creates a Solidgate payment link for a credit pack purchase.
 * Does NOT modify credits — that happens in the webhook handler.
 */
creditsRoute.post(
  '/purchase',
  zValidator('json', purchaseBodySchema, validationHook),
  async (c) => {
    const userId = c.get('userId');
    if (!userId) {
      throw Errors.unauthorized();
    }

    const { packId, clipId } = c.req.valid('json');
    const pack = getCreditPack(packId);
    if (!pack) {
      throw Errors.validation('Invalid pack ID');
    }

    const session = c.get('session');
    const email = session?.user?.email;
    if (!email) {
      throw Errors.unauthorized();
    }

    const baseUrl = c.env.BETTER_AUTH_URL;
    const clipParam = clipId ? `&clipId=${encodeURIComponent(clipId)}` : '';
    const successUrl = `${baseUrl}/?purchase=success${clipParam}`;
    const failUrl = `${baseUrl}/?purchase=failed`;

    const paymentUrl = await createPaymentLink(c.env, {
      orderId: crypto.randomUUID(),
      amount: pack.price,
      currency: pack.currency,
      customerEmail: email,
      orderDescription: pack.label,
      orderMetadata: {
        type: 'credit_pack',
        pack_id: pack.id,
        credits: pack.credits,
        user_id: userId,
        clip_id: clipId ?? '',
      },
      successUrl,
      failUrl,
    });

    return c.json({ paymentUrl });
  },
);

export default creditsRoute;
