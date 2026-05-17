-- SUPABASE AUTH IDENTITY AUDIT
-- Tujuan:
-- 1) Pastikan tidak ada duplicate user berdasarkan email di auth.users
-- 2) Cek apakah satu user sudah punya identity email + google
-- 3) Verifikasi detail email tertentu saat investigasi login

-- 1) Global duplicate email audit (case-insensitive)
select
  lower(email) as email_normalized,
  count(*) as user_count,
  array_agg(id order by created_at) as user_ids
from auth.users
where email is not null
group by lower(email)
having count(*) > 1
order by user_count desc, email_normalized;

-- 2) Per-email identity audit
-- Ganti value email sesuai kebutuhan investigasi.
select
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  u.is_sso_user,
  u.email_confirmed_at,
  u.raw_user_meta_data,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'provider', i.provider,
        'identity_id', i.id,
        'created_at', i.created_at
      )
      order by i.created_at
    ) filter (where i.id is not null),
    '[]'::jsonb
  ) as identities
from auth.users u
left join auth.identities i on i.user_id = u.id
where lower(u.email) = lower('taradfworkspace@gmail.com')
group by
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  u.is_sso_user,
  u.email_confirmed_at,
  u.raw_user_meta_data
order by u.created_at;

-- 3) Ringkasan provider per user untuk quick check
select
  u.id as user_id,
  u.email,
  string_agg(distinct i.provider, ', ' order by i.provider) as linked_providers,
  count(distinct i.id) as identity_count
from auth.users u
left join auth.identities i on i.user_id = u.id
where u.email is not null
group by u.id, u.email
order by u.email;
