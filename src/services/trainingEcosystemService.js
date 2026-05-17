import { supabase } from '../config/supabase.js';

const isSupabaseReady = () => Boolean(supabase);

const SPORT_LABEL = {
  football: 'Sepakbola',
  futsal: 'Futsal',
  basketball: 'Basket',
  volleyball: 'Voli',
  badminton: 'Badminton',
  tennis: 'Tennis',
  padel: 'Padel',
  esports: 'Esports',
  swimming: 'Renang',
};

const LEVEL_LABEL = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite',
};

const EVENT_TYPE_LABEL = {
  coaching_clinic: 'Coaching Clinic',
  holiday_camp: 'Holiday Camp',
  talent_scouting_camp: 'Talent Scouting Camp',
  trial_day: 'Trial Day',
  open_training: 'Open Training',
};

const sportLabel = (value) => SPORT_LABEL[value] || value || 'Umum';
const levelLabel = (value) => LEVEL_LABEL[value] || 'Beginner';
const eventTypeLabel = (value) => EVENT_TYPE_LABEL[value] || value || 'Training Event';

function safeInitial(name) {
  const value = String(name || '').trim();
  if (!value) return 'TR';
  return value
    .split(' ')
    .map((item) => item[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function resolveAcademyColor(sport) {
  const normalized = String(sport || '').toLowerCase();
  if (normalized === 'football') return '#0F4D2A';
  if (normalized === 'basketball') return '#EA580C';
  if (normalized === 'badminton') return '#B91C1C';
  if (normalized === 'padel') return '#1F3A8A';
  if (normalized === 'futsal') return '#92400E';
  if (normalized === 'esports') return '#7C3AED';
  return '#1F2937';
}

export async function fetchTrainingAcademies() {
  if (!isSupabaseReady()) return [];

  try {
    const { data, error } = await supabase
      .from('training_academies')
      .select('id,name,sport,province,city,age_category,monthly_price,is_verified,verified_identity,verified_venue,verified_coach')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      sport: sportLabel(item.sport),
      city: item.city || 'Kota belum diisi',
      province: item.province || 'Provinsi belum diisi',
      coaches: 0,
      students: 0,
      ageRange: item.age_category || 'All Age',
      price: Number(item.monthly_price || 0),
      rating: 4.8,
      reviews: 0,
      verified: Boolean(item.is_verified || (item.verified_identity && item.verified_venue && item.verified_coach)),
      tags: ['Academy Terdaftar'],
      color: resolveAcademyColor(item.sport),
      initial: safeInitial(item.name),
      schedule: 'Jadwal akan diumumkan',
      desc: `${item.name} membuka program ${sportLabel(item.sport)} untuk kategori ${item.age_category || 'umum'}.`,
    }));
  } catch (error) {
    console.error('fetchTrainingAcademies error:', error);
    return [];
  }
}

export async function fetchTrainingCoaches() {
  if (!isSupabaseReady()) return [];

  try {
    const { data, error } = await supabase
      .from('training_coaches')
      .select('id,full_name,sport,city,license,years_experience,online_available,group_available,session_price,specialty,achievement')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => ({
      id: item.id,
      name: item.full_name,
      sport: sportLabel(item.sport),
      exp: Number(item.years_experience || 0),
      rating: 4.8,
      sessions: 0,
      price: Number(item.session_price || 0),
      license: item.license || 'Lisensi belum diisi',
      city: item.city || 'Kota belum diisi',
      speciality: item.specialty || 'General Training',
      online: Boolean(item.online_available),
      group: Boolean(item.group_available),
      initial: safeInitial(item.full_name),
      achievements: item.achievement ? [item.achievement] : ['Pelatih Terdaftar'],
      services: ['Private coaching', 'Group coaching'],
      certs: item.license ? [item.license] : ['Certified Coach'],
    }));
  } catch (error) {
    console.error('fetchTrainingCoaches error:', error);
    return [];
  }
}

export async function fetchTrainingPrograms() {
  if (!isSupabaseReady()) return [];

  try {
    const { data, error } = await supabase
      .from('training_programs')
      .select('id,title,program_type,package_name,sessions_per_week,billing_cycle,price,min_age,max_age,level,is_active,training_academies(name,sport),training_program_enrollments(id)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => {
      const academy = item.training_academies || {};
      const minAge = Number(item.min_age || 0);
      const maxAge = Number(item.max_age || 0);
      const hasAgeRange = minAge > 0 || maxAge > 0;
      const ageRange = hasAgeRange
        ? `U-${minAge || maxAge} — U-${maxAge || minAge}`
        : 'All Age';
      const sessionsPerWeek = Number(item.sessions_per_week || 0);
      const enrollmentCount = Array.isArray(item.training_program_enrollments)
        ? item.training_program_enrollments.length
        : 0;
      const slotCapacity = Math.max(enrollmentCount + 5, 10);

      return {
        id: item.id,
        name: item.title,
        type: item.program_type || 'Program',
        sport: sportLabel(academy.sport),
        academy: academy.name || 'Academy',
        desc: `Program ${item.program_type || 'latihan'} dengan paket ${item.package_name || 'regular'}.`,
        ageRange,
        duration: item.billing_cycle || 'Bulanan',
        sessions: sessionsPerWeek > 0 ? `${sessionsPerWeek}x/minggu` : 'Sesuai paket',
        price: Number(item.price || 0),
        color: resolveAcademyColor(academy.sport),
        slots: slotCapacity,
        filled: enrollmentCount,
      };
    });
  } catch (error) {
    console.error('fetchTrainingPrograms error:', error);
    return [];
  }
}

