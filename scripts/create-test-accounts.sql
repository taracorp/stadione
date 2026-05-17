-- ============================================================
-- TEST ACCOUNTS — SEMUA ROLE STADIONE
-- ⚠️  HANYA UNTUK ENVIRONMENT DEV / STAGING, JANGAN DI PRODUCTION
-- Password semua akun: 1234abcd
-- Jalankan di Supabase SQL Editor (dengan service role / postgres user)
-- ============================================================

DO $$
DECLARE
  v_pass       text;
  v_uid        uuid;
  v_email      text;
  v_name       text;
  v_role       text;
  accounts     jsonb;
  acc          jsonb;
BEGIN
  -- Hash password '1234abcd' dengan bcrypt
  v_pass := crypt('1234abcd', gen_salt('bf'));

  accounts := '[
    {"email":"super_admin@stadione.id",          "name":"Super Admin",            "role":"super_admin"},
    {"email":"internal_admin@stadione.id",        "name":"Internal Admin",         "role":"internal_admin"},
    {"email":"news_reporter_admin@stadione.id",   "name":"News Reporter Admin",    "role":"news_reporter_admin"},
    {"email":"tournament_host_admin@stadione.id", "name":"Tournament Host Admin",  "role":"tournament_host_admin"},
    {"email":"registration_admin@stadione.id",    "name":"Registration Admin",     "role":"registration_admin"},
    {"email":"verification_admin@stadione.id",    "name":"Verification Admin",     "role":"verification_admin"},
    {"email":"finance_admin@stadione.id",         "name":"Finance Admin",          "role":"finance_admin"},
    {"email":"verified_operator@stadione.id",     "name":"Verified Operator",      "role":"verified_operator"},
    {"email":"federation_operator@stadione.id",   "name":"Federation Operator",    "role":"federation_operator"},
    {"email":"eo_operator@stadione.id",           "name":"EO Operator",            "role":"eo_operator"},
    {"email":"community_host@stadione.id",        "name":"Community Host",         "role":"community_host"},
    {"email":"match_official@stadione.id",        "name":"Match Official",         "role":"match_official"},
    {"email":"referee@stadione.id",               "name":"Referee",                "role":"referee"},
    {"email":"match_commissioner@stadione.id",    "name":"Match Commissioner",     "role":"match_commissioner"},
    {"email":"statistic_operator@stadione.id",    "name":"Statistic Operator",     "role":"statistic_operator"},
    {"email":"venue_officer@stadione.id",         "name":"Venue Officer",          "role":"venue_officer"},
    {"email":"team_official@stadione.id",         "name":"Team Official",          "role":"team_official"},
    {"email":"coach@stadione.id",                 "name":"Coach",                  "role":"coach"},
    {"email":"manager@stadione.id",               "name":"Manager",                "role":"manager"},
    {"email":"player@stadione.id",                "name":"Player",                 "role":"player"},
    {"email":"general_user@stadione.id",          "name":"General User",           "role":"general_user"}
  ]';

  FOR acc IN SELECT * FROM jsonb_array_elements(accounts) LOOP
    v_email := acc->>'email';
    v_name  := acc->>'name';
    v_role  := acc->>'role';

    -- Skip jika email sudah ada
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      RAISE NOTICE 'SKIP (sudah ada): %', v_email;
      CONTINUE;
    END IF;

    v_uid := gen_random_uuid();

    -- Buat user di auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      v_pass,
      now(),                                      -- email sudah terverifikasi
      jsonb_build_object('name', v_name),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      false,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Buat profil di public.profiles (jika tabel ada)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
      INSERT INTO public.profiles (id, email, name, created_at)
      VALUES (v_uid, v_email, v_name, now())
      ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Assign role di user_roles
    INSERT INTO public.user_roles (user_id, role, granted_at)
    VALUES (v_uid, v_role, now())
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'CREATED: % → role: %', v_email, v_role;
  END LOOP;
END $$;


-- ============================================================
-- VERIFIKASI — cek akun yang baru dibuat
-- ============================================================
SELECT
  au.email,
  au.email_confirmed_at IS NOT NULL AS confirmed,
  ur.role,
  au.created_at
FROM auth.users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE au.email LIKE '%@stadione.id'
ORDER BY ur.role;
