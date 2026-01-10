/**
 * Better Auth Server Configuration
 *
 * This configures Better Auth with Cloudflare D1 and KV storage.
 * Used in Cloudflare Workers API endpoints.
 */

import { betterAuth } from 'better-auth';
import { d1Adapter } from 'better-auth-cloudflare';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

interface AuthEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

/**
 * Create Better Auth instance with Cloudflare bindings
 */
export function createAuth(env: AuthEnv) {
  return betterAuth({
    // Database adapter for user data
    database: d1Adapter(env.DB, {
      // Use custom table names matching our schema
      userTable: 'users',
      sessionTable: 'sessions',
      accountTable: 'accounts',
      verificationTable: 'verifications',
    }),

    // Session configuration with KV storage
    session: {
      // Use KV for fast session lookups
      storeSessionInDatabase: false,
      cookieName: 'webtoon_session',
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session once per day
    },

    // Social providers (optional - configure as needed)
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID || '',
        clientSecret: env.GITHUB_CLIENT_SECRET || '',
        enabled: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      },
    },

    // Email/password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    // Email verification (configure SMTP in production)
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24, // 24 hours
      sendVerificationEmail: async ({ user, url, token }) => {
        // TODO: Implement email sending with your SMTP provider
        console.log(`Verification email for ${user.email}: ${url}`);
      },
    },

    // Security settings
    advanced: {
      generateId: () => crypto.randomUUID(),
      crossSubDomainCookies: false,
      useSecureCookies: env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
    },

    // Base URL for auth endpoints
    baseURL: env.BETTER_AUTH_URL,

    // Secret for signing tokens
    secret: env.BETTER_AUTH_SECRET,
  });
}

/**
 * Session management with KV cache
 */
export class SessionManager {
  constructor(
    private kv: KVNamespace,
    private auth: ReturnType<typeof createAuth>
  ) {}

  /**
   * Get session from KV cache or validate with Better Auth
   */
  async getSession(sessionToken: string) {
    // Try KV cache first (fast!)
    const cachedSession = await this.kv.get(`session:${sessionToken}`, 'json');
    if (cachedSession) {
      return cachedSession;
    }

    // Cache miss - validate with Better Auth
    const session = await this.auth.api.getSession({ headers: { cookie: sessionToken } });

    if (session) {
      // Cache for next request (7 days)
      await this.kv.put(`session:${sessionToken}`, JSON.stringify(session), {
        expirationTtl: 60 * 60 * 24 * 7,
      });
    }

    return session;
  }

  /**
   * Invalidate session cache
   */
  async invalidateSession(sessionToken: string) {
    await this.kv.delete(`session:${sessionToken}`);
  }

  /**
   * Store session in KV cache
   */
  async setSession(sessionToken: string, session: any) {
    await this.kv.put(`session:${sessionToken}`, JSON.stringify(session), {
      expirationTtl: 60 * 60 * 24 * 7,
    });
  }
}

/**
 * Middleware to protect routes
 */
export async function requireAuth(
  request: Request,
  env: AuthEnv
): Promise<{ user: any; session: any } | Response> {
  const auth = createAuth(env);
  const sessionManager = new SessionManager(env.SESSIONS, auth);

  // Extract session token from cookie
  const cookie = request.headers.get('cookie') || '';
  const sessionToken = cookie
    .split(';')
    .find((c) => c.trim().startsWith('webtoon_session='))
    ?.split('=')[1];

  if (!sessionToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const session = await sessionManager.getSession(sessionToken);

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  return { user: session.user, session };
}

/**
 * Check if user has active subscription
 */
export async function requireSubscription(
  userId: string,
  env: AuthEnv
): Promise<boolean> {
  const subscription = await env.DB.prepare(
    `SELECT status FROM subscriptions
     WHERE user_id = ? AND status IN ('active', 'trial')
     AND (current_period_end IS NULL OR current_period_end > unixepoch())
     LIMIT 1`
  )
    .bind(userId)
    .first();

  return !!subscription;
}
