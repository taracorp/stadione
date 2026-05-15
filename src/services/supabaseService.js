import { supabase } from '../config/supabase.js';
import { getSubstitutionPresetForSport } from './substitutionRuleEngine.js';
import { normalizeRoles } from '../utils/roles.js';

const isSupabaseReady = () => Boolean(supabase);
const handleEmptyConsistency = (fallback = []) => fallback;
const TOURNAMENT_COLOR_BY_SPORT = {
  sepakbola: '#0F4D2A',
  futsal: '#92400E',
  badminton: '#B91C1C',
  tennis: '#15803D',
  padel: '#1F3A8A',
  renang: '#0E7490',
  esports: '#7C3AED',
  pingpong: '#B45309'
};

const PERMISSIONS = {
  PLATFORM_ALL: 'platform.all',
  OPERATOR_VERIFY: 'operator.verify',
  REGISTRATION_APPROVE: 'registration.approve',
  REGISTRATION_REJECT: 'registration.reject',
  PAYMENT_VERIFY: 'payment.verify',
};

const FALLBACK_PERMISSION_BY_ROLE = {
  super_admin: [
    PERMISSIONS.PLATFORM_ALL,
    PERMISSIONS.OPERATOR_VERIFY,
    PERMISSIONS.REGISTRATION_APPROVE,
    PERMISSIONS.REGISTRATION_REJECT,
    PERMISSIONS.PAYMENT_VERIFY,
  ],
  internal_admin: [
    PERMISSIONS.PLATFORM_ALL,
    PERMISSIONS.OPERATOR_VERIFY,
    PERMISSIONS.REGISTRATION_APPROVE,
    PERMISSIONS.REGISTRATION_REJECT,
    PERMISSIONS.PAYMENT_VERIFY,
  ],
  reviewer: [PERMISSIONS.OPERATOR_VERIFY],
  verification_admin: [PERMISSIONS.OPERATOR_VERIFY],
  admin: [PERMISSIONS.OPERATOR_VERIFY],
  finance_admin: [PERMISSIONS.PAYMENT_VERIFY, PERMISSIONS.REGISTRATION_APPROVE],
};

function derivePermissionsFromRoles(roles = []) {
  const derived = new Set();
  const normalizedRoles = normalizeRoles(roles);

  (normalizedRoles || []).forEach((role) => {
    const permissionList = FALLBACK_PERMISSION_BY_ROLE[role];
    if (!permissionList) return;
    permissionList.forEach((permission) => derived.add(permission));
  });

  return Array.from(derived);
}

async function hasAnyCurrentUserPermission(requiredPermissions = []) {
  if (!isSupabaseReady()) return false;
  if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) return true;

  const currentPermissions = await fetchCurrentUserPermissions();
  if (!currentPermissions.length) return false;
  if (currentPermissions.includes(PERMISSIONS.PLATFORM_ALL)) return true;

  return requiredPermissions.some((permission) => currentPermissions.includes(permission));
}

function getTournamentColor(sport, color) {
  if (color) return color;
  return TOURNAMENT_COLOR_BY_SPORT[(sport || '').toLowerCase()] || '#1F2937';
}

function generateUniqueTransferAmount(baseFee) {
  const fee = Number(baseFee || 0);
  if (!fee) return 0;
  const suffix = Math.floor(Math.random() * 90) + 11;
  return fee + suffix;
}

async function getNextVenueId() {
  if (!isSupabaseReady()) return null;

  const { data, error } = await supabase
    .from('venues')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const currentMaxId = Number(data?.id || 0);
  return currentMaxId + 1;
}

export async function getDokuVenueConfig(venueId) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const { data, error } = await supabase
      .from('doku_venue_config')
      .select('*')
      .eq('venue_id', venueId)
      .single();
    if (error) {
      if (isMissingColumnError(error, 'doku_venue_config') || error.message?.toLowerCase().includes('not found')) {
        return { data: null };
      }
      throw error;
    }
    return { data };
  } catch (err) {
    console.error('Error loading DOKU config:', err.message);
    return { error: err.message || 'Gagal memuat konfigurasi DOKU.' };
  }
}

export async function saveDokuVenueConfig(venueId, config = {}) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };

  const normalizedEnvironment = config.environment === 'production' ? 'production' : 'sandbox';
  const normalizedBusinessId = String(config.business_id || '').trim();
  const normalizedBrandId = String(config.brand_id || '').trim();
  const normalizedApiKey = String(config.api_key || '').trim();
  const normalizedCheckoutUrl = String(config.checkout_base_url || '').trim();
  const normalizedMerchantId = String(config.merchant_id || '').trim();
  const normalizedClientId = String(config.client_id || '').trim();
  const normalizedSecretKey = String(config.secret_key || '').trim();
  const normalizedDokuPublicKey = String(config.doku_public_key || '').trim();
  const normalizedMerchantPublicKey = String(config.merchant_public_key || '').trim();

  if (!normalizedCheckoutUrl) {
    return { error: 'Checkout Base URL wajib diisi untuk konfigurasi DOKU.' };
  }

  if (!/^https?:\/\//i.test(normalizedCheckoutUrl)) {
    return { error: 'Checkout Base URL harus berupa URL valid (http/https).' };
  }

  if (normalizedEnvironment === 'production') {
    const missingFields = [];
    if (!normalizedBusinessId) missingFields.push('Business ID');
    if (!normalizedBrandId) missingFields.push('Brand ID');
    if (!normalizedMerchantId) missingFields.push('Merchant ID');
    if (!normalizedApiKey) missingFields.push('API Key');
    if (!normalizedClientId) missingFields.push('Client ID');
    if (!normalizedSecretKey) missingFields.push('Secret Key');

    if (missingFields.length > 0) {
      return { error: `Konfigurasi production belum lengkap: ${missingFields.join(', ')}.` };
    }
  }

  try {
    const { data, error } = await supabase
      .from('doku_venue_config')
      .upsert({
        venue_id: venueId,
        environment: normalizedEnvironment,
        business_id: normalizedBusinessId || null,
        brand_id: normalizedBrandId || null,
        merchant_id: normalizedMerchantId || null,
        api_key: normalizedApiKey || null,
        client_id: normalizedClientId || null,
        secret_key: normalizedSecretKey || null,
        doku_public_key: normalizedDokuPublicKey || null,
        merchant_public_key: normalizedMerchantPublicKey || null,
        checkout_base_url: normalizedCheckoutUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'venue_id' })
      .select()
      .single();
    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('Error saving DOKU config:', err.message);
    return { error: err.message || 'Gagal menyimpan konfigurasi DOKU.' };
  }
}

export async function initiateDokuPayment(bookingId, venueId, payload = {}) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };

  const requestBody = {
    booking_id: bookingId,
    venue_id: venueId,
    amount: Number(payload.amount || 0),
    currency: payload.currency || 'IDR',
    customer_name: payload.customer_name || null,
    customer_phone: payload.customer_phone || null,
    return_url: payload.return_url || null,
  };

  try {
    if (supabase.functions && typeof supabase.functions.invoke === 'function') {
      const invokeResponse = await supabase.functions.invoke('doku-checkout', {
        body: requestBody,
      });

      if (invokeResponse.error) {
        console.warn('DOKU function invoke returned error, falling back to table insert:', invokeResponse.error.message || invokeResponse.error);
      } else {
        const invokeData = invokeResponse.data || {};
        return {
          data: invokeData.transaction || invokeData,
          checkout_url: invokeData.checkout_url || invokeData?.transaction?.checkout_url || null,
        };
      }
    }
  } catch (err) {
    console.warn('DOKU function invoke failed:', err.message || err);
  }

  const getColumnMissingMessage = (error, columnName) => {
    const message = (error?.message || '').toLowerCase();
    return message.includes('column') && message.includes(columnName.toLowerCase()) && message.includes('does not exist');
  };

  const insertTransactionWithSchemaFallback = async (basePayload) => {
    const attempts = [
      { key: 'price', payload: { ...basePayload, price: basePayload.amount } },
      { key: 'amount', payload: { ...basePayload } },
    ];

    let lastError = null;

    for (const attempt of attempts) {
      const insertPayload = { ...attempt.payload };
      if (attempt.key === 'price') {
        delete insertPayload.amount;
      }

      const { data, error } = await supabase
        .from('doku_payment_transactions')
        .insert(insertPayload)
        .select()
        .single();

      if (!error) {
        return { data };
      }

      lastError = error;

      // Try alternate schema if column mismatch happens.
      if ((attempt.key === 'price' && getColumnMissingMessage(error, 'price')) ||
          (attempt.key === 'amount' && getColumnMissingMessage(error, 'amount'))) {
        continue;
      }

      throw error;
    }

    throw lastError;
  };

  try {
    const transactionPayload = {
      ...requestBody,
      status: 'pending',
      doku_order_id: `doku-${bookingId}-${Date.now()}`,
      checkout_url: payload.checkout_url || null,
      doku_response: {
        generated_at: new Date().toISOString(),
        source: 'supabase_service_fallback',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await insertTransactionWithSchemaFallback(transactionPayload)
      .then((result) => ({ data: result.data, error: null }))
      .catch((err) => ({ data: null, error: err }));

    if (error) {
      if (isMissingColumnError(error, 'doku_payment_transactions') || error.message?.toLowerCase().includes('not found')) {
        return { error: 'Tabel transaksi DOKU belum tersedia. Jalankan migrasi DOKU terlebih dahulu.' };
      }
      throw error;
    }

    return {
      data,
      checkout_url: payload.checkout_url || null,
    };
  } catch (err) {
    console.error('Error initiating DOKU payment:', err.message);
    return { error: err.message || 'Gagal memulai pembayaran DOKU.' };
  }
}

export async function fetchDokuTransactions(venueId, filters = {}) {
  if (!isSupabaseReady()) return { data: [] };
  try {
    let query = supabase.from('doku_payment_transactions').select('*').eq('venue_id', venueId).order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.from) query = query.gte('created_at', filters.from);
    if (filters.to) query = query.lte('created_at', filters.to);
    const { data, error } = await query;
    if (error) throw error;
    return { data: data || [] };
  } catch (err) {
    console.error('Error fetching DOKU transactions:', err.message);
    return { error: err.message || 'Gagal memuat transaksi DOKU.' };
  }
}

