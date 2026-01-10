/**
 * Better Auth Client Configuration
 *
 * This provides React hooks and utilities for authentication in the frontend.
 */

import { createAuthClient } from 'better-auth/react';

/**
 * Auth client instance
 * Use this to access authentication state and methods in React components
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || 'http://localhost:5174',
});

/**
 * Type-safe user object
 */
export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Type-safe session object
 */
export interface Session {
  user: User;
  expires: Date;
}

/**
 * Auth hooks for React components
 * Import from 'better-auth/react' in your components:
 *
 * import { useSession, signIn, signOut, signUp } from 'better-auth/react'
 *
 * Available hooks:
 * - useSession() - Get current session state
 * - signIn({ email, password }) - Sign in with email/password
 * - signUp({ email, password, name }) - Create account
 * - signOut() - Sign out current user
 * - useOAuth() - OAuth provider sign-in
 */

/**
 * Helper to check if user is authenticated
 */
export function useAuth() {
  const session = authClient.useSession();

  return {
    user: session.data?.user,
    session: session.data,
    isLoading: session.isPending,
    isAuthenticated: !!session.data?.user,
  };
}

/**
 * Helper to check if user has active subscription
 */
export async function checkSubscription(): Promise<boolean> {
  try {
    const response = await fetch('/api/subscription/check', {
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json() as { hasSubscription: boolean };
      return data.hasSubscription;
    }

    return false;
  } catch (error) {
    console.error('Failed to check subscription:', error);
    return false;
  }
}

/**
 * Helper to get subscription status
 */
export async function getSubscriptionStatus() {
  try {
    const response = await fetch('/api/subscription/status', {
      credentials: 'include',
    });

    if (response.ok) {
      return await response.json();
    }

    return null;
  } catch (error) {
    console.error('Failed to get subscription status:', error);
    return null;
  }
}
