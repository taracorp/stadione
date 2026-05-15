// Gamification Services - Points, Coins, and Activity Tracking
import { supabase } from '../config/supabase';
import { recordActivityToLog } from './supabaseService';

// ============ POINTS & COINS SYSTEM ============

function getPendingPointsKey(userId) {
  return `stadione_pending_points_${userId}`;
}

function readPendingPoints(userId) {
  if (typeof window === 'undefined' || !userId) return 0;
  const raw = window.localStorage.getItem(getPendingPointsKey(userId));
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writePendingPoints(userId, value) {
  if (typeof window === 'undefined' || !userId) return;
  window.localStorage.setItem(getPendingPointsKey(userId), String(Math.max(0, Number(value) || 0)));
}

function addPendingPoints(userId, delta) {
  const current = readPendingPoints(userId);
  const next = current + (Number(delta) || 0);
  writePendingPoints(userId, next);
  return next;
}

function resolveTierByPoints(points) {
  if (points >= 5000) return 'Platinum';
  if (points >= 2000) return 'Gold';
  if (points >= 500) return 'Silver';
  return 'Bronze';
}

async function fallbackAwardPointsByDirectUpdate(userId, points) {
  // Best effort for legacy users whose user_stats row was never created by trigger.
  await supabase
    .from('user_stats')
    .upsert({
      user_id: userId,
      coins: 0,
      points: 0,
      tier_level: 'Bronze',
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: true,
    });

  const { data: currentStats, error: currentStatsError } = await supabase
    .from('user_stats')
    .select('points')
    .eq('user_id', userId)
    .single();

  if (currentStatsError || !currentStats) {
    throw currentStatsError || new Error('User stats row not found');
  }

  const currentPoints = Number(currentStats.points || 0);
  const nextPoints = currentPoints + Number(points || 0);
  const nextTier = resolveTierByPoints(nextPoints);

  const { error: updateError } = await supabase
    .from('user_stats')
    .update({
      points: nextPoints,
      tier_level: nextTier,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) throw updateError;

  return {
    new_points: nextPoints,
    new_tier: nextTier,
    points_awarded: Number(points || 0),
    fallback: true,
  };
}

/**
 * Award points to user for various activities
 * Activity types: 'login', 'article_read', 'trivia_correct', 'share', 'event_join', 'checkin', 'review', 'referral'
 */
export async function awardPoints(userId, points, activityType, referenceId = null) {
  if (!supabase || !userId) return null;
  
  try {
    const { data, error } = await supabase.rpc('award_points', {
      p_user_id: userId,
      p_points: points,
      p_activity_type: activityType,
      p_reference_id: referenceId
    });

    if (!error && data?.[0]) {
      return data[0];
    }

    // Fallback when RPC fails because of backend policy/config mismatch.
    const fallbackResult = await fallbackAwardPointsByDirectUpdate(userId, points);
    if (fallbackResult) return fallbackResult;

    const pending = addPendingPoints(userId, points);
    return {
      new_points: pending,
      new_tier: resolveTierByPoints(pending),
      points_awarded: Number(points || 0),
      fallback: 'pending_local',
    };
  } catch (error) {
    console.error('Error awarding points via RPC, trying fallback:', error.message);
    try {
      const fallbackResult = await fallbackAwardPointsByDirectUpdate(userId, points);
      if (fallbackResult) return fallbackResult;

      const pending = addPendingPoints(userId, points);
      return {
        new_points: pending,
        new_tier: resolveTierByPoints(pending),
        points_awarded: Number(points || 0),
        fallback: 'pending_local',
      };
    } catch (fallbackError) {
      console.error('Error awarding points via fallback:', fallbackError.message);
      const pending = addPendingPoints(userId, points);
      return {
        new_points: pending,
        new_tier: resolveTierByPoints(pending),
        points_awarded: Number(points || 0),
        fallback: 'pending_local',
      };
    }
  }
}

/**
 * Award coins from transaction amount
 * Formula: 1 coin per Rp 10,000 spent
 */
export async function awardCoinsFromTransaction(userId, transactionAmount) {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase.rpc('award_coins_from_transaction', {
      p_user_id: userId,
      p_transaction_amount: transactionAmount
    });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error awarding coins:', error.message);
    return null;
  }
}

/**
 * Get user's current gamification stats
 */
export async function getUserGamificationStats(userId) {
  if (!supabase || !userId) return null;

  try {
    const pending = readPendingPoints(userId);

    const { data, error } = await supabase.rpc('get_user_gamification_stats', {
      p_user_id: userId
    });

    if (!error && data?.[0]) {
      const stats = data[0];
      if (pending > 0) {
        const mergedPoints = Number(stats.points || 0) + pending;
        return {
          ...stats,
          points: mergedPoints,
          tier_level: stats.tier_level || resolveTierByPoints(mergedPoints),
        };
      }
      return stats;
    }

    // Fallback to direct table read if RPC is unavailable.
    await supabase
      .from('user_stats')
      .upsert({
        user_id: userId,
        coins: 0,
        points: 0,
        tier_level: 'Bronze',
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      });

    const { data: basicStats, error: basicStatsError } = await supabase
      .from('user_stats')
      .select('coins, points, tier_level, total_spent')
      .eq('user_id', userId)
      .single();

    const basic = {
      coins: Number(basicStats?.coins || 0),
      points: Number(basicStats?.points || 0),
      tier_level: basicStats?.tier_level || resolveTierByPoints(Number(basicStats?.points || 0)),
      total_spent: Number(basicStats?.total_spent || 0),
      total_activities: 0,
      articles_read: 0,
      quizzes_correct: 0,
      tournaments_joined: 0,
    };

    let recoveredPoints = 0;

    // First recovery path: activity_log sum (closest to source of truth for awarded points).
    const { data: activityRows } = await supabase
      .from('activity_log')
      .select('points_earned')
      .eq('user_id', userId)
      .limit(500);

    if (Array.isArray(activityRows) && activityRows.length > 0) {
      recoveredPoints = activityRows.reduce((sum, row) => sum + Number(row?.points_earned || 0), 0);
    }

    // Second recovery path: infer from reading + quiz results when activity_log insert was blocked.
    if (recoveredPoints <= 0) {
      const [{ count: readCompletedCount }, { data: quizRows }] = await Promise.all([
        supabase
          .from('article_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read_completed', true),
        supabase
          .from('quiz_results')
          .select('points_awarded')
          .eq('user_id', userId)
          .limit(500),
      ]);

      const articlePoints = Number(readCompletedCount || 0) * 2;
      const quizPoints = Array.isArray(quizRows)
        ? quizRows.reduce((sum, row) => sum + Number(row?.points_awarded || 0), 0)
        : 0;

      recoveredPoints = articlePoints + quizPoints;
    }

    const mergedPoints = Math.max(0, Number(basic.points || 0), Number(recoveredPoints || 0)) + pending;
    return {
      ...basic,
      points: mergedPoints,
      tier_level: resolveTierByPoints(mergedPoints),
    };
  } catch (error) {
    console.error('Error fetching user stats:', error.message);
    const pending = readPendingPoints(userId);
    return {
      coins: 0,
      points: pending,
      tier_level: resolveTierByPoints(pending),
      total_spent: 0,
      total_activities: 0,
      articles_read: 0,
      quizzes_correct: 0,
      tournaments_joined: 0,
    };
  }
}

// ============ ARTICLE READING & QUIZ ============

/**
 * Update article reading progress
 */
export async function updateArticleProgress(userId, articleId, scrollDepth, completed = false) {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('article_progress')
      .upsert({
        user_id: userId,
        article_id: articleId,
        scroll_depth_percent: scrollDepth,
        read_completed: completed,
        reading_completed_at: completed ? new Date().toISOString() : null
      }, {
        onConflict: 'user_id,article_id'
      })
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error updating article progress:', error.message);
    return null;
  }
}

