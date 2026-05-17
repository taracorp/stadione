// ============ REGISTRATION SERVICES ============

import { supabase } from '../config/supabase.js';

const REGISTRATION_TABLE_CANDIDATES = ['registrations', 'tournament_registrations'];
const SPORT_PREFERENCES_NOTE_PREFIX = '[SPORT_PREFS]';

const normalizeSportPreferences = (input) => {
  if (!input || typeof input !== 'object') return null;

  const base = {
    mainSport: String(input.mainSport || '').trim(),
    mainPosition: String(input.mainPosition || '').trim(),
    secondPosition: String(input.secondPosition || '').trim(),
    esportsGame: String(input.esportsGame || '').trim(),
    additionalSports: Array.isArray(input.additionalSports)
      ? input.additionalSports
          .map((item) => ({
            sport: String(item?.sport || '').trim(),
            mainPosition: String(item?.mainPosition || '').trim(),
            secondPosition: String(item?.secondPosition || '').trim(),
            esportsGame: String(item?.esportsGame || '').trim(),
          }))
          .filter((item) => item.sport)
      : [],
  };

  if (!base.mainSport && base.additionalSports.length === 0) return null;
  return base;
};

const serializeSportPreferences = (preferences) => {
  if (!preferences) return null;
  return `${SPORT_PREFERENCES_NOTE_PREFIX}${JSON.stringify(preferences)}`;
};

const isMissingRegistrationTableError = (error, tableName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(`public.${tableName}`)
    && (message.includes('schema cache') || message.includes('could not find the table'));
};

const withRegistrationTableFallback = async (queryFactory) => {
  let lastError = null;

  for (const tableName of REGISTRATION_TABLE_CANDIDATES) {
    const result = await queryFactory(tableName);

    if (!result?.error) {
      return { ...result, tableName };
    }

    lastError = result.error;

    if (!isMissingRegistrationTableError(result.error, tableName)) {
      return { ...result, tableName };
    }
  }

  return { data: null, error: lastError, tableName: null };
};

/**
 * Create new registration record (Quick Reg Step 1)
 * Generate unique transfer amount & reserve slot for 15 minutes
 */
export const createTournamentRegistration = async ({
  tournamentId,
  userId,
  registrantName,
  registrantEmail,
  registrationType = 'team',
  baseFee = 0,
  slotLockMinutes = 15,
  requiresReview = false,
  profilePreferences = null,
}) => {
  try {
    // Generate unique transfer amount for payment verification
    const uniqueTransferAmount = baseFee + Math.floor(Math.random() * 99999);
    
    // Calculate slot expiry
    const slotExpiresAt = new Date();
    slotExpiresAt.setMinutes(slotExpiresAt.getMinutes() + slotLockMinutes);
    const normalizedPreferences = normalizeSportPreferences(profilePreferences);
    const sportPreferencesNote = serializeSportPreferences(normalizedPreferences);

    const payload = {
      tournament_id: tournamentId,
      user_id: userId,
      registrant_name: registrantName,
      registrant_email: registrantEmail,
      registration_type: registrationType,
      registration_status: 'draft',
      payment_status: 'unpaid',
      base_fee: baseFee,
      unique_transfer_amount: uniqueTransferAmount,
      slot_expires_at: slotExpiresAt.toISOString(),
      awaiting_review: requiresReview,
      notes: sportPreferencesNote,
    };

    const { data, error, tableName } = await withRegistrationTableFallback((targetTable) => {
      const insertPayload = targetTable === 'tournament_registrations'
        ? {
            tournament_id: tournamentId,
            user_id: userId,
            registrant_name: registrantName,
            registrant_email: registrantEmail,
            registration_type: registrationType,
            registration_status: 'draft',
            payment_status: 'unpaid',
            base_fee: baseFee,
            unique_transfer_amount: uniqueTransferAmount,
            slot_expires_at: slotExpiresAt.toISOString(),
            admin_notes: sportPreferencesNote,
          }
        : payload;

      return supabase
        .from(targetTable)
        .insert([insertPayload])
        .select()
        .single();
    });

    if (error) {
      return { error: error.message, data: null };
    }

    const normalizedData = data ? { ...data, __registrationTable: tableName || 'registrations' } : data;

    // Record history
    await recordRegistrationHistory(normalizedData.id, 'created', userId, 'user', 'draft', 'draft', {
      registrant_name: registrantName,
      registration_type: registrationType,
      profile_preferences: normalizedPreferences,
    });

    return { data: normalizedData, error: null };
  } catch (err) {
    return { error: err.message, data: null };
  }
};

