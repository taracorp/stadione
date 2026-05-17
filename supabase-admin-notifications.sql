-- ============================================================
-- ADMIN NOTIFICATIONS TABLE
-- Untuk tracking partnership applications dan notifikasi admin
-- Run di Supabase SQL Editor
-- ============================================================

-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partnership_id uuid NOT NULL REFERENCES public.partnership_applications(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'partnership_submitted' CHECK (type IN ('partnership_submitted', 'partnership_reviewed', 'partnership_approved')),
  title text NOT NULL,
  description text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes untuk performance
CREATE INDEX IF NOT EXISTS idx_admin_notifications_admin_user ON public.admin_notifications(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_partnership ON public.admin_notifications(partnership_id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at DESC);

-- Row Level Security
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Policy 1: Only admin can see their own notifications
DROP POLICY IF EXISTS admin_notifications_own_select ON public.admin_notifications;
CREATE POLICY admin_notifications_own_select ON public.admin_notifications
  FOR SELECT USING (admin_user_id = auth.uid());

-- Policy 2: Super admin can see all notifications
DROP POLICY IF EXISTS admin_notifications_superadmin ON public.admin_notifications;
CREATE POLICY admin_notifications_superadmin ON public.admin_notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'internal_admin')
    )
  );

-- Policy 3: System can insert notifications (for triggers)
DROP POLICY IF EXISTS admin_notifications_system_insert ON public.admin_notifications;
CREATE POLICY admin_notifications_system_insert ON public.admin_notifications
  FOR INSERT WITH CHECK (true);

-- Policy 4: Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS admin_notifications_own_update ON public.admin_notifications;
CREATE POLICY admin_notifications_own_update ON public.admin_notifications
  FOR UPDATE USING (admin_user_id = auth.uid())
  WITH CHECK (admin_user_id = auth.uid());

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_admin_notifications_updated_at ON public.admin_notifications;
CREATE TRIGGER trg_admin_notifications_updated_at
  BEFORE UPDATE ON public.admin_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER: Create notification when partnership submitted
-- ============================================================

DROP TRIGGER IF EXISTS trg_create_notification_on_partnership ON public.partnership_applications;
DROP FUNCTION IF EXISTS public.create_partnership_notification();
CREATE OR REPLACE FUNCTION public.create_partnership_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_super_admin_id uuid;
BEGIN
  -- Find super admin user (usually taradfworkspace@gmail.com)
  SELECT id INTO v_super_admin_id
  FROM auth.users
  WHERE email = 'taradfworkspace@gmail.com'
  LIMIT 1;

  -- If super admin not found, try to find any super_admin role user
  IF v_super_admin_id IS NULL THEN
    SELECT user_id INTO v_super_admin_id
    FROM public.user_roles
    WHERE role = 'super_admin'
    LIMIT 1;
  END IF;

  -- If still no admin found, try internal_admin
  IF v_super_admin_id IS NULL THEN
    SELECT user_id INTO v_super_admin_id
    FROM public.user_roles
    WHERE role = 'internal_admin'
    LIMIT 1;
  END IF;

  -- If admin found, create notification
  IF v_super_admin_id IS NOT NULL THEN
    INSERT INTO public.admin_notifications (
      admin_user_id,
      partnership_id,
      type,
      title,
      description
    ) VALUES (
      v_super_admin_id,
      NEW.id,
      'partnership_submitted',
      'Partnership Baru: ' || COALESCE(NEW.applicant_name, 'Unknown'),
      'Ada ' || NEW.type || ' application dari ' || COALESCE(NEW.applicant_name, 'unknown') || 
      ' (' || COALESCE(NEW.applicant_email, '-') || '). ' ||
      'Cek detail di Workspace > Kelola Sponsor'
    );
  END IF;

  RETURN NEW;
END; $$;

-- Attach trigger to partnership_applications
DROP TRIGGER IF EXISTS trg_create_notification_on_partnership ON public.partnership_applications;
CREATE TRIGGER trg_create_notification_on_partnership
  AFTER INSERT ON public.partnership_applications
  FOR EACH ROW EXECUTE FUNCTION public.create_partnership_notification();

-- ============================================================
-- HELPER FUNCTION: Get unread notification count
-- ============================================================

DROP FUNCTION IF EXISTS public.get_unread_notification_count(admin_id uuid);
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(admin_id uuid)
RETURNS bigint LANGUAGE sql AS $$
  SELECT COUNT(*) FROM public.admin_notifications
  WHERE admin_user_id = admin_id AND is_read = false;
$$ SECURITY DEFINER;

-- ============================================================
-- HELPER FUNCTION: Mark notification as read
-- ============================================================

DROP FUNCTION IF EXISTS public.mark_notification_read(notification_id uuid);
CREATE OR REPLACE FUNCTION public.mark_notification_read(notification_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.admin_notifications
  SET is_read = true, read_at = now()
  WHERE id = notification_id;
END; $$;

-- ============================================================
-- Verification Query (Run to verify)
-- ============================================================

-- Check table exists
SELECT 
  'admin_notifications' as table_name,
  COUNT(*) as total_rows
FROM public.admin_notifications;

-- List policies
SELECT policyname FROM pg_policies WHERE tablename = 'admin_notifications';

-- List indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'admin_notifications';