export async function fetchDokuTransactionByBooking(bookingId) {
  if (!isSupabaseReady()) return { data: null };
  try {
    const { data, error } = await supabase
      .from('doku_payment_transactions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) {
      if (isMissingColumnError(error, 'doku_payment_transactions')) {
        return { data: null };
      }
      throw error;
    }
    return { data };
  } catch (err) {
    console.error('Error fetching DOKU transaction:', err.message);
    return { error: err.message || 'Gagal memuat status transaksi DOKU.' };
  }
}

// ── Customer Favorite Courts ───────────────────────────────────────────────────

export async function addCustomerFavoriteCourt(customerId, venueId, courtId) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const { data, error } = await supabase
      .from('customer_favorite_courts')
      .insert({
        customer_id: customerId,
        venue_id: venueId,
        court_id: courtId,
      })
      .select()
      .single();

    if (error) {
      if (isMissingColumnError(error, 'customer_favorite_courts')) {
        return { error: 'Tabel favorit court belum tersedia. Jalankan migrasi favorit court terlebih dahulu.' };
      }
      if (error.code === '23505') { // unique violation
        return { error: 'Court ini sudah ditandai sebagai favorit.' };
      }
      throw error;
    }

    return { data };
  } catch (err) {
    console.error('Error adding favorite court:', err.message);
    return { error: err.message || 'Gagal menambahkan court favorit.' };
  }
}

export async function removeCustomerFavoriteCourt(customerId, courtId) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const { error } = await supabase
      .from('customer_favorite_courts')
      .delete()
      .eq('customer_id', customerId)
      .eq('court_id', courtId);

    if (error) {
      if (isMissingColumnError(error, 'customer_favorite_courts')) {
        return { error: 'Tabel favorit court belum tersedia.' };
      }
      throw error;
    }

    return { success: true };
  } catch (err) {
    console.error('Error removing favorite court:', err.message);
    return { error: err.message || 'Gagal menghapus court favorit.' };
  }
}

export async function fetchCustomerFavoriteCourts(customerId, venueId) {
  if (!isSupabaseReady()) return { data: [] };
  try {
    const { data, error } = await supabase
      .from('customer_favorite_courts')
      .select(`
        id,
        created_at,
        venue_courts (
          id,
          name,
          sport_type,
          price_per_hour,
          venue_branches (
            id,
            name
          )
        )
      `)
      .eq('customer_id', customerId)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingColumnError(error, 'customer_favorite_courts')) {
        return { data: [] };
      }
      throw error;
    }

    return { data: data || [] };
  } catch (err) {
    console.error('Error fetching favorite courts:', err.message);
    return { error: err.message || 'Gagal memuat court favorit.' };
  }
}

export async function isCourtFavorited(customerId, courtId) {
  if (!isSupabaseReady()) return { data: false };
  try {
    const { data, error } = await supabase
      .from('customer_favorite_courts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('court_id', courtId)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // no rows returned
        return { data: false };
      }
      if (isMissingColumnError(error, 'customer_favorite_courts')) {
        return { data: false };
      }
      throw error;
    }

    return { data: true };
  } catch (err) {
    console.error('Error checking favorite status:', err.message);
    return { error: err.message || 'Gagal memeriksa status favorit.' };
  }
}

// ── Staff Action Audit Log ─────────────────────────────────────────────────────

export async function logStaffAction(params) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };

  const {
    venueId,
    staffUserId,
    actionType,
    actionDescription,
    targetType,
    targetId,
    oldValues,
    newValues,
    metadata,
    ipAddress,
    userAgent,
  } = params;

  try {
    const { data, error } = await supabase.rpc('log_staff_action', {
      p_venue_id: venueId,
      p_staff_user_id: staffUserId,
      p_action_type: actionType,
      p_action_description: actionDescription,
      p_target_type: targetType,
      p_target_id: targetId,
      p_old_values: oldValues,
      p_new_values: newValues,
      p_metadata: metadata,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    });

    if (error) {
      if (isMissingColumnError(error, 'staff_action_logs')) {
        console.warn('Staff audit log table not available, skipping log');
        return { success: true }; // Don't fail the main operation
      }
      throw error;
    }

    return { data };
  } catch (err) {
    console.error('Error logging staff action:', err.message);
    // Don't return error to avoid breaking main operations
    return { success: true };
  }
}

export async function fetchStaffActionLogs(venueId, filters = {}) {
  if (!isSupabaseReady()) return { data: [] };
  try {
    let query = supabase
      .from('staff_action_logs')
      .select(`
        id,
        action_type,
        action_description,
        target_type,
        target_id,
        old_values,
        new_values,
        metadata,
        created_at,
        venue_staff (
          role,
          auth.users (
            email,
            raw_user_meta_data
          )
        )
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (filters.actionType) query = query.eq('action_type', filters.actionType);
    if (filters.staffUserId) query = query.eq('staff_user_id', filters.staffUserId);
    if (filters.targetType) query = query.eq('target_type', filters.targetType);
    if (filters.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters.toDate) query = query.lte('created_at', filters.toDate);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;

    if (error) {
      if (isMissingColumnError(error, 'staff_action_logs')) {
        return { data: [] };
      }
      throw error;
    }

    return { data: data || [] };
  } catch (err) {
    console.error('Error fetching staff action logs:', err.message);
    return { error: err.message || 'Gagal memuat log aksi staf.' };
  }
}

function isMissingSubstitutionRulesColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('substitution_rules')
    && (message.includes('schema cache') || message.includes('column') || message.includes('does not exist'));
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(String(columnName || '').toLowerCase())
    && (message.includes('schema cache') || message.includes('column') || message.includes('does not exist'));
}

function isRlsDeniedError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('row-level security') || message.includes('permission denied');
}

function getPendingActivityKey(userId) {
  return `stadione_pending_activity_${userId}`;
}

function readPendingActivities(userId) {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(getPendingActivityKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingActivities(userId, activities) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(getPendingActivityKey(userId), JSON.stringify(activities || []));
  } catch {
    // ignore localStorage write errors
  }
}

function appendPendingActivity(userId, payload) {
  if (!userId || !payload?.type) return;
  const current = readPendingActivities(userId);
  const next = [
    {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      activity_type: payload.type,
      activity_category: payload.category,
      activity_title: payload.title,
      activity_description: payload.description,
      activity_metadata: {
        ...(payload.metadata || {}),
        source: 'local_pending_fallback',
      },
      status: payload.status || 'active',
      is_completed: Boolean(payload.isCompleted),
      activity_date: new Date().toISOString(),
    },
    ...current,
  ].slice(0, 200);
  writePendingActivities(userId, next);
}

function getActivityArticleId(activity) {
  return activity?.activity_metadata?.articleId
    || activity?.activity_metadata?.article_id
    || activity?.activity_metadata?.referenceId
    || activity?.reference_id
    || null;
}

function getActivityDedupeKey(activity) {
  const articleId = getActivityArticleId(activity);
  if (activity?.activity_type === 'article_read' && articleId) {
    return `article_read:${articleId}`;
  }

  return `${activity?.activity_type || 'activity'}:${activity?.id || activity?.activity_date || Math.random()}`;
}

function mergeActivityHistory(...activityGroups) {
  const merged = [];
  const seen = new Set();

  activityGroups.flat().filter(Boolean).forEach((activity) => {
    const key = getActivityDedupeKey(activity);
    if (seen.has(key)) return;

    seen.add(key);
    merged.push(activity);
  });

  return merged.sort((a, b) => new Date(b.activity_date || 0).getTime() - new Date(a.activity_date || 0).getTime());
}

// ========== VENUES ==========
export async function fetchVenues() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchVenues returning fallback empty array.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('venues')
      .select(`
        *,
        venue_tags(tag)
      `);
    if (error) throw error;
    
    // Transform to match frontend format
    return data.map(v => ({
      ...v,
      tags: v.venue_tags.map(t => t.tag)
    }));
  } catch (err) {
    console.error('Error fetching venues:', err.message);
    return [];
  }
}

export async function fetchVenueById(id) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchVenueById returning null.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('venues')
      .select(`
        *,
        venue_tags(tag)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return { ...data, tags: data.venue_tags.map(t => t.tag) };
  } catch (err) {
    console.error('Error fetching venue:', err.message);
    return null;
  }
}

// ========== TOURNAMENTS ==========
export async function fetchTournaments() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchTournaments returning fallback empty array.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) throw error;
    
    // Transform to match frontend format
    return data.map(t => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      format: t.format,
      teams: t.teams,
      status: t.status,
      prize: t.prize,
      regFee: Number(t.reg_fee || 0),
      registrationType: t.registration_type || 'individual',
      slotLockMinutes: Number(t.slot_lock_minutes || 15),
      ageMin: Number(t.age_min || 0),
      ageMax: Number(t.age_max || 0),
      startDate: t.start_date,
      color: getTournamentColor(t.sport, t.color),
      host: t.host,
      participants: t.participants,
      classification: t.classification || 'community',
      operatorType: t.operator_type || 'community',
      isVerified: Boolean(t.is_verified),
      verificationStatus: t.verification_status || (t.is_verified ? 'approved' : 'unverified'),
      verificationBadge: t.verification_badge || null,
      substitutionRules: t.substitution_rules || null,
      bracket_ready: Boolean(t.bracket_ready),
      schedule_ready: Boolean(t.schedule_ready),
      bracket_published_at: t.bracket_published_at || null,
      schedule_published_at: t.schedule_published_at || null,
    }));
  } catch (err) {
    console.error('Error fetching tournaments:', err.message);
    return [];
  }
}