export async function completeArticleReading(userId, articleId, scrollDepth = 100) {
  if (!supabase || !userId) return null;

  try {
    const existingProgress = await getArticleProgress(userId, articleId);
    const data = await updateArticleProgress(userId, articleId, scrollDepth, true);

    if (!existingProgress?.read_completed) {
      const awarded = await awardPoints(userId, 2, 'article_read', articleId);
      if (!awarded) {
        throw new Error('Gagal memberikan poin trivia');
      }
    }

    return data;
  } catch (error) {
    console.error('Error completing article reading:', error.message);
    return null;
  }
}

/**
 * Get article quiz for a specific article
 */
export async function getArticleQuiz(articleId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('article_quiz')
      .select('*')
      .eq('article_id', articleId)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No quiz found, return null
        return null;
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching quiz:', error.message);
    return null;
  }
}

/**
 * Submit quiz answer and award points if correct
 */
export async function submitQuizAnswer(userId, quizId, articleId, selectedAnswer) {
  if (!supabase || !userId) return null;

  try {
    const attempted = await hasTriviaAttempt(userId, articleId);
    if (attempted) {
      return {
        success: false,
        message: 'Trivia untuk artikel ini sudah pernah dikerjakan. Kesempatan hanya 1x.',
        alreadyAttempted: true,
      };
    }

    // Get the quiz to check correct answer
    const quiz = await supabase
      .from('article_quiz')
      .select('correct_answer')
      .eq('id', quizId)
      .single();

    if (quiz.error) throw quiz.error;

    const isCorrect = selectedAnswer.toLowerCase() === quiz.data.correct_answer.toLowerCase();
    const pointsAwarded = isCorrect ? 1 : 0;

    // Record quiz result
    const { data: resultData, error: resultError } = await supabase
      .from('quiz_results')
      .insert({
        user_id: userId,
        quiz_id: quizId,
        article_id: articleId,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
        points_awarded: pointsAwarded
      })
      .select();

    if (resultError) throw resultError;

    // Award points only if correct
    if (isCorrect) {
      await awardPoints(userId, 1, 'trivia_correct', articleId);
    }

    // Always record trivia activity to user_activity_log
    await recordActivityToLog(userId, {
      type: 'article_read',
      category: 'Trivia',
      title: 'Trivia diselesaikan',
      description: isCorrect
        ? 'Trivia untuk artikel ini sudah diselesaikan dengan jawaban benar'
        : 'Trivia untuk artikel ini sudah diselesaikan',
      metadata: {
        articleId,
        quizId,
        selectedAnswer,
        isCorrect,
      },
      status: 'completed',
      isCompleted: true,
    });

    // Mark quiz as attempted in article_progress
    await supabase
      .from('article_progress')
      .update({
        quiz_attempted: true,
        quiz_correct: isCorrect
      })
      .eq('user_id', userId)
      .eq('article_id', articleId);

    return {
      success: true,
      isCorrect,
      pointsAwarded,
      message: isCorrect
        ? 'Jawaban benar! +1 poin'
        : 'Jawaban salah. Kesempatan trivia sudah habis (1x).',
      result: resultData?.[0]
    };
  } catch (error) {
    console.error('Error submitting quiz answer:', error.message);
    return { success: false, message: 'Error submitting answer' };
  }
}

