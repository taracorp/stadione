-- Sprint 2 foundation: active workspace context per user + switch audit log.
-- Idempotent and safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS user_active_workspace_context (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  context_scope text NOT NULL CHECK (context_scope IN ('platform', 'workspace', 'official', 'team', 'general')),
  context_role text,
  context_entity_type text,
  context_entity_id text,
  context_label text,
  metadata jsonb DEFAULT '{}'::jsonb,
  switched_at timestamptz DEFAULT now(),
  switched_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_context_switch_logs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_scope text,
  previous_role text,
  previous_entity_type text,
  previous_entity_id text,
  new_scope text NOT NULL,
  new_role text,
  new_entity_type text,
  new_entity_id text,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  switched_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_context_switch_logs_user_id_created_at
  ON user_context_switch_logs (user_id, created_at DESC);

ALTER TABLE user_active_workspace_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context_switch_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own active workspace context" ON user_active_workspace_context;
CREATE POLICY "Users can view own active workspace context"
  ON user_active_workspace_context FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own active workspace context" ON user_active_workspace_context;
CREATE POLICY "Users can upsert own active workspace context"
  ON user_active_workspace_context FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read active workspace context" ON user_active_workspace_context;
CREATE POLICY "Admins can read active workspace context"
  ON user_active_workspace_context FOR SELECT
  USING (public.has_app_role('super_admin') OR public.has_permission('users.role.manage'));

DROP POLICY IF EXISTS "Users can read own context switch logs" ON user_context_switch_logs;
CREATE POLICY "Users can read own context switch logs"
  ON user_context_switch_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own context switch logs" ON user_context_switch_logs;
CREATE POLICY "Users can insert own context switch logs"
  ON user_context_switch_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read context switch logs" ON user_context_switch_logs;
CREATE POLICY "Admins can read context switch logs"
  ON user_context_switch_logs FOR SELECT
  USING (public.has_app_role('super_admin') OR public.has_permission('audit.read'));

CREATE OR REPLACE FUNCTION public.set_active_workspace_context(
  p_scope text,
  p_role text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prev user_active_workspace_context%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth session missing';
  END IF;

  IF p_scope IS NULL OR p_scope NOT IN ('platform', 'workspace', 'official', 'team', 'general') THEN
    RAISE EXCEPTION 'invalid context scope';
  END IF;

  SELECT * INTO v_prev
  FROM user_active_workspace_context
  WHERE user_id = v_user_id;

  INSERT INTO user_active_workspace_context (
    user_id,
    context_scope,
    context_role,
    context_entity_type,
    context_entity_id,
    context_label,
    metadata,
    switched_at,
    switched_by,
    updated_at
  )
  VALUES (
    v_user_id,
    p_scope,
    p_role,
    p_entity_type,
    p_entity_id,
    p_label,
    COALESCE(p_metadata, '{}'::jsonb),
    now(),
    v_user_id,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    context_scope = EXCLUDED.context_scope,
    context_role = EXCLUDED.context_role,
    context_entity_type = EXCLUDED.context_entity_type,
    context_entity_id = EXCLUDED.context_entity_id,
    context_label = EXCLUDED.context_label,
    metadata = EXCLUDED.metadata,
    switched_at = EXCLUDED.switched_at,
    switched_by = EXCLUDED.switched_by,
    updated_at = now();

  INSERT INTO user_context_switch_logs (
    user_id,
    previous_scope,
    previous_role,
    previous_entity_type,
    previous_entity_id,
    new_scope,
    new_role,
    new_entity_type,
    new_entity_id,
    reason,
    metadata,
    switched_by,
    created_at
  )
  VALUES (
    v_user_id,
    v_prev.context_scope,
    v_prev.context_role,
    v_prev.context_entity_type,
    v_prev.context_entity_id,
    p_scope,
    p_role,
    p_entity_type,
    p_entity_id,
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb),
    v_user_id,
    now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_workspace_context(text, text, text, text, text, text, jsonb) TO authenticated;

COMMIT;
