// scripts/create-test-accounts.js
// Jalankan: node scripts/create-test-accounts.js
// Pastikan SUPABASE_SERVICE_ROLE_KEY sudah di-set di environment atau .env.local

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manual (simple parser, tanpa dotenv dependency)
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY belum diset.');
  console.error('   Jalankan ulang dengan:\n');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/create-test-accounts.js\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  // Platform Admin
  { email: 'super_admin@stadione.id',          name: 'Super Admin',           role: 'super_admin' },
  { email: 'internal_admin@stadione.id',        name: 'Internal Admin',        role: 'internal_admin' },
  { email: 'news_reporter_admin@stadione.id',   name: 'News Reporter Admin',   role: 'news_reporter_admin' },
  { email: 'tournament_host_admin@stadione.id', name: 'Tournament Host Admin', role: 'tournament_host_admin' },
  { email: 'registration_admin@stadione.id',    name: 'Registration Admin',    role: 'registration_admin' },
  { email: 'verification_admin@stadione.id',    name: 'Verification Admin',    role: 'verification_admin' },
  { email: 'finance_admin@stadione.id',         name: 'Finance Admin',         role: 'finance_admin' },
  // Operator
  { email: 'verified_operator@stadione.id',     name: 'Verified Operator',     role: 'verified_operator' },
  { email: 'federation_operator@stadione.id',   name: 'Federation Operator',   role: 'federation_operator' },
  { email: 'eo_operator@stadione.id',           name: 'EO Operator',           role: 'eo_operator' },
  { email: 'community_host@stadione.id',        name: 'Community Host',        role: 'community_host' },
  // Match Official
  { email: 'match_official@stadione.id',        name: 'Match Official',        role: 'match_official' },
  { email: 'referee@stadione.id',               name: 'Referee',               role: 'referee' },
  { email: 'match_commissioner@stadione.id',    name: 'Match Commissioner',    role: 'match_commissioner' },
  { email: 'statistic_operator@stadione.id',    name: 'Statistic Operator',    role: 'statistic_operator' },
  { email: 'venue_officer@stadione.id',         name: 'Venue Officer',         role: 'venue_officer' },
  // Team
  { email: 'team_official@stadione.id',         name: 'Team Official',         role: 'team_official' },
  { email: 'coach@stadione.id',                 name: 'Coach',                 role: 'coach' },
  { email: 'manager@stadione.id',               name: 'Manager',               role: 'manager' },
  { email: 'player@stadione.id',                name: 'Player',                role: 'player' },
  // General
  { email: 'general_user@stadione.id',          name: 'General User',          role: 'general_user' },
];

const PASSWORD = '1234abcd';

async function main() {
  console.log(`\n🚀  Membuat ${ACCOUNTS.length} akun test di ${SUPABASE_URL}\n`);

  const results = [];

  for (const acc of ACCOUNTS) {
    process.stdout.write(`  → ${acc.email.padEnd(42)} `);

    // 1. Buat user via Admin API
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: acc.name },
    });

    if (createErr) {
      if (createErr.message?.includes('already been registered')) {
        console.log('⚠️  SKIP (sudah ada)');
        results.push({ ...acc, status: 'skip' });
        continue;
      }
      console.log(`❌  ERROR: ${createErr.message}`);
      results.push({ ...acc, status: 'error', error: createErr.message });
      continue;
    }

    const userId = created.user.id;

    // 2. Assign role ke user_roles
    const { error: roleErr } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: acc.role, granted_at: new Date().toISOString() });

    if (roleErr) {
      console.log(`✅  CREATED user | ⚠️  role error: ${roleErr.message}`);
      results.push({ ...acc, status: 'created_no_role', error: roleErr.message });
    } else {
      console.log(`✅  CREATED`);
      results.push({ ...acc, status: 'created' });
    }
  }

  // Ringkasan
  const created = results.filter((r) => r.status === 'created').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  const failed  = results.filter((r) => r.status === 'error').length;

  console.log('\n──────────────────────────────────────────────────');
  console.log(`✅  Berhasil dibuat : ${created}`);
  console.log(`⚠️   Sudah ada (skip): ${skipped}`);
  console.log(`❌  Error           : ${failed}`);
  console.log('──────────────────────────────────────────────────');
  console.log(`\nPassword semua akun: ${PASSWORD}\n`);

  if (failed > 0) {
    console.log('Error detail:');
    results.filter((r) => r.status === 'error').forEach((r) => {
      console.log(`  ${r.email}: ${r.error}`);
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
