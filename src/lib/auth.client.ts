/**
 * Better Auth Client Configuration
 *
 * Provides authentication state and methods for React components.
 * Use authClient.useSession() to access authentication state.
 */

import { createAuthClient } from 'better-auth/react';
import { cloudflareClient } from 'better-auth-cloudflare/client';

/**
 * Auth client instance with Cloudflare plugin
 *
 * Usage:
 * - authClient.useSession() - Get current session state
 * - authClient.signIn.email() - Sign in with email/password
 * - authClient.signUp.email() - Create account
 * - authClient.signOut() - Sign out current user
 */
export const authClient = createAuthClient({
  // Use current origin for production (Worker serves both API and frontend)
  // In development, use localhost:5174 to match dev server
  baseURL: import.meta.env.DEV
    ? 'http://localhost:5174'
    : window.location.origin,
  plugins: [
    cloudflareClient(),
  ],
});