/**
 * Confirm payment & move to 'slot_secured'
 */
export const confirmRegistrationPayment = async (
  registrationId,
  paymentMethod,
  paymentProofUrl = null
) => {
  try {
    const { data, error } = await withRegistrationTableFallback((targetTable) => supabase
      .from(targetTable)
      .update({
        registration_status: 'slot_secured',
        payment_status: 'confirmed',
        payment_method: paymentMethod,
        payment_proof_url: paymentProofUrl,
        payment_proof_uploaded_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single());

    if (error) {
      return { error: error.message, data: null };
    }

    // Record history
    await recordRegistrationHistory(
      registrationId,
      'payment_received',
      null,
      'system',
      'draft',
      'slot_secured',
      { payment_method: paymentMethod }
    );

    return { data, error: null };
  } catch (err) {
    return { error: err.message, data: null };
  }
};

/**
 * Fetch registration record for user + tournament
 */
export const fetchTournamentRegistration = async (tournamentId, userId) => {
  try {
    const result = await withRegistrationTableFallback((targetTable) => supabase
      .from(targetTable)
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single());

    if (result.error && result.error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error, just no registration)
      console.error('fetchTournamentRegistration error:', result.error);
      return null;
    }

    return result.data || null;
  } catch (err) {
    console.error('fetchTournamentRegistration error:', err);
    return null;
  }
};

export const attachTeamToRegistration = async (registrationId, teamId) => {
  try {
    const { data, error } = await withRegistrationTableFallback((targetTable) => supabase
      .from(targetTable)
      .update({
        team_id: teamId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single());

    if (error) {
      return { error: error.message, data: null };
    }

    return { data, error: null };
  } catch (err) {
    return { error: err.message, data: null };
  }
};

export const fetchRegistrationWorkspaceContext = async (tournamentId, userId) => {
  try {
    const registration = await fetchTournamentRegistration(tournamentId, userId);
    if (!registration) {
      return { registration: null, team: null };
    }

    let team = null;

    if (registration.team_id) {
      const { data } = await supabase
        .from('teams')
        .select('*')
        .eq('id', registration.team_id)
        .maybeSingle();

      team = data || null;
    }

    if (!team && String(registration.registration_type || '').toLowerCase() === 'team') {
      const { data } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('coordinator_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      team = data?.[0] || null;
    }

    return { registration, team };
  } catch (err) {
    console.error('fetchRegistrationWorkspaceContext error:', err);
    return { registration: null, team: null };
  }
};

/**
 * Create team for team-based tournaments
 */
export const createTeam = async ({
  tournamentId,
  coordinatorId,
  teamName,
  logoUrl = null,
  city = '',
  province = '',
}) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .insert([
        {
          tournament_id: tournamentId,
          coordinator_id: coordinatorId,
          name: teamName,
          logo_url: logoUrl,
          city,
          province,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (error) {
      return { error: error.message, data: null };
    }

    return { data, error: null };
  } catch (err) {
    return { error: err.message, data: null };
  }
};

/**
 * Add player to roster (team member)
 */
export const addTeamMember = async ({
  teamId,
  userId,
  playerName,
  playerIdentifier = '',
  dateOfBirth = null,
  position = '',
  jerseyName = '',
}) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .insert([
        {
          team_id: teamId,
          user_id: userId,
          player_name: playerName,
          player_identifier: playerIdentifier,
          date_of_birth: dateOfBirth,
          position,
          jersey_name: jerseyName,
          status: 'pending', // Pending confirmation from player
        },
      ])
      .select()
      .single();

    if (error) {
      return { error: error.message, data: null };
    }

    return { data, error: null };
  } catch (err) {
    return { error: err.message, data: null };
  }
};

/**
 * Fetch team roster
 */
export const fetchTeamRoster = async (teamId) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('fetchTeamRoster error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('fetchTeamRoster error:', err);
    return [];
  }
};

/**
 * Fetch roster for registration (batch)
 */
export const fetchRegistrationRosterBatch = async (registrationIds = []) => {
  if (!registrationIds.length) return {};

  try {
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('id, team_id')
      .in('id', registrationIds);

    if (regError) {
      console.error('fetchRegistrationRosterBatch error:', regError);
      return {};
    }

    const teamIds = registrations
      .map((r) => r.team_id)
      .filter(Boolean);

    if (!teamIds.length) return {};

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .in('team_id', teamIds);

    if (membersError) {
      console.error('fetchTeamMembers error:', membersError);
      return {};
    }

    // Map by registration id
    const rosterMap = {};
    registrations.forEach((reg) => {
      rosterMap[reg.id] = members.filter((m) => m.team_id === reg.team_id);
    });

    return rosterMap;
  } catch (err) {
    console.error('fetchRegistrationRosterBatch error:', err);
    return {};
  }
};

/**
 * Fetch specific registration roster
 */
export const fetchRegistrationRoster = async (registrationId) => {
  try {
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('team_id')
      .eq('id', registrationId)
      .single();

    if (regError || !registration?.team_id) {
      return [];
    }

    return await fetchTeamRoster(registration.team_id);
  } catch (err) {
    console.error('fetchRegistrationRoster error:', err);
    return [];
  }
};

/**
 * Accept player invitation (player confirms to join roster)
 */
export const acceptTeamMemberInvite = async (teamMemberId) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamMemberId)
      .select()
      .single();

    if (error) {
      return { error: error.message, data: null };
    }

    return { data, error: null };
  } catch (err) {
    return { error: err.message, data: null };
  }
};

