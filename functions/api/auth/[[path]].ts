/**
 * Better Auth API Handler for Cloudflare Pages Functions
 *
 * This handles all authentication routes:
 * - POST /api/auth/sign-up
 * - POST /api/auth/sign-in
 * - POST /api/auth/sign-out
 * - GET  /api/auth/session
 * - POST /api/auth/verify-email
 * - POST /api/auth/forgot-password
 * - POST /api/auth/reset-password
 * - OAuth routes (if configured)
 */

import { createAuth } from '../../../lib/auth.server';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/**
 * Handle all Better Auth API routes
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    // Create Better Auth instance
    const auth = createAuth(env);

    // Handle the request with Better Auth
    const response = await auth.handler(request);

    return response;
  } catch (error) {
    console.error('Auth handler error:', error);

    return new Response(
      JSON.stringify({
        error: 'Authentication error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
