# RBAC Catalog and QA Matrix

## Role Catalog Level 1-5

| Level | Scope | Canonical Roles | Legacy/Compat Roles |
| --- | --- | --- | --- |
| 5 | Platform | super_admin | - |
| 4 | Platform | platform_admin, moderator, reporter | internal_admin, admin, reviewer, news_reporter_admin |
| 3 | Operator | tournament_host, venue_partner | tournament_host_admin, eo_operator |
| 2 | Official | assistant_referee, timekeeper, referee, match_commissioner, statistic_operator, venue_officer | match_official |
| 2 | Team | team_official, coach, manager, player | team_role |
| 1 | General | member, fans, supporter | general_user |

Notes:
1. Role model bersifat additive: satu user bisa punya banyak role.
2. Canonical role diprioritaskan untuk rule baru, legacy role dipertahankan untuk kompatibilitas.

## Permission Catalog per Modul

| Modul | Permissions |
| --- | --- |
| platform | platform.all, platform.settings.manage |
| analytics | analytics.global.read |
| users | users.role.manage, users.moderate |
| security | audit.read, audit.write |
| verification | operator.verify, operator.create_official_tournament |
| registration | registration.approve, registration.reject, registration.roster.validate, registration.age.validate |
| finance | payment.verify |
| news | news.create, news.edit, news.publish, news.feature, media.upload |
| tournament | tournament.create, tournament.edit, tournament.schedule.manage, tournament.official.assign, tournament.sponsorship.manage |
| team | team.register, team.roster.manage |
| match | match.events.manage, match.report.finalize, match.lineup.manage |
| player | player.profile.read |

## QA Matrix (30 Skenario Allow/Deny)

| # | Persona | Page/Action | Expected |
| --- | --- | --- | --- |
| 1 | super_admin | Open platform-console | Allow |
| 2 | super_admin | Open newsroom | Allow |
| 3 | super_admin | Open moderation | Allow |
| 4 | super_admin | Open analytics | Allow |
| 5 | super_admin | Open admin-verification-queue | Allow |
| 6 | platform_admin | Open platform-console | Allow |
| 7 | platform_admin | Open moderation | Allow |
| 8 | platform_admin | Open analytics | Allow |
| 9 | platform_admin | Open admin-verification-queue | Allow |
| 10 | platform_admin | Open sponsor-manager | Deny |
| 11 | moderator | Open moderation | Allow |
| 12 | moderator | Open analytics | Allow |
| 13 | moderator | Open admin-verification-queue | Allow |
| 14 | moderator | Open newsroom | Deny |
| 15 | moderator | Open venue-manager | Deny |
| 16 | reporter | Open newsroom | Allow |
| 17 | reporter | Open moderation | Deny |
| 18 | reporter | Open analytics | Deny |
| 19 | reporter | Open tournament-manager | Deny |
| 20 | tournament_host | Open workspace-console | Allow |
| 21 | tournament_host | Open tournament-manager | Allow |
| 22 | tournament_host | Open sponsor-manager | Allow |
| 23 | tournament_host | Open training-manager | Allow |
| 24 | tournament_host | Open platform-console | Deny |
| 25 | venue_partner | Open workspace-console | Allow |
| 26 | venue_partner | Open tournament-manager | Allow |
| 27 | venue_partner | Open sponsor-manager | Allow |
| 28 | member/fans/supporter | Open newsroom admin page | Deny |
| 29 | member/fans/supporter | Open moderation | Deny |
| 30 | member/fans/supporter | Open workspace manager pages | Deny |

## Verifikasi Teknis
1. Jalankan scripts/qa-role-access-smoke.sql.
2. Pastikan hasil sejalan dengan matriks di atas.
3. Jika mismatch, cek mapping di src/utils/permissions.js dan role_permissions di database.
