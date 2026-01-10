# Testing Authentication Flow

Quick guide to test the email-only login/signup feature.

## What Was Implemented

✅ **AuthDrawer Component**
- Bottom sheet popup with email-only authentication
- Three states: Initial → Login/Signup
- "Continue with Email" button
- Auto-login after signup
- Error handling with user-friendly messages

✅ **Integration with Serial Page**
- Clicking locked episodes opens auth drawer
- Same slide-up animation as episodes drawer
- Closes episodes drawer when auth drawer opens
- Refreshes page after successful authentication

✅ **EpisodeSidebar Updates**
- Locked episodes are now clickable
- Triggers auth drawer on click
- Visual indication with lock icon

## How to Test Locally

### 1. Start Dev Server

```bash
npm run dev
```

Visit: http://localhost:5174

### 2. Navigate to Serial Page

Go to a serial page with locked episodes (e.g., `/serials/YOUR_SERIAL_ID`)

### 3. Test Authentication Flow

#### Create Account (Signup):

1. **Click a locked episode** (one with lock icon)
2. Auth drawer slides up from bottom
3. Click **"Continue with Email"**
4. Signup form appears
5. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123" (min 8 chars)
6. Click **"Create Account"**
7. ✅ Auto-logs in and refreshes page

#### Sign In (Login):

1. Click a locked episode
2. Click "Continue with Email"
3. Form shows login by default if you have account
4. Fill in email and password
5. Click "Sign In"
6. ✅ Logs in and refreshes page

#### Switch Between Login/Signup:

- On login form: Click "Don't have an account? Sign up"
- On signup form: Click "Already have an account? Sign in"

### 4. Verify in Database

Check that user was created:

```bash
# Check users table
npx wrangler d1 execute webtoon-db --local --command "SELECT id, email, name, created_at FROM users;"

# Check sessions table
npx wrangler d1 execute webtoon-db --local --command "SELECT user_id, expires_at FROM sessions;"
```

### 5. Test Error Handling

#### Invalid Credentials:

1. Try to login with wrong password
2. Should show error: "Invalid email or password"

#### Duplicate Email:

1. Try to signup with existing email
2. Should show error: "Failed to create account"

#### Short Password:

1. Try to signup with password < 8 chars
2. Should show error: "Password must be at least 8 characters"

## Testing on Mobile

### Using Browser DevTools:

1. Open Chrome DevTools (F12)
2. Click device toolbar icon (Ctrl/Cmd + Shift + M)
3. Select a mobile device (e.g., iPhone 13)
4. Test the flow

### Using Real Device:

1. Get your local IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
2. Update `.env`: `BETTER_AUTH_URL=http://YOUR_IP:5174`
3. Restart dev server
4. Visit from mobile: `http://YOUR_IP:5174`

## Expected Behavior

### Animations:

- ✅ Auth drawer slides up smoothly (same as episodes drawer)
- ✅ Episodes drawer closes when auth opens
- ✅ Forms transition smoothly between login/signup

### User Experience:

- ✅ Locked episodes have lock icon overlay
- ✅ Clicking locked episode opens auth
- ✅ "Continue with Email" is prominent
- ✅ Loading states show spinner
- ✅ Errors display clearly with icon
- ✅ Success auto-closes drawer and refreshes

### Security:

- ✅ Passwords hidden (type="password")
- ✅ Passwords min 8 characters
- ✅ Email validation (type="email")
- ✅ Session created on successful auth

## Troubleshooting

### "signIn is not a function" error

Make sure Better Auth client is set up:

```bash
# Check if better-auth is installed
npm list better-auth

# If not, install it
npm install better-auth
```

### Auth drawer not opening

1. Check console for errors
2. Verify `isAuthDrawerOpen` state is updating
3. Make sure `onLockedClick` is passed to EpisodeSidebar

### Form submission does nothing

1. Check network tab for API calls
2. Verify `/api/auth/*` endpoints exist
3. Check Better Auth server configuration in `lib/auth.server.ts`

### "No such table: users" error

Run migrations:

```bash
npm run db:migrate:local
```

### Session not persisting

Check cookies in browser DevTools:
- Should have `webtoon_session` cookie
- Cookie should be httpOnly
- Check expiration date

## Next Steps After Testing

Once authentication is working:

1. ✅ Test subscription check for locked episodes
2. ✅ Implement "My Account" page
3. ✅ Add subscription plans page
4. ✅ Integrate Solidgate payment
5. ✅ Add email verification (optional)
6. ✅ Add OAuth providers (optional)

## Demo Flow Walkthrough

Here's the complete user journey:

```
1. User visits serial page
   ↓
2. Scrolls through episodes list
   ↓
3. Sees episode 3 is locked (lock icon visible)
   ↓
4. Clicks on locked episode 3
   ↓
5. Episodes drawer closes (if open on mobile)
   ↓
6. Auth drawer slides up from bottom
   ↓
7. Sees "Unlock Premium Content" title
   ↓
8. Clicks "Continue with Email"
   ↓
9. Login form appears
   ↓
10. Clicks "Don't have an account? Sign up"
    ↓
11. Signup form appears
    ↓
12. Fills in: name, email, password
    ↓
13. Clicks "Create Account"
    ↓
14. Loading spinner shows
    ↓
15. Account created + auto-login
    ↓
16. Drawer closes
    ↓
17. Page refreshes
    ↓
18. User is now logged in
    ↓
19. (Future) Can watch locked episodes
```

## Screenshots Location

Take screenshots of:
1. Locked episode in list (with lock icon)
2. Auth drawer initial state ("Continue with Email")
3. Login form
4. Signup form
5. Error states
6. Success state (before page refresh)

Save to: `docs/screenshots/auth-flow/`

---

**Status**: ✅ Authentication UI complete and ready for testing!

**Next**: Test locally, then add subscription checks.
