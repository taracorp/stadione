import { createClient } from '@supabase/supabase-js';

// ⚠️ PENTING: Ganti dengan credentials Supabase kamu
// Dapatkan dari: https://supabase.com/dashboard/project/[PROJECT_NAME]/settings/api
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bkjsqfcjylgmxlauatwt.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY !== 'your_anon_key_here'
);

if (!SUPABASE_CONFIGURED) {
  console.warn('⚠️ Supabase credentials belum dikonfigurasi atau masih placeholder. Setup di .env.local atau environment variables Vercel.');
}

let supabaseClient = null;
export let SUPABASE_ERROR = null;

try {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (error) {
  SUPABASE_ERROR = error?.message || 'Unknown Supabase configuration error';
  console.error('⚠️ Supabase client initialization failed:', SUPABASE_ERROR);
}

export const supabase = supabaseClient;