export async function fetchTournamentDetail(tournamentId) {
  try {
    const { data: tournament, error: tourError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();
    if (tourError) throw tourError;

    // Fetch standings
    const { data: standings, error: standError } = await supabase
      .from('tournament_standings')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('pos', { ascending: true });
    if (standError) throw standError;

    // Fetch schedule
    const { data: schedule, error: schedError } = await supabase
      .from('tournament_schedule')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('date', { ascending: false });
    if (schedError) throw schedError;

    return {
      ...tournament,
      startDate: tournament.start_date,
      regFee: Number(tournament.reg_fee || 0),
      registrationType: tournament.registration_type || 'individual',
      slotLockMinutes: Number(tournament.slot_lock_minutes || 15),
      ageMin: Number(tournament.age_min || 0),
      ageMax: Number(tournament.age_max || 0),
      color: getTournamentColor(tournament.sport, tournament.color),
      classification: tournament.classification || 'community',
      operatorType: tournament.operator_type || 'community',
      isVerified: Boolean(tournament.is_verified),
      verificationStatus: tournament.verification_status || (tournament.is_verified ? 'approved' : 'unverified'),
      verificationBadge: tournament.verification_badge || null,
      substitutionRules: tournament.substitution_rules || null,
      standings,
      schedule: schedule.map(s => ({
        date: s.date,
        home: s.home,
        away: s.away,
        score: s.score,
        status: s.status
      }))
    };
  } catch (err) {
    console.error('Error fetching tournament detail:', err.message);
    return null;
  }
}

export async function createTournament(data) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const sportKey = (data.sport || '').toLowerCase();
    const teamSportAliases = new Set([
      'sepakbola', 'football', 'soccer 7', 'soccer7',
      'futsal',
      'basket', 'basketball', 'basketball 3x3', 'basketball3x3',
      'voli', 'volleyball',
      'esports', 'mobile legends', 'pubg mobile', 'valorant', 'efootball', 'ea sports fc'
    ]);
    const isTeamTournament = teamSportAliases.has(sportKey);
    const registrationTypeFromInput = String(data.registrationType || '').trim().toLowerCase();
    const normalizedRegistrationType = ['team', 'individual'].includes(registrationTypeFromInput)
      ? registrationTypeFromInput
      : (isTeamTournament ? 'team' : 'individual');
    const substitutionRules = data.substitutionRules || getSubstitutionPresetForSport(data.sport);
    const basePayload = {
      name: data.name,
      sport: data.sport,
      format: data.format,
      color: getTournamentColor(data.sport, data.color),
      host: data.host || null,
      start_date: data.startDate || null,
      teams: data.maxTeams,
      reg_fee: Number(data.regFee || 0),
      registration_type: normalizedRegistrationType,
      slot_lock_minutes: Number(data.slotLockMinutes || 15),
      age_min: Number(data.ageMin || 0),
      age_max: Number(data.ageMax || 0),
      prize: data.prize,
      status: 'open',
      participants: 0,
      classification: 'community',
      operator_type: 'community',
      is_verified: false,
      verification_status: 'unverified',
    };

    let { data: created, error } = await supabase
      .from('tournaments')
      .insert({
        ...basePayload,
        substitution_rules: substitutionRules,
      })
      .select()
      .single();

    if (error && isMissingSubstitutionRulesColumnError(error)) {
      const retry = await supabase
        .from('tournaments')
        .insert(basePayload)
        .select()
        .single();
      created = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    return { data: created };
  } catch (err) {
    console.error('Error creating tournament:', err.message);
    return { error: err.message };
  }
}

// ========== TOURNAMENT REGISTRATION WORKFLOW ==========
export async function runRegistrationExpirySweep() {
  if (!isSupabaseReady()) return false;
  try {
    const { error } = await supabase.rpc('expire_tournament_registration_slots');
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Registration expiry sweep skipped:', err.message);
    return false;
  }
}

export async function fetchTournamentRegistration(tournamentId, userId) {
  if (!isSupabaseReady() || !tournamentId || !userId) return null;
  try {
    await runRegistrationExpirySweep();
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return null;

    const activeStatuses = new Set(['draft', 'waiting_payment', 'waiting_review', 'approved']);
    const activeRow = rows.find((row) => activeStatuses.has(row.registration_status));
    return activeRow || rows[0];
  } catch (err) {
    console.error('Error fetching tournament registration:', err.message);
    return null;
  }
}

export async function createTournamentRegistration(payload) {
  if (!isSupabaseReady()) {
    return { error: 'Supabase belum dikonfigurasi.' };
  }

  try {
    const existing = await fetchTournamentRegistration(payload.tournamentId, payload.userId);

    const baseFee = Number(payload.baseFee || 0);
    const slotLockMinutes = Number(payload.slotLockMinutes || 15);
    const now = new Date();
    const slotExpiresAt = new Date(now.getTime() + slotLockMinutes * 60 * 1000).toISOString();

    let registrationStatus = 'approved';
    let paymentStatus = 'paid';

    if (payload.registrationType === 'team') {
      if (baseFee > 0) {
        registrationStatus = 'waiting_payment';
        paymentStatus = 'unpaid';
      } else if (payload.requiresReview) {
        registrationStatus = 'waiting_review';
        paymentStatus = 'paid';
      }
    } else if (baseFee > 0) {
      registrationStatus = 'waiting_payment';
      paymentStatus = 'unpaid';
    } else if (payload.requiresReview) {
      registrationStatus = 'waiting_review';
      paymentStatus = 'paid';
    }

    const uniqueTransferAmount = baseFee > 0 ? generateUniqueTransferAmount(baseFee) : 0;

    if (existing) {
      if (!['cancelled', 'rejected'].includes(existing.registration_status)) {
        return { data: existing };
      }

      const { data: revivedRows, error: reviveError } = await supabase
        .from('tournament_registrations')
        .update({
          registrant_name: payload.registrantName,
          registrant_email: payload.registrantEmail,
          registration_type: payload.registrationType || existing.registration_type || 'individual',
          registration_status: registrationStatus,
          payment_status: paymentStatus,
          payment_method: baseFee > 0 ? 'manual_transfer' : null,
          base_fee: baseFee,
          unique_transfer_amount: uniqueTransferAmount,
          payment_amount: null,
          payment_proof_url: null,
          payment_proof_uploaded_at: null,
          payment_notes: null,
          admin_review_status: 'pending',
          admin_notes: null,
          reviewed_by: null,
          reviewed_at: null,
          slot_locked_at: now.toISOString(),
          slot_expires_at: slotExpiresAt,
          lock_released_at: null,
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id)
        .eq('user_id', payload.userId)
        .select('*');

      if (reviveError) throw reviveError;
      return { data: Array.isArray(revivedRows) ? (revivedRows[0] || null) : null };
    }

    const { data: insertedRows, error } = await supabase
      .from('tournament_registrations')
      .insert({
        tournament_id: payload.tournamentId,
        user_id: payload.userId,
        registrant_name: payload.registrantName,
        registrant_email: payload.registrantEmail,
        registration_type: payload.registrationType || 'individual',
        registration_status: registrationStatus,
        payment_status: paymentStatus,
        payment_method: baseFee > 0 ? 'manual_transfer' : null,
        base_fee: baseFee,
        unique_transfer_amount: uniqueTransferAmount,
        slot_locked_at: now.toISOString(),
        slot_expires_at: slotExpiresAt,
      })
      .select('*');

    if (error) throw error;
    return { data: Array.isArray(insertedRows) ? (insertedRows[0] || null) : null };
  } catch (err) {
    console.error('Error creating tournament registration:', err.message);
    return { error: err.message };
  }
}

export async function fetchRegistrationRoster(registrationId) {
  if (!isSupabaseReady() || !registrationId) return [];
  try {
    const { data, error } = await supabase
      .from('tournament_registration_roster')
      .select('*')
      .eq('registration_id', registrationId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching registration roster:', err.message);
    return [];
  }
}

export async function addRegistrationRosterPlayer(payload) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const normalizedIdentifier = String(payload.playerIdentifier || '').trim().toLowerCase();
    if (!normalizedIdentifier) {
      return { error: 'Identifier pemain wajib diisi.' };
    }
    if (!payload.dateOfBirth) {
      return { error: 'Tanggal lahir wajib diisi untuk validasi umur.' };
    }

    const dob = new Date(payload.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return { error: 'Format tanggal lahir tidak valid.' };
    }

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age -= 1;
    }

    const minAge = Number(payload.ageMin || 0);
    const maxAge = Number(payload.ageMax || 0);
    if (minAge > 0 && age < minAge) {
      return { error: `Umur pemain belum memenuhi syarat minimum (${minAge}+).` };
    }
    if (maxAge > 0 && age > maxAge) {
      return { error: `Umur pemain melebihi batas maksimum kategori (${maxAge}).` };
    }

    const { data: duplicateRows, error: dupError } = await supabase
      .from('tournament_registration_roster')
      .select('id, registration_id, tournament_registrations!inner(registration_status)')
      .eq('tournament_id', payload.tournamentId)
      .eq('player_identifier', normalizedIdentifier);

    if (dupError) throw dupError;

    const hasBlockedDuplicate = (duplicateRows || []).some((row) => {
      const statuses = row.tournament_registrations;
      const statusValue = Array.isArray(statuses) ? statuses[0]?.registration_status : statuses?.registration_status;
      return row.registration_id !== payload.registrationId && !['cancelled', 'rejected'].includes(statusValue);
    });

    if (hasBlockedDuplicate) {
      return { error: 'Pemain ini sudah terdaftar di tim lain pada turnamen yang sama.' };
    }

    const { data, error } = await supabase
      .from('tournament_registration_roster')
      .insert({
        registration_id: payload.registrationId,
        tournament_id: payload.tournamentId,
        player_name: payload.playerName,
        player_identifier: normalizedIdentifier,
        date_of_birth: payload.dateOfBirth || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('Error adding roster player:', err.message);
    return { error: err.message };
  }
}

export async function updateRegistrationRosterPlayer(payload) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const updates = {
      player_name: payload.playerName,
      player_identifier: String(payload.playerIdentifier || '').trim().toLowerCase(),
      date_of_birth: payload.dateOfBirth || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('tournament_registration_roster')
      .update(updates)
      .eq('id', payload.rosterId)
      .eq('registration_id', payload.registrationId)
      .select('*')
      .single();

    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('Error updating roster player:', err.message);
    return { error: err.message };
  }
}

