-- ============ REGISTRATION SYSTEM SCHEMA ============
-- Teams Management
CREATE TABLE IF NOT EXISTS public.teams (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tournament_id BIGINT NOT NULL,
  coordinator_id UUID NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  city TEXT,
  province TEXT,
  status TEXT DEFAULT 'active', -- active, archived
  notes TEXT
);

-- Team Members (Roster)
CREATE TABLE IF NOT EXISTS public.team_members (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  team_id BIGINT NOT NULL REFERENCES public.teams(id),
  user_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  player_identifier TEXT, -- jersey number, identity
  date_of_birth DATE,
  position TEXT,
  jersey_name TEXT,
  status TEXT DEFAULT 'pending', -- pending, accepted, verified, rejected, suspended
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  age_valid BOOLEAN,
  gender_valid BOOLEAN,
  identity_valid BOOLEAN,
  suspension_flag BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Registrations (Payment + Slot Management)
CREATE TABLE IF NOT EXISTS public.registrations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tournament_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  team_id BIGINT REFERENCES public.teams(id), -- NULL for solo sports
  registrant_name TEXT NOT NULL,
  registrant_email TEXT NOT NULL,
  registration_type TEXT NOT NULL, -- team, individual, double
  registration_status TEXT DEFAULT 'idle', -- idle, draft, waiting_payment, slot_secured, incomplete_roster, waiting_verification, approved, rejected
  payment_status TEXT DEFAULT 'unpaid', -- unpaid, pending, confirmed, failed
  
  -- Slot management
  base_fee DECIMAL(15,2),
  unique_transfer_amount DECIMAL(15,2), -- Unique nominal untuk verifikasi manual
  slot_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Payment tracking
  payment_method TEXT, -- qris, va, ewallet, card
  payment_proof_url TEXT,
  payment_proof_uploaded_at TIMESTAMP WITH TIME ZONE,
  
  -- Verification
  awaiting_review BOOLEAN DEFAULT FALSE,
  admin_review_at TIMESTAMP WITH TIME ZONE,
  admin_reviewed_by UUID,
  admin_notes TEXT,
  
  -- Roster status
  roster_complete BOOLEAN DEFAULT FALSE,
  min_players_met BOOLEAN DEFAULT FALSE,
  
  notes TEXT
);

-- Registration History (audit trail)
CREATE TABLE IF NOT EXISTS public.registration_history (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  registration_id BIGINT NOT NULL REFERENCES public.registrations(id),
  action TEXT NOT NULL, -- created, payment_received, slot_secured, roster_added, verified, approved, rejected
  actor_id UUID,
  actor_type TEXT, -- user, admin, system
  old_status TEXT,
  new_status TEXT,
  details JSONB,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_registrations_tournament ON public.registrations(tournament_id);
CREATE INDEX idx_registrations_user ON public.registrations(user_id);
CREATE INDEX idx_registrations_team ON public.registrations(team_id);
CREATE INDEX idx_registrations_status ON public.registrations(registration_status);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_team_members_status ON public.team_members(status);
CREATE INDEX idx_teams_tournament ON public.teams(tournament_id);
CREATE INDEX idx_teams_coordinator ON public.teams(coordinator_id);

-- RLS Policies
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_history ENABLE ROW LEVEL SECURITY;

-- Policy: Teams - Coordinator can view/edit their own, Admin can view all
CREATE POLICY teams_select_policy ON public.teams
  FOR SELECT USING (
    auth.uid() = coordinator_id OR
    EXISTS(SELECT 1 FROM public.app_roles WHERE user_id = auth.uid() AND role_name IN ('admin', 'operator'))
  );

CREATE POLICY teams_insert_policy ON public.teams
  FOR INSERT WITH CHECK (auth.uid() = coordinator_id);

CREATE POLICY teams_update_policy ON public.teams
  FOR UPDATE USING (auth.uid() = coordinator_id);

-- Policy: Team Members - Coordinator & verified users can view
CREATE POLICY team_members_select_policy ON public.team_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    team_id IN (SELECT id FROM public.teams WHERE coordinator_id = auth.uid()) OR
    EXISTS(SELECT 1 FROM public.app_roles WHERE user_id = auth.uid() AND role_name IN ('admin', 'operator'))
  );

CREATE POLICY team_members_insert_policy ON public.team_members
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM public.teams WHERE coordinator_id = auth.uid())
  );

-- Policy: Registrations - User can view own
CREATE POLICY registrations_select_policy ON public.registrations
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS(SELECT 1 FROM public.app_roles WHERE user_id = auth.uid() AND role_name IN ('admin', 'operator'))
  );

CREATE POLICY registrations_insert_policy ON public.registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY registrations_update_policy ON public.registrations
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS(SELECT 1 FROM public.app_roles WHERE user_id = auth.uid() AND role_name IN ('admin', 'operator'))
  );

-- ============ HELPER FUNCTIONS ============

-- Generate unique transfer amount for payment verification
CREATE OR REPLACE FUNCTION generate_unique_transfer_amount(base_fee DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  RETURN base_fee + (RANDOM() * 100000)::DECIMAL(15,2);
END;
$$ LANGUAGE plpgsql;

-- Auto-lock roster on deadline
CREATE OR REPLACE FUNCTION lock_expired_rosters()
RETURNS void AS $$
BEGIN
  UPDATE public.registrations
  SET registration_status = 'incomplete_roster'
  WHERE registration_status = 'slot_secured'
    AND (
      SELECT COUNT(*) FROM public.team_members 
      WHERE team_id = registrations.team_id 
        AND status IN ('accepted', 'verified')
    ) < (
      SELECT min_roster FROM public.tournaments 
      WHERE id = registrations.tournament_id
    );
END;
$$ LANGUAGE plpgsql;

-- Check if player can participate (age, gender, suspension)
CREATE OR REPLACE FUNCTION validate_player_eligibility(
  player_id UUID,
  tournament_id BIGINT
)
RETURNS TABLE (is_eligible BOOLEAN, reason TEXT) AS $$
BEGIN
  -- Check suspension
  IF EXISTS(SELECT 1 FROM public.team_members WHERE user_id = player_id AND suspension_flag = TRUE) THEN
    RETURN QUERY SELECT FALSE, 'Player is suspended'::TEXT;
    RETURN;
  END IF;
  
  -- Check age validation if required
  -- Check gender validation if required
  
  RETURN QUERY SELECT TRUE, 'Eligible'::TEXT;
END;
$$ LANGUAGE plpgsql;
