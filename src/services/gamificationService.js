// Gamification Services - Points, Coins, and Activity Tracking
import { supabase } from '../config/supabase';

// ============ POINTS & COINS SYSTEM ============

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

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error awarding points:', error.message);
    return null;
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
    const { data, error } = await supabase.rpc('get_user_gamification_stats', {
      p_user_id: userId
    });

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error fetching user stats:', error.message);
    return null;
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
    // Get the quiz to check correct answer
    const quiz = await supabase
      .from('article_quiz')
      .select('correct_answer')
      .eq('id', quizId)
      .single();

    if (quiz.error) throw quiz.error;

    const isCorrect = selectedAnswer.toLowerCase() === quiz.data.correct_answer.toLowerCase();
    const pointsAwarded = isCorrect ? 5 : 0;

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

    // Award points if correct
    if (isCorrect) {
      await awardPoints(userId, 5, 'trivia_correct', articleId);
    }

    // Mark quiz as attempted
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
      message: isCorrect ? 'Jawaban benar! +5 poin' : 'Jawaban salah. Coba lagi!',
      result: resultData?.[0]
    };
  } catch (error) {
    console.error('Error submitting quiz answer:', error.message);
    return { success: false, message: 'Error submitting answer' };
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
