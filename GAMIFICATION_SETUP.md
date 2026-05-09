# Gamification System Implementation Guide

## 📋 Overview

This guide covers the implementation of Stadione's complete gamification system, including:
- Dual-currency rewards (Coins & Points)
- Tier progression system
- Article reading with auto-quiz generation
- Tournament player registration & management
- Match statistics tracking
- Automatic player suspension system

## 🗄️ Database Setup

### Step 1: Import Gamification Schema

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query and copy the contents of `supabase-gamification-schema.sql`
3. Run the migration to create all tables and indexes

### Step 2: Create RPC Functions

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query and copy the contents of `supabase-gamification-functions.sql`
3. Run all RPC functions

### Step 3: Verify Setup

Check that these tables exist in Supabase:
- `user_stats` - Tracks coins, points, tier level
- `activity_log` - Records all player activities
- `article_progress` - Tracks article reading progress
- `article_quiz` - Stores quiz questions and answers
- `quiz_results` - Records user quiz attempts
- `tournament_players` - Player registration in tournaments
- `match_statistics` - Goals, assists, cards tracking
- `player_lineups` - Match lineup data
- `player_suspensions` - Red/yellow card records

## 💾 Files Created

### Backend Services
- **`src/services/gamificationService.js`** - All API functions for gamification

### React Hooks
- **`src/hooks/useGamification.js`** - Custom hooks for gamification features

### UI Components
- **`src/components/GamificationUI.jsx`** - Reusable gamification components

### Database Schemas
- **`supabase-gamification-schema.sql`** - Table definitions and RLS policies
- **`supabase-gamification-functions.sql`** - RPC functions for business logic

## 🎯 Integration Checklist

### 1. Update Header Component

Add gamification badge to show coins, points, and tier:

```jsx
import { useUserGamification } from '../hooks/useGamification';
import { UserGamificationBadge } from '../components/GamificationUI';

// In Header component
const { stats, loading } = useUserGamification(userId);

// Add to header JSX
{auth && (
  <div className="flex items-center gap-4">
    <UserGamificationBadge stats={stats} loading={loading} />
    {/* ... rest of header ... */}
  </div>
)}
```

### 2. Create "Profile" Page

Show user's complete gamification stats with:
- Current tier and progression bar
- Total coins and points
- Activity history
- Statistics breakdown

```jsx
import { useUserGamification, useTierProgression, useActivityHistory } from '../hooks/useGamification';
import { TierProgressionCard, ActivityCard } from '../components/GamificationUI';

// Component code
```

### 3. Update Article Detail Page

Implement reading tracker and quiz:

```jsx
import { useArticleReading, useScrollTracker } from '../hooks/useGamification';
import { ArticleQuizModal, QuizResultToast } from '../components/GamificationUI';
import { submitQuizAnswer } from '../services/gamificationService';

const ArticleDetail = ({ articleId, userId }) => {
  const articleRef = useRef();
  const { progress, quiz, updateProgress } = useArticleReading(userId, articleId);
  const scrollDepth = useScrollTracker(articleRef, () => {
    updateProgress(90, true);
  });

  const [showQuiz, setShowQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  const handleQuizSubmit = async (answer) => {
    const result = await submitQuizAnswer(userId, quiz.id, articleId, answer);
    setQuizResult(result);
    setShowQuiz(false);
  };

  useEffect(() => {
    if (progress?.read_completed && !progress?.quiz_attempted && quiz) {
      setShowQuiz(true);
    }
  }, [progress, quiz]);

  return (
    <div ref={articleRef} className="article-content">
      {/* Article content */}
      
      {showQuiz && (
        <ArticleQuizModal
          quiz={quiz}
          onSubmit={handleQuizSubmit}
          onClose={() => setShowQuiz(false)}
        />
      )}

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

### 4. Tournament Players Registration

Implement player registration and management:

```jsx
import { useUserTournamentRecord, useTournamentPlayers } from '../hooks/useGamification';
import { registerTournamentPlayer } from '../services/gamificationService';
import { TournamentPlayerCard } from '../components/GamificationUI';

const TournamentDetail = ({ tournamentId, userId }) => {
  const { players, refetch } = useTournamentPlayers(tournamentId);
  const { record, isSuspended } = useUserTournamentRecord(userId, tournamentId);
  const [showRegister, setShowRegister] = useState(false);

  const handleRegister = async (playerData) => {
    const result = await registerTournamentPlayer(userId, tournamentId, playerData);
    if (result) {
      refetch();
      setShowRegister(false);
    }
  };

  return (
    <div>
      {!record ? (
        <button onClick={() => setShowRegister(true)}>
          Daftar Sebagai Pemain
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {players.map(player => (
            <TournamentPlayerCard key={player.id} player={player} />
          ))}
        </div>
      )}

      {showRegister && (
        <RegistrationModal
          tournamentId={tournamentId}
          onSubmit={handleRegister}
          onClose={() => setShowRegister(false)}
        />
      )}
    </div>
  );
};
```

### 5. Payment Integration

Award coins when payment is completed:

```jsx
import { awardCoinsFromTransaction } from '../services/gamificationService';