export async function deleteRegistrationRosterPlayer(payload) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const { error } = await supabase
      .from('tournament_registration_roster')
      .delete()
      .eq('id', payload.rosterId)
      .eq('registration_id', payload.registrationId);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error('Error deleting roster player:', err.message);
    return { error: err.message };
  }
}

export async function fetchRegistrationRosterBatch(registrationIds) {
  if (!isSupabaseReady()) return {};
  if (!Array.isArray(registrationIds) || registrationIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('tournament_registration_roster')
      .select('*')
      .in('registration_id', registrationIds)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const grouped = {};
    (data || []).forEach((row) => {
      if (!grouped[row.registration_id]) grouped[row.registration_id] = [];
      grouped[row.registration_id].push(row);
    });
    return grouped;
  } catch (err) {
    console.error('Error fetching registration roster batch:', err.message);
    return {};
  }
}

export async function finalizeTeamRegistrationDraft(payload) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const roster = await fetchRegistrationRoster(payload.registrationId);
    const minPlayers = Number(payload.minPlayers || 5);
    if (roster.length < minPlayers) {
      return { error: `Tim belum memenuhi minimum jumlah pemain (${minPlayers}).` };
    }

    const now = new Date();
    const slotLockMinutes = Number(payload.slotLockMinutes || 15);
    const nextSlotExpiresAt = new Date(now.getTime() + slotLockMinutes * 60 * 1000).toISOString();

    let registrationStatus = 'approved';
    let paymentStatus = 'paid';

    if (Number(payload.baseFee || 0) > 0) {
      registrationStatus = 'waiting_payment';
      paymentStatus = 'unpaid';
    } else if (payload.requiresReview) {
      registrationStatus = 'waiting_review';
      paymentStatus = 'paid';
    }

    const { data, error } = await supabase
      .from('tournament_registrations')
      .update({
        registration_status: registrationStatus,
        payment_status: paymentStatus,
        slot_expires_at: nextSlotExpiresAt,
        updated_at: now.toISOString(),
      })
      .eq('id', payload.registrationId)
      .eq('user_id', payload.userId)
      .select('*')
      .single();

    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('Error finalizing team registration draft:', err.message);
    return { error: err.message };
  }
}

export async function uploadTournamentPaymentProofFile(payload) {
  if (!isSupabaseReady() || !payload?.file) {
    return { error: 'File bukti transfer tidak ditemukan.' };
  }

  try {
    const safeName = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${payload.tournamentId}/${payload.userId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase
      .storage
      .from('payment-proofs')
      .upload(objectPath, payload.file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase
      .storage
      .from('payment-proofs')
      .getPublicUrl(objectPath);

    return { data: { path: objectPath, publicUrl: data?.publicUrl || null } };
  } catch (err) {
    console.error('Error uploading payment proof:', err.message);
    return { error: err.message };
  }
}

export async function submitTournamentPaymentProof(payload) {
  if (!isSupabaseReady()) return { error: 'Supabase belum dikonfigurasi.' };
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('tournament_registrations')
      .update({
        payment_status: 'pending',
        registration_status: 'waiting_review',
        payment_proof_url: payload.paymentProofUrl,
        payment_proof_uploaded_at: now,
        payment_amount: Number(payload.paymentAmount || 0),
        payment_notes: payload.paymentNotes || null,
        updated_at: now,
      })
      .eq('id', payload.registrationId)
      .eq('user_id', payload.userId)
      .select('*')
      .single();

    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('Error submitting payment proof:', err.message);
    return { error: err.message };
  }
}

export async function fetchRegistrationReviewQueue() {
  if (!isSupabaseReady()) return [];
  try {
    const allowed = await hasAnyCurrentUserPermission([
      PERMISSIONS.PAYMENT_VERIFY,
      PERMISSIONS.REGISTRATION_APPROVE,
      PERMISSIONS.REGISTRATION_REJECT,
    ]);
    if (!allowed) {
      console.warn('Permission denied: fetchRegistrationReviewQueue requires registration/payment review permission.');
      return [];
    }

    await runRegistrationExpirySweep();
    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('*')
      .or('registration_status.eq.waiting_review,payment_status.eq.pending')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching registration review queue:', err.message);
    return [];
  }
}

export async function reviewTournamentRegistration(payload) {
  if (!isSupabaseReady()) return false;
  try {
    const allowed = await hasAnyCurrentUserPermission([
      PERMISSIONS.PAYMENT_VERIFY,
      PERMISSIONS.REGISTRATION_APPROVE,
      PERMISSIONS.REGISTRATION_REJECT,
    ]);
    if (!allowed) {
      console.warn('Permission denied: reviewTournamentRegistration requires registration/payment review permission.');
      return false;
    }

    const now = new Date().toISOString();
    const decision = payload.decision === 'approved' ? 'approved' : 'rejected';
    const nextRegistrationStatus = decision === 'approved' ? 'approved' : 'rejected';
    const nextPaymentStatus = decision === 'approved' ? 'paid' : 'rejected';

    const { data: updated, error } = await supabase
      .from('tournament_registrations')
      .update({
        registration_status: nextRegistrationStatus,
        payment_status: nextPaymentStatus,
        admin_review_status: decision,
        admin_notes: payload.adminNotes || null,
        reviewed_by: payload.reviewerId || null,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', payload.registrationId)
      .select('*')
      .single();

    if (error) throw error;

    try {
      await supabase.rpc('log_admin_action', {
        p_action: `registration.${decision}`,
        p_target_type: 'tournament_registration',
        p_target_id: String(payload.registrationId),
        p_details: {
          tournament_id: updated.tournament_id,
          user_id: updated.user_id,
          decision,
          payment_status: nextPaymentStatus,
        }
      });
    } catch (auditError) {
      console.warn('Audit log write skipped for registration review:', auditError.message);
    }

    if (decision === 'approved') {
      const { data: existingPlayer } = await supabase
        .from('tournament_players')
        .select('id')
        .eq('tournament_id', updated.tournament_id)
        .eq('user_id', updated.user_id)
        .maybeSingle();

      if (!existingPlayer) {
        await supabase
          .from('tournament_players')
          .insert({
            tournament_id: updated.tournament_id,
            user_id: updated.user_id,
            player_name: updated.registrant_name || 'Player',
            jersey_name: updated.registrant_name || 'Player',
            status: 'active'
          });
      }
    }

    return true;
  } catch (err) {
    console.error('Error reviewing tournament registration:', err.message);
    return false;
  }
}

// ========== NEWS ==========
export async function fetchNews() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchNews returning fallback empty array.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    
    return data.map(n => ({
      ...n,
      read: n.read_time,
      excerpt: n.excerpt
    }));
  } catch (err) {
    console.error('Error fetching news:', err.message);
    return [];
  }
}

export async function fetchNewsById(id) {
  try {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return { ...data, read: data.read_time };
  } catch (err) {
    console.error('Error fetching news:', err.message);
    return null;
  }
}

// ========== COACHES ==========
export async function fetchCoaches() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchCoaches returning fallback empty array.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('coaches')
      .select(`
        *,
        coach_certs(cert),
        coach_extra(bio, location),
        coach_languages(language),
        coach_schedule(schedule_line),
        coach_programs(*)
      `)
      .order('rating', { ascending: false });
    if (error) throw error;
    
    return data.map(c => ({
      ...c,
      exp: c.exp,
      rating: c.rating,
      sessions: c.sessions,
      price: c.price,
      certs: c.coach_certs?.map(ct => ct.cert) || [],
      bio: c.coach_extra?.bio,
      location: c.coach_extra?.location,
      languages: c.coach_languages?.map(l => l.language) || [],
      schedule: c.coach_schedule?.map(s => s.schedule_line) || [],
      programs: c.coach_programs || []
    }));
  } catch (err) {
    console.error('Error fetching coaches:', err.message);
    return [];
  }
}

export async function fetchCoachDetail(coachId) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchCoachDetail returning null.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('coaches')
      .select(`
        *,
        coach_certs(cert),
        coach_extra(bio, location),
        coach_languages(language),
        coach_schedule(schedule_line),
        coach_programs(*)
      `)
      .eq('id', coachId)
      .single();
    if (error) throw error;
    
    return {
      ...data,
      exp: data.exp,
      rating: data.rating,
      sessions: data.sessions,
      price: data.price,
      certs: data.coach_certs.map(c => c.cert),
      bio: data.coach_extra?.[0]?.bio,
      location: data.coach_extra?.[0]?.location,
      languages: data.coach_languages.map(l => l.language),
      schedule: data.coach_schedule.map(s => s.schedule_line),
      programs: data.coach_programs
    };
  } catch (err) {
    console.error('Error fetching coach detail:', err.message);
    return null;
  }
}

// ========== COMMUNITIES ==========
export async function fetchCommunities() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchCommunities returning fallback empty array.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('sport_communities')
      .select('*')
      .order('members_count', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching communities:', err.message);
    return [];
  }
}

export async function fetchCommunityDetail(communityId) {
  if (!isSupabaseReady() || !communityId) return null;

  try {
    const { data, error } = await supabase
      .from('sport_communities')
      .select('*')
      .eq('id', communityId)
      .single();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Error fetching community detail:', err.message);
    return null;
  }
}

