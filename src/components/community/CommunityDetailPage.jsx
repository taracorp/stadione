import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  CalendarDays,
  CheckCircle,
  Flame,
  Heart,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { useCommunityChatMessages, useCommunityChatPresence, useCommunityDetail, useRecommendedCommunities } from '../../hooks/useSupabase.js';
import { supabase } from '../../config/supabase.js';
import {
  createCommunityFeedPost,
  createCommunityFeedComment,
  createCommunityChatMessage,
  joinCommunity,
  saveCommunityRecommendationFeedback,
  toggleCommunityEventAttendance,
  toggleCommunityFeedLike,
  toggleCommunityBookmark,
} from '../../services/supabaseService.js';

const badgeConfig = {
  Verified: { icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'Beginner Friendly': { icon: CheckCircle, cls: 'bg-lime-100 text-lime-700 border-lime-200' },
  Trending: { icon: Flame, cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  'Most Active': { icon: Zap, cls: 'bg-sky-100 text-sky-700 border-sky-200' },
};

function CommunityBadge({ label }) {
  const config = badgeConfig[label] || { icon: Users, cls: 'bg-neutral-100 text-neutral-700 border-neutral-200' };
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${config.cls}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

export default function CommunityDetailPage({ communityId, initialCommunity, auth, openAuth, onBack, onSelectCommunity, onCommunityNotification, onCommunityRead }) {
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [commentDrafts, setCommentDrafts] = useState({});
  const [chatDraft, setChatDraft] = useState('');
  const [optimisticCommunity, setOptimisticCommunity] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const { community, loading, refetch } = useCommunityDetail(communityId || initialCommunity?.id, auth?.id || null);
  const { communities: recommendedCommunities, refetch: refetchRecommendations } = useRecommendedCommunities(auth?.id || null, {
    limit: 3,
    excludeCommunityId: communityId || initialCommunity?.id,
  });
  const activeCommunity = community || initialCommunity;
  const currentCommunity = optimisticCommunity || activeCommunity;
  const { messages: chatMessages, loading: chatLoading } = useCommunityChatMessages(communityId || initialCommunity?.id);
  const { onlineMembers, typingMembers, connected: chatPresenceConnected, setTypingStatus } = useCommunityChatPresence(
    communityId || initialCommunity?.id,
    auth?.id
      ? {
          id: auth.id,
          name: auth.name || auth.email?.split('@')[0] || 'Member',
          role: currentCommunity?.isJoined ? 'member' : 'guest',
          email: auth.email || '',
        }
      : null,
    Boolean(currentCommunity?.isJoined)
  );
  const chatEndRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const refetchRef = useRef(refetch);
  const refetchRecommendationsRef = useRef(refetchRecommendations);
  const typingTimeoutRef = useRef(null);
  const currentCommunityRef = useRef(currentCommunity);
  const notificationIdsRef = useRef(new Set());

  useEffect(() => {
    if (activeCommunity) {
      setOptimisticCommunity(activeCommunity);
    }
  }, [activeCommunity]);

  useEffect(() => {
    currentCommunityRef.current = currentCommunity;
  }, [currentCommunity]);

  useEffect(() => {
    if (currentCommunity?.id && typeof onCommunityRead === 'function') {
      onCommunityRead(currentCommunity.id);
    }
  }, [currentCommunity?.id, onCommunityRead]);

  useEffect(() => {
    refetchRef.current = refetch;
    refetchRecommendationsRef.current = refetchRecommendations;
  }, [refetch, refetchRecommendations]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!currentCommunity?.isJoined || !auth?.id) return undefined;

    if (!chatDraft.trim()) {
      setTypingStatus(false);
      return undefined;
    }

    setTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, 1200);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [auth?.id, chatDraft, currentCommunity?.isJoined, setTypingStatus]);

  const pushNotification = (id, title, detail, tone = 'info', options = {}) => {
    if (!id || notificationIdsRef.current.has(id)) return;
    notificationIdsRef.current.add(id);
    const nextNotification = {
      id,
      title,
      detail,
      tone,
      createdAt: new Date().toISOString(),
      communityId: currentCommunityRef.current?.id || communityId || initialCommunity?.id,
      communityName: currentCommunityRef.current?.name || initialCommunity?.name || 'Komunitas',
      communitySeed: currentCommunityRef.current || initialCommunity || null,
      type: options.type || tone,
    };
    setNotifications((prev) => [
      nextNotification,
      ...prev,
    ].slice(0, 6));

    if (options.global !== false && typeof onCommunityNotification === 'function') {
      onCommunityNotification(nextNotification);
    }
  };

  const mutateCommunity = (updater) => {
    setOptimisticCommunity((prev) => {
      const base = prev || currentCommunityRef.current;
      if (!base) return base;
      return updater(base);
    });
  };

  useEffect(() => {
    const activeCommunityId = communityId || initialCommunity?.id;
    if (!activeCommunityId || !supabase) return undefined;

    const scheduleRefresh = (withRecommendations = false) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        refetchRef.current?.();
        if (withRecommendations) {
          refetchRecommendationsRef.current?.();
        }
      }, 180);
    };

    const channel = supabase
      .channel(`community-detail-live-${activeCommunityId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_feed_posts',
        filter: `community_id=eq.${activeCommunityId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const actorName = payload.new?.author_name || 'Member komunitas';
          const currentUserName = auth?.name || auth?.email?.split('@')[0] || '';
          if (actorName !== currentUserName) {
            pushNotification(`post-${payload.new?.id}`, 'Post baru di feed komunitas', `${actorName} membagikan update baru.`, 'feed');
          }
        }
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_feed_comments',
        filter: `community_id=eq.${activeCommunityId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== auth?.id) {
          pushNotification(`comment-${payload.new?.id}`, 'Komentar baru', `${payload.new?.author_name || 'Member'} menambahkan komentar di feed komunitas.`, 'comment');
        }
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_feed_likes',
        filter: `community_id=eq.${activeCommunityId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== auth?.id) {
          pushNotification(`like-${payload.new?.id}`, 'Like baru', 'Satu like baru masuk ke feed komunitas.', 'like');
        }
        scheduleRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_events',
        filter: `community_id=eq.${activeCommunityId}`,
      }, () => scheduleRefresh())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'community_chat_messages',
        filter: `community_id=eq.${activeCommunityId}`,
      }, (payload) => {
        if (payload.new?.sender_name && payload.new?.sender_name !== (auth?.name || auth?.email?.split('@')[0] || '')) {
          pushNotification(`chat-${payload.new?.id}`, 'Pesan chat baru', `${payload.new?.sender_name} mengirim pesan di ruang komunitas.`, 'chat', { type: 'chat' });
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'community_event_attendance',
        filter: `community_id=eq.${activeCommunityId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== auth?.id) {
          const eventTitle = currentCommunityRef.current?.events?.find((item) => item.id === payload.new?.event_id)?.title || 'event komunitas';
          pushNotification(`attendance-${payload.new?.id}`, 'Attendance event baru', `Ada peserta baru yang join ${eventTitle}.`, 'attendance');
        }
        scheduleRefresh(true);
      })
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [communityId, initialCommunity?.id]);

  const ensureAuth = () => {
    if (auth?.id) return true;
    openAuth?.('login');
    return false;
  };

  const handleJoin = async () => {
    if (!ensureAuth() || !currentCommunity?.id) return;

    const previousCommunity = currentCommunity;
    mutateCommunity((communityState) => ({
      ...communityState,
      isJoined: true,
      membershipCount: Number(communityState.membershipCount || communityState.members_count || 0) + 1,
      members_count: Number(communityState.members_count || communityState.membershipCount || 0) + 1,
    }));

    setActionLoading(true);
    const result = await joinCommunity(auth.id, currentCommunity.id);
    setActionMessage(result.message || 'Aksi join diproses.');
    setActionLoading(false);

    if (result.success) {
      refetch();
      refetchRecommendations();
      pushNotification(`local-join-${currentCommunity.id}`, 'Berhasil bergabung', `Anda sekarang bergabung dengan ${currentCommunity.name}.`, 'success', { global: false, type: 'join' });
    } else {
      setOptimisticCommunity(previousCommunity);
    }
  };

  const handleBookmark = async () => {
    if (!ensureAuth() || !currentCommunity?.id) return;

    setActionLoading(true);
    const previousCommunity = currentCommunity;
    mutateCommunity((communityState) => ({
      ...communityState,
      isBookmarked: !communityState.isBookmarked,
    }));
    const result = await toggleCommunityBookmark(auth.id, currentCommunity);
    setActionMessage(result.message || 'Aksi bookmark diproses.');
    setActionLoading(false);

    if (result.success) {
      refetch();
      refetchRecommendations();
    } else {
      setOptimisticCommunity(previousCommunity);
    }
  };

  const handleRecommendation = async (item) => {
    if (!ensureAuth() || !item?.id) return;

    const result = await saveCommunityRecommendationFeedback(auth.id, item.id, 'accepted', {
      source: 'community_detail',
      reason: item.recommendationReason || 'Related community from detail page',
      sport: item.sport,
      city: item.city,
    });

    setActionMessage(result.success ? 'Preferensi rekomendasi disimpan.' : (result.message || 'Gagal menyimpan preferensi rekomendasi.'));
    if (result.success) refetchRecommendations();
  };

  const handleCreatePost = async () => {
    if (!ensureAuth() || !currentCommunity?.id) return;

    const draftContent = postDraft.trim();
    if (!draftContent) return;

    const optimisticPostId = `temp-post-${Date.now()}`;
    const previousCommunity = currentCommunity;

    mutateCommunity((communityState) => {
      const optimisticPost = {
        id: optimisticPostId,
        author_name: auth.name || auth.email?.split('@')[0] || 'Member',
        author_role: 'member',
        content: draftContent,
        likes_count: 0,
        comments_count: 0,
        comments: [],
        isLiked: false,
        created_at: new Date().toISOString(),
      };

      return {
        ...communityState,
        latestFeedPost: optimisticPost,
        feedPosts: [optimisticPost, ...(communityState.feedPosts || [])],
      };
    });
    setPostDraft('');

    setActionLoading(true);
    const result = await createCommunityFeedPost({
      communityId: currentCommunity.id,
      userId: auth.id,
      authorName: auth.name || auth.email?.split('@')[0] || 'Member',
      authorRole: currentCommunity.isJoined ? 'member' : 'guest',
      content: draftContent,
    });
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi post diproses.');

    if (result.success) {
      pushNotification(`local-post-${optimisticPostId}`, 'Post berhasil dipublikasikan', 'Update Anda langsung muncul di feed komunitas.', 'success');
    } else {
      setOptimisticCommunity(previousCommunity);
      setPostDraft(draftContent);
    }
  };

  const handleToggleAttendance = async (event) => {
    if (!ensureAuth() || !currentCommunity?.id) return;

    const previousCommunity = currentCommunity;
    mutateCommunity((communityState) => ({
      ...communityState,
      events: (communityState.events || []).map((item) => item.id === event.id
        ? {
            ...item,
            isAttending: !item.isAttending,
            attendees_count: Math.max(0, Number(item.attendees_count || 0) + (item.isAttending ? -1 : 1)),
          }
        : item),
    }));

    setActionLoading(true);
    const result = await toggleCommunityEventAttendance({
      community: currentCommunity,
      event,
      userId: auth.id,
    });
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi attendance diproses.');

    if (result.success) {
      refetchRecommendations();
    } else {
      setOptimisticCommunity(previousCommunity);
    }
  };

  const handleToggleLike = async (post) => {
    if (!ensureAuth() || !currentCommunity?.id) return;

    const previousCommunity = currentCommunity;
    mutateCommunity((communityState) => ({
      ...communityState,
      latestFeedPost: communityState.latestFeedPost?.id === post.id
        ? {
            ...communityState.latestFeedPost,
            isLiked: !post.isLiked,
            likes_count: Math.max(0, Number(post.likes_count || 0) + (post.isLiked ? -1 : 1)),
          }
        : communityState.latestFeedPost,
      feedPosts: (communityState.feedPosts || []).map((item) => item.id === post.id
        ? {
            ...item,
            isLiked: !item.isLiked,
            likes_count: Math.max(0, Number(item.likes_count || 0) + (item.isLiked ? -1 : 1)),
          }
        : item),
    }));

    setActionLoading(true);
    const result = await toggleCommunityFeedLike({
      communityId: currentCommunity.id,
      postId: post.id,
      userId: auth.id,
    });
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi like diproses.');

    if (result.success) {
      pushNotification(`local-like-${post.id}-${Date.now()}`, post.isLiked ? 'Like dibatalkan' : 'Like ditambahkan', 'Reaksi Anda langsung diterapkan ke feed.', 'success');
    } else {
      setOptimisticCommunity(previousCommunity);
    }
  };

  const handleCreateComment = async (post) => {
    if (!ensureAuth() || !currentCommunity?.id) return;

    const draft = commentDrafts[post.id] || '';
    const normalizedDraft = draft.trim();
    if (!normalizedDraft) return;
    const optimisticCommentId = `temp-comment-${Date.now()}`;
    const previousCommunity = currentCommunity;

    mutateCommunity((communityState) => ({
      ...communityState,
      latestFeedPost: communityState.latestFeedPost?.id === post.id
        ? {
            ...communityState.latestFeedPost,
            comments_count: Number(communityState.latestFeedPost.comments_count || 0) + 1,
          }
        : communityState.latestFeedPost,
      feedPosts: (communityState.feedPosts || []).map((item) => item.id === post.id
        ? {
            ...item,
            comments_count: Number(item.comments_count || 0) + 1,
            comments: [
              ...(item.comments || []),
              {
                id: optimisticCommentId,
                author_name: auth.name || auth.email?.split('@')[0] || 'Member',
                author_role: 'member',
                content: normalizedDraft,
                created_at: new Date().toISOString(),
              },
            ],
          }
        : item),
    }));
    setCommentDrafts((prev) => ({ ...prev, [post.id]: '' }));

    setActionLoading(true);
    const result = await createCommunityFeedComment({
      communityId: currentCommunity.id,
      postId: post.id,
      userId: auth.id,
      authorName: auth.name || auth.email?.split('@')[0] || 'Member',
      authorRole: currentCommunity.isJoined ? 'member' : 'guest',
      content: normalizedDraft,
    });
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi komentar diproses.');

    if (result.success) {
      pushNotification(`local-comment-${optimisticCommentId}`, 'Komentar berhasil dikirim', 'Komentar Anda langsung muncul di feed.', 'success');
    } else {
      setOptimisticCommunity(previousCommunity);
      setCommentDrafts((prev) => ({ ...prev, [post.id]: draft }));
    }
  };

  const handleSendChat = async () => {
    if (!ensureAuth() || !currentCommunity?.id) return;

    setActionLoading(true);
    const result = await createCommunityChatMessage({
      communityId: currentCommunity.id,
      userId: auth.id,
      senderName: auth.name || auth.email?.split('@')[0] || 'Member',
      senderRole: currentCommunity.isJoined ? 'member' : 'guest',
      message: chatDraft,
    });
    setActionLoading(false);
    setActionMessage(result.message || 'Aksi chat diproses.');

    if (result.success) {
      setChatDraft('');
      setTypingStatus(false);
    }
  };

  if (loading && !currentCommunity) {
    return <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 text-center text-neutral-500">Memuat detail komunitas...</div>;
  }

  if (!currentCommunity) {
    return (
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700">
          <ArrowLeft size={14} /> KEMBALI
        </button>
        <div className="mt-6 rounded-3xl border border-neutral-200 bg-white p-8 text-neutral-500">Komunitas tidak ditemukan.</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-8 lg:py-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-xs font-bold text-neutral-700 hover:border-neutral-900">
          <ArrowLeft size={14} /> KEMBALI KE DISCOVERY
        </button>
        <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ Community Detail</div>
      </div>

      {actionMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{actionMessage}</div>}

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-8">
        <div className="grid lg:grid-cols-[1.4fr_0.8fr] gap-8">
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              {(currentCommunity.badges || []).map((badge) => <CommunityBadge key={badge} label={badge} />)}
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-700">{currentCommunity.sport}</span>
            </div>
            <h1 className="font-display text-5xl lg:text-7xl leading-[0.88] text-neutral-900">{currentCommunity.name}</h1>
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500"><MapPin size={14} /> {currentCommunity.city}, {currentCommunity.province}</div>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-neutral-600">{currentCommunity.tagline || 'Komunitas aktif dengan event rutin, feed interaksi nyata, dan matchmaking aktivitas olahraga.'}</p>

            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="rounded-2xl bg-neutral-100 p-3"><div className="uppercase tracking-wider font-bold text-neutral-500">Member</div><div className="mt-1 text-lg font-black text-neutral-900">{Number(currentCommunity.membershipCount || currentCommunity.members_count || 0).toLocaleString('id-ID')}</div></div>
              <div className="rounded-2xl bg-neutral-100 p-3"><div className="uppercase tracking-wider font-bold text-neutral-500">Level</div><div className="mt-1 text-lg font-black text-neutral-900">{currentCommunity.skill_level || '-'}</div></div>
              <div className="rounded-2xl bg-neutral-100 p-3"><div className="uppercase tracking-wider font-bold text-neutral-500">Activity</div><div className="mt-1 text-lg font-black text-neutral-900">{currentCommunity.activity_level || '-'}</div></div>
              <div className="rounded-2xl bg-neutral-100 p-3"><div className="uppercase tracking-wider font-bold text-neutral-500">Type</div><div className="mt-1 text-lg font-black text-neutral-900">{currentCommunity.community_type || '-'}</div></div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-5 lg:p-6">
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Action Panel</div>
            <div className="space-y-3">
              <button
                onClick={handleJoin}
                disabled={actionLoading || currentCommunity.isJoined}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-black ${currentCommunity.isJoined ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-900 text-white hover:bg-neutral-800'} disabled:cursor-not-allowed`}
              >
                {currentCommunity.isJoined ? 'SUDAH BERGABUNG' : actionLoading ? 'MEMPROSES...' : 'JOIN COMMUNITY'}
              </button>
              <button
                onClick={handleBookmark}
                disabled={actionLoading}
                className={`w-full rounded-2xl border px-4 py-3 text-sm font-black ${currentCommunity.isBookmarked ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-900'}`}
              >
                {currentCommunity.isBookmarked ? 'BOOKMARKED' : 'SIMPAN KE BOOKMARK'}
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-neutral-600">
              <div className="font-bold text-neutral-900 mb-1">Live Snapshot</div>
              <div>Upcoming event: <span className="font-semibold">{currentCommunity.latestEvent?.title || 'Belum ada event yang dipublikasikan'}</span></div>
              <div className="mt-1">Recent feed: <span className="font-semibold">{currentCommunity.latestFeedPost?.author_name || 'Belum ada post terbaru'}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="inline-flex items-center gap-2">
            <Bell size={16} className="text-neutral-700" />
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ In-App Notifications</div>
          </div>
          <div className="text-xs text-neutral-500">{notifications.length} update terbaru di komunitas ini</div>
        </div>
        {notifications.length === 0 ? (
          <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-500">Belum ada notifikasi komunitas. Event realtime baru akan muncul di sini.</div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-3">
            {notifications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide font-black text-neutral-500 mb-1">{item.title}</div>
                <div className="text-sm text-neutral-700">{item.detail}</div>
                <div className="mt-2 text-[11px] text-neutral-500">{new Date(item.createdAt).toLocaleTimeString('id-ID')}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-7">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Community Events</div>
              <div className="font-display text-3xl text-neutral-900">EVENT & ACTIVITY</div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-neutral-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {(currentCommunity.events || []).length} event aktif</div>
          </div>
          <div className="space-y-3">
            {(currentCommunity.events || []).length === 0 ? (
              <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-500">Belum ada event live untuk komunitas ini.</div>
            ) : (
              currentCommunity.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-neutral-900">{event.title}</div>
                      <div className="mt-1 text-sm text-neutral-600">{event.description || 'Event komunitas dengan format latihan, sparring, atau meetup.'}</div>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold uppercase text-neutral-700">{event.status}</span>
                  </div>
                  <div className="mt-3 grid md:grid-cols-3 gap-2 text-xs text-neutral-600">
                    <div className="rounded-xl bg-neutral-100 px-3 py-2"><CalendarDays size={12} className="inline mr-1" /> {event.event_date || 'Tanggal TBD'}</div>
                    <div className="rounded-xl bg-neutral-100 px-3 py-2">{event.time_label || 'Jam TBD'}</div>
                    <div className="rounded-xl bg-neutral-100 px-3 py-2">{event.location || 'Lokasi TBD'}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs text-neutral-500">{Number(event.attendees_count || 0).toLocaleString('id-ID')} peserta tercatat</div>
                    <button
                      onClick={() => handleToggleAttendance(event)}
                      disabled={actionLoading || !currentCommunity.isJoined}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-black ${event.isAttending ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-900 text-white'} disabled:cursor-not-allowed disabled:bg-neutral-300`}
                    >
                      {event.isAttending ? 'SUDAH JOIN EVENT' : 'TANDAI HADIR'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-7">
          <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Activity Feed</div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <div className="font-display text-3xl text-neutral-900">REAL FEED</div>
            <div className="inline-flex items-center gap-2 text-xs text-neutral-500"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> sinkron otomatis</div>
          </div>
          <div className="mb-4 rounded-2xl bg-neutral-100 p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] font-black text-neutral-500 mb-1">/ Post Composer</div>
                <div className="text-sm text-neutral-600">Bagikan sparring call, recap event, atau update komunitas secara langsung.</div>
              </div>
              <div className="text-[11px] font-semibold text-neutral-500">{currentCommunity.isJoined ? 'Anda bisa posting' : 'Join dulu untuk posting'}</div>
            </div>
            <textarea
              value={postDraft}
              onChange={(event) => setPostDraft(event.target.value)}
              placeholder="Contoh: Sparring Jumat malam fixed jam 19:00, siapa join?"
              className="min-h-[112px] w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800"
            />
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[11px] text-neutral-500">Post, like, dan komentar akan sinkron otomatis saat ada perubahan di Supabase.</div>
              <button
                onClick={handleCreatePost}
                disabled={actionLoading || !postDraft.trim() || !currentCommunity.isJoined}
                className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {actionLoading ? 'MEMPROSES...' : 'PUBLIKASIKAN POST'}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {(currentCommunity.feedPosts || []).length === 0 ? (
              <div className="rounded-2xl bg-neutral-100 px-4 py-4 text-sm text-neutral-500">Belum ada feed post untuk komunitas ini.</div>
            ) : (
              currentCommunity.feedPosts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="font-bold text-sm text-neutral-900">{post.author_name}</div>
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{post.author_role}</div>
                    </div>
                    <div className="text-[11px] text-neutral-500">{new Date(post.created_at).toLocaleDateString('id-ID')}</div>
                  </div>
                  <div className="text-sm leading-relaxed text-neutral-700">{post.content}</div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                    <button onClick={() => handleToggleLike(post)} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-bold ${post.isLiked ? 'border-[#E11D2E] bg-[#FDEBEC] text-[#E11D2E]' : 'border-neutral-300 text-neutral-600'}`}>
                      <Heart size={12} /> {post.likes_count || 0} likes
                    </button>
                    <span>{post.comments_count || 0} comments</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {(post.comments || []).map((comment) => (
                      <div key={comment.id} className="rounded-xl bg-neutral-100 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-500 mb-1">
                          <span className="font-bold uppercase tracking-wide">{comment.author_name}</span>
                          <span>{new Date(comment.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="text-sm text-neutral-700">{comment.content}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl bg-neutral-100 p-3">
                    <textarea
                      value={commentDrafts[post.id] || ''}
                      onChange={(event) => setCommentDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))}
                      placeholder="Tulis komentar untuk update ini..."
                      className="min-h-[72px] w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[11px] text-neutral-500">Komentar hanya untuk member komunitas.</div>
                      <button
                        onClick={() => handleCreateComment(post)}
                        disabled={actionLoading || !(commentDrafts[post.id] || '').trim() || !currentCommunity.isJoined}
                        className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                      >
                        KIRIM KOMENTAR
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-7">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Community Chat</div>
            <div className="font-display text-3xl text-neutral-900">REAL-TIME CHAT</div>
          </div>
          <div className="text-xs text-neutral-500">{chatLoading ? 'Menghubungkan realtime...' : 'Pesan baru akan masuk otomatis saat ada insert baru.'}</div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-2xl bg-neutral-100 px-4 py-3">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700">
            <span className={`w-2 h-2 rounded-full ${chatPresenceConnected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
            {chatPresenceConnected ? 'Presence realtime aktif' : 'Presence belum terhubung'}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {onlineMembers.length === 0 ? (
              <span className="text-[11px] text-neutral-500">Belum ada member aktif di ruang chat.</span>
            ) : (
              onlineMembers.slice(0, 5).map((member) => (
                <span key={member.id} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold text-neutral-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {member.name}
                </span>
              ))
            )}
            {onlineMembers.length > 5 && <span className="text-[11px] font-semibold text-neutral-500">+{onlineMembers.length - 5} lainnya</span>}
          </div>
        </div>

        {typingMembers.length > 0 && (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {typingMembers.slice(0, 2).map((member) => member.name).join(', ')} sedang mengetik...
          </div>
        )}

        <div className="rounded-3xl bg-neutral-100 p-4">
          <div className="max-h-[320px] overflow-y-auto space-y-3 pr-1">
            {chatMessages.length === 0 ? (
              <div className="rounded-2xl bg-white px-4 py-4 text-sm text-neutral-500">Belum ada pesan chat komunitas. Mulai percakapan setelah join komunitas.</div>
            ) : (
              chatMessages.map((message) => (
                <div key={message.id} className="rounded-2xl bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-500 mb-1">
                    <div className="font-bold uppercase tracking-wide text-neutral-700">{message.sender_name}</div>
                    <div>{new Date(message.sent_at || message.created_at || Date.now()).toLocaleString('id-ID')}</div>
                  </div>
                  <div className="text-sm text-neutral-700 leading-relaxed">{message.message}</div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="mt-4 flex items-end gap-3">
            <textarea
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Ketik pesan untuk komunitas ini..."
              className="min-h-[88px] flex-1 rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-800"
            />
            <button
              onClick={handleSendChat}
              disabled={actionLoading || !chatDraft.trim() || !activeCommunity.isJoined}
              className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              <Send size={13} /> KIRIM
            </button>
          </div>
          <div className="mt-2 text-[11px] text-neutral-500">Chat hanya bisa dikirim oleh member komunitas dan akan masuk real-time lewat subscription Supabase.</div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-neutral-200 bg-white p-6 lg:p-7">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Related Recommendation</div>
            <div className="font-display text-3xl text-neutral-900">NEXT COMMUNITY MATCH</div>
          </div>
          <div className="text-xs text-neutral-500">Personalized from memberships, bookmarks, and activity badge.</div>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recommendedCommunities.map((item) => (
            <article key={`related-${item.id}`} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <button onClick={() => onSelectCommunity?.(item)} className="text-left font-display text-2xl leading-tight text-neutral-900 hover:text-[#E11D2E]">{item.name}</button>
                  <div className="mt-1 text-xs text-neutral-500 flex items-center gap-2"><MapPin size={11} /> {item.city}, {item.province}</div>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">{item.sport}</span>
              </div>
              <div className="mt-3 text-sm text-neutral-600">{item.recommendationReason || 'Relevan dengan pola komunitas Anda.'}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(item.badges || []).slice(0, 2).map((badge) => <CommunityBadge key={`${item.id}-${badge}`} label={badge} />)}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button onClick={() => handleRecommendation(item)} className="rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-black text-white">SIMPAN REKOMENDASI</button>
                <button onClick={() => onSelectCommunity?.(item)} className="inline-flex items-center gap-1 text-xs font-bold text-neutral-900 hover:text-[#E11D2E]">
                  Detail <ArrowRight size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
