# STADIONE - Unified Role and Workspace Architecture

Dokumen ini merapikan RBAC menjadi tiga lapisan yang terpisah: System Role, Workspace Role, dan Activity Role.

## Core Principle

Stadione harus memisahkan:

1. System Role

- Hak akses global platform.

1. Workspace Role

- Hak akses pada workspace tertentu (venue, tournament, academy, community, sponsor).

1. Activity Role

- Hak akses kontekstual pada aktivitas tertentu (match, team season, training cohort, event).

Prinsip ini mencegah bentrok ketika 1 user memiliki banyak peran sekaligus dalam konteks berbeda.

## Recommended Final Role Tree

### 1) System Role (Global Platform)

- `super_admin`
- `platform_admin`
- `verification_admin`
- `finance_admin`
- `moderator`
- `reporter`
- `support_admin`
- `reviewer`

Catatan normalisasi:

- `internal_admin` ditandai deprecated, dipetakan ke `platform_admin`.
- `admin` ditandai deprecated, dipetakan ke `moderator`.
- `news_reporter_admin` ditandai deprecated, dipetakan ke `reporter`.
- `registration_admin` ditandai deprecated, dipetakan ke `verification_admin`.

### 2) Base User Role

- `member` (default role)

Catatan:

- `fans` dan `supporter` dipindahkan menjadi user interest/tag, bukan role permission.

### 3) Workspace Role (Operator Ecosystem)

- `verified_operator`
- `tournament_host`
- `venue_partner`
- `community_host`
- `academy_operator`
- `coach_operator`
- `federation_operator`
- `sponsor_partner`

Catatan normalisasi:

- `eo_operator` ditandai deprecated, dipetakan ke `tournament_host` atau `venue_partner` sesuai konteks organisasi.

### 4) Official / Match Role

- `match_official`
- `referee`
- `assistant_referee`
- `timekeeper`
- `match_commissioner`
- `statistic_operator`
- `lineup_operator`
- `venue_officer`

### 5) Team Role (Contextual)

- `team_member`
- `player`
- `coach`
- `manager`
- `team_official`

### 6) Training Role

- `training_role`
- `academy_owner`
- `academy_admin`
- `trainer`
- `athlete`
- `parent`

### 7) Venue Role

- `venue_role`
- `venue_owner`
- `venue_manager`
- `cashier`
- `venue_staff`

## Data Model Recommendation

Gunakan model assignment berikut agar role bisa kontekstual.

1. `user_roles`

- Menyimpan System Role global (platform-level).

1. `user_workspace_roles`

- Menyimpan role user terhadap workspace tertentu.

1. `user_activity_roles`

- Menyimpan role user terhadap aktivitas tertentu.

1. `user_interests`

- Menyimpan interest/profile tag seperti `supporter`, `football`, `arsenal`.

## Partnership and Workspace Activation Flow

1. Register User

- Quick register
- Verify email/phone
- Auto-assign `member`

1. Choose Partnership Type

- Tournament Host
- Venue Partner
- Academy
- Community Host
- Coach

1. Submit Business and Legal Data

- Basic profile
- Legalitas
- Verification docs

1. Super Admin Review

- `pending`
- `need_revision`
- `approved`

1. Workspace Activated

- Assign `user_workspace_roles`
- Optional: assign scoped `user_activity_roles` untuk event/match/team

## Role vs Permission

Role harus tetap ringkas, sedangkan capability detail diletakkan pada permission.

Contoh:

- Role: `venue_manager`
- Permission: `booking.manage`, `cashier.manage`, `reports.read`

## Migration Strategy (Safe and Incremental)

1. Tambahkan role canonical baru tanpa menghapus role lama.
1. Tambahkan tabel assignment kontekstual (`user_workspace_roles`, `user_activity_roles`).
1. Tambahkan compatibility grants agar akses lama tetap jalan.
1. Ubah UI gate menjadi permission-first dan context-aware.
1. Setelah observasi stabil, lakukan deprecate bertahap role lama.

## Artifact

SQL rollout untuk arsitektur ini tersedia di:

- `scripts/unified-role-workspace-architecture.sql`