/**
 * Submit multi-question quiz attempt for generated quizzes
 */
export async function submitGeneratedQuizAttempt(userId, articleId, attempt) {
    if (!supabase || !userId) return { success: false, message: 'User tidak ditemukan.' };

  try {
    const attempted = await hasTriviaAttempt(userId, articleId);
    if (attempted) {
      return {
        success: false,
        message: 'Trivia untuk artikel ini sudah pernah dikerjakan. Kesempatan hanya 1x.',
        alreadyAttempted: true,
      };
    }

    const totalQuestions = Number(attempt?.totalQuestions || 0);
    const correctCount = Number(attempt?.correctCount || 0);
    const articleTitle = attempt?.articleTitle || 'Artikel';
    const articleCategory = attempt?.articleCategory || 'Trivia';

    if (correctCount > 0) {
      const awardedCorrect = await awardPoints(userId, correctCount, 'trivia_correct', articleId);
      if (!awardedCorrect) {
        return { success: false, message: 'Poin trivia belum berhasil disimpan. Coba lagi.' };
      }
    }

    const perfect = totalQuestions > 0 && correctCount === totalQuestions;

    await supabase
      .from('article_progress')
      .upsert({
        user_id: userId,
        article_id: articleId,
        quiz_attempted: true,
        quiz_correct: perfect,
      }, {
        onConflict: 'user_id,article_id'
      });

    await recordActivityToLog(userId, {
      type: 'article_read',
      category: articleCategory,
      title: `Trivia: ${articleTitle}`,
      description: `Trivia untuk artikel ${articleTitle} sudah diselesaikan`,
      metadata: {
        articleId,
        articleTitle,
        totalQuestions,
        correctCount,
        durationSeconds: Number(attempt?.durationSeconds || 0),
      },
      status: 'completed',
      isCompleted: true,
    });

    return {
      success: true,
      totalQuestions,
      correctCount,
      perfect,
      pointsAwarded: correctCount,
      message: perfect
        ? `Perfect score! +${correctCount} poin`
        : `Kamu menjawab benar ${correctCount}/${totalQuestions}. +${correctCount} poin`,
    };
  } catch (error) {
    console.error('Error submitting generated quiz attempt:', error.message);
    return { success: false, message: 'Gagal menyimpan hasil trivia.' };
  }
}

export async function hasTriviaAttempt(userId, articleId) {
  if (!supabase || !userId || !articleId) return false;

  try {
    const progress = await getArticleProgress(userId, articleId);
    const progressAttempted = Boolean(progress?.quiz_attempted);
    if (progressAttempted) return true;

    const { count, error } = await supabase
      .from('quiz_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('article_id', articleId);
    const quizAttempted = Number(count || 0) > 0;

    if (error) {
      console.error('Error checking trivia attempt from quiz_results:', error.message);
    } else if (quizAttempted) {
      return true;
    }

    const { count: legacyCount, error: legacyError } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('reference_id', articleId)
      .in('activity_type', ['trivia_correct', 'article_read']);

    if (legacyError) {
      console.error('Error checking trivia attempt from legacy activity_log:', legacyError.message);
      return progressAttempted || quizAttempted;
    }

    return Number(legacyCount || 0) > 0;
  } catch (error) {
    console.error('Error checking trivia attempt:', error.message);
    return false;
  }
}

/**
 * Check if user already completed quiz for article
 */
export async function getArticleProgress(userId, articleId) {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('article_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching article progress:', error.message);
    return null;
  }
}

