# DOKU Secrets Setup

Dokumen ini untuk set secret runtime Edge Function DOKU tanpa menyimpan secret di repo.

## Minimal Secrets

- DOKU_SECRET_KEY

## Partnership Email Notifications

Untuk edge function `send-partnership-notification`, set secret berikut di Supabase:

- RESEND_API_KEY
- RESEND_FROM_EMAIL

Contoh tambahan via Supabase CLI:

```bash
npx supabase secrets set \
  RESEND_API_KEY="YOUR_RESEND_API_KEY" \
  RESEND_FROM_EMAIL="Stadione <no-reply@yourdomain.com>" \
  --project-ref "$SUPABASE_PROJECT_REF"
```

## Rekomendasi Tambahan

- DOKU_API_KEY
- DOKU_CLIENT_ID
- DOKU_MERCHANT_ID
- DOKU_BUSINESS_ID
- DOKU_BRAND_ID

## Bash / Git Bash

```bash
export SUPABASE_PROJECT_REF="YOUR_PROJECT_REF"

npx supabase secrets set \
  DOKU_SECRET_KEY="YOUR_DOKU_SECRET_KEY" \
  DOKU_API_KEY="YOUR_DOKU_API_KEY" \
  DOKU_CLIENT_ID="YOUR_DOKU_CLIENT_ID" \
  DOKU_MERCHANT_ID="YOUR_DOKU_MERCHANT_ID" \
  DOKU_BUSINESS_ID="YOUR_DOKU_BUSINESS_ID" \
  DOKU_BRAND_ID="YOUR_DOKU_BRAND_ID" \
  --project-ref "$SUPABASE_PROJECT_REF"
```

## PowerShell

```powershell
$env:SUPABASE_PROJECT_REF = "YOUR_PROJECT_REF"

npx supabase secrets set `
  DOKU_SECRET_KEY="YOUR_DOKU_SECRET_KEY" `
  DOKU_API_KEY="YOUR_DOKU_API_KEY" `
  DOKU_CLIENT_ID="YOUR_DOKU_CLIENT_ID" `
  DOKU_MERCHANT_ID="YOUR_DOKU_MERCHANT_ID" `
  DOKU_BUSINESS_ID="YOUR_DOKU_BUSINESS_ID" `
  DOKU_BRAND_ID="YOUR_DOKU_BRAND_ID" `
  --project-ref "$env:SUPABASE_PROJECT_REF"
```

## Verify (Opsional)

```bash
npx supabase secrets list --project-ref "$SUPABASE_PROJECT_REF"
```

Catatan: output list secret hanya menampilkan nama key, bukan nilainya.