export async function registerTrainingEvent({ eventId, userId, athleteName }) {
  if (!isSupabaseReady()) return { success: false, error: 'Supabase belum siap.' };
  if (!eventId || !userId) return { success: false, error: 'Data pendaftaran event belum lengkap.' };

  try {
    const payload = {
      event_id: eventId,
      user_id: userId,
      athlete_name: athleteName || null,
      payment_status: 'pending',
    };

    const { data, error } = await supabase
      .from('training_event_registrations')
      .upsert(payload, { onConflict: 'event_id,user_id' })
      .select('id,event_id,user_id')
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('registerTrainingEvent error:', error);
    return { success: false, error: error?.message || 'Gagal mendaftar training event.' };
  }
}

export async function enrollTrainingProgram({ programId, userId }) {
  if (!isSupabaseReady()) return { success: false, error: 'Supabase belum siap.' };
  if (!programId || !userId) return { success: false, error: 'Data enrollment program belum lengkap.' };

  try {
    const payload = {
      program_id: programId,
      user_id: userId,
      status: 'active',
    };

    const { data, error } = await supabase
      .from('training_program_enrollments')
      .upsert(payload, { onConflict: 'program_id,user_id' })
      .select('id,program_id,user_id')
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('enrollTrainingProgram error:', error);
    return { success: false, error: error?.message || 'Gagal mendaftar program latihan.' };
  }
}

export async function createTrainingAthleteReport({ userId, periodLabel }) {
  if (!isSupabaseReady()) return { success: false, error: 'Supabase belum siap.' };
  if (!userId) return { success: false, error: 'Login dibutuhkan untuk membuat raport.' };

  try {
    const { data: memberRows, error: memberError } = await supabase
      .from('training_workspace_members')
      .select('academy_id')
      .eq('user_id', userId)
      .eq('lifecycle_status', 'active')
      .limit(1);

    if (memberError) throw memberError;

    const academyId = memberRows?.[0]?.academy_id;
    if (!academyId) {
      return { success: false, error: 'Akun ini belum terhubung ke workspace academy.' };
    }

    const { data: athletes, error: athleteError } = await supabase
      .from('training_athletes')
      .select('id,full_name')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (athleteError) throw athleteError;

    const athleteId = athletes?.[0]?.id;
    if (!athleteId) {
      return { success: false, error: 'Belum ada atlet pada academy ini.' };
    }

    const label = periodLabel || new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    const reportPayload = {
      athlete_id: athleteId,
      academy_id: academyId,
      period_label: label,
      physical_score: 80,
      technical_score: 82,
      tactical_score: 78,
      mental_score: 84,
      discipline_score: 88,
      coach_notes: 'Raport otomatis dari workspace training ecosystem.',
      report_grade: 'A',
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('training_athlete_reports')
      .upsert(reportPayload, { onConflict: 'athlete_id,period_label' })
      .select('id,athlete_id,period_label')
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      athleteName: athletes?.[0]?.full_name || 'Atlet',
      academyId,
    };
  } catch (error) {
    console.error('createTrainingAthleteReport error:', error);
    return { success: false, error: error?.message || 'Gagal membuat raport atlet.' };
  }
}

export async function fetchTrainingEvents() {
  if (!isSupabaseReady()) return [];

  try {
    const { data, error } = await supabase
      .from('training_events')
      .select('id,title,event_type,sport,starts_at,ends_at,venue_name,quota,price,registration_open,training_academies(name),training_event_registrations(id)')
      .order('starts_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((item) => {
      const startsAt = item.starts_at ? new Date(item.starts_at) : null;
      const endsAt = item.ends_at ? new Date(item.ends_at) : null;
      const registered = Array.isArray(item.training_event_registrations)
        ? item.training_event_registrations.length
        : 0;
      const quota = Number(item.quota || 0);
      const date = startsAt ? startsAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanggal menyusul';
      const time = startsAt
        ? `${startsAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}${endsAt ? ` - ${endsAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}`
        : 'Waktu menyusul';

      return {
        id: item.id,
        title: item.title,
        type: eventTypeLabel(item.event_type),
        sport: sportLabel(item.sport),
        organizer: item.training_academies?.name || 'Academy',
        date,
        time,
        location: item.venue_name || 'Venue akan diumumkan',
        price: Number(item.price || 0),
        slots: quota > 0 ? quota : Math.max(registered, 1),
        registered,
        color: resolveAcademyColor(item.sport),
        desc: `${item.title} untuk cabang ${sportLabel(item.sport)}.`,
      };
    });
  } catch (error) {
    console.error('fetchTrainingEvents error:', error);
    return [];
  }
}