export async function fetchUserCommunityMemberships(userId) {
  if (!isSupabaseReady() || !userId) return [];

  try {
    const { data, error } = await supabase
      .from('community_memberships')
      .select('community_id, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching community memberships:', err.message);
    return [];
  }
}

export async function joinCommunity(userId, communityId) {
  if (!isSupabaseReady() || !userId || !communityId) {
    return { success: false, message: 'User atau komunitas tidak valid.' };
  }

  try {
    const { data: existingMembership, error: existingError } = await supabase
      .from('community_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('community_id', communityId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingMembership) {
      return { success: true, alreadyJoined: true, message: 'Kamu sudah bergabung di komunitas ini.' };
    }

    const { data, error } = await supabase
      .from('community_memberships')
      .insert({
        user_id: userId,
        community_id: communityId,
        joined_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data, message: 'Berhasil bergabung ke komunitas.' };
  } catch (err) {
    console.error('Error joining community:', err.message);
    return { success: false, message: err.message || 'Gagal bergabung ke komunitas.' };
  }
}

export async function fetchCommunityFeedPosts(communityId) {
  if (!isSupabaseReady() || !communityId) return [];

  try {
    const { data, error } = await supabase
      .from('community_feed_posts')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching community feed posts:', err.message);
    return [];
  }
}

export async function fetchCommunityEvents(communityId) {
  if (!isSupabaseReady() || !communityId) return [];

  try {
    const { data, error } = await supabase
      .from('community_events')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching community events:', err.message);
    return [];
  }
}

export async function fetchCommunityChatMessages(communityId) {
  if (!isSupabaseReady() || !communityId) return [];

  try {
    const { data, error } = await supabase
      .from('community_chat_messages')
      .select('*')
      .eq('community_id', communityId)
      .order('sent_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching community chat messages:', err.message);
    return [];
  }
}

export async function bookAcademyTrial(payload) {
  if (!isSupabaseReady() || !payload?.academyName) {
    return { success: false, message: 'Data trial belum lengkap.' };
  }

  try {
    const { data, error } = await supabase
      .from('academy_trial_bookings')
      .insert({
        user_id: payload.userId || null,
        academy_name: payload.academyName,
        academy_city: payload.academyCity || null,
        participant_name: payload.participantName || null,
        participant_age: payload.participantAge || null,
        trial_date: payload.trialDate || null,
        trial_time: payload.trialTime || null,
        contact_number: payload.contactNumber || null,
        notes: payload.notes || null,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw error;
    return { success: true, data, message: 'Booking trial berhasil dikirim.' };
  } catch (err) {
    console.error('Error booking academy trial:', err.message);
    return { success: false, message: err.message || 'Gagal booking trial.' };
  }
}

// ========== CHATS ==========
export async function fetchChats() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchChats returning fallback empty array.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .select(`
        *,
        chat_messages(sender, text, time)
      `)
      .order('time', { ascending: false });
    if (error) throw error;
    
    return data.map(c => ({
      ...c,
      lastMsg: c.last_msg,
      messages: c.chat_messages.map(m => ({
        from: m.sender === 'coach' ? 'coach' : 'me',
        text: m.text,
        time: m.time
      }))
    }));
  } catch (err) {
    console.error('Error fetching chats:', err.message);
    return [];
  }
}

export async function fetchChatMessages(chatId) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('message_id', { ascending: true });
    if (error) throw error;
    
    return data.map(m => ({
      from: m.sender === 'coach' ? 'coach' : 'me',
      text: m.text,
      time: m.time
    }));
  } catch (err) {
    console.error('Error fetching messages:', err.message);
    return [];
  }
}

// ========== INSERT/UPDATE OPERATIONS ==========
export async function insertChatMessage(chatId, sender, text, time) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{
        chat_id: chatId,
        sender,
        text,
        time
      }]);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error inserting message:', err.message);
    return null;
  }
}

export async function updateChatLastMessage(chatId, lastMsg, time) {
  try {
    const { error } = await supabase
      .from('chats')
      .update({
        last_msg: lastMsg,
        time
      })
      .eq('id', chatId);
    if (error) throw error;
  } catch (err) {
    console.error('Error updating chat:', err.message);
  }
}

// ========== TOURNAMENT VERIFICATION WORKFLOW ==========
export async function updateTournamentClassificationStatus(tournamentId, classification) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: updateTournamentClassificationStatus skipped.');
    return false;
  }

  try {
    const { error } = await supabase
      .from('tournaments')
      .update({ classification })
      .eq('id', tournamentId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating tournament classification:', err.message);
    return false;
  }
}

export async function publishTournamentStage(tournamentId, stage) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: publishTournamentStage skipped.');
    return false;
  }

  if (!tournamentId || !['bracket', 'schedule'].includes(stage)) {
    return false;
  }

  const flagColumn = stage === 'bracket' ? 'bracket_ready' : 'schedule_ready';
  const timeColumn = stage === 'bracket' ? 'bracket_published_at' : 'schedule_published_at';
  const now = new Date().toISOString();

  try {
    let { error } = await supabase
      .from('tournaments')
      .update({
        [flagColumn]: true,
        [timeColumn]: now,
      })
      .eq('id', tournamentId);

    if (!error) return true;

    if (!isMissingColumnError(error, timeColumn)) {
      throw error;
    }

    ({ error } = await supabase
      .from('tournaments')
      .update({ [flagColumn]: true })
      .eq('id', tournamentId));

    if (!error) return true;
    throw error;
  } catch (err) {
    console.error(`Error publishing tournament ${stage}:`, err.message);
    return false;
  }
}

export async function unpublishTournamentStage(tournamentId, stage) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: unpublishTournamentStage skipped.');
    return false;
  }

  if (!tournamentId || !['bracket', 'schedule'].includes(stage)) {
    return false;
  }

  const flagColumn = stage === 'bracket' ? 'bracket_ready' : 'schedule_ready';
  const timeColumn = stage === 'bracket' ? 'bracket_published_at' : 'schedule_published_at';

  try {
    let { error } = await supabase
      .from('tournaments')
      .update({
        [flagColumn]: false,
        [timeColumn]: null,
      })
      .eq('id', tournamentId);

    if (!error) return true;

    if (!isMissingColumnError(error, timeColumn)) {
      throw error;
    }

    ({ error } = await supabase
      .from('tournaments')
      .update({ [flagColumn]: false })
      .eq('id', tournamentId));

    if (!error) return true;
    throw error;
  } catch (err) {
    console.error(`Error unpublishing tournament ${stage}:`, err.message);
    return false;
  }
}

export async function submitTournamentVerificationRequest(payload) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: submitTournamentVerificationRequest skipped.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('tournament_operator_verification_requests')
      .insert([{
        tournament_id: payload.tournamentId,
        requester_user_id: payload.requesterUserId,
        requester_name: payload.requesterName,
        requester_email: payload.requesterEmail,
        operator_type: payload.operatorType || 'community',
        requested_classification: payload.requestedClassification || 'community',
        documents: payload.documents || {},
        status: 'pending'
      }])
      .select('*')
      .single();

    if (error) throw error;

    // Keep tournament verification status in sync with latest request.
    const { error: tournamentUpdateError } = await supabase
      .from('tournaments')
      .update({ verification_status: 'pending' })
      .eq('id', payload.tournamentId);

    if (tournamentUpdateError) {
      console.error('Error updating tournament verification status:', tournamentUpdateError.message);
    }

    return data;
  } catch (err) {
    console.error('Error submitting tournament verification request:', err.message);
    return null;
  }
}

export async function fetchTournamentVerificationRequests(tournamentId) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchTournamentVerificationRequests returning fallback empty array.');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('tournament_operator_verification_requests')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching tournament verification requests:', err.message);
    return [];
  }
}

export async function fetchVerificationQueue() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchVerificationQueue returning fallback empty array.');
    return [];
  }

  try {
    const allowed = await hasAnyCurrentUserPermission([PERMISSIONS.OPERATOR_VERIFY]);
    if (!allowed) {
      console.warn('Permission denied: fetchVerificationQueue requires operator verification permission.');
      return [];
    }

    const { data, error } = await supabase
      .from('tournament_operator_verification_requests')
      .select('*')
      .in('status', ['pending', 'under_review'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching verification queue:', err.message);
    return [];
  }
}

export async function submitVenueRegistrationRequest(payload) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: submitVenueRegistrationRequest skipped.');
    return null;
  }

  const ownerUserId = payload?.ownerUserId;
  if (!ownerUserId) return null;

  try {
    const nextVenueId = await getNextVenueId();
    if (!nextVenueId) return null;

    const venueInput = {
      id: nextVenueId,
      name: payload.name,
      city: payload.city,
      province: payload.province,
      address: payload.address,
      contact_number: payload.contactNumber,
      maps_url: payload.mapsUrl,
      description: payload.description || null,
      sport: payload.sport || 'Futsal',
      owner_user_id: ownerUserId,
      verification_status: 'pending',
      is_active: false,
    };

    const { data: existingVenue, error: existingVenueError } = await supabase
      .from('venues')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();

    if (existingVenueError) throw existingVenueError;

    let venueId = existingVenue?.id;

    if (venueId) {
      const { error: updateVenueError } = await supabase
        .from('venues')
        .update(venueInput)
        .eq('id', venueId);

      if (updateVenueError) throw updateVenueError;
    } else {
      const { data: createdVenue, error: createVenueError } = await supabase
        .from('venues')
        .insert([venueInput])
        .select('id')
        .single();

      if (createVenueError) throw createVenueError;
      venueId = createdVenue?.id;
    }

    if (!venueId) return null;

    const { data, error } = await supabase
      .from('venue_verification')
      .insert([{
        venue_id: venueId,
        submitted_by: ownerUserId,
        verification_type: payload.verificationType || 'individual',
        ktp_url: payload.ktpUrl || null,
        selfie_url: payload.selfieUrl || null,
        nib_url: payload.nibUrl || null,
        npwp_url: payload.npwpUrl || null,
        legalitas_url: payload.legalitasUrl || null,
        notes: payload.notes || null,
        status: 'pending',
      }])
      .select('*')
      .single();

    if (error) throw error;
    return { venueId, verification: data };
  } catch (err) {
    console.error('Error submitting venue registration request:', err.message);
    return null;
  }
}

