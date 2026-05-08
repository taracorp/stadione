import { createClient } from '@supabase/supabase-js';

// ⚠️ PENTING: Ganti dengan credentials Supabase kamu
// Dapatkan dari: https://supabase.com/dashboard/project/[PROJECT_NAME]/settings/api
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bkjsqfcjylgmxlauatwt.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️ Supabase credentials belum dikonfigurasi. Setup di .env.local');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
