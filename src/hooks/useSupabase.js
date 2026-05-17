import { useEffect, useRef, useState } from 'react';
import {
  fetchVenues,
  fetchTournaments,
  fetchNews,
  fetchCoaches,
  fetchChats,
  fetchCommunities,
  fetchCommunityBookmarks,
  fetchCommunityChatMessages,
  fetchCommunityDetail,
  fetchRecommendedCommunities,
  fetchTournamentDetail,
  fetchCoachDetail
} from '../services/supabaseService.js';
import { supabase } from '../config/supabase.js';

// ========== CUSTOM HOOKS ==========

export function useVenues() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchVenues();
        setVenues(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { venues, loading, error };
}

export function useTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchTournaments();
        setTournaments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const refetch = () => setRefreshKey((k) => k + 1);

  return { tournaments, loading, error, refetch };
}

export function useTournamentDetail(tournamentId) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tournamentId) return;
    
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchTournamentDetail(tournamentId);
        setTournament(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tournamentId]);

  return { tournament, loading, error };
}

export function useNews() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchNews();
        setNews(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { news, loading, error };
}

export function useCoaches() {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCoaches();
        setCoaches(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { coaches, loading, error };
}

export function useCoachDetail(coachId) {
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!coachId) return;
    
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCoachDetail(coachId);
        setCoach(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [coachId]);

  return { coach, loading, error };
}

export function useChats() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchChats();
        setChats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { chats, loading, error };
}

export function useCommunities(userId = null) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCommunities({ userId });
        setCommunities(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey, userId]);

  const refetch = () => setRefreshKey((key) => key + 1);

  return { communities, loading, error, refetch };
}

export function useCommunityDetail(communityId, userId = null) {
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!communityId) {
      setCommunity(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCommunityDetail(communityId, { userId });
        setCommunity(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [communityId, refreshKey, userId]);

  const refetch = () => setRefreshKey((key) => key + 1);

  return { community, loading, error, refetch };
}

export function useCommunityBookmarks(userId = null) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userId) {
      setBookmarks([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCommunityBookmarks(userId);
        setBookmarks(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [refreshKey, userId]);

  const refetch = () => setRefreshKey((key) => key + 1);

  return { bookmarks, loading, error, refetch };
}

export function useRecommendedCommunities(userId = null, options = {}) {
  const { limit = 3, excludeCommunityId = null } = options;
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchRecommendedCommunities(userId, { limit, excludeCommunityId });
        setCommunities(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [excludeCommunityId, limit, refreshKey, userId]);

  const refetch = () => setRefreshKey((key) => key + 1);

  return { communities, loading, error, refetch };
}

export function useCommunityChatMessages(communityId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!communityId) {
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    let isActive = true;
    let channel = null;

    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCommunityChatMessages(communityId);
        if (isActive) setMessages(data);
      } catch (err) {
        if (isActive) setError(err.message);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    load();

    if (supabase) {
      channel = supabase
        .channel(`community-chat-${communityId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'community_chat_messages',
            filter: `community_id=eq.${communityId}`,
          },
          (payload) => {
            if (!isActive || !payload?.new) return;
            setMessages((prev) => {
              const exists = prev.some((item) => item.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();
    }

    return () => {
      isActive = false;
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [communityId]);

  return { messages, loading, error, setMessages };
}

export function useCommunityChatPresence(communityId, presenceUser = null, enabled = true) {
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!communityId || !supabase || !enabled) {
      setOnlineMembers([]);
      setConnected(false);
      channelRef.current = null;
      return undefined;
    }

    let isActive = true;
    const channel = supabase.channel(`community-chat-presence-${communityId}`, {
      config: {
        presence: {
          key: presenceUser?.id || `anon-${communityId}`,
        },
      },
    });

    const syncPresence = () => {
      if (!isActive) return;
      const state = channel.presenceState();
      const flattened = Object.values(state)
        .flatMap((entries) => Array.isArray(entries) ? entries : [])
        .map((entry) => ({
          id: entry.id || entry.user_id || entry.presence_ref,
          name: entry.name || entry.user_name || 'Member aktif',
          role: entry.role || 'member',
          joinedAt: entry.joinedAt || entry.online_at || null,
          isTyping: Boolean(entry.typing),
        }));

      const deduped = [];
      const seen = new Set();
      flattened.forEach((entry) => {
        if (!entry.id || seen.has(entry.id)) return;
        seen.add(entry.id);
        deduped.push(entry);
      });

      setOnlineMembers(deduped);
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (!isActive) return;
        setConnected(status === 'SUBSCRIBED');
        channelRef.current = channel;
        if (status === 'SUBSCRIBED' && presenceUser?.id) {
          await channel.track({
            id: presenceUser.id,
            name: presenceUser.name || presenceUser.email || 'Member',
            role: presenceUser.role || 'member',
            online_at: new Date().toISOString(),
            typing: false,
          });
        }
      });

    return () => {
      isActive = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [communityId, enabled, presenceUser?.email, presenceUser?.id, presenceUser?.name, presenceUser?.role]);

  const setTypingStatus = async (isTyping) => {
    if (!channelRef.current || !presenceUser?.id) return;

    await channelRef.current.track({
      id: presenceUser.id,
      name: presenceUser.name || presenceUser.email || 'Member',
      role: presenceUser.role || 'member',
      online_at: new Date().toISOString(),
      typing: Boolean(isTyping),
    });
  };

  const typingMembers = onlineMembers.filter((member) => member.isTyping && member.id !== presenceUser?.id);

  return { onlineMembers, typingMembers, connected, setTypingStatus };
}
