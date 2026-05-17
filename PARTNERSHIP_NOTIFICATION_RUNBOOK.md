# Partnership Notification Runbook

Status: implemented in code, documentation, and deploy guides.

Quick path: for a shorter operational flow, use `PARTNERSHIP_NOTIFICATION_ONEPAGE.md`.

## Goal

When a new partnership application is submitted, Stadione should:

1. Save the application to `partnership_applications`.
2. Create an in-app admin notification in `admin_notifications`.
3. Send an email notification to the super admin or configured recipient.
4. Keep submission success independent from email delivery failures.

## Implemented Pieces

- Frontend submit flow: `src/components/PartnershipPage.jsx`
- In-app admin notification UI: `src/components/admin/workspace/SponsorManagerPage.jsx`
- In-app notification SQL: `supabase-admin-notifications.sql`
- Email edge function: `supabase/functions/send-partnership-notification/index.ts`
- Supabase setup guide: `SUPABASE_SETUP.md`
- Vercel env guide: `VERCEL_SETUP.md`
- Secrets setup: `DOKU_SECRETS_SETUP.md`
- Partnership deploy guides: `PARTNERSHIP_*`

## Required Setup

### 1. Database

Run these SQL files in Supabase SQL Editor:

1. `scripts/add-partnership-applications.sql`
2. `supabase-admin-notifications.sql`

### 2. Supabase Secrets

Set these secrets for the edge function:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### 3. Vercel Environment Variables

Set these on the Vercel project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PARTNERSHIP_NOTIFICATION_EMAIL` (optional, overrides default recipient)

## Runtime Flow

1. User submits partnership form.
2. Frontend inserts into `partnership_applications`.
3. Frontend invokes `send-partnership-notification`.
4. Edge function sends email via Resend.
5. Separately, DB trigger creates `admin_notifications` row for in-app tracking.
6. Sponsor manager shows unread count in real time.

## Verification Checklist

### In the UI

- Submit a partnership form successfully.
- Confirm the success modal appears.
- Open admin sponsor workspace and confirm unread badge count.
- Click the badge action and confirm unread count returns to zero.

### In Supabase

- Confirm new row in `partnership_applications`.
- Confirm new row in `admin_notifications`.
- Confirm `trg_create_notification_on_partnership` exists.

### In Deployment

- Build passes with `npm run build`.
- Vercel has the env vars listed above.
- Supabase has the secrets listed above.

## Failure Behavior

- If email delivery fails, the application still saves and the UI still shows success.
- If in-app notification insert fails, the application insert remains the source of truth and the admin can still review the request manually.

## Notes

- Default email recipient is the super admin fallback used by the frontend.
- Deno syntax check could not be validated in this environment because `deno` is not installed.
- The notification recipient can be changed without code changes by updating `VITE_PARTNERSHIP_NOTIFICATION_EMAIL`.