// ============ TOURNAMENT PLAYER SYSTEM ============

/**
 * Register user as tournament player
 */
export async function registerTournamentPlayer(userId, tournamentId, playerData) {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('tournament_players')
      .insert({
        user_id: userId,
        tournament_id: tournamentId,
        player_name: playerData.playerName,
        player_number: playerData.playerNumber || null,
        position: playerData.position || null,
        jersey_name: playerData.jerseyName || playerData.playerName,
        team_id: playerData.teamId || null,
        status: 'active'
      })
      .select();

    if (error) throw error;

    // Award points for joining tournament
    await awardPoints(userId, 10, 'event_join', tournamentId);

    return data?.[0] || null;
  } catch (error) {
    console.error('Error registering tournament player:', error.message);
    return null;
  }
}

/**
 * Get all players in a tournament
 */
export async function getTournamentPlayers(tournamentId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'active')
      .order('player_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching tournament players:', error.message);
    return [];
  }
}

/**
 * Get user's tournament player record
 */
export async function getUserTournamentRecord(userId, tournamentId) {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('tournament_players')
      .select('*')
      .eq('user_id', userId)
      .eq('tournament_id', tournamentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching tournament record:', error.message);
    return null;
  }
}

// ============ MATCH STATISTICS ============

/**
 * Record player statistics for a match
 */
export async function recordMatchStatistics(playerId, tournamentId, stats) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('match_statistics')
      .insert({
        player_id: playerId,
        tournament_id: tournamentId,
        match_id: stats.matchId || null,
        goals: stats.goals || 0,
        assists: stats.assists || 0,
        yellow_cards: stats.yellowCards || 0,
        red_cards: stats.redCards || 0,
        minutes_played: stats.minutesPlayed || 0,
        rating: stats.rating || null
      })
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error recording match statistics:', error.message);
    return null;
  }
}

/**
 * Get player statistics for a tournament
 */
export async function getPlayerStatistics(playerId, tournamentId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('match_statistics')
      .select('*')
      .eq('player_id', playerId)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching player statistics:', error.message);
    return [];
  }
}

// ============ PLAYER SUSPENSION SYSTEM ============

/**
 * Check if player is suspended
 */
export async function isPlayerSuspended(playerId, matchId = null) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('is_player_suspended', {
      p_player_id: playerId,
      p_match_id: matchId
    });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error checking suspension status:', error.message);
    return null;
  }
}

/**
 * Handle red card - auto suspend for next match
 */
export async function handleRedCard(playerId, tournamentId, matchId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('handle_red_card', {
      p_player_id: playerId,
      p_tournament_id: tournamentId,
      p_match_id: matchId
    });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error handling red card:', error.message);
    return null;
  }
}

/**
 * Handle yellow card - check accumulation for suspension
 */
export async function handleYellowCard(playerId, tournamentId, matchId) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.rpc('handle_yellow_card', {
      p_player_id: playerId,
      p_tournament_id: tournamentId,
      p_match_id: matchId
    });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error handling yellow card:', error.message);
    return null;
  }
}

/**
 * Get all suspensions for a player in a tournament
 */
export async function getPlayerSuspensions(playerId, tournamentId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('player_suspensions')
      .select('*')
      .eq('player_id', playerId)
      .eq('tournament_id', tournamentId)
      .order('suspended_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching player suspensions:', error.message);
    return [];
  }
}

// ============ ACTIVITY TRACKING ============

/**
 * Log a general activity (login, share, check-in, review, referral)
 */
export async function logActivity(userId, activityType, referenceId = null) {
  if (!supabase || !userId) return null;

  const activityPoints = {
    login: 1,
    share: 2,
    checkin: 15,
    review: 8,
    referral: 20
  };

  const points = activityPoints[activityType] || 0;

  try {
    await awardPoints(userId, points, activityType, referenceId);
    return { success: true, points };
  } catch (error) {
    console.error('Error logging activity:', error.message);
    return null;
  }
}

/**
 * Get user's activity history
 */
export async function getUserActivityHistory(userId, limit = 50) {
  if (!supabase || !userId) return [];

  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching activity history:', error.message);
    return [];
  }
}
