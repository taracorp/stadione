-- Assign super_admin role to taradfworkspace@gmail.com
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'taradfworkspace@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found in auth.users', 'taradfworkspace@gmail.com';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM app_roles
    WHERE role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Role super_admin not found in app_roles';
  END IF;

  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Also initialize user_stats if not exists
  INSERT INTO user_stats (user_id, points, coins, tier_level)
  VALUES (v_user_id, 0, 0, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- Verify
SELECT au.email, ur.role, ur.granted_at
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
WHERE au.email = 'taradfworkspace@gmail.com'
  AND ur.role = 'super_admin';
