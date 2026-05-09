// COMPLETE EXAMPLE: Integrating Gamification into Stadione
// This shows how all components work together in a real component

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Star, Coins, Flame, MessageCircle, ChevronDown, LogOut, Settings, Calendar, BarChart3, X, Menu } from 'lucide-react';

// ============ IMPORTS ============
import { useUserGamification, useArticleReading, useScrollTracker, useTournamentPlayers, useUserTournamentRecord, useTierProgression } from '../hooks/useGamification';
import { UserGamificationBadge, TierProgressionCard, ArticleQuizModal, QuizResultToast, TournamentPlayerCard } from '../components/GamificationUI';
import { submitQuizAnswer, registerTournamentPlayer } from '../services/gamificationService';

// ============ UPDATED HEADER WITH GAMIFICATION ============
const HeaderWithGamification = ({ current, onNav, auth, onOpenAuth, onLogout, onChat }) => {
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  
  // NEW: Add gamification stats
  const { stats, loading: statsLoading } = useUserGamification(auth?.id);
  
  const items = [
    { id: 'booking', label: 'Booking Lapangan' },
    { id: 'tournament', label: 'Turnamen & Liga' },
    { id: 'news', label: 'Berita' },
    { id: 'training', label: 'Pelatihan' },
  ];
  
  const totalUnread = 5; // Mock value - replace with real chat count

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-300" style={{ background: 'rgba(244,244,244,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <button onClick={() => onNav('home')} className="flex items-center gap-2.5">
          <span className="text-2xl font-bold">⚽</span>
          <span className="font-bold text-xl">Stadione</span>
        </button>

        <nav className="hidden lg:flex items-center gap-1">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
                current === item.id ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 relative">
          {auth ? (
            <>
              {/* NEW: Gamification Badge */}
              <UserGamificationBadge stats={stats} loading={statsLoading} />

              {/* Chat Button */}
              <button onClick={onChat} className="relative p-2.5 hover:bg-neutral-200 rounded-full">
                <MessageCircle size={18} />
                {totalUnread > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center bg-red-600">
                    {totalUnread}
                  </span>
                )}
              </button>

              {/* User Menu */}
              <button
                onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-neutral-200"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold bg-red-600">
                  {auth.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <ChevronDown size={14} />
              </button>

              {userMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl border border-neutral-200 shadow-xl z-50">
                    <div className="p-4 border-b border-neutral-100">
                      <div className="font-bold">{auth.name}</div>
                      <div className="text-xs text-neutral-500">{auth.email}</div>
                    </div>
                    <div className="py-2">
                      {/* NEW: Profile & Stats Link */}
                      <button
                        onClick={() => {
                          onNav('profile');
                          setUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3"
                      >
                        <Trophy size={14} /> Profil & Statistik
                      </button>
                      
                      <button
                        onClick={() => {
                          onNav('coach-dashboard');
                          setUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3"
                      >
                        <BarChart3 size={14} /> Dashboard Pelatih
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                        <Calendar size={14} /> Booking Saya
                      </button>
                      <button className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
                        <Settings size={14} /> Pengaturan
                      </button>
                    </div>
                    <div className="border-t border-neutral-100 py-2">
                      <button
                        onClick={() => {
                          onLogout();
                          setUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-3"
                      >
                        <LogOut size={14} /> Keluar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={() => onOpenAuth('login')} className="hidden md:inline px-4 py-2 text-sm font-semibold text-neutral-700">
                Masuk
              </button>
              <button onClick={() => onOpenAuth('register')} className="px-4 py-2 text-sm font-bold rounded-full text-white bg-red-600">
                Daftar
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

// ============ ARTICLE DETAIL WITH READING TRACKER & QUIZ ============
const ArticleDetailWithGamification = ({ articleId, userId, article }) => {
  const articleRef = useRef(null);
  
  // NEW: Add hooks for reading tracking
  const { progress, quiz, updateProgress } = useArticleReading(userId, articleId);
  const scrollDepth = useScrollTracker(articleRef, async () => {
    // Auto-mark as read at 90% scroll
    await updateProgress(90, true);
  });

  const [showQuiz, setShowQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);

  // Show quiz when reading is complete
  useEffect(() => {
    if (progress?.read_completed && quiz && !progress?.quiz_attempted) {
      setShowQuiz(true);
    }
  }, [progress, quiz]);

  const handleQuizSubmit = async (answer) => {
    if (!quiz) return;
    setQuizLoading(true);

    try {
      const result = await submitQuizAnswer(userId, quiz.id, articleId, answer);
      setQuizResult(result);
      setShowQuiz(false);

      // Refetch progress to update UI
      await updateProgress(scrollDepth, progress.read_completed);
    } finally {
      setQuizLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Reading Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-neutral-600">Reading Progress</span>
          <span className="text-sm font-bold text-blue-600">{scrollDepth}%</span>
        </div>
        <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${Math.min(scrollDepth, 100)}%` }}
          />
        </div>
      </div>

      {/* Article Content */}
      <article ref={articleRef} className="prose max-w-none mb-8" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <h1 className="text-3xl font-bold mb-4">{article?.title}</h1>
        <p className="text-lg text-neutral-600 mb-6">{article?.excerpt}</p>
        
        {/* Mock article body */}
        <div className="space-y-4 text-neutral-700">
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit...</p>
          <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...</p>
          <p>Ut enim ad minim veniam, quis nostrud exercitation...</p>
          {/* Add more paragraphs to make scrolling necessary */}
          {Array(8).fill(0).map((_, i) => (
            <p key={i}>Additional paragraph {i + 1} with content...</p>
          ))}
        </div>
      </article>

      {/* Quiz Modal */}
      {showQuiz && (
        <ArticleQuizModal
          quiz={quiz}
          onSubmit={handleQuizSubmit}
          onClose={() => setShowQuiz(false)}
          loading={quizLoading}
        />
      )}

      {/* Quiz Result Toast */}
      {quizResult && (
        <QuizResultToast
          result={quizResult}
          onClose={() => setQuizResult(null)}
        />
      )}

      {/* Reading Completed State */}
      {progress?.read_completed && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-900">
            ✓ Artikel selesai dibaca! {!progress?.quiz_attempted && 'Trivia quiz sedang menunggu jawaban Anda.'}
          </p>
        </div>
      )}
    </div>
  );
};

// ============ TOURNAMENT DETAIL WITH PLAYER REGISTRATION ============
const TournamentDetailWithGamification = ({ tournamentId, userId }) => {
  const { players, loading: playersLoading, refetch } = useTournamentPlayers(tournamentId);
  const { record: userRecord, isRegistered } = useUserTournamentRecord(userId, tournamentId);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [formData, setFormData] = useState({
    playerName: '',
    playerNumber: '',
    position: '',
    jerseyName: ''
  });

  const handleRegister = async () => {
    if (!formData.playerName) {
      alert('Nama pemain harus diisi');
      return;
    }

    const result = await registerTournamentPlayer(userId, tournamentId, formData);
    if (result) {
      setShowRegisterForm(false);
      setFormData({ playerName: '', playerNumber: '', position: '', jerseyName: '' });
      refetch();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Daftar Pemain</h1>
        {!isRegistered && (
          <button
            onClick={() => setShowRegisterForm(true)}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
          >
            Daftar Sebagai Pemain
          </button>
        )}
      </div>

      {/* Registration Form */}
      {showRegisterForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Daftar Sebagai Pemain</h2>
            
            <div className="space-y-4 mb-6">
              <input
                type="text"
                placeholder="Nama Pemain"
                value={formData.playerName}
                onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-200 rounded-lg"
              />
              <input
                type="number"
                placeholder="Nomor Jersey (opsional)"
                value={formData.playerNumber}
                onChange={(e) => setFormData({ ...formData, playerNumber: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-200 rounded-lg"
              />
              <select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-2 border border-neutral-200 rounded-lg"
              >
                <option value="">Pilih Posisi</option>
                <option value="Goalkeeper">Goalkeeper</option>
                <option value="Defender">Defender</option>
                <option value="Midfielder">Midfielder</option>
                <option value="Forward">Forward</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRegisterForm(false)}
                className="flex-1 px-4 py-2 border border-neutral-200 rounded-lg font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleRegister}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
              >
                Daftar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Players Grid */}
      {isRegistered && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {playersLoading ? (
            <div>Loading players...</div>
          ) : (
            players.map(player => (
              <TournamentPlayerCard
                key={player.id}
                player={player}
                onViewStats={() => console.log('View stats for', player.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Your Player Record */}
      {isRegistered && userRecord && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-bold mb-2">Your Registration</h3>
          <p className="text-neutral-700">
            {userRecord.player_name} #{userRecord.player_number} - {userRecord.position}
          </p>
          <p className="text-sm text-neutral-600 mt-2">Status: {userRecord.status}</p>
        </div>
      )}
    </div>
  );
};

// ============ USER PROFILE PAGE WITH GAMIFICATION STATS ============
const ProfilePageWithGamification = ({ userId }) => {
  const { stats, loading } = useUserGamification(userId);
  const tierProgression = useTierProgression(stats?.points || 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Profil & Statistik</h1>

      {loading ? (
        <div>Loading stats...</div>
      ) : (
        <>
          {/* Tier Progression Card */}
          <TierProgressionCard
            currentTier={tierProgression.currentTier}
            nextTier={tierProgression.nextTier}
            progressPercentage={tierProgression.progressPercentage}
            pointsToNextTier={tierProgression.pointsToNextTier}
          />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center">
              <div className="text-3xl font-bold text-amber-600">{stats.coins}</div>
              <div className="text-sm text-neutral-600 mt-2">💛 Coins</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.points}</div>
              <div className="text-sm text-neutral-600 mt-2">🔥 Points</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center">
              <div className="text-3xl font-bold">{stats.articles_read}</div>
              <div className="text-sm text-neutral-600 mt-2">📖 Articles Read</div>
            </div>
            <div className="bg-white rounded-lg border border-neutral-200 p-6 text-center">
              <div className="text-3xl font-bold">{stats.tournaments_joined}</div>
              <div className="text-sm text-neutral-600 mt-2">🏆 Tournaments</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============ EXPORTS ============
export {
  HeaderWithGamification,
  ArticleDetailWithGamification,
  TournamentDetailWithGamification,
  ProfilePageWithGamification
};

// ============ USAGE IN MAIN APP ============
/*
In your stadione.jsx:

import {
  HeaderWithGamification,
  ArticleDetailWithGamification,
  TournamentDetailWithGamification,
  ProfilePageWithGamification
} from './gamificationExamples';

// Replace existing components with gamification versions:
<HeaderWithGamification
  current={current}
  onNav={onNav}
  auth={auth}
  onOpenAuth={onOpenAuth}
  onLogout={onLogout}
  onChat={onChat}
/>

// In page routing:
case 'article-detail':
  return <ArticleDetailWithGamification articleId={...} userId={auth?.id} />;

case 'tournament-detail':
  return <TournamentDetailWithGamification tournamentId={...} userId={auth?.id} />;

case 'profile':
  return <ProfilePageWithGamification userId={auth?.id} />;
*/
