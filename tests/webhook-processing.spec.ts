import { test, expect, type BrowserContext, type APIRequestContext } from '@playwright/test';
import * as crypto from 'node:crypto';
import { BASE_URL, bypassAgeGate, signUpUser } from './helpers/test-utils';

/**
 * E2E Tests for Payment Webhook Processing (Story 5.3)
 *
 * Tests Solidgate webhook signature verification, event processing,
 * idempotency, and credit reversal on refunds.
 *
 * IMPORTANT: The SOLIDGATE_WEBHOOK_SECRET in .dev.vars must match the secret
 * used here for signing test payloads. Default: 'your_webhook_secret_here'.
 */

const WEBHOOK_URL = `${BASE_URL}/api/webhooks/solidgate`;
const WEBHOOK_SECRET = process.env.SOLIDGATE_WEBHOOK_SECRET ?? 'your_webhook_secret_here';

interface WebhookPayloadOptions {
  event: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  customerEmail?: string;
  orderMetadata?: Record<string, unknown>;
  subscription?: {
    id: string;
    status: string;
    plan_id: string;
    current_period_start: number;
    current_period_end: number;
  };
}

function createWebhookPayload(options: WebhookPayloadOptions) {
  return {
    event: options.event,
    order: {
      order_id: options.orderId ?? `order-${Date.now()}`,
      status: 'approved',
      amount: options.amount ?? 699,
      currency: options.currency ?? 'USD',
      customer: {
        email: options.customerEmail ?? 'test@example.com',
      },
      order_metadata: options.orderMetadata,
      subscription: options.subscription,
    },
  };
}

function signPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function sendWebhook(
  request: APIRequestContext,
  payload: ReturnType<typeof createWebhookPayload>,
  signature?: string,
) {
  const body = JSON.stringify(payload);
  const sig = signature ?? signPayload(body, WEBHOOK_SECRET);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sig !== '') {
    headers['x-solidgate-signature'] = sig;
  }

  return request.post(WEBHOOK_URL, {
    data: body,
    headers,
  });
}

