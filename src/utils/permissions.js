import { normalizeRoles } from './roles.js';

export const APP_PERMISSIONS = Object.freeze({
  PLATFORM_ALL: 'platform.all',
  ANALYTICS_GLOBAL_READ: 'analytics.global.read',
  AUDIT_READ: 'audit.read',
  USERS_ROLE_MANAGE: 'users.role.manage',
  USERS_MODERATE: 'users.moderate',
  NEWS_CREATE: 'news.create',
  NEWS_EDIT: 'news.edit',
  NEWS_FEATURE: 'news.feature',
  NEWS_PUBLISH: 'news.publish',
  TOURNAMENT_CREATE: 'tournament.create',
  TOURNAMENT_EDIT: 'tournament.edit',
  TOURNAMENT_SCHEDULE_MANAGE: 'tournament.schedule.manage',
  TOURNAMENT_SPONSORSHIP_MANAGE: 'tournament.sponsorship.manage',
  OPERATOR_VERIFY: 'operator.verify',
  REGISTRATION_APPROVE: 'registration.approve',
  REGISTRATION_REJECT: 'registration.reject',
  PAYMENT_VERIFY: 'payment.verify',
});

export const FEATURE_PERMISSIONS = Object.freeze({
  reviewVerificationQueue: [APP_PERMISSIONS.OPERATOR_VERIFY],
  reviewRegistrationQueue: [
    APP_PERMISSIONS.PAYMENT_VERIFY,
    APP_PERMISSIONS.REGISTRATION_APPROVE,
    APP_PERMISSIONS.REGISTRATION_REJECT,
  ],
});

export const ROLE_GROUPS = Object.freeze({
  platform: [
    'super_admin',
    'platform_admin',
    'internal_admin',
    'reporter',
    'news_reporter_admin',
    'registration_admin',
    'verification_admin',
    'finance_admin',
    'moderator',
    'admin',
    'reviewer',
  ],
  workspace: [
    'venue_partner',
    'verified_operator',
    'federation_operator',
    'eo_operator',
    'community_host',
  ],
  official: [
    'match_official',
    'referee',
    'match_commissioner',
    'statistic_operator',
    'venue_officer',
  ],
});

