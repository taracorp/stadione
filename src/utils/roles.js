const ROLE_ALIAS_MAP = Object.freeze({
  platform_admin: 'internal_admin',
  moderator: 'admin',
  reporter: 'news_reporter_admin',
  tournament_host: 'tournament_host_admin',
  coach_academy: 'coach',
  assistant_referee: 'match_official',
  timekeeper: 'match_official',
  venue_partner: 'eo_operator',
  member: 'general_user',
  fans: 'general_user',
  supporter: 'general_user',
  host: 'verified_operator',
});

const ROLE_BADGE_LABEL = Object.freeze({
  super_admin: 'Admin',
  internal_admin: 'Platform Admin',
  admin: 'Moderator',
  reviewer: 'Moderator',
  news_reporter_admin: 'Reporter',
  verification_admin: 'Verification Admin',
  tournament_host_admin: 'Tournament Host',
  registration_admin: 'Registration Admin',
  finance_admin: 'Finance Admin',
  verified_operator: 'Verified Host',
  federation_operator: 'Federation Operator',
  eo_operator: 'Venue Partner',
  community_host: 'Community Leader',
  coach: 'Coach',
  referee: 'Licensed Referee',
  match_commissioner: 'Match Commissioner',
  match_official: 'Match Official',
  statistic_operator: 'Statistic Operator',
  venue_officer: 'Venue Officer',
  team_official: 'Team Official',
  manager: 'Manager',
  player: 'Player',
  general_user: 'Member',
});

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