export async function fetchVenueVerificationRequestsByUser(userId) {
  if (!isSupabaseReady() || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('venue_verification')
      .select('*, venues(id, name, city, verification_status, is_active)')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching venue verification requests:', err.message);
    return [];
  }
}

export async function fetchCurrentUserRoles() {
  const profiles = await fetchCurrentUserRoleProfiles();
  return normalizeRoles((profiles || []).map((profile) => profile.role).filter(Boolean));
}

export async function fetchCurrentUserRoleProfiles() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchCurrentUserRoleProfiles returning fallback empty array.');
    return [];
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const userId = authData?.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from('user_roles')
      .select('role, app_roles(role, display_name, parent_role, hierarchy_level, scope_type)')
      .eq('user_id', userId);

    if (error) throw error;

    const normalizedProfiles = (data || []).reduce((acc, row) => {
      const normalizedRole = normalizeRoles([row?.role])[0];
      if (!normalizedRole) return acc;

      const roleMeta = Array.isArray(row?.app_roles)
        ? row.app_roles[0]
        : row?.app_roles;

      const existing = acc.find((entry) => entry.role === normalizedRole);
      if (existing) return acc;

      acc.push({
        role: normalizedRole,
        displayName: String(roleMeta?.display_name || '').trim(),
        parentRole: String(roleMeta?.parent_role || '').trim(),
        hierarchyLevel: roleMeta?.hierarchy_level ?? null,
        scopeType: String(roleMeta?.scope_type || '').trim(),
      });
      return acc;
    }, []);

    return normalizedProfiles;
  } catch (err) {
    console.error('Error fetching current user role profiles:', err.message);
    return [];
  }
}

export async function fetchCurrentUserActiveContext() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchCurrentUserActiveContext returning null.');
    return null;
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const userId = authData?.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from('user_active_workspace_context')
      .select('context_scope, context_role, context_entity_type, context_entity_id, context_label, metadata, switched_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Error fetching current user active context:', err.message);
    return null;
  }
}

export async function switchCurrentUserActiveContext(payload = {}) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: switchCurrentUserActiveContext skipped.');
    return null;
  }

  try {
    const {
      scope,
      role = null,
      entityType = null,
      entityId = null,
      label = null,
      reason = null,
      metadata = {},
    } = payload;

    const { error } = await supabase.rpc('set_active_workspace_context', {
      p_scope: scope,
      p_role: role,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_label: label,
      p_reason: reason,
      p_metadata: metadata,
    });

    if (error) throw error;
    return await fetchCurrentUserActiveContext();
  } catch (err) {
    console.error('Error switching active workspace context:', err.message);
    return null;
  }
}

export async function fetchCurrentUserPermissions() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchCurrentUserPermissions returning fallback empty array.');
    return [];
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    const userId = authData?.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase.rpc('get_current_user_permissions');
    if (error) throw error;

    const deduped = new Set((data || []).map((row) => row.permission).filter(Boolean));
    const permissions = Array.from(deduped);
    if (permissions.length > 0) return permissions;

    const currentRoles = await fetchCurrentUserRoles();
    return derivePermissionsFromRoles(currentRoles);
  } catch (err) {
    console.error('Error fetching current user permissions:', err.message);
    const currentRoles = await fetchCurrentUserRoles();
    return derivePermissionsFromRoles(currentRoles);
  }
}

export async function reviewTournamentVerificationRequest(payload) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: reviewTournamentVerificationRequest skipped.');
    return false;
  }

  const decision = payload.decision === 'approved' ? 'approved' : 'rejected';
  const badgeByOperatorType = {
    federation: 'Verified Federation',
    eo: 'Verified EO',
    academy: 'Verified Academy',
    community: 'Community Host'
  };

  try {
    const allowed = await hasAnyCurrentUserPermission([PERMISSIONS.OPERATOR_VERIFY]);
    if (!allowed) {
      console.warn('Permission denied: reviewTournamentVerificationRequest requires operator verification permission.');
      return false;
    }

    const now = new Date().toISOString();
    const { error: requestError } = await supabase
      .from('tournament_operator_verification_requests')
      .update({
        status: decision,
        admin_notes: payload.adminNotes || null,
        reviewed_by: payload.reviewerId || null,
        reviewed_at: now,
        updated_at: now
      })
      .eq('id', payload.requestId);

    if (requestError) throw requestError;

    const tournamentUpdate = decision === 'approved'
      ? {
          is_verified: true,
          verification_status: 'approved',
          operator_type: payload.operatorType || 'community',
          classification: payload.requestedClassification || 'community',
          verification_badge: badgeByOperatorType[payload.operatorType] || 'Verified',
          verification_reviewed_at: now
        }
      : {
          is_verified: false,
          verification_status: 'rejected',
          verification_reviewed_at: now
        };

    const { error: tournamentError } = await supabase
      .from('tournaments')
      .update(tournamentUpdate)
      .eq('id', payload.tournamentId);

    if (tournamentError) throw tournamentError;

    try {
      await supabase.rpc('log_admin_action', {
        p_action: `verification.${decision}`,
        p_target_type: 'tournament_verification_request',
        p_target_id: String(payload.requestId),
        p_details: {
          tournament_id: payload.tournamentId,
          decision,
          operator_type: payload.operatorType || 'community',
          requested_classification: payload.requestedClassification || 'community',
        }
      });
    } catch (auditError) {
      console.warn('Audit log write skipped for verification review:', auditError.message);
    }

    return true;
  } catch (err) {
    console.error('Error reviewing tournament verification request:', err.message);
    return false;
  }
}

export async function fetchVenueVerificationQueue() {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: fetchVenueVerificationQueue returning fallback empty array.');
    return [];
  }

  try {
    const allowed = await hasAnyCurrentUserPermission([PERMISSIONS.OPERATOR_VERIFY]);
    if (!allowed) {
      console.warn('Permission denied: fetchVenueVerificationQueue requires operator verification permission.');
      return [];
    }

    const { data, error } = await supabase
      .from('venue_verification')
      .select('*, venues(id, name, city, verification_status, is_active, owner_user_id)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching venue verification queue:', err.message);
    return [];
  }
}

export async function reviewVenueVerificationRequest(payload) {
  if (!isSupabaseReady()) {
    console.warn('Supabase client not configured: reviewVenueVerificationRequest skipped.');
    return false;
  }

  const decision = payload.decision === 'approved' ? 'approved' : 'rejected';

  try {
    const allowed = await hasAnyCurrentUserPermission([PERMISSIONS.OPERATOR_VERIFY]);
    if (!allowed) {
      console.warn('Permission denied: reviewVenueVerificationRequest requires operator verification permission.');
      return false;
    }

    const now = new Date().toISOString();
    const { error: requestError } = await supabase
      .from('venue_verification')
      .update({
        status: decision,
        notes: payload.adminNotes || null,
        reviewed_by: payload.reviewerId || null,
        reviewed_at: now,
      })
      .eq('id', payload.requestId);

    if (requestError) throw requestError;

    const { error: venueError } = await supabase
      .from('venues')
      .update(decision === 'approved'
        ? { verification_status: 'verified', is_active: true }
        : { verification_status: 'rejected', is_active: false })
      .eq('id', payload.venueId);

    if (venueError) throw venueError;

    try {
      await supabase.rpc('log_admin_action', {
        p_action: `venue_verification.${decision}`,
        p_target_type: 'venue_verification_request',
        p_target_id: String(payload.requestId),
        p_details: {
          venue_id: payload.venueId,
          decision,
        }
      });
    } catch (auditError) {
      console.warn('Audit log write skipped for venue verification review:', auditError.message);
    }

    return true;
  } catch (err) {
    console.error('Error reviewing venue verification request:', err.message);
    return false;
  }
}

export async function fetchOfficialProfile(userId) {
  if (!isSupabaseReady() || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('official_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Error fetching official profile:', err.message);
    return null;
  }
}

