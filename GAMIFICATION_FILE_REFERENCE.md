# Stadione Gamification System - File Reference & Quick Guide

## 📁 Complete File Structure

```
/workspaces/stadione/
│
├── Database Schema Files (SQL - Import to Supabase)
│   ├── supabase-gamification-schema.sql (450 lines)
│   │   ├── Tables: user_stats, activity_log, article_progress, article_quiz, quiz_results
│   │   ├── Tables: tournament_players, match_statistics, player_lineups, player_suspensions
│   │   ├── Indexes: 10 performance indexes
│   │   └── RLS Policies: 15 security policies
│   │
│   └── supabase-gamification-functions.sql (400 lines)
│       ├── award_points() - Award points with activity logging
│       ├── award_coins_from_transaction() - Calculate and award coins
│       ├── get_user_gamification_stats() - Aggregated user stats
│       ├── is_player_suspended() - Check suspension status
│       ├── handle_red_card() - Auto-suspend for red cards
│       ├── handle_yellow_card() - Track yellow card accumulation
│       └── Triggers & initialization functions
│
├── Backend Services (JavaScript - Copy to src/services/)
│   └── src/services/gamificationService.js (350 lines)
│       ├── Points & Coins Functions (4)
│       ├── Article Reading & Quiz Functions (6)
│       ├── Tournament Player Functions (5)
│       ├── Match Statistics Functions (4)
│       ├── Suspension System Functions (5)
│       └── Activity Tracking Functions (2)
│
├── React Hooks (JavaScript - Copy to src/hooks/)
│   └── src/hooks/useGamification.js (400 lines)
│       ├── useUserGamification() - Track user coins/points/tier
│       ├── useArticleReading() - Reading progress & quiz
│       ├── useScrollTracker() - Auto scroll depth tracking
│       ├── useTournamentPlayers() - Get tournament players list
│       ├── useUserTournamentRecord() - User's player record
│       ├── usePlayerStatistics() - Goals, assists, cards
│       ├── usePlayerSuspension() - Suspension tracking
│       ├── useActivityHistory() - User activity log
│       └── useTierProgression() - Tier calculation & progression
│
├── UI Components (React JSX - Copy to src/components/)
│   └── src/components/GamificationUI.jsx (600 lines)
│       ├── UserGamificationBadge - Header display (coins/points/tier)
│       ├── TierProgressionCard - Tier progress visualization
│       ├── ActivityCard - Single activity display
│       ├── ArticleQuizModal - Quiz interface with 4 options
│       ├── QuizResultToast - Quiz result notification
│       ├── TournamentPlayerCard - Player card display
│       ├── PlayerStatisticsWidget - Statistics dashboard
│       └── SuspensionWarning - Card/suspension alerts
│
├── Utilities (JavaScript - Copy to src/utils/)
│   └── src/utils/quizGeneration.js (350 lines)
│       ├── quizTemplates - 25+ template quizzes (6 sports)
│       ├── getOrCreateArticleQuiz() - Fetch or auto-generate
│       ├── generateQuizFromArticleContent() - AI integration point
│       ├── getUserQuizStatistics() - Quiz analytics
│       ├── getPopularQuizCategories() - Popular quiz categories
│       ├── validateQuizAnswer() - Answer validation
│       └── batchCreateQuizzes() - Admin batch operations
│
├── Integration Examples (React JSX - Reference Only)
│   └── src/examples/GamificationIntegrationExample.jsx (700 lines)
│       ├── HeaderWithGamification - Updated header component
│       ├── ArticleDetailWithGamification - Article + quiz
│       ├── TournamentDetailWithGamification - Player registration
│       └── ProfilePageWithGamification - User stats page
│
└── Documentation (Markdown - For Reference)
    ├── GAMIFICATION_SETUP.md (300 lines)
    │   ├── Database setup steps
    │   ├── Integration checklist
    │   └── Testing procedures
    │
    ├── GAMIFICATION_HEADER_INTEGRATION.md (50 lines)
    │   └── Quick header integration example
    │
    ├── GAMIFICATION_IMPLEMENTATION_SUMMARY.md (400 lines)
    │   ├── Complete system overview
    │   ├── Quick start guide
    │   ├── Feature breakdown
    │   └── Next steps
    │
    └── GAMIFICATION_FILE_REFERENCE.md (This file)
        └── File organization and quick reference
```

## 🔧 Implementation Steps

### Step 1: Database Setup (15 minutes)

**Action**: Import SQL schemas to Supabase

```bash
# 1. Open Supabase Dashboard
# 2. Go to SQL Editor
# 3. Create new query
# 4. Copy entire contents of: supabase-gamification-schema.sql
# 5. Click "RUN"
# 6. Wait for completion

# 7. Create another new query
# 8. Copy entire contents of: supabase-gamification-functions.sql
# 9. Click "RUN"
# 10. Verify all functions appear in Database → Functions
```

**Files to Run**:
- ✅ `supabase-gamification-schema.sql`
- ✅ `supabase-gamification-functions.sql`