/**
 * Verify player (age, gender, identity check)
 */
export const verifyTeamMember = async ({
  teamMemberId,
  ageValid = true,
  genderValid = true,
  identityValid = true,
  suspensionFlag = false,
}) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .update({
        status: suspensionFlag ? 'suspended' : 'verified',
        age_valid: ageValid,
        gender_valid: genderValid,
        identity_valid: identityValid,
        suspension_flag: suspensionFlag,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamMemberId)
      .select()
      .single();

    if (error) {
      return { error: error.message, data: null };
    }

    return { data, error: null };
  } catch (err) {
    return { error: err.message, data: null };
  }
};

/**
 * Check roster completeness & update registration status
 */
export const checkRosterCompleteness = async (registrationRef) => {
  try {
    const registrationId = typeof registrationRef === 'object' ? registrationRef?.registrationId : registrationRef;
    const explicitTeamId = typeof registrationRef === 'object' ? registrationRef?.teamId : null;
    const explicitTournamentId = typeof registrationRef === 'object' ? registrationRef?.tournamentId : null;

    if (explicitTeamId) {
      const { data: tournament, error: tourError } = await supabase
        .from('tournaments')
        .select('min_roster')
        .eq('id', explicitTournamentId)
        .single();

      if (tourError || !tournament) {
        return { error: 'Tournament not found', complete: false };
      }

      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', explicitTeamId)
        .in('status', ['accepted', 'verified']);

      if (membersError) {
        return { error: membersError.message, complete: false };
      }

      const memberCount = members?.length || 0;
      const isComplete = memberCount >= tournament.min_roster;

      return { complete: isComplete, memberCount, required: tournament.min_roster };
    }

    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('team_id, tournament_id')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return { error: 'Registration not found', complete: false };
    }

    // Get tournament min_roster requirement
    const { data: tournament, error: tourError } = await supabase
      .from('tournaments')
      .select('min_roster')
      .eq('id', registration.tournament_id)
      .single();

    if (tourError || !tournament) {
      return { error: 'Tournament not found', complete: false };
    }

    // Count verified members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', registration.team_id)
      .in('status', ['accepted', 'verified']);

    if (membersError) {
      return { error: membersError.message, complete: false };
    }

    const isComplete = members.length >= tournament.min_roster;

    // Update registration if complete
    if (isComplete) {
      await supabase
        .from('registrations')
        .update({
          registration_status: 'waiting_verification',
          roster_complete: true,
          min_players_met: true,
        })
        .eq('id', registrationId);
    }

    return { complete: isComplete, memberCount: members.length, required: tournament.min_roster };
  } catch (err) {
    return { error: err.message, complete: false };
  }
};

