/**
 * Solidgate Payment Link Integration
 *
 * Creates hosted payment page URLs via Solidgate API.
 * Uses HMAC-SHA256 request signing per Solidgate docs.
 */

import type { Bindings } from './types';

const SOLIDGATE_API_URL = 'https://payment-page.solidgate.com/api/v1/link/init';

interface CreatePaymentLinkParams {
  orderId: string;
  amount: number; // cents
  currency: string;
  customerEmail: string;
  orderDescription: string;
  orderMetadata: Record<string, string | number>;
  successUrl: string;
  failUrl: string;
}

async function signRequest(body: string, secretKey: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body),
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function createPaymentLink(
  env: Bindings,
  params: CreatePaymentLinkParams,
): Promise<string> {
  const body = {
    order: {
      order_id: params.orderId,
      amount: params.amount,
      currency: params.currency,
      order_description: params.orderDescription,
      order_metadata: params.orderMetadata,
    },
    customer: {
      email: params.customerEmail,
    },
    payment_page_options: {
      success_url: params.successUrl,
      fail_url: params.failUrl,
    },
  };

  const bodyStr = JSON.stringify(body);
  const signature = await signRequest(bodyStr, env.SOLIDGATE_SECRET_KEY);

  const response = await fetch(SOLIDGATE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      merchant: env.SOLIDGATE_MERCHANT_ID,
      signature,
    },
    body: bodyStr,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Solidgate API error:', response.status, errorText);
    throw new Error(`Solidgate payment link creation failed: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const url = data.url;
  if (typeof url !== 'string' || !url) {
    console.error('Solidgate unexpected response:', JSON.stringify(data));
    throw new Error('Solidgate returned invalid payment link response');
  }
  return url;
}
