/**
 * Better Auth Client Configuration
 *
 * Provides authentication state and methods for React components.
 * Use useOptimizedSession() hook for session state (avoids API calls for guests).
 */

import { createAuthClient } from 'better-auth/react';
import { cloudflareClient } from 'better-auth-cloudflare/client';

/**
 * Auth client instance with Cloudflare plugin
 *
 * Usage:
 * - useOptimizedSession() - Get current session state (preferred, skips API for guests)
 * - authClient.signIn.email() - Sign in with email/password
 * - authClient.signUp.email() - Create account
 * - authClient.signOut() - Sign out current user
 */
export const authClient = createAuthClient({
  // Use current origin for both dev and production
  // The Worker serves both frontend and API from the same origin,
  // so window.location.origin always points to the correct base URL
  baseURL: window.location.origin,
  plugins: [
    cloudflareClient(),
  ],
});
