# Supabase Authentication Setup Guide

## Overview

Stadione now has full Supabase authentication integration! Users can:
- ✅ Register with email and password
- ✅ Login with email and password
- ✅ Session persistence (stays logged in across page refreshes)
- ✅ Secure logout

## How It Works

### Components Involved

1. **LoginModal** (`stadione.jsx` lines 1429+)
   - Handles both login and registration UI
   - Calls `supabase.auth.signUp()` for registration
   - Calls `supabase.auth.signInWithPassword()` for login
   - Displays loading state and error messages

2. **Session Restoration** (Stadione component, useEffect)
   - On app load, checks for existing Supabase session
   - Restores user if already logged in
   - Listens for auth state changes in real-time

3. **Logout Handler**
   - Calls `supabase.auth.signOut()`
   - Clears local auth state
   - Redirects to home

## Testing Authentication

### Local Testing

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Register a new account:**
   - Click "Daftar" in the header
   - Enter: name, email, password (min 6 chars)
   - Click "BUAT AKUN"
   - App automatically logs you in

3. **Login with existing account:**
   - Click "Masuk" in the header
   - Enter: email, password
   - Click "MASUK SEKARANG"

4. **Test session persistence:**
   - Login successfully
   - Refresh the page (Ctrl+R or Cmd+R)
   - You should still be logged in

5. **Test logout:**
   - Click your name in the header
   - Click "Keluar"
   - You should be logged out and redirected home

### Production Testing on Vercel

1. **Ensure env vars are set in Vercel:**
   - Go to: https://vercel.com/[your-team]/stadione/settings/environment-variables
   - Set `VITE_SUPABASE_URL` = Your Supabase project URL
   - Set `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
   - Redeploy the project

2. **Visit your Vercel deployment URL**
   - Test registration and login
   - Verify session persists across page refreshes

## Troubleshooting

### "Email dan password tidak boleh kosong"
- Make sure both fields are filled before clicking the button

### "Terjadi kesalahan. Silakan coba lagi."
- Check browser console (F12 → Console tab) for detailed error
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured
- Check Supabase dashboard for any service issues

### Users can't login after registering
- Supabase might require email verification
- Check Supabase dashboard: Authentication → Email Templates
- By default, email verification is OFF for development (no verification needed)

### "Session not found" or similar
- Clear browser cache/cookies and try again
- Check that Supabase credentials are correct

## Architecture Notes

### File Structure
```
stadione.jsx
├── LoginModal component (auth UI)
├── handleAuth() (stores user in state)
├── handleLogout() (signs out + clears state)
└── useEffect (restores session on mount)

src/config/supabase.js
└── supabase client initialization
```

### Data Flow: Registration
1. User fills form → click "BUAT AKUN"
2. LoginModal calls `supabase.auth.signUp(email, password)`
3. Supabase creates account & returns user object
4. LoginModal auto-logs in user with `signInWithPassword()`
5. User data passed to `onAuth()` callback
6. setAuth() updates app state
7. Modal closes, user sees logged-in header

### Data Flow: Login
1. User fills form → click "MASUK SEKARANG"
2. LoginModal calls `supabase.auth.signInWithPassword(email, password)`
3. Supabase validates and returns session
4. User data passed to `onAuth()` callback
5. setAuth() updates app state
6. Modal closes, user sees logged-in header

### Data Flow: Persistence
1. App mounts → Stadione useEffect runs
2. Calls `supabase.auth.getSession()`
3. If session exists → setAuth() updates state
4. Listener watches for future auth changes
5. If user logs out elsewhere → setAuth(null)

## Security Notes

- Passwords are **never** sent to your app backend (handled by Supabase)
- Session tokens are stored in browser secure storage by Supabase
- `VITE_SUPABASE_ANON_KEY` is safe to expose in client-side code (it's meant to be public)
- Email verification can be enabled in Supabase settings for production

## Next Steps

- Enable email verification: Supabase Dashboard → Authentication → Email Templates
- Add password reset: Create `/forgot-password` page with Supabase reset flow
- Add OAuth: Enable Google/Facebook login in Supabase settings
- Store user profile data: Create users table and sync on signup