export const PAGE_ACCESS = Object.freeze({
  'platform-console': { console: 'platform' },
  newsroom: {
    console: 'platform',
    roles: ['super_admin', 'platform_admin', 'internal_admin', 'reporter', 'news_reporter_admin'],
    permissions: [APP_PERMISSIONS.NEWS_CREATE, APP_PERMISSIONS.NEWS_EDIT, APP_PERMISSIONS.NEWS_PUBLISH, APP_PERMISSIONS.NEWS_FEATURE],
  },
  moderation: {
    console: 'platform',
    roles: ['super_admin', 'platform_admin', 'internal_admin', 'moderator', 'admin'],
    permissions: [APP_PERMISSIONS.USERS_MODERATE, APP_PERMISSIONS.AUDIT_READ],
  },
  analytics: {
    console: 'platform',
    roles: ['super_admin', 'platform_admin', 'internal_admin', 'finance_admin', 'moderator', 'admin'],
    permissions: [APP_PERMISSIONS.ANALYTICS_GLOBAL_READ, APP_PERMISSIONS.AUDIT_READ, APP_PERMISSIONS.PAYMENT_VERIFY],
  },
  'admin-verification-queue': { console: 'platform', permissions: [APP_PERMISSIONS.OPERATOR_VERIFY] },
  'user-management': {
    console: 'platform',
    roles: ['super_admin', 'platform_admin', 'internal_admin', 'admin'],
    permissions: [APP_PERMISSIONS.USERS_ROLE_MANAGE, APP_PERMISSIONS.USERS_MODERATE],
  },
  'workspace-console': { console: 'workspace' },
  'community-manager': {
    console: 'workspace',
    roles: ['community_host', 'verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
    permissions: [APP_PERMISSIONS.TOURNAMENT_CREATE, APP_PERMISSIONS.TOURNAMENT_EDIT],
  },
  'sponsor-manager': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin'],
    permissions: [APP_PERMISSIONS.TOURNAMENT_SPONSORSHIP_MANAGE],
  },
  'tournament-manager': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin', 'registration_admin', 'finance_admin'],
    permissions: [
      APP_PERMISSIONS.TOURNAMENT_CREATE,
      APP_PERMISSIONS.TOURNAMENT_EDIT,
      APP_PERMISSIONS.TOURNAMENT_SCHEDULE_MANAGE,
      APP_PERMISSIONS.PAYMENT_VERIFY,
      APP_PERMISSIONS.REGISTRATION_APPROVE,
      APP_PERMISSIONS.REGISTRATION_REJECT,
    ],
  },
  'training-manager': {
    console: 'workspace',
    roles: ['community_host', 'verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
    permissions: [APP_PERMISSIONS.TOURNAMENT_CREATE, APP_PERMISSIONS.TOURNAMENT_EDIT],
  },
  'venue-manager': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin', 'venue_officer'],
    permissions: [APP_PERMISSIONS.TOURNAMENT_CREATE, APP_PERMISSIONS.TOURNAMENT_EDIT],
  },
  'venue-workspace': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin', 'venue_officer'],
    permissions: [APP_PERMISSIONS.TOURNAMENT_CREATE, APP_PERMISSIONS.TOURNAMENT_EDIT],
  },
  'venue-dashboard': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin', 'venue_officer'],
  },
  'venue-courts': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin', 'venue_officer'],
  },
  'venue-bookings': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin', 'venue_officer'],
  },
  'venue-calendar': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'federation_operator', 'internal_admin', 'venue_officer'],
  },
  'venue-pos': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
  },
  'venue-membership': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
  },
  'venue-customers': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
  },
  'venue-staff': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
  },
  'venue-maintenance': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin', 'venue_officer'],
  },
  'venue-ads': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
  },
  'venue-finance': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
  },
  'venue-settings': {
    console: 'workspace',
    roles: ['verified_operator', 'venue_partner', 'eo_operator', 'internal_admin'],
  },
  'official-center': { console: 'official' },
  'official-schedule': { console: 'official' },
  'match-center': { console: 'official', roles: ['match_official', 'referee', 'match_commissioner', 'statistic_operator'] },
  'match-report': { console: 'official', roles: ['match_official', 'referee', 'match_commissioner'] },
  'match-statistics': { console: 'official', roles: ['match_official', 'match_commissioner', 'statistic_operator'] },
});

const OFFICIAL_MATCH_ROLE_CAPABILITIES = Object.freeze({
  match_official: {
    openMatchCenter: true,
    openMatchReport: true,
    openMatchStatistics: true,
    manageLineup: true,
    recordEvents: true,
    finalizeAssignment: true,
  },
  referee: {
    openMatchCenter: true,
    openMatchReport: true,
    openMatchStatistics: true,
    manageLineup: true,
    recordEvents: true,
    finalizeAssignment: true,
  },
  match_commissioner: {
    openMatchCenter: true,
    openMatchReport: true,
    openMatchStatistics: true,
    manageLineup: true,
    recordEvents: true,
    finalizeAssignment: true,
  },
  statistic_operator: {
    openMatchCenter: true,
    openMatchReport: false,
    openMatchStatistics: true,
    manageLineup: false,
    recordEvents: true,
    finalizeAssignment: false,
  },
  venue_officer: {
    openMatchCenter: false,
    openMatchReport: false,
    openMatchStatistics: false,
    manageLineup: false,
    recordEvents: false,
    finalizeAssignment: false,
  },
});