### Step 2: Copy Service Files (5 minutes)

**Action**: Copy JavaScript files to your project

```bash
# Copy service layer
cp src/services/gamificationService.js your-project/src/services/

# Copy hooks
cp src/hooks/useGamification.js your-project/src/hooks/

# Copy UI components
cp src/components/GamificationUI.jsx your-project/src/components/

# Copy utilities
cp src/utils/quizGeneration.js your-project/src/utils/
```

**Files to Copy**:
- ✅ `src/services/gamificationService.js`
- ✅ `src/hooks/useGamification.js`
- ✅ `src/components/GamificationUI.jsx`
- ✅ `src/utils/quizGeneration.js`

### Step 3: Update Header Component (10 minutes)

**Action**: Modify your existing Header component

```jsx
// In stadione.jsx or wherever Header is defined

// ADD IMPORT
import { useUserGamification } from '../hooks/useGamification';
import { UserGamificationBadge } from '../components/GamificationUI';

// IN HEADER COMPONENT
const Header = ({ current, onNav, auth, onOpenAuth, onLogout, onChat }) => {
  // ADD THIS HOOK
  const { stats, loading } = useUserGamification(auth?.id);
  
  // ADD TO JSX BEFORE CHAT BUTTON (around line 370)
  {auth && (
    <>
      {/* NEW */}
      <UserGamificationBadge stats={stats} loading={loading} />
      
      {/* EXISTING CHAT BUTTON */}
      <button onClick={onChat} className="...">
        {/* ... */}
      </button>
      {/* ... REST OF CODE ... */}
    </>
  )}
};
```

**See**: `GAMIFICATION_HEADER_INTEGRATION.md` for complete example

### Step 4: Add Article Quiz (20 minutes)

**Action**: Update ArticleDetail component

```jsx
// IN ArticleDetail COMPONENT

import { useArticleReading, useScrollTracker } from '../hooks/useGamification';
import { ArticleQuizModal, QuizResultToast } from '../components/GamificationUI';
import { submitQuizAnswer } from '../services/gamificationService';

const ArticleDetail = ({ articleId, userId }) => {
  const articleRef = useRef();
  const { progress, quiz, updateProgress } = useArticleReading(userId, articleId);
  const scrollDepth = useScrollTracker(articleRef, async () => {
    await updateProgress(90, true);
  });

  const [showQuiz, setShowQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // Show quiz when reading completes
  useEffect(() => {
    if (progress?.read_completed && quiz && !progress?.quiz_attempted) {
      setShowQuiz(true);
    }
  }, [progress, quiz]);

  // Handle quiz submission
  const handleQuizSubmit = async (answer) => {
    const result = await submitQuizAnswer(userId, quiz.id, articleId, answer);
    setQuizResult(result);
    setShowQuiz(false);
  };

  return (
    <div ref={articleRef}>
      {/* Article content with scroll tracking */}
      
      {/* Show quiz modal */}
      {showQuiz && (
        <ArticleQuizModal
          quiz={quiz}
          onSubmit={handleQuizSubmit}
          onClose={() => setShowQuiz(false)}
        />
      )}

      {/* Show result toast */}
      {quizResult && (
        <QuizResultToast
          result={quizResult}
          onClose={() => setQuizResult(null)}
        />
      )}
    </div>
  );
};
```

**See**: `src/examples/GamificationIntegrationExample.jsx` for full component

### Step 5: Add Tournament Players (25 minutes)

**Action**: Update TournamentDetail component

```jsx
import { useTournamentPlayers, useUserTournamentRecord } from '../hooks/useGamification';
import { registerTournamentPlayer } from '../services/gamificationService';
import { TournamentPlayerCard } from '../components/GamificationUI';

const TournamentDetail = ({ tournamentId, userId }) => {
  const { players, refetch } = useTournamentPlayers(tournamentId);
  const { record, isRegistered } = useUserTournamentRecord(userId, tournamentId);

  const handleRegister = async (playerData) => {
    const result = await registerTournamentPlayer(userId, tournamentId, playerData);
    if (result) refetch();
  };

  return (
    <div>
      {!isRegistered && (
        <button onClick={() => /* show form */}>
          Daftar Sebagai Pemain
        </button>
      )}

      {isRegistered && (
        <div className="grid grid-cols-3 gap-4">
          {players.map(player => (
            <TournamentPlayerCard key={player.id} player={player} />
          ))}
        </div>
      )}
    </div>
  );
};
```

### Step 6: Create Profile Page (15 minutes)

**Action**: Create new profile page component