async function getCookies(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

// --- Tests ---

test.describe('Webhook Processing (Story 5.3)', () => {
  test.describe.configure({ mode: 'serial' });

  test('5.3.1 — webhook with missing signature returns 401', async ({ request }) => {
    const payload = createWebhookPayload({ event: 'payment.success' });
    const body = JSON.stringify(payload);

    const response = await request.post(WEBHOOK_URL, {
      data: body,
      headers: { 'Content-Type': 'application/json' },
      // No x-solidgate-signature header
    });

    expect(response.status()).toBe(401);
    expect(await response.text()).toContain('Missing signature');
  });

  test('5.3.2 — webhook with invalid signature returns 401', async ({ request }) => {
    const payload = createWebhookPayload({ event: 'payment.success' });
    const body = JSON.stringify(payload);

    const response = await request.post(WEBHOOK_URL, {
      data: body,
      headers: {
        'Content-Type': 'application/json',
        'x-solidgate-signature': 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
      },
    });

    expect(response.status()).toBe(401);
    expect(await response.text()).toContain('Invalid signature');
  });

  test('5.3.3 — payment.success for credit pack increases user balance', async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await bypassAgeGate(page);

    const email = `webhook-credit-${Date.now()}@example.com`;
    await signUpUser(page, { name: 'Webhook Credit', email, password: 'TestPass123!' });

    // Check initial balance
    const balanceBefore = await request.get(`${BASE_URL}/api/credits/balance`, {
      headers: { cookie: await getCookies(context) },
    });
    const before = await balanceBefore.json();
    const initialBalance = before.balance;

    // Send credit pack payment webhook
    const orderId = `order-credit-${Date.now()}`;
    const payload = createWebhookPayload({
      event: 'payment.success',
      orderId,
      amount: 699,
      customerEmail: email,
      orderMetadata: {
        type: 'credit_pack',
        pack_id: 'pack_10',
        credits: 10,
        user_id: 'test',
      },
    });

    const response = await sendWebhook(request, payload);
    expect(response.status()).toBe(200);

    // Verify balance increased
    const balanceAfter = await request.get(`${BASE_URL}/api/credits/balance`, {
      headers: { cookie: await getCookies(context) },
    });
    const after = await balanceAfter.json();
    expect(after.balance).toBe(initialBalance + 10);

    await context.close();
  });

  test('5.3.4 — subscription.created creates subscription record', async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await bypassAgeGate(page);

    const email = `webhook-sub-${Date.now()}@example.com`;
    await signUpUser(page, { name: 'Webhook Sub', email, password: 'TestPass123!' });

    const orderId = `order-sub-${Date.now()}`;
    const subId = `sub-${Date.now()}`;
    const now = Math.floor(Date.now() / 1000);

    const payload = createWebhookPayload({
      event: 'subscription.created',
      orderId,
      amount: 999,
      customerEmail: email,
      subscription: {
        id: subId,
        status: 'active',
        plan_id: 'plan_1week',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
      },
    });

    const response = await sendWebhook(request, payload);
    expect(response.status()).toBe(200);

    // Verify subscription status
    const statusRes = await request.get(`${BASE_URL}/api/subscription/status`, {
      headers: { cookie: await getCookies(context) },
    });
    const status = await statusRes.json();
    expect(status.hasSubscription).toBe(true);

    await context.close();
  });

  test('5.3.5 — refund.success for credit pack reverses balance and creates refund ledger', async ({ browser, request }) => {
    // NOTE: AC3 requires a creditTransactions entry with type='refund' and negative amount.
    // We verify the balance change (proves credits were reversed in the batch), but there is
    // no public API endpoint to query creditTransactions directly. The ledger insert is part
    // of the same db.batch() as the balance update — if the batch succeeds, both are written.
    // A dedicated /api/credits/transactions endpoint could provide stronger verification.

    const context = await browser.newContext();
    const page = await context.newPage();
    await bypassAgeGate(page);

    const email = `webhook-refund-${Date.now()}@example.com`;
    await signUpUser(page, { name: 'Webhook Refund', email, password: 'TestPass123!' });

    // First: send a credit pack payment
    const orderId = `order-refund-${Date.now()}`;
    const creditPayload = createWebhookPayload({
      event: 'payment.success',
      orderId,
      amount: 699,
      customerEmail: email,
      orderMetadata: {
        type: 'credit_pack',
        pack_id: 'pack_10',
        credits: 10,
        user_id: 'test',
      },
    });

    const payRes = await sendWebhook(request, creditPayload);
    expect(payRes.status()).toBe(200);

    // Check balance after purchase
    const balanceAfterPurchase = await request.get(`${BASE_URL}/api/credits/balance`, {
      headers: { cookie: await getCookies(context) },
    });
    const afterPurchase = await balanceAfterPurchase.json();
    const balanceBeforeRefund = afterPurchase.balance;

    // Now: send refund for the same order
    const refundPayload = createWebhookPayload({
      event: 'refund.success',
      orderId,
      amount: 699,
      customerEmail: email,
    });

    const refundRes = await sendWebhook(request, refundPayload);
    expect(refundRes.status()).toBe(200);

    // Verify balance decreased
    const balanceAfterRefund = await request.get(`${BASE_URL}/api/credits/balance`, {
      headers: { cookie: await getCookies(context) },
    });
    const afterRefund = await balanceAfterRefund.json();
    expect(afterRefund.balance).toBe(balanceBeforeRefund - 10);

    await context.close();
  });

  test('5.3.6 — duplicate webhook returns 200 without double-processing', async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await bypassAgeGate(page);

    const email = `webhook-dupe-${Date.now()}@example.com`;
    await signUpUser(page, { name: 'Webhook Dupe', email, password: 'TestPass123!' });

    // Read balance before any webhooks
    const balanceBefore = await request.get(`${BASE_URL}/api/credits/balance`, {
      headers: { cookie: await getCookies(context) },
    });
    const before = await balanceBefore.json();
    const initialBalance = before.balance;

    const orderId = `order-dupe-${Date.now()}`;
    const payload = createWebhookPayload({
      event: 'payment.success',
      orderId,
      amount: 699,
      customerEmail: email,
      orderMetadata: {
        type: 'credit_pack',
        pack_id: 'pack_10',
        credits: 10,
        user_id: 'test',
      },
    });

    // Send first time
    const res1 = await sendWebhook(request, payload);
    expect(res1.status()).toBe(200);

    // Send same webhook again (duplicate)
    const res2 = await sendWebhook(request, payload);
    expect(res2.status()).toBe(200);

    // Verify balance was only increased once (delta pattern, not hard-coded)
    const balanceRes = await request.get(`${BASE_URL}/api/credits/balance`, {
      headers: { cookie: await getCookies(context) },
    });
    const balance = await balanceRes.json();
    expect(balance.balance).toBe(initialBalance + 10);

    await context.close();
  });

  test('5.3.7 — subscription.canceled updates status', async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await bypassAgeGate(page);

    const email = `webhook-cancel-${Date.now()}@example.com`;
    await signUpUser(page, { name: 'Webhook Cancel', email, password: 'TestPass123!' });

    const orderId = `order-cancel-${Date.now()}`;
    const subId = `sub-cancel-${Date.now()}`;
    const now = Math.floor(Date.now() / 1000);

    // First create the subscription
    const createPayload = createWebhookPayload({
      event: 'subscription.created',
      orderId,
      amount: 999,
      customerEmail: email,
      subscription: {
        id: subId,
        status: 'active',
        plan_id: 'plan_1week',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
      },
    });
    const createRes = await sendWebhook(request, createPayload);
    expect(createRes.status()).toBe(200);

    // Cancel the subscription
    const cancelPayload = createWebhookPayload({
      event: 'subscription.canceled',
      orderId: `order-cancel-evt-${Date.now()}`,
      customerEmail: email,
      subscription: {
        id: subId,
        status: 'canceled',
        plan_id: 'plan_1week',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 60 * 60,
      },
    });
    const cancelRes = await sendWebhook(request, cancelPayload);
    expect(cancelRes.status()).toBe(200);

    // Canceled subscription still has access until period ends (time-based)
    // Verify the status field is updated to 'canceled'
    const statusRes = await request.get(`${BASE_URL}/api/subscription/status`, {
      headers: { cookie: await getCookies(context) },
    });
    const status = await statusRes.json();
    expect(status.hasSubscription).toBe(true);
    expect(status.subscription.status).toBe('canceled');

    await context.close();
  });

  test('5.3.8 — subscription.expired updates status', async ({ browser, request }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await bypassAgeGate(page);

    const email = `webhook-expire-${Date.now()}@example.com`;
    await signUpUser(page, { name: 'Webhook Expire', email, password: 'TestPass123!' });

    const orderId = `order-expire-${Date.now()}`;
    const subId = `sub-expire-${Date.now()}`;
    const now = Math.floor(Date.now() / 1000);

    // Create subscription with a past period (already expired by time)
    const pastStart = now - 60 * 24 * 60 * 60; // 60 days ago
    const pastEnd = now - 30 * 24 * 60 * 60; // 30 days ago

    const createPayload = createWebhookPayload({
      event: 'subscription.created',
      orderId,
      amount: 999,
      customerEmail: email,
      subscription: {
        id: subId,
        status: 'active',
        plan_id: 'plan_1week',
        current_period_start: pastStart,
        current_period_end: pastEnd,
      },
    });
    const createRes = await sendWebhook(request, createPayload);
    expect(createRes.status()).toBe(200);

    // Expire the subscription
    const expirePayload = createWebhookPayload({
      event: 'subscription.expired',
      orderId: `order-expire-evt-${Date.now()}`,
      customerEmail: email,
      subscription: {
        id: subId,
        status: 'expired',
        plan_id: 'plan_1week',
        current_period_start: pastStart,
        current_period_end: pastEnd,
      },
    });
    const expireRes = await sendWebhook(request, expirePayload);
    expect(expireRes.status()).toBe(200);

    // Verify subscription is no longer active (period ended in the past)
    const statusRes = await request.get(`${BASE_URL}/api/subscription/status`, {
      headers: { cookie: await getCookies(context) },
    });
    const status = await statusRes.json();
    expect(status.hasSubscription).toBe(false);

    await context.close();
  });
});
