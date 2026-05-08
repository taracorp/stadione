import { supabase } from '../config/supabase.js';

// ========== VENUES ==========
export async function fetchVenues() {
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
      startDate: t.start_date,
      color: t.color,
      host: t.host,
      participants: t.participants
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

// ========== NEWS ==========
export async function fetchNews() {
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
  try {
    const { data, error } = await supabase
      .from('coaches')
      .select(`
        *,
        coach_certs(cert),
        coach_extra(bio, location, languages:coach_languages(language), schedule:coach_schedule(schedule_line), programs:coach_programs(*))
      `)
      .order('rating', { ascending: false });
    if (error) throw error;
    
    return data.map(c => ({
      ...c,
      exp: c.exp,
      rating: c.rating,
      sessions: c.sessions,
      price: c.price,
      certs: c.coach_certs.map(ct => ct.cert),
      bio: c.coach_extra?.[0]?.bio,
      location: c.coach_extra?.[0]?.location,
      languages: c.coach_extra?.[0]?.languages?.map(l => l.language) || [],
      schedule: c.coach_extra?.[0]?.schedule?.map(s => s.schedule_line) || [],
      programs: c.coach_extra?.[0]?.programs || []
    }));
  } catch (err) {
    console.error('Error fetching coaches:', err.message);
    return [];
  }
}

export async function fetchCoachDetail(coachId) {
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

// ========== CHATS ==========
export async function fetchChats() {
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