const handlePaymentSuccess = async (userId, amount) => {
  // Process payment...
  
  // Award coins
  const result = await awardCoinsFromTransaction(userId, amount);
  
  // Show notification
  if (result) {
    showNotification(`Pembayaran berhasil! +${result.coins_earned} Coin`);
  }
};
```

## 📊 Activity Points Table

| Activity | Points | Trigger |
|----------|--------|---------|
| Daily Login | 1 | First login each day |
| Article Read | 2 | Complete 90% of article |
| Trivia Correct | 5 | Answer quiz correctly |
| Share Content | 2 | User clicks share |
| Event Join | 10 | Register for tournament |
| Check-in | 15 | Check-in at venue |
| Review | 8 | Submit review |
| Referral | 20 | Friend joins via link |

## 💰 Coin Earning

- **Formula**: 1 Coin per Rp 10,000 spent
- **When**: Automatically awarded after successful payment
- **Use Case**: Future redemption system (cosmetics, badges, etc.)

## 🏆 Tier Progression

| Tier | Points Range | Emoji |
|------|-------------|-------|
| Bronze | 0 - 499 | 🥉 |
| Silver | 500 - 1,999 | 🥈 |
| Gold | 2,000 - 4,999 | 🥇 |
| Platinum | 5,000+ | 💎 |

## ⚽ Tournament Player System

### Player Registration
1. User registers for tournament
2. Provides player name, number, position
3. Auto-awarded 10 points
4. Player record created with "active" status

### Lineup Management
1. Coach/admin selects starting 11
2. System checks suspension status
3. Suspended players cannot be selected
4. Substitutions recorded with timestamp

### Statistics Tracking
- Goals scored
- Assists provided
- Yellow cards received
- Red cards received
- Minutes played
- Match rating (optional)

### Suspension System

**Auto-Suspension Rules:**
1. **Red Card** → Immediate suspension for next match
2. **2 Yellow Cards** → 1 match suspension
3. **Misconduct** → Manual admin action

**Prevention:**
- Can't add suspended player to lineup
- Display warning in UI
- Automatic status update in database

## 🔄 Data Flow Examples

### Example 1: Article Reading Completion

```
User scrolls article → 90% reached
→ ArticleDetail triggers onReadComplete()
→ updateArticleProgress(userId, articleId, 90, true)
→ Database: article_progress.read_completed = true
→ User automatically sees quiz modal
→ User submits answer
→ submitQuizAnswer() calls Supabase RPC
→ If correct: award_points() +5 poin
→ Quiz result recorded
```

### Example 2: Tournament Registration

```
User clicks "Daftar Sebagai Pemain"
→ registerTournamentPlayer() called
→ Insert into tournament_players table
→ awardPoints(..., 'event_join', 10)
→ activity_log entry created
→ user_stats.points increased by 10
→ Tier recalculated automatically
→ Player card appears in list
```

### Example 3: Red Card & Suspension

```
Admin records red card in match stats
→ handleRedCard(playerId, tournamentId, matchId)
→ handle_red_card() RPC executes
→ New suspension record created
→ tournament_players.status = 'suspended'
→ isPlayerSuspended() returns true
→ Player cannot be added to next lineup
→ UI shows suspension warning
```

## 🧪 Testing Checklist

- [ ] User stats initialized on signup
- [ ] Coins awarded on payment (test with different amounts)
- [ ] Points awarded for activities
- [ ] Tier auto-updates when points threshold crossed
- [ ] Article reading tracked to 90%
- [ ] Quiz appears after reading completion
- [ ] Quiz points awarded correctly (only +5 for correct)
- [ ] Player registration creates record
- [ ] Suspension prevents lineup selection
- [ ] Activity history displays correctly
- [ ] Gamification badge shows in header

## 🚀 Future Enhancements

1. **Leaderboards** - Global, weekly, and tournament-specific
2. **Achievements** - Badge system for milestones
3. **Coin Shop** - Cosmetics and in-app purchases
4. **Streaks** - Bonus points for consecutive daily logins
5. **Analytics** - Detailed performance dashboard
6. **Notifications** - Real-time updates for points earned
7. **Social Features** - Compare stats with friends

## 📝 Notes

- All gamification data is user-scoped via Row Level Security
- Activity log provides complete audit trail
- Suspension system prevents unauthorized lineup changes
- Quiz generation can be automated via AI (future)
- Stats are rolled up automatically from individual matches

## ❓ Troubleshooting

**Quiz not appearing after reading?**
- Check if scroll depth >= 90%
- Verify quiz record exists in article_quiz table
- Check browser console for errors

**Coins not awarded?**
- Verify payment amount >= 10,000
- Check if award_coins_from_transaction RPC exists
- Review activity_log for transaction entry

**Player suspension not working?**
- Check player_suspensions table for records
- Verify is_player_suspended() RPC
- Test suspension status with is_active = true

**Points not updating?**
- Check if user_stats record exists for user
- Verify award_points RPC
- Review activity_log entries