export async function fetchOfficialAssignments({ userId, status = 'all', throwOnError = false } = {}) {
  if (!isSupabaseReady() || !userId) return [];

  try {
    let query = supabase
      .from('match_assignments')
      .select('id,tournament_id,match_entry_id,display_name,role,status,venue,notes,assigned_at,updated_at,source_type,venue_tournament_id,venue_match_id')
      .eq('user_id', userId)
      .order('assigned_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const assignments = data || [];
    if (assignments.length === 0) return [];

    const normalizedAssignments = assignments.map((item) => ({
      ...item,
      source_type: item.source_type || 'tournament',
    }));

    const tournamentIds = [...new Set(normalizedAssignments
      .filter((item) => item.source_type === 'tournament')
      .map((item) => item.tournament_id)
      .filter(Boolean))];
    const venueTournamentIds = [...new Set(normalizedAssignments
      .filter((item) => item.source_type === 'venue_tournament')
      .map((item) => item.venue_tournament_id)
      .filter(Boolean))];
    const venueMatchIds = [...new Set(normalizedAssignments
      .filter((item) => item.source_type === 'venue_tournament')
      .map((item) => item.venue_match_id)
      .filter(Boolean))];

    let tournamentMap = {};
    if (tournamentIds.length > 0) {
      const { data: tournaments, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id,name,sport')
        .in('id', tournamentIds);

      if (tournamentError) throw tournamentError;
      tournamentMap = (tournaments || []).reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});
    }

    let venueTournamentMap = {};
    if (venueTournamentIds.length > 0) {
      const { data: venueTournaments, error: venueTournamentError } = await supabase
        .from('venue_tournaments')
        .select('id,name,sport_type')
        .in('id', venueTournamentIds);

      if (venueTournamentError) throw venueTournamentError;
      venueTournamentMap = (venueTournaments || []).reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});
    }

    let venueMatchMap = {};
    let courtMap = {};
    if (venueMatchIds.length > 0) {
      const { data: venueMatches, error: venueMatchError } = await supabase
        .from('venue_tournament_matches')
        .select('id,round_name,scheduled_date,scheduled_time,court_id')
        .in('id', venueMatchIds);

      if (venueMatchError) throw venueMatchError;
      venueMatchMap = (venueMatches || []).reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});

      const courtIds = [...new Set((venueMatches || []).map((item) => item.court_id).filter(Boolean))];
      if (courtIds.length > 0) {
        const { data: courts, error: courtsError } = await supabase
          .from('venue_courts')
          .select('id,name')
          .in('id', courtIds);

        if (courtsError) throw courtsError;
        courtMap = (courts || []).reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
      }
    }

    return normalizedAssignments.map((item) => {
      if (item.source_type === 'venue_tournament') {
        const venueTournament = venueTournamentMap[item.venue_tournament_id] || null;
        const venueMatch = venueMatchMap[item.venue_match_id] || null;
        const court = courtMap[venueMatch?.court_id] || null;
        const venueLabel = item.venue
          || (venueMatch?.scheduled_date
            ? `${new Date(venueMatch.scheduled_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}${venueMatch?.scheduled_time ? ` · ${String(venueMatch.scheduled_time).slice(0, 5)}` : ''}${court?.name ? ` · ${court.name}` : ''}`
            : (court?.name || 'Venue match venue'));

        return {
          ...item,
          tournament_name: venueTournament?.name || item.display_name || 'Turnamen Venue',
          tournament_sport: venueTournament?.sport_type || '',
          source_label: 'Venue Tournament',
          source_ready: true,
          venue: venueLabel,
          round_name: venueMatch?.round_name || null,
        };
      }

      return {
        ...item,
        tournament_name: tournamentMap[item.tournament_id]?.name || 'Turnamen',
        tournament_sport: tournamentMap[item.tournament_id]?.sport || '',
        source_label: 'Tournament',
        source_ready: true,
      };
    });
  } catch (err) {
    console.error('Error fetching official assignments:', err.message);
    if (throwOnError) throw err;
    return [];
  }
}