/**
 * Review registration (Admin)
 */
export const reviewTournamentRegistration = async ({
  registrationId,
  decision = 'approved', // approved, rejected
  reviewerId,
  adminNotes = '',
}) => {
  try {
    const newStatus = decision === 'approved' ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('registrations')
      .update({
        registration_status: newStatus,
        admin_review_at: new Date().toISOString(),
        admin_reviewed_by: reviewerId,
        admin_notes: adminNotes,
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) {
      return false;
    }

    // Record history
    await recordRegistrationHistory(
      registrationId,
      decision === 'approved' ? 'approved' : 'rejected',
      reviewerId,
      'admin',
      'waiting_verification',
      newStatus,
      { admin_notes: adminNotes }
    );

    return true;
  } catch (err) {
    console.error('reviewTournamentRegistration error:', err);
    return false;
  }
};

/**
 * Fetch registration review queue (Admin)
 */
export const fetchRegistrationReviewQueue = async () => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select(
        `
        id,
        tournament_id,
        user_id,
        team_id,
        registrant_name,
        registrant_email,
        registration_type,
        registration_status,
        payment_status,
        unique_transfer_amount,
        payment_proof_uploaded_at,
        payment_proof_url,
        created_at
      `
      )
      .eq('registration_status', 'waiting_verification')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('fetchRegistrationReviewQueue error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('fetchRegistrationReviewQueue error:', err);
    return [];
  }
};

/**
 * Record registration history (audit trail)
 */
const recordRegistrationHistory = async (
  registrationId,
  action,
  actorId,
  actorType,
  oldStatus,
  newStatus,
  details = {}
) => {
  try {
    await supabase
      .from('registration_history')
      .insert([
        {
          registration_id: registrationId,
          action,
          actor_id: actorId,
          actor_type: actorType,
          old_status: oldStatus,
          new_status: newStatus,
          details,
        },
      ]);
  } catch (err) {
    console.error('recordRegistrationHistory error:', err);
  }
};

/**
 * Auto-remind coordinator if roster incomplete (H-3 deadline)
 */
export const checkAndNotifyIncompleteRosters = async () => {
  try {
    // Fetch all slot_secured registrations
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select(`
        id,
        tournament_id,
        team_id,
        user_id,
        registrant_name,
        created_at
      `)
      .eq('registration_status', 'slot_secured')
      .lt('slot_expires_at', new Date().toISOString());

    if (error) {
      console.error('checkAndNotifyIncompleteRosters error:', error);
      return;
    }

    // For each, check if roster is complete
    for (const reg of registrations) {
      const { complete } = await checkRosterCompleteness(reg.id);
      if (!complete) {
        // TODO: Send notification to coordinator
        console.log(`[AUTO-REMINDER] Coordinator ${reg.registrant_name} has incomplete roster`);
      }
    }
  } catch (err) {
    console.error('checkAndNotifyIncompleteRosters error:', err);
  }
};

/**
 * Export registration data (for admin reporting)
 */
export const exportRegistrationData = async (tournamentId) => {
  try {
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select(`
        *,
        team:team_id(name, coordinator_id)
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('exportRegistrationData error:', error);
      return [];
    }

    return registrations || [];
  } catch (err) {
    console.error('exportRegistrationData error:', err);
    return [];
  }
};
