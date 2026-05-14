// Gamification Hooks
import { useState, useEffect, useCallback } from 'react';
import {
  getUserGamificationStats,
  updateArticleProgress,
  getArticleQuiz,
  getArticleProgress,
  hasTriviaAttempt,
  getTournamentPlayers,
  getUserTournamentRecord,
  getPlayerStatistics,
  isPlayerSuspended,
  getPlayerSuspensions,
  getUserActivityHistory
} from '../services/gamificationService';
import { fetchUserActivityHistory } from '../services/supabaseService';

/**
 * Hook: Track user's coins and points
 */
export function useUserGamification(userId) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getUserGamificationStats(userId);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook: Track article reading progress and quiz
 */
export function useArticleReading(userId, articleId) {
  const [progress, setProgress] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAttemptFallback, setQuizAttemptFallback] = useState(false);

  // Fetch existing progress
  useEffect(() => {
    if (!userId || !articleId) return;

    const fetchProgress = async () => {
      setLoading(true);
      try {
        const data = await getArticleProgress(userId, articleId);
        setProgress(data);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [userId, articleId]);

  // Fetch quiz
  useEffect(() => {
    if (!articleId) return;

    const fetchQuiz = async () => {
      setQuizLoading(true);
      try {
        const data = await getArticleQuiz(articleId);
        setQuiz(data);
      } finally {
        setQuizLoading(false);
      }
    };

    fetchQuiz();
  }, [articleId]);

  useEffect(() => {
    if (!userId || !articleId) {
      setQuizAttemptFallback(false);
      return;
    }

    const fetchQuizAttemptFallback = async () => {
      try {
        const attempted = await hasTriviaAttempt(userId, articleId);
        setQuizAttemptFallback(Boolean(attempted));
      } catch {
        setQuizAttemptFallback(false);
      }
    };

    fetchQuizAttemptFallback();
  }, [userId, articleId]);

  const updateProgress = useCallback(async (scrollDepth, completed) => {
    if (!userId || !articleId) return null;
    const data = await updateArticleProgress(userId, articleId, scrollDepth, completed);
    setProgress(data);
    return data;
  }, [userId, articleId]);

  return {
    progress,
    quiz,
    loading,
    quizLoading,
    updateProgress,
    readingCompleted: progress?.read_completed || false,
    quizCompleted: progress?.quiz_attempted || quizAttemptFallback || false,
    quizCorrect: progress?.quiz_correct || false,
    scrollDepth: progress?.scroll_depth_percent || 0
  };
}

/**
 * Hook: Scroll depth tracker with automatic completion
 */
export function useScrollTracker(articleRef, onReadComplete) {
  const [scrollDepth, setScrollDepth] = useState(0);
  const [hasTriggeredCompletion, setHasTriggeredCompletion] = useState(false);

  useEffect(() => {
    const element = articleRef?.current || null;
    const canUseElementScroll = Boolean(element && (element.scrollHeight - element.clientHeight > 1));
    const isWindowMode = !canUseElementScroll;

    const handleScroll = () => {
      const contentHeight = isWindowMode
        ? Math.max((document.documentElement.scrollHeight || 0) - window.innerHeight, 0)
        : Math.max((element.scrollHeight || 0) - (element.clientHeight || 0), 0);
      const scrollTop = isWindowMode
        ? window.scrollY || document.documentElement.scrollTop || 0
        : element.scrollTop || 0;
      const depth = contentHeight > 0 ? Math.round((scrollTop / contentHeight) * 100) : 0;

      setScrollDepth(depth);

      // Trigger completion at 90% scroll
      if (depth >= 90 && !hasTriggeredCompletion && onReadComplete) {
        setHasTriggeredCompletion(true);
        onReadComplete();
      }
    };

    if (isWindowMode) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
      return () => window.removeEventListener('scroll', handleScroll);
    }

    element.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => element.removeEventListener('scroll', handleScroll);
  }, [articleRef, onReadComplete, hasTriggeredCompletion]);

  return scrollDepth;
}

/**
 * Hook: Tournament player management
 */
export function useTournamentPlayers(tournamentId) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPlayers = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const data = await getTournamentPlayers(tournamentId);
      setPlayers(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  return { players, loading, error, refetch: fetchPlayers };
}

/**
 * Hook: User's tournament record
 */
export function useUserTournamentRecord(userId, tournamentId) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !tournamentId) return;

    const fetchRecord = async () => {
      setLoading(true);
      try {
        const data = await getUserTournamentRecord(userId, tournamentId);
        setRecord(data);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [userId, tournamentId]);

  const isRegistered = !!record;
  const isSuspended = record?.status === 'suspended';

  return { record, loading, isRegistered, isSuspended };
}

