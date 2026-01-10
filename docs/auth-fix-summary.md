# Better Auth API Fix Summary

## Problem

Frontend crashed with TypeScript error:
```
TS2305: Module '"better-auth/react"' has no exported member 'signIn'.
```

## Root Cause

The Better Auth React API doesn't export `signIn` and `signUp` directly. Instead, these are methods on the client instance returned by `createAuthClient()`.

## Solution

### 1. Fixed Import in `AuthDrawer.tsx`

**Before (Incorrect):**
```typescript
import { signIn, signUp } from 'better-auth/react';

// Usage
await signIn.email({ email, password });
await signUp.email({ email, password, name });
```

**After (Correct):**
```typescript
import { authClient } from '@/lib/auth.client';

// Usage
await authClient.signIn.email({ email, password });
await authClient.signUp.email({ email, password, name });
```

### 2. Updated Environment Variables

Added `VITE_BETTER_AUTH_URL` to `.env` and `.dev.vars`:

```bash
# Vite exposes variables prefixed with VITE_ to the client
VITE_BETTER_AUTH_URL=http://localhost:5174
```

**Why?** Vite only exposes environment variables prefixed with `VITE_` to the client-side code. Server-side variables (without the prefix) are not accessible in the browser.

### 3. Updated Error Handling

**Before:**
```typescript
const result = await signIn.email(
  { email, password },
  {
    onError: (ctx) => {
      setError(ctx.error.message);
    },
    onSuccess: () => {
      handleClose();
    }
  }
);
```

**After:**
```typescript
const result = await authClient.signIn.email({
  email,
  password,
});

if (result.error) {
  setError(result.error.message);
} else {
  handleClose();
  onSuccess?.();
}
```

## Files Modified

1. ✅ `src/components/AuthDrawer.tsx` - Fixed API usage
2. ✅ `.env` - Added `VITE_BETTER_AUTH_URL`
3. ✅ `.dev.vars` - Added `VITE_BETTER_AUTH_URL`
4. ✅ `.env.example` - Updated template

## Correct Better Auth React API

### Client Creation
```typescript
// lib/auth.client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_BETTER_AUTH_URL || 'http://localhost:5174',
});
```

### Available Methods

```typescript
// Sign In
await authClient.signIn.email({ email, password });

// Sign Up
await authClient.signUp.email({ email, password, name });

// Sign Out
await authClient.signOut();

// Get Session
const session = authClient.useSession();

// Check if authenticated
const { isAuthenticated, user } = useAuth(); // Custom hook
```

## Testing

After the fix:

```bash
# TypeScript compilation should pass
npx tsc --noEmit

# Start dev server (restart if running)
npm run dev

# Test authentication flow
# Visit: http://localhost:5174/serials/YOUR_SERIAL_ID
# Click locked episode → Auth drawer should work
```

## Key Takeaways

1. ✅ Better Auth uses a **client instance** pattern, not direct exports
2. ✅ Always use `authClient.signIn.email()` not `signIn.email()`
3. ✅ Client-side env vars must be prefixed with `VITE_`
4. ✅ The `useSession()` hook is available on the client instance
5. ✅ Error handling is done by checking `result.error`

## References

- Better Auth React Docs: https://www.better-auth.com/docs/react
- Vite Environment Variables: https://vitejs.dev/guide/env-and-mode.html

---

**Status**: ✅ Fixed - Ready for testing!
