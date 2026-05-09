// Gamification UI Components
import React, { useState, useEffect } from 'react';
import { Coins, Trophy, Flame, Award, Target, TrendingUp, Star, Zap, Lock, CheckCircle, AlertCircle } from 'lucide-react';

// ============ COIN & POINTS DISPLAY (for Header) ============
export const UserGamificationBadge = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-12 bg-neutral-300 rounded animate-pulse" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex items-center gap-3">
      {/* Coins */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-50 to-amber-50 border border-amber-200">
        <Coins size={16} className="text-amber-600" />
        <span className="text-sm font-bold text-amber-700">{stats.coins}</span>
      </div>

      {/* Points */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200">
        <Flame size={16} className="text-blue-600" />
        <span className="text-sm font-bold text-blue-700">{stats.points}</span>
      </div>

      {/* Tier Badge */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border">
        {stats.tier_level === 'Platinum' && <span className="text-lg">💎</span>}
        {stats.tier_level === 'Gold' && <span className="text-lg">🥇</span>}
        {stats.tier_level === 'Silver' && <span className="text-lg">🥈</span>}
        {stats.tier_level === 'Bronze' && <span className="text-lg">🥉</span>}
        <span className="text-xs font-bold">{stats.tier_level}</span>
      </div>
    </div>
  );
};

// ============ TIER PROGRESSION CARD ============
export const TierProgressionCard = ({ currentTier, nextTier, progressPercentage, pointsToNextTier }) => {
  const tierColors = {
    'Bronze': { bg: '#CD7F32', light: '#F4DFD0' },
    'Silver': { bg: '#C0C0C0', light: '#F0F0F0' },
    'Gold': { bg: '#FFD700', light: '#FFF9E6' },
    'Platinum': { bg: '#E5E4E2', light: '#F9F8F7' }
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Tier Progression</h3>
        <div className="flex items-center gap-2">
          <span className="text-3xl">{currentTier.icon}</span>
          <span className="font-bold text-lg">{currentTier.name}</span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-neutral-600">Progress to {nextTier?.name || 'Max Tier'}</span>
          <span className="text-sm font-bold">{progressPercentage}%</span>
        </div>
        <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${Math.min(progressPercentage, 100)}%`,
              background: currentTier.bg
            }}
          />
        </div>
      </div>

      {nextTier && (
        <div className="text-center">
          <p className="text-sm text-neutral-600">
            Kumpulkan <span className="font-bold text-lg">{pointsToNextTier}</span> poin lagi untuk mencapai <span className="font-bold">{nextTier.name}</span>
          </p>
        </div>
      )}
    </div>
  );
};

// ============ ACTIVITY CARD ============
export const ActivityCard = ({ activity }) => {
  const activityIcons = {
    login: <Zap size={18} className="text-blue-600" />,
    article_read: <Target size={18} className="text-cyan-600" />,
    trivia_correct: <Star size={18} className="text-yellow-600" />,
    share: <Trophy size={18} className="text-purple-600" />,
    event_join: <Flame size={18} className="text-red-600" />,
    checkin: <CheckCircle size={18} className="text-green-600" />,
    review: <Award size={18} className="text-indigo-600" />,
    referral: <TrendingUp size={18} className="text-emerald-600" />,
    transaction: <Coins size={18} className="text-amber-600" />
  };

  const activityLabels = {
    login: 'Masuk ke Stadione',
    article_read: 'Membaca Artikel',
    trivia_correct: 'Jawab Trivia Benar',
    share: 'Bagikan Konten',
    event_join: 'Daftar Event',
    checkin: 'Check-in Lapangan',
    review: 'Tulis Review',
    referral: 'Referral Berhasil',
    transaction: 'Transaksi'
  };

  const date = new Date(activity.created_at);
  const timeStr = date.toLocaleDateString('id-ID', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="flex items-start gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
      <div className="flex-shrink-0 mt-1">
        {activityIcons[activity.activity_type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900">
          {activityLabels[activity.activity_type] || activity.activity_type}
        </p>
        <p className="text-xs text-neutral-500 mt-0.5">{timeStr}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className={`text-sm font-bold ${activity.points_earned > 0 ? 'text-blue-600' : 'text-amber-600'}`}>
          {activity.points_earned > 0 ? `+${activity.points_earned}` : `+${activity.points_earned}`} {activity.activity_type === 'transaction' ? 'Coin' : 'Poin'}
        </span>
      </div>
    </div>
  );
};

// ============ ARTICLE QUIZ MODAL ============
export const ArticleQuizModal = ({ quiz, onSubmit, onClose, loading }) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const handleSubmit = () => {
    if (selectedAnswer) {
      onSubmit(selectedAnswer);
      setSelectedAnswer(null);
    }
  };

  if (!quiz) return null;

  const options = [
    { key: 'a', label: quiz.option_a },
    { key: 'b', label: quiz.option_b },
    { key: 'c', label: quiz.option_c },
    { key: 'd', label: quiz.option_d }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star size={24} className="fill-white" />
            <h2 className="text-xl font-bold">Trivia Quiz</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 text-sm mb-4">Jawab dengan benar untuk mendapatkan +5 poin!</p>
          
          <div className="mb-8">
            <h3 className="text-lg font-bold text-neutral-900 mb-6">{quiz.question}</h3>

            <div className="space-y-3">
              {options.map(option => (
                <button
                  key={option.key}
                  onClick={() => !loading && setSelectedAnswer(option.key)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    selectedAnswer === option.key
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold ${
                      selectedAnswer === option.key
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-neutral-300'
                    }`}>
                      {option.key.toUpperCase()}
                    </div>
                    <span className="text-neutral-900">{option.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {quiz.explanation && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <span className="font-bold">💡 Penjelasan: </span>
                  {quiz.explanation}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-lg border border-neutral-200 font-bold hover:bg-neutral-50 transition disabled:opacity-50"
            >
              Lewati
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedAnswer || loading}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Kirim Jawaban
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ QUIZ RESULT TOAST ============
export const QuizResultToast = ({ result, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 max-w-sm p-4 rounded-lg text-white shadow-lg z-50 flex items-center gap-3 animate-slide-in ${
      result.isCorrect ? 'bg-green-600' : 'bg-red-600'
    }`}>
      {result.isCorrect ? (
        <>
          <CheckCircle size={24} className="flex-shrink-0" />
          <div>
            <p className="font-bold">Jawaban Benar!</p>
            <p className="text-sm">+5 poin diterima</p>
          </div>
        </>
      ) : (
        <>
          <AlertCircle size={24} className="flex-shrink-0" />
          <div>
            <p className="font-bold">Jawaban Salah!</p>
            <p className="text-sm">Coba lagi di artikel berikutnya</p>
          </div>
        </>
      )}
    </div>
  );
};

// ============ TOURNAMENT PLAYER REGISTRATION CARD ============
export const TournamentPlayerCard = ({ player, onViewStats, onEdit, canSuspend }) => {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-neutral-900">{player.player_name}</h4>
          <p className="text-sm text-neutral-600">#{player.player_number || 'N/A'} • {player.position || 'Pemain'}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${
          player.status === 'suspended'
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700'
        }`}>
          {player.status === 'suspended' ? '🚫 Suspended' : '✓ Aktif'}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onViewStats}
          className="flex-1 px-3 py-2 text-sm font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
        >
          Statistik
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex-1 px-3 py-2 text-sm font-bold rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

// ============ PLAYER STATISTICS DISPLAY ============
export const PlayerStatisticsWidget = ({ stats, totalStats, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="h-32 bg-neutral-200 rounded animate-pulse" />
      </div>
    );
  }

  const statItems = [
    { label: 'Goals', value: totalStats.totalGoals || 0, icon: '⚽', color: 'bg-green-100 text-green-700' },
    { label: 'Assists', value: totalStats.totalAssists || 0, icon: '🤝', color: 'bg-blue-100 text-blue-700' },
    { label: '🟨 Cards', value: totalStats.totalYellowCards || 0, icon: '⚠️', color: 'bg-yellow-100 text-yellow-700' },
    { label: '🟥 Cards', value: totalStats.totalRedCards || 0, icon: '❌', color: 'bg-red-100 text-red-700' }
  ];

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <h3 className="text-lg font-bold mb-4">Statistik Pertandingan</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item, idx) => (
          <div key={idx} className={`${item.color} rounded-lg p-4 text-center`}>
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-2xl font-bold">{item.value}</div>
            <div className="text-xs opacity-80 mt-1">{item.label}</div>
          </div>
        ))}
      </div>
      {stats.length > 0 && (
        <div className="mt-4 text-sm text-neutral-600">
          Total matches played: {stats.length}
        </div>
      )}
    </div>
  );
};

// ============ SUSPENSION WARNING ============
export const SuspensionWarning = ({ isSuspended, yellowCardCount, lastRedCard }) => {
  if (!isSuspended && yellowCardCount === 0) return null;

  return (
    <div className={`p-4 rounded-lg border-l-4 flex items-start gap-3 ${
      isSuspended
        ? 'bg-red-50 border-red-400'
        : 'bg-yellow-50 border-yellow-400'
    }`}>
      <div className="text-2xl flex-shrink-0">
        {isSuspended ? '🚫' : '⚠️'}
      </div>
      <div>
        {isSuspended ? (
          <>
            <p className="font-bold text-red-900">Player Suspended</p>
            <p className="text-sm text-red-800 mt-1">
              Pemain tidak dapat dihubungkan ke lineup sampai suspension selesai.
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-yellow-900">{yellowCardCount} Kartu Kuning</p>
            <p className="text-sm text-yellow-800 mt-1">
              {2 - yellowCardCount} kartu kuning lagi = suspension 1 pertandingan
            </p>
          </>
        )}
      </div>
    </div>
  );
};