export async function fetchOfficialAssignmentDetail({ assignmentId, userId } = {}) {
  if (!isSupabaseReady() || !assignmentId || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('match_assignments')
      .select('*')
      .eq('id', assignmentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Error fetching official assignment detail:', err.message);
    return null;
  }
}

export async function updateOfficialAssignmentStatus({ assignmentId, userId, status, throwOnError = false } = {}) {
  if (!isSupabaseReady() || !assignmentId || !userId || !status) return false;

  const allowedStatuses = ['assigned', 'confirmed', 'completed', 'cancelled', 'declined'];
  if (!allowedStatuses.includes(status)) return false;

  try {
    const { error } = await supabase
      .from('match_assignments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', assignmentId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating official assignment status:', err.message);
    if (throwOnError) throw err;
    return false;
  }
}

// ========== USER ACTIVITY HISTORY ==========

export async function fetchUserActivityHistory(userId, options = {}) {
  if (!isSupabaseReady() || !userId) return [];
  const { limit = 50, type = null, status = null } = options;
  let activityData = [];
  let fallbackTrivia = [];
  let fallbackFromQuiz = [];
  let fallbackFromLegacy = [];

  try {
    let query = supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('activity_date', { ascending: false })
      .limit(limit);

    if (type) query = query.eq('activity_type', type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching user activity history from log:', error.message);
    } else {
      activityData = data || [];
    }
  } catch (err) {
    console.error('Error fetching user activity history from log:', err.message);
  }

  const allowTriviaFallback = !type || type === 'article_read';

  if (allowTriviaFallback) {
    try {
      let progressRows = [];
      const { data: progressWithTimestamp, error: progressWithTimestampError } = await supabase
        .from('article_progress')
        .select('article_id, read_completed, quiz_attempted, updated_at')
        .eq('user_id', userId)
        .or('quiz_attempted.eq.true,read_completed.eq.true')
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (progressWithTimestampError) {
        const { data: progressWithoutTimestamp, error: progressWithoutTimestampError } = await supabase
          .from('article_progress')
          .select('article_id, read_completed, quiz_attempted')
          .eq('user_id', userId)
          .or('quiz_attempted.eq.true,read_completed.eq.true')
          .limit(limit);

        if (progressWithoutTimestampError) {
          console.error('Error fetching trivia fallback history:', progressWithoutTimestampError.message);
        } else {
          progressRows = progressWithoutTimestamp || [];
        }
      } else {
        progressRows = progressWithTimestamp || [];
      }

      fallbackTrivia = (progressRows || []).map((row, index) => ({
        id: `fallback-trivia-${row.article_id || 'unknown'}-${index}`,
        user_id: userId,
        activity_type: 'article_read',
        activity_category: 'Trivia',
        activity_title: row.quiz_attempted ? 'Trivia diselesaikan' : 'Artikel selesai dibaca',
        activity_description: row.quiz_attempted
          ? 'Trivia untuk artikel ini sudah diselesaikan'
          : 'Progress artikel sudah selesai dibaca',
        activity_metadata: { articleId: row.article_id, source: 'article_progress_fallback' },
        status: 'completed',
        is_completed: true,
        activity_date: row.updated_at || new Date().toISOString(),
      }));

      const { data: quizRows, error: quizError } = await supabase
        .from('quiz_results')
        .select('id, article_id, answered_at, is_correct')
        .eq('user_id', userId)
        .order('answered_at', { ascending: false })
        .limit(limit);

      if (quizError) {
        console.error('Error fetching quiz fallback history:', quizError.message);
      } else {
        fallbackFromQuiz = (quizRows || []).map((row, index) => ({
          id: `fallback-quiz-${row.id || row.article_id || index}`,
          user_id: userId,
          activity_type: 'article_read',
          activity_category: 'Trivia',
          activity_title: 'Trivia diselesaikan',
          activity_description: row.is_correct ? 'Trivia sudah dikerjakan dengan jawaban benar' : 'Trivia sudah dikerjakan',
          activity_metadata: { articleId: row.article_id, source: 'quiz_results_fallback' },
          status: 'completed',
          is_completed: true,
          activity_date: row.answered_at || new Date().toISOString(),
        }));
      }

      const { data: legacyRows, error: legacyError } = await supabase
        .from('activity_log')
        .select('id, activity_type, points_earned, reference_id, created_at')
        .eq('user_id', userId)
        .in('activity_type', ['trivia_correct', 'article_read'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (legacyError) {
        console.error('Error fetching legacy activity fallback:', legacyError.message);
      } else {
        fallbackFromLegacy = (legacyRows || []).map((row, index) => ({
          id: `fallback-legacy-${row.id || index}`,
          user_id: userId,
          activity_type: 'article_read',
          activity_category: 'Trivia',
          activity_title: 'Trivia diselesaikan',
          activity_description: `Aktivitas trivia tercatat (${Number(row.points_earned || 0)} poin)`,
          activity_metadata: {
            source: 'legacy_activity_log_fallback',
            referenceId: row.reference_id,
            points: Number(row.points_earned || 0),
          },
          status: 'completed',
          is_completed: true,
          activity_date: row.created_at || new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.error('Error building trivia fallback history:', err.message);
    }
  }

  if (status === 'running') {
    return mergeActivityHistory(
      activityData,
      fallbackTrivia,
      fallbackFromQuiz,
      fallbackFromLegacy,
      readPendingActivities(userId),
    )
      .filter((item) => item.status === 'active' && !item.is_completed)
      .slice(0, limit);
  }
  if (status === 'completed') {
    return mergeActivityHistory(
      activityData,
      fallbackTrivia,
      fallbackFromQuiz,
      fallbackFromLegacy,
      readPendingActivities(userId),
    )
      .filter((item) => item.is_completed || item.status === 'completed')
      .slice(0, limit);
  }

  const merged = mergeActivityHistory(
    activityData,
    fallbackTrivia,
    fallbackFromQuiz,
    fallbackFromLegacy,
    readPendingActivities(userId),
  )
    .slice(0, limit);
  return merged;
}

export async function fetchUserVenueBookings(userId) {
  if (!isSupabaseReady() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_venue_bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching user venue bookings:', err.message);
    return [];
  }
}

export async function fetchUserArticlesRead(userId) {
  if (!isSupabaseReady() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_articles_read')
      .select('*')
      .eq('user_id', userId)
      .order('read_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching user articles read:', err.message);
    return [];
  }
}

export async function fetchUserTournamentParticipations(userId) {
  if (!isSupabaseReady() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_tournament_participations')
      .select('*')
      .eq('user_id', userId)
      .order('registration_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching user tournament participations:', err.message);
    return [];
  }
}

export async function fetchUserCommunityMembershipsLog(userId) {
  if (!isSupabaseReady() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_community_memberships_log')
      .select('*')
      .eq('user_id', userId)
      .order('joined_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching user community memberships log:', err.message);
    return [];
  }
}

export async function fetchUserTrainingEnrollments(userId) {
  if (!isSupabaseReady() || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_training_enrollments')
      .select('*')
      .eq('user_id', userId)
      .order('enrollment_date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching user training enrollments:', err.message);
    return [];
  }
}

export async function recordActivityToLog(userId, payload) {
  if (!userId) return { error: 'Invalid user' };
  if (!isSupabaseReady()) {
    appendPendingActivity(userId, payload || {});
    return { error: 'Supabase not ready', pendingSaved: true };
  }
  try {
    const { data, error } = await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        activity_type: payload.type,
        activity_category: payload.category,
        activity_title: payload.title,
        activity_description: payload.description,
        activity_metadata: payload.metadata || {},
        status: payload.status || 'active',
        is_completed: payload.isCompleted || false,
        activity_date: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { data };
  } catch (err) {
    if (isRlsDeniedError(err)) {
      console.warn('RLS blocked user_activity_log insert, fallback ke local pending queue.');
    } else {
      console.error('Error recording activity to log:', err.message);
    }
    appendPendingActivity(userId, payload || {});
    return { error: err.message, pendingSaved: true };
  }
}

export async function recordVenueBooking(userId, payload) {
  if (!userId) return { error: 'Invalid user' };

  const logPayload = {
    type: 'venue_booking',
    category: payload.sport,
    title: `Booking Lapangan: ${payload.venueName}`,
    description: `Booking ${payload.venueName} untuk ${payload.bookingDate} pukul ${payload.bookingTime}`,
    metadata: {
      venueId: payload.venueId,
      venueName: payload.venueName,
      venueCity: payload.venueCity,
      bookingDate: payload.bookingDate,
      bookingTime: payload.bookingTime,
      paymentMethod: payload.paymentMethod,
      totalPaid: payload.totalPaid,
    },
    status: 'active',
  };

  if (!isSupabaseReady()) {
    const fallback = await recordActivityToLog(userId, logPayload);
    return { error: 'Supabase not ready', fallback: true, pendingSaved: Boolean(fallback?.pendingSaved) };
  }

  try {
    const { data, error } = await supabase
      .from('user_venue_bookings')
      .insert({
        user_id: userId,
        venue_id: payload.venueId,
        venue_name: payload.venueName,
        venue_city: payload.venueCity,
        booking_date: payload.bookingDate,
        booking_time: payload.bookingTime,
        duration_hours: payload.durationHours || 1,
        sport: payload.sport,
        status: payload.status || 'confirmed'
      })
      .select()
      .single();

    if (error) {
      if (isRlsDeniedError(error)) {
        const fallback = await recordActivityToLog(userId, logPayload);
        if (fallback?.data || fallback?.pendingSaved) {
          console.warn('RLS blocked user_venue_bookings insert, fallback ke riwayat aktivitas.');
          return { data: null, fallback: true, pendingSaved: Boolean(fallback?.pendingSaved) };
        }
      }
      throw error;
    }

    // Also record to activity log
    await recordActivityToLog(userId, logPayload);

    return { data };
  } catch (err) {
    if (isRlsDeniedError(err)) {
      const fallback = await recordActivityToLog(userId, logPayload);
      if (fallback?.data || fallback?.pendingSaved) {
        console.warn('RLS blocked venue booking logging, fallback ke riwayat aktivitas.');
        return { data: null, fallback: true, pendingSaved: Boolean(fallback?.pendingSaved) };
      }
    }

    console.error('Error recording venue booking:', err.message);
    return { error: err.message };
  }
}

export async function recordArticleRead(userId, payload) {
  if (!isSupabaseReady() || !userId) return { error: 'Invalid user or Supabase not ready' };
  try {
    const { data, error } = await supabase
      .from('user_articles_read')
      .insert({
        user_id: userId,
        article_id: payload.articleId,
        article_title: payload.articleTitle,
        article_category: payload.articleCategory,
        read_duration_seconds: payload.readDurationSeconds || 0,
        completion_percentage: payload.completionPercentage || 100
      })
      .select()
      .single();

    if (error) throw error;

    // Also record to activity log
    await recordActivityToLog(userId, {
      type: 'article_read',
      category: payload.articleCategory,
      title: `Trivia: ${payload.articleTitle}`,
      description: `Trivia untuk artikel ${payload.articleTitle} sudah diselesaikan`,
      metadata: { 
        articleId: payload.articleId,
        articleTitle: payload.articleTitle
      },
      status: 'completed',
      isCompleted: true
    });

    return { data };
  } catch (err) {
    console.error('Error recording article read:', err.message);
    return { error: err.message };
  }
}

export async function recordTournamentParticipation(userId, payload) {
  if (!isSupabaseReady() || !userId) return { error: 'Invalid user or Supabase not ready' };
  const logPayload = {
    type: 'tournament_participation',
    category: payload.sport,
    title: `Joined Tournament: ${payload.tournamentName}`,
    description: `Mengikuti turnamen ${payload.tournamentName}`,
    metadata: {
      tournamentId: payload.tournamentId,
      tournamentName: payload.tournamentName,
    },
    status: payload.status || 'active',
  };

  try {
    const { data, error } = await supabase
      .from('user_tournament_participations')
      .insert({
        user_id: userId,
        tournament_id: payload.tournamentId,
        tournament_name: payload.tournamentName,
        sport: payload.sport,
        registration_type: payload.registrationType || 'individual',
        registration_status: payload.registrationStatus || 'registered',
        tournament_start_date: payload.tournamentStartDate,
        status: payload.status || 'registered'
      })
      .select()
      .single();

    if (error) {
      if (isRlsDeniedError(error)) {
        const fallback = await recordActivityToLog(userId, logPayload);
        if (fallback?.data) {
          console.warn('RLS blocked user_tournament_participations insert, fallback ke user_activity_log.');
          return { data: null, fallback: true, pendingSaved: false };
        }
        if (fallback?.pendingSaved) {
          console.warn('RLS blocked user_tournament_participations insert, fallback ke local pending queue.');
          return { data: null, fallback: true, pendingSaved: Boolean(fallback?.pendingSaved) };
        }
      }
      throw error;
    }

    // Also record to activity log
    await recordActivityToLog(userId, logPayload);

    return { data };
  } catch (err) {
    if (isRlsDeniedError(err)) {
      const fallback = await recordActivityToLog(userId, logPayload);
      if (fallback?.data) {
        console.warn('RLS blocked tournament participation logging, fallback ke user_activity_log.');
        return { data: null, fallback: true, pendingSaved: false };
      }
      if (fallback?.pendingSaved) {
        console.warn('RLS blocked tournament participation logging, fallback ke local pending queue.');
        return { data: null, fallback: true, pendingSaved: Boolean(fallback?.pendingSaved) };
      }
    }

    console.error('Error recording tournament participation:', err.message);
    return { error: err.message };
  }
}

export async function recordCommunityMembership(userId, payload) {
  if (!isSupabaseReady() || !userId) return { error: 'Invalid user or Supabase not ready' };
  try {
    const { data, error } = await supabase
      .from('user_community_memberships_log')
      .insert({
        user_id: userId,
        community_id: payload.communityId,
        community_name: payload.communityName,
        sport: payload.sport,
        status: payload.status || 'active'
      })
      .select()
      .single();

    if (error) throw error;

    // Also record to activity log
    await recordActivityToLog(userId, {
      type: 'community_join',
      category: payload.sport,
      title: `Joined Community: ${payload.communityName}`,
      description: `Bergabung dengan komunitas ${payload.communityName}`,
      metadata: { 
        communityId: payload.communityId,
        communityName: payload.communityName
      },
      status: 'active'
    });

    return { data };
  } catch (err) {
    console.error('Error recording community membership:', err.message);
    return { error: err.message };
  }
}

export async function recordTrainingEnrollment(userId, payload) {
  if (!isSupabaseReady() || !userId) return { error: 'Invalid user or Supabase not ready' };
  try {
    const { data, error } = await supabase
      .from('user_training_enrollments')
      .insert({
        user_id: userId,
        academy_id: payload.academyId,
        academy_name: payload.academyName,
        academy_city: payload.academyCity,
        program_name: payload.programName,
        sport: payload.sport,
        status: payload.status || 'enrolled',
        total_classes: payload.totalClasses || 0
      })
      .select()
      .single();

    if (error) throw error;

    // Also record to activity log
    await recordActivityToLog(userId, {
      type: 'training_enrollment',
      category: payload.sport,
      title: `Enrolled in: ${payload.programName}`,
      description: `Mendaftar program pelatihan ${payload.programName} di ${payload.academyName}`,
      metadata: { 
        academyId: payload.academyId,
        academyName: payload.academyName,
        programName: payload.programName
      },
      status: 'active'
    });

    return { data };
  } catch (err) {
    console.error('Error recording training enrollment:', err.message);
    return { error: err.message };
  }
}

export async function updateActivityStatus(activityId, status, isCompleted = false) {
  if (!isSupabaseReady() || !activityId) return { error: 'Invalid activity ID or Supabase not ready' };
  try {
    const updates = {
      status,
      is_completed: isCompleted,
      updated_at: new Date().toISOString()
    };

    if (isCompleted) {
      updates.completion_date = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('user_activity_log')
      .update(updates)
      .eq('id', activityId)
      .select()
      .single();

    if (error) throw error;
    return { data };
  } catch (err) {
    console.error('Error updating activity status:', err.message);
    return { error: err.message };
  }
}

export async function getActivitySummary(userId) {
  if (!isSupabaseReady() || !userId) return null;
  try {
    const [bookings, articles, tournaments, communities, trainings, activities] = await Promise.all([
      fetchUserVenueBookings(userId),
      fetchUserArticlesRead(userId),
      fetchUserTournamentParticipations(userId),
      fetchUserCommunityMemberships(userId),
      fetchUserTrainingEnrollments(userId),
      fetchUserActivityHistory(userId, { limit: 100 })
    ]);

    const runningActivities = activities.filter(a => a.status === 'active' && !a.is_completed);
    const completedActivities = activities.filter(a => a.is_completed || a.status === 'completed');

    return {
      totalVenueBookings: bookings.length,
      totalArticlesRead: articles.length,
      totalTournamentsJoined: tournaments.length,
      totalCommunitiesJoined: communities.length,
      totalTrainingsEnrolled: trainings.length,
      totalActivities: activities.length,
      runningActivitiesCount: runningActivities.length,
      completedActivitiesCount: completedActivities.length,
      recentActivities: activities.slice(0, 10)
    };
  } catch (err) {
    console.error('Error getting activity summary:', err.message);
    return null;
  }
}