/**
 * Hook: Player statistics
 */
export function usePlayerStatistics(playerId, tournamentId) {
  const [statistics, setStatistics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!playerId || !tournamentId) return;
    setLoading(true);
    try {
      const data = await getPlayerStatistics(playerId, tournamentId);
      setStatistics(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [playerId, tournamentId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const totalStats = statistics.reduce((acc, stat) => ({
    totalGoals: (acc.totalGoals || 0) + (stat.goals || 0),
    totalAssists: (acc.totalAssists || 0) + (stat.assists || 0),
    totalYellowCards: (acc.totalYellowCards || 0) + (stat.yellow_cards || 0),
    totalRedCards: (acc.totalRedCards || 0) + (stat.red_cards || 0),
    totalMinutes: (acc.totalMinutes || 0) + (stat.minutes_played || 0)
  }), {});

  return { statistics, loading, error, totalStats, refetch: fetchStats };
}

/**
 * Hook: Player suspension status
 */
export function usePlayerSuspension(playerId, tournamentId) {
  const [suspensions, setSuspensions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    if (!playerId || !tournamentId) return;

    const fetchSuspensions = async () => {
      setLoading(true);
      try {
        const data = await getPlayerSuspensions(playerId, tournamentId);
        setSuspensions(data);

        // Check if any active suspension exists
        const activeSuspension = data.some(s => s.is_active);
        setIsSuspended(activeSuspension);
      } finally {
        setLoading(false);
      }
    };

    fetchSuspensions();
  }, [playerId, tournamentId]);

  const yellowCardCount = suspensions
    .filter(s => s.suspension_reason === 'yellow_card_accumulation')
    .reduce((sum, s) => sum + (s.yellow_card_count || 0), 0);

  const lastRedCard = suspensions
    .find(s => s.suspension_reason === 'red_card')?.suspended_at;

  return { suspensions, loading, isSuspended, yellowCardCount, lastRedCard };
}

/**
 * Hook: Activity history
 */
export function useActivityHistory(userId, limit = 50) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchUserActivityHistory(userId, { limit });
      setActivities(data);
      setError(null);
    } catch (err) {
      try {
        const fallbackData = await getUserActivityHistory(userId, limit);
        setActivities(fallbackData);
        setError(null);
      } catch (fallbackErr) {
        setError(fallbackErr.message || err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, error, refetch: fetchActivities };
}

/**
 * Hook: Tier information and progression
 */
export function useTierProgression(points) {
  const tiers = [
    { name: 'Bronze', minPoints: 0, maxPoints: 499, color: '#CD7F32', icon: '🥉' },
    { name: 'Silver', minPoints: 500, maxPoints: 1999, color: '#C0C0C0', icon: '🥈' },
    { name: 'Gold', minPoints: 2000, maxPoints: 4999, color: '#FFD700', icon: '🥇' },
    { name: 'Platinum', minPoints: 5000, maxPoints: Infinity, color: '#E5E4E2', icon: '💎' }
  ];

  const currentTier = tiers.find(t => points >= t.minPoints && points <= t.maxPoints);
  const nextTier = tiers.find(t => t.minPoints > points);

  const progressToNextTier = nextTier
    ? Math.round(((points - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100)
    : 100;

  const pointsToNextTier = nextTier
    ? nextTier.minPoints - points
    : 0;

  return {
    currentTier,
    nextTier,
    progressPercentage: progressToNextTier,
    pointsToNextTier,
    allTiers: tiers
  };
}
