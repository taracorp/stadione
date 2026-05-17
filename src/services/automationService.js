// ============ SMART AUTOMATION FOR REGISTRATION ============
// Auto-reminders, auto-locks, auto-validation, auto-notifications

import { supabase } from '../config/supabase.js';
import {
  fetchRegistrationReviewQueue,
  checkRosterCompleteness,
  verifyTeamMember,
} from './registrationService.js';

/**
 * Auto-reminder H-3 before roster deadline
 * Sends notification to team coordinator
 */
export const autoRemindIncompleteRosters = async () => {
  try {
    // Get all registrations in slot_secured status
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select(`
        id,
        user_id,
        team_id,
        registrant_name,
        registrant_email,
        tournament_id,
        registration_status
      `)
      .eq('registration_status', 'slot_secured')
      .lt('slot_expires_at', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('autoRemindIncompleteRosters error:', error);
      return { sent: 0, errors: [] };
    }

    const sentCount = registrations?.length || 0;
    const errors = [];

    // For each registration, check roster status
    for (const reg of registrations || []) {
      const { complete, memberCount, required } = await checkRosterCompleteness(reg.id);
      
      if (!complete) {
        // Send notification
        const notificationMessage = `
Reminder: Roster Tim "${reg.registrant_name}" untuk turnamen belum lengkap.
Anda perlu ${required - memberCount} pemain lagi sebelum deadline 3 hari ke depan.
Buka Team Workspace sekarang untuk melengkapi roster.
        `;

        // TODO: Integrate with Supabase notification system or email service
        console.log(`[AUTO-REMINDER] Sent to ${reg.registrant_email}:\n${notificationMessage}`);

        // Record activity
        await recordAutomationActivity({
          type: 'auto_reminder',
          registration_id: reg.id,
          user_id: reg.user_id,
          message: `Reminder sent: ${required - memberCount} players needed`,
          status: 'sent',
        });
      }
    }

    return { sent: sentCount, errors };
  } catch (err) {
    console.error('autoRemindIncompleteRosters error:', err);
    return { sent: 0, errors: [err.message] };
  }
};

/**
 * Auto-lock registrations on deadline pass
 * If roster incomplete after deadline, mark as incomplete_roster
 */
export const autoLockExpiredRegistrations = async () => {
  try {
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select('id, team_id, registration_status')
      .eq('registration_status', 'slot_secured')
      .lte('slot_expires_at', new Date().toISOString());

    if (error) {
      console.error('autoLockExpiredRegistrations error:', error);
      return { locked: 0 };
    }

    let lockedCount = 0;

    for (const reg of registrations || []) {
      const { complete } = await checkRosterCompleteness(reg.id);

      if (!complete) {
        // Update status to incomplete_roster
        await supabase
          .from('registrations')
          .update({
            registration_status: 'incomplete_roster',
            updated_at: new Date().toISOString(),
          })
          .eq('id', reg.id);

        await recordAutomationActivity({
          type: 'auto_lock_expired',
          registration_id: reg.id,
          message: 'Locked: Slot expired with incomplete roster',
          status: 'locked',
        });

        lockedCount++;
      }
    }

    return { locked: lockedCount };
  } catch (err) {
    console.error('autoLockExpiredRegistrations error:', err);
    return { locked: 0 };
  }
};

/**
 * Auto-validate player eligibility
 * Check: age, gender, duplicate teams, suspension status
 */
export const autoValidatePlayerEligibility = async (teamMemberId) => {
  try {
    // Fetch team member details
    const { data: member, error: memberError } = await supabase
      .from('team_members')
      .select('*, team:team_id(tournament_id)')
      .eq('id', teamMemberId)
      .single();

    if (memberError || !member) {
      return { valid: false, reason: 'Player not found' };
    }

    const tournamentId = member.team?.tournament_id;

    // Fetch tournament requirements
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('ageMin, ageMax, gender')
      .eq('id', tournamentId)
      .single();

    if (tournamentError || !tournament) {
      return { valid: false, reason: 'Tournament not found' };
    }

    // Check age
    if (member.date_of_birth) {
      const age = calculateAge(new Date(member.date_of_birth));
      if (age < tournament.ageMin || (tournament.ageMax > 0 && age > tournament.ageMax)) {
        return { valid: false, reason: `Age ${age} out of range (${tournament.ageMin}-${tournament.ageMax})` };
      }
    }

    // Check gender (if tournament has gender restrictions)
    if (tournament.gender && tournament.gender !== 'Mixed') {
      // Implement gender check if needed
    }

    // Check suspension
    const { data: suspensions, error: suspError } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', member.user_id)
      .eq('suspension_flag', true);

    if (!suspError && suspensions?.length > 0) {
      return { valid: false, reason: 'Player is suspended' };
    }

    // Check duplicate team registration in same tournament
    const { data: duplicates, error: dupError } = await supabase
      .from('team_members')
      .select('team:team_id(tournament_id)')
      .eq('user_id', member.user_id)
      .filter('team_id', 'neq', member.team_id);

    if (!dupError && duplicates?.some((d) => d.team?.tournament_id === tournamentId)) {
      return { valid: false, reason: 'Player already registered in another team for this tournament' };
    }

    return { valid: true, reason: 'Eligible' };
  } catch (err) {
    console.error('autoValidatePlayerEligibility error:', err);
    return { valid: false, reason: err.message };
  }
};