export function getOfficialMatchCapabilities({ userRoles = [], assignmentRole = null } = {}) {
  const normalizedUserRoles = normalizeRoles(userRoles);
  const normalizedAssignmentRole = normalizeRoles([assignmentRole])[0] || null;

  const roleFromAssignment = normalizedAssignmentRole && normalizedUserRoles.includes(normalizedAssignmentRole)
    ? normalizedAssignmentRole
    : null;
  const roleFromAuth = normalizedUserRoles.find((role) => OFFICIAL_MATCH_ROLE_CAPABILITIES[role]) || null;
  const effectiveRole = roleFromAssignment || roleFromAuth;

  const fallback = {
    openMatchCenter: false,
    openMatchReport: false,
    openMatchStatistics: false,
    manageLineup: false,
    recordEvents: false,
    finalizeAssignment: false,
  };

  const capability = OFFICIAL_MATCH_ROLE_CAPABILITIES[effectiveRole] || fallback;

  return {
    effectiveRole,
    ...capability,
  };
}

export function hasRole(userRoles = [], role) {
  if (!Array.isArray(userRoles)) return false;
  if (!role) return false;
  const normalized = normalizeRoles(userRoles);
  const targetRole = normalizeRoles([role])[0] || role;
  return normalized.includes(targetRole);
}

export function hasAnyRole(userRoles = [], roles = []) {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  const normalizedUserRoles = normalizeRoles(userRoles);
  return roles.some((role) => hasRole(normalizedUserRoles, role));
}

export function hasPermission(userPermissions = [], permission) {
  if (!Array.isArray(userPermissions)) return false;
  if (!permission) return false;
  if (userPermissions.includes(APP_PERMISSIONS.PLATFORM_ALL)) return true;
  return userPermissions.includes(permission);
}

export function hasAnyPermission(userPermissions = [], permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) return true;
  return permissions.some((permission) => hasPermission(userPermissions, permission));
}

export function canAccessFeature(userPermissions = [], featureKey) {
  const requiredPermissions = FEATURE_PERMISSIONS[featureKey] || [];
  return hasAnyPermission(userPermissions, requiredPermissions);
}

export function deriveConsoleAccess(userRoles = [], userPermissions = []) {
  const normalizedRoles = normalizeRoles(userRoles);
  const hasUniversalAccess = hasAnyRole(normalizedRoles, ['super_admin'])
    || hasAnyPermission(userPermissions, [APP_PERMISSIONS.PLATFORM_ALL]);

  if (hasUniversalAccess) {
    return {
      platform: true,
      workspace: true,
      official: true,
    };
  }

  return {
    platform: hasAnyRole(normalizedRoles, ROLE_GROUPS.platform)
      || hasAnyPermission(userPermissions, [
        APP_PERMISSIONS.PLATFORM_ALL,
        APP_PERMISSIONS.OPERATOR_VERIFY,
      ]),
    workspace: hasAnyRole(normalizedRoles, ROLE_GROUPS.workspace)
      || canAccessFeature(userPermissions, 'reviewRegistrationQueue'),
    official: hasAnyRole(normalizedRoles, ROLE_GROUPS.official),
  };
}

export function canAccessAdminPage(pageKey, userRoles = [], userPermissions = []) {
  const pageRule = PAGE_ACCESS[pageKey];
  if (!pageRule) return false;

  const normalizedRoles = normalizeRoles(userRoles);
  const hasUniversalAccess = hasAnyRole(normalizedRoles, ['super_admin'])
    || hasAnyPermission(userPermissions, [APP_PERMISSIONS.PLATFORM_ALL]);
  if (hasUniversalAccess) {
    return true;
  }

  const consoleAccess = deriveConsoleAccess(normalizedRoles, userPermissions);
  if (pageRule.console && !consoleAccess[pageRule.console]) {
    return false;
  }

  const roleAllowed = Array.isArray(pageRule.roles) && pageRule.roles.length > 0
    ? hasAnyRole(normalizedRoles, pageRule.roles)
    : false;
  const permissionAllowed = Array.isArray(pageRule.permissions) && pageRule.permissions.length > 0
    ? hasAnyPermission(userPermissions, pageRule.permissions)
    : false;

  if (Array.isArray(pageRule.roles) || Array.isArray(pageRule.permissions)) {
    return roleAllowed || permissionAllowed;
  }

  return true;
}
