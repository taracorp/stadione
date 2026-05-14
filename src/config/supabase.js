import { createClient } from '@supabase/supabase-js';

// ⚠️ PENTING: Ganti dengan credentials Supabase kamu
// Dapatkan dari: https://supabase.com/dashboard/project/[PROJECT_NAME]/settings/api
const DEFAULT_SUPABASE_URL = 'https://bkjsqfcjylgmxlauatwt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJranNxZmNqeWxnbXhsYXVhdHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzMzMTIsImV4cCI6MjA5MzgwOTMxMn0.b0fTIE4cGohoXHTcpjvRUrHm8Jyc6UuHwatWVOguu9o';

function getValidHttpUrl(value) {
  if (typeof value !== 'string') return '';

  const trimmed = sanitizeEnvValue(value);
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? trimmed : '';
  } catch {
    return '';
  }
}

function sanitizeEnvValue(value) {
  if (typeof value !== 'string') return '';

  let sanitized = value.trim();
  if (!sanitized) return '';

  if (
    (sanitized.startsWith('"') && sanitized.endsWith('"')) ||
    (sanitized.startsWith("'") && sanitized.endsWith("'"))
  ) {
    sanitized = sanitized.slice(1, -1).trim();
  }

  return sanitized.replace(/\s+/g, '');
}

function getFirstNonEmptyEnvValue(keys = []) {
  for (const key of keys) {
    const value = sanitizeEnvValue(String(import.meta.env?.[key] || ''));
    if (value) return value;
  }

  return '';
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getSupabaseProjectRef(url) {
  try {
    return new URL(url).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function isValidSupabaseAnonKeyForUrl(key, url) {
  const payload = decodeJwtPayload(key);
  if (!payload || payload.role !== 'anon') return false;

  const projectRef = getSupabaseProjectRef(url);
  return !projectRef || payload.ref === projectRef;
}

const envSupabaseUrl = getValidHttpUrl(
  getFirstNonEmptyEnvValue([
    'VITE_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
  ])
);

const envSupabaseKey = getFirstNonEmptyEnvValue([
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
]);

const envConfigIsValid = Boolean(envSupabaseUrl && isValidSupabaseAnonKeyForUrl(envSupabaseKey, envSupabaseUrl));
export const SUPABASE_URL = envConfigIsValid ? envSupabaseUrl : DEFAULT_SUPABASE_URL;
export const SUPABASE_KEY = envConfigIsValid ? envSupabaseKey : DEFAULT_SUPABASE_ANON_KEY;
export const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_KEY && SUPABASE_KEY !== 'your_anon_key_here'
);

if ((envSupabaseUrl || envSupabaseKey) && !envConfigIsValid) {
  console.warn('Supabase environment tidak valid untuk project ini. Menggunakan fallback config Stadione.');
}

if (!SUPABASE_CONFIGURED) {
  console.warn('⚠️ Supabase credentials belum dikonfigurasi atau masih placeholder. Setup di .env.local atau environment variables Vercel.');
}

let supabaseClient = null;
export let SUPABASE_ERROR = null;

try {
  if (SUPABASE_CONFIGURED) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (error) {
  SUPABASE_ERROR = error?.message || 'Unknown Supabase configuration error';
  console.error('⚠️ Supabase client initialization failed:', SUPABASE_ERROR);
}

export const supabase = supabaseClient;