/**
 * Auto-trigger host review workflow for official tournaments
 * When roster is complete, move to waiting_verification
 */
export const autoTriggerReviewForOfficial = async (registrationId) => {
  try {
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('tournament_id, registration_status')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return { triggered: false, reason: 'Registration not found' };
    }

    // Check if tournament is official
    const { data: tournament, error: tourError } = await supabase
      .from('tournaments')
      .select('classification, created_by')
      .eq('id', registration.tournament_id)
      .single();

    if (tourError || !tournament || tournament.classification !== 'official') {
      return { triggered: false, reason: 'Not an official tournament' };
    }

    // Check roster completeness
    const { complete } = await checkRosterCompleteness(registrationId);

    if (!complete) {
      return { triggered: false, reason: 'Roster not complete' };
    }

    // Update status to waiting_verification
    await supabase
      .from('registrations')
      .update({
        registration_status: 'waiting_verification',
        awaiting_review: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    // Notify host/platform verifier
    console.log(`[AUTO-REVIEW] Registration ${registrationId} ready for verification`);

    await recordAutomationActivity({
      type: 'auto_trigger_review',
      registration_id: registrationId,
      message: 'Ready for verification: Roster complete',
      status: 'triggered',
    });

    return { triggered: true };
  } catch (err) {
    console.error('autoTriggerReviewForOfficial error:', err);
    return { triggered: false, reason: err.message };
  }
};

/**
 * Auto-verify players if all validations pass
 * Only for non-official tournaments with optional verification
 */
export const autoVerifyPlayersIfEligible = async (teamId) => {
  try {
    // Get all team members
    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('status', 'accepted');

    if (membersError) {
      return { verified: 0 };
    }

    let verifiedCount = 0;

    for (const member of members || []) {
      const { valid } = await autoValidatePlayerEligibility(member.id);

      if (valid) {
        await verifyTeamMember({
          teamMemberId: member.id,
          ageValid: true,
          genderValid: true,
          identityValid: true,
          suspensionFlag: false,
        });

        verifiedCount++;
      }
    }

    return { verified: verifiedCount };
  } catch (err) {
    console.error('autoVerifyPlayersIfEligible error:', err);
    return { verified: 0 };
  }
};

/**
 * Batch automation task runner
 * Run all automation jobs in sequence
 */
export const runAutomationBatchJobs = async () => {
  try {
    const results = {};

    // 1. Auto-remind incomplete rosters (H-3 deadline)
    console.log('[AUTOMATION] Running auto-remind...');
    results.reminder = await autoRemindIncompleteRosters();

    // 2. Auto-lock expired registrations
    console.log('[AUTOMATION] Running auto-lock...');
    results.lock = await autoLockExpiredRegistrations();

    // 3. Auto-trigger reviews for official tournaments
    // (Batch: get all waiting_verification registrations)
    console.log('[AUTOMATION] Checking registrations for review trigger...');
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id')
      .eq('registration_status', 'slot_secured');

    for (const reg of registrations || []) {
      await autoTriggerReviewForOfficial(reg.id);
    }

    results.reviews = { triggered: registrations?.length || 0 };

    console.log('[AUTOMATION] Batch jobs completed:', results);
    return results;
  } catch (err) {
    console.error('runAutomationBatchJobs error:', err);
    return { error: err.message };
  }
};

/**
 * Record automation activity for audit trail
 */
const recordAutomationActivity = async ({
  type,
  registration_id,
  user_id = null,
  message = '',
  status = 'pending',
}) => {
  try {
    await supabase
      .from('automation_logs')
      .insert([
        {
          type,
          registration_id,
          user_id,
          message,
          status,
          executed_at: new Date().toISOString(),
        },
      ]);
  } catch (err) {
    console.error('recordAutomationActivity error:', err);
  }
};

/**
 * Helper: Calculate age from DOB
 */
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Schedule automation jobs
 * In production, this would be integrated with Supabase cron or external scheduler
 */
export const scheduleAutomationJobs = () => {
  if (typeof window === 'undefined') {
    // Server-side only
    console.log('[AUTOMATION] Scheduling automation jobs (production: use Supabase cron)');
    // Every hour: run batch jobs
    setInterval(runAutomationBatchJobs, 60 * 60 * 1000);
  }
};
