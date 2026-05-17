const ROLE_ALIAS_MAP = Object.freeze({
  internal_admin: 'platform_admin',
  admin: 'moderator',
  news_reporter_admin: 'reporter',
  registration_admin: 'verification_admin',
  tournament_host_admin: 'tournament_host',
  eo_operator: 'venue_partner',
  coach_academy: 'coach',
  general_user: 'member',
  fans: 'member',
  supporter: 'member',
  host: 'verified_operator',
});

const ROLE_BADGE_LABEL = Object.freeze({
  super_admin: 'Admin',
  platform_admin: 'Platform Admin',
  internal_admin: 'Platform Admin',
  moderator: 'Moderator',
  admin: 'Moderator',
  reviewer: 'Moderator',
  reporter: 'Reporter',
  news_reporter_admin: 'Reporter',
  support_admin: 'Support Admin',
  verification_admin: 'Verification Admin',
  tournament_host_admin: 'Tournament Host',
  tournament_host: 'Tournament Host',
  registration_admin: 'Registration Admin',
  finance_admin: 'Finance Admin',
  verified_operator: 'Verified Host',
  federation_operator: 'Federation Operator',
  venue_partner: 'Venue Partner',
  eo_operator: 'Venue Partner',
  community_host: 'Community Leader',
  academy_operator: 'Academy Operator',
  coach_operator: 'Coach Operator',
  sponsor_partner: 'Sponsor Partner',
  referee: 'Licensed Referee',
  assistant_referee: 'Assistant Referee',
  timekeeper: 'Timekeeper',
  lineup_operator: 'Lineup Operator',
  venue_owner: 'Venue Owner',
  venue_manager: 'Venue Manager',
  cashier: 'Cashier',
  venue_staff: 'Venue Staff',
  team_member: 'Team Member',
  coach: 'Coach',
  match_commissioner: 'Match Commissioner',
  match_official: 'Match Official',
  statistic_operator: 'Statistic Operator',
  venue_officer: 'Venue Officer',
  team_official: 'Team Official',
  manager: 'Manager',
  player: 'Player',
  general_user: 'Member',
  member: 'Member',
});

export function getRoleDisplayName(role) {
  const normalizedRole = normalizeRoles([role])[0];
  if (!normalizedRole) return '-';
  return ROLE_BADGE_LABEL[normalizedRole] || normalizedRole
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeRoles(roles = []) {
  if (!Array.isArray(roles)) return [];

  const mapped = roles
    .map((role) => String(role || '').trim().toLowerCase())
    .filter(Boolean)
    .map((role) => ROLE_ALIAS_MAP[role] || role);

  return Array.from(new Set(mapped));
}

export function getUserRoleBadges(roles = [], roleProfiles = [], maxBadges = 6) {
  const normalized = normalizeRoles(roles);
  const profileMap = Array.isArray(roleProfiles)
    ? roleProfiles.reduce((acc, profile) => {
      const normalizedRole = normalizeRoles([profile?.role])[0];
      if (!normalizedRole) return acc;
      acc[normalizedRole] = String(profile?.displayName || '').trim();
      return acc;
    }, {})
    : {};

  const labels = normalized
    .map((role) => profileMap[role] || ROLE_BADGE_LABEL[role])
    .filter(Boolean);

  return Array.from(new Set(labels)).slice(0, maxBadges);
}