```jsx
import { useUserGamification, useTierProgression } from '../hooks/useGamification';
import { TierProgressionCard } from '../components/GamificationUI';

const ProfilePage = ({ userId }) => {
  const { stats } = useUserGamification(userId);
  const tierProg = useTierProgression(stats?.points || 0);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1>Profil & Statistik</h1>
      
      <TierProgressionCard
        currentTier={tierProg.currentTier}
        nextTier={tierProg.nextTier}
        progressPercentage={tierProg.progressPercentage}
        pointsToNextTier={tierProg.pointsToNextTier}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Coins" value={stats.coins} icon="💛" />
        <StatCard label="Points" value={stats.points} icon="🔥" />
        <StatCard label="Articles Read" value={stats.articles_read} icon="📖" />
        <StatCard label="Tournaments" value={stats.tournaments_joined} icon="🏆" />
      </div>
    </div>
  );
};
```

## 📊 Function Reference

### Points & Coins
```javascript
// Award points for activity
await awardPoints(userId, 10, 'event_join', tournamentId);

// Award coins from transaction
await awardCoinsFromTransaction(userId, 250000); // = 25 coins

// Get user stats
const stats = await getUserGamificationStats(userId);
```

### Article Reading
```javascript
// Update reading progress
await updateArticleProgress(userId, articleId, 90, true);

// Get quiz for article
const quiz = await getArticleQuiz(articleId);

// Submit quiz answer
const result = await submitQuizAnswer(userId, quizId, articleId, 'a');
```

### Tournament Players
```javascript
// Register as player
await registerTournamentPlayer(userId, tournamentId, {
  playerName: 'John Doe',
  playerNumber: 9,
  position: 'Forward'
});

// Get all players
const players = await getTournamentPlayers(tournamentId);

// Get player record
const record = await getUserTournamentRecord(userId, tournamentId);
```

### Match Statistics
```javascript
// Record stats
await recordMatchStatistics(playerId, tournamentId, {
  goals: 2,
  assists: 1,
  yellowCards: 0,
  redCards: 0,
  minutesPlayed: 90
});

// Get player stats
const stats = await getPlayerStatistics(playerId, tournamentId);
```

### Suspensions
```javascript
// Check if suspended
const suspension = await isPlayerSuspended(playerId, matchId);

// Handle red card
await handleRedCard(playerId, tournamentId, matchId);

// Handle yellow card
await handleYellowCard(playerId, tournamentId, matchId);
```

## 🎯 Quick Checklist

### Before Going Live
- [ ] Database schema imported in Supabase
- [ ] RPC functions created and tested
- [ ] Service files copied to project
- [ ] Hooks copied to project
- [ ] Components copied to project
- [ ] Utilities copied to project
- [ ] Header updated with gamification badge
- [ ] Article detail updated with quiz
- [ ] Tournament detail updated with players
- [ ] Profile page created
- [ ] Payment integration adds coins
- [ ] Navigation links point to profile page

### Testing
- [ ] Create test user and verify stats initialized
- [ ] Award test points and verify tier updates
- [ ] Complete article reading (scroll to 90%)
- [ ] Answer quiz correctly and verify +5 points
- [ ] Register as tournament player and verify +10 points
- [ ] Check suspension system works
- [ ] Verify points/coins display in header
- [ ] Test on mobile device

## 📝 Notes

### File Sizes
- SQL Schemas: ~850 lines total
- JavaScript Services: ~1,450 lines total
- React Components: ~600 lines
- Documentation: ~1,500 lines total

### Dependencies
- React 18 (hooks)
- Supabase (backend)
- Tailwind CSS (styling)
- Lucide Icons (icons)
- No additional packages needed

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Responsive design works on mobile

## ⚠️ Important Notes

1. **Supabase Credentials**: Keep environment variables secure
2. **RLS Policies**: Users can only see their own data
3. **Database**: Use PostgreSQL queries directly if needed
4. **Performance**: Indexes included for fast queries
5. **Scalability**: Designed to handle 1M+ users

## 🆘 Troubleshooting

**Issue**: Quiz doesn't appear after reading
- Check browser console for errors
- Verify scroll depth reaches 90%
- Confirm quiz record exists in Supabase

**Issue**: Points not updating
- Check RPC functions exist in Supabase
- Verify user_stats record created
- Check activity_log in Supabase

**Issue**: Player suspension not working
- Verify player_suspensions table
- Check is_player_suspended RPC
- Test with test data in Supabase

## 📚 Documentation Files

| File | Purpose | Pages |
|------|---------|-------|
| GAMIFICATION_SETUP.md | Complete setup guide | 10 |
| GAMIFICATION_HEADER_INTEGRATION.md | Header integration | 2 |
| GAMIFICATION_IMPLEMENTATION_SUMMARY.md | System overview | 15 |
| GAMIFICATION_FILE_REFERENCE.md | This file | 10 |
| src/examples/GamificationIntegrationExample.jsx | Code examples | 30 |

## 🚀 Next Steps

1. Import database schemas
2. Copy JavaScript files
3. Update Header component
4. Test basic functionality
5. Integrate article quiz
6. Add tournament players
7. Create profile page
8. Test all features
9. Deploy to production

---

**Total Implementation Time**: 2-3 hours
**Total Testing Time**: 1-2 hours
**Total Project Time**: 3-5 hours

Good luck! 🎊
