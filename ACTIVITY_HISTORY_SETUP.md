# User Activity History Tracking

## Overview

Stadione now features a comprehensive **User Activity History** system that tracks all user activities across the platform in one unified view. Users can see their complete history of:

- **🏟️ Booking Lapangan** - Venue reservations
- **📖 Artikel** - Articles read  
- **🏆 Turnamen** - Tournament participations
- **👥 Komunitas** - Community memberships
- **🎓 Pelatihan** - Training program enrollments
- **📝 Quiz** - Quiz attempts
- **⭐ Poin** - Points earned

## Features

### Status Tracking
- **▶ Berjalan** (Running) - Ongoing activities
- **✓ Selesai** (Completed) - Finished activities

### Summary Dashboard
- Total bookings, articles read, tournaments joined
- Total communities joined and training enrollments
- Count of running vs completed activities
- Recent activity timeline

### Filtering & Search
- Filter by activity type (booking, articles, tournaments, etc.)
- Filter by status (running/completed)
- Sort by date (newest first)

## Database Schema

### Tables

#### `user_activity_log` - Main activity log
Unified log for all user activities with support for multiple types.

```sql
- id: Unique identifier
- user_id: References auth.users
- activity_type: venue_booking, article_read, tournament_participation, etc.
- activity_category: Sport, category, or classification
- activity_title: User-friendly activity title
- activity_description: Detailed description
- activity_date: When the activity occurred
- activity_metadata: JSON metadata (flexible)
- status: active or completed
- is_completed: Boolean completion flag
- completion_date: When activity was completed
- created_at, updated_at: Timestamps
```

#### `user_venue_bookings` - Venue booking history
Detailed venue booking records with status and timestamps.

```sql
- id: Unique identifier
- user_id: User who made the booking
- venue_id: Booked venue
- venue_name, venue_city: Venue details
- booking_date, booking_time: When the booking is for
- duration_hours: Booking duration
- sport: Sport type
- status: confirmed, tentative, cancelled, completed
- booking_created_at, booking_completed_at: Booking lifecycle
```

#### `user_articles_read` - Article reading history
Tracks which articles users have read and reading metrics.

```sql
- id: Unique identifier
- user_id: User who read
- article_id, article_title, article_category: Article details
- read_date: When article was read
- read_duration_seconds: How long user spent reading
- completion_percentage: % of article read
```

#### `user_tournament_participations` - Tournament history
Records of user tournament registrations and participation.

```sql
- id: Unique identifier
- user_id: User who participated
- tournament_id, tournament_name, sport: Tournament details
- registration_type: individual or team
- registration_status: registered, approved, rejected, etc.
- tournament_start_date: Tournament date
- status: registered, ongoing, completed
- result_placement: Final placement in tournament
```

#### `user_community_memberships_log` - Community membership history
Tracks which communities users have joined.

```sql
- id: Unique identifier
- user_id: User who joined
- community_id, community_name, sport: Community details
- joined_date: When user joined
- status: active or left
- posts_count, events_attended: Engagement metrics
```

#### `user_training_enrollments` - Training enrollment history
Tracks user enrollments in training programs.

```sql
- id: Unique identifier
- user_id: User enrolled
- academy_id, academy_name, academy_city: Academy details
- program_name, sport: Program details
- enrollment_date: Enrollment date
- status: enrolled, ongoing, completed, dropped
- progress_percentage: Course completion %
- classes_attended, total_classes: Attendance tracking
```

## Service Functions

### Fetching Activities

#### `fetchUserActivityHistory(userId, options)`
Fetch user's complete activity history with optional filters.

```javascript
const activities = await fetchUserActivityHistory(userId, {
  limit: 50,
  type: 'tournament_participation', // optional: filter by type
  status: 'active' // optional: filter by status
});
```

#### Activity-Specific Fetchers
```javascript
// Venue bookings
const bookings = await fetchUserVenueBookings(userId);

// Articles read
const articles = await fetchUserArticlesRead(userId);

// Tournament participations
const tournaments = await fetchUserTournamentParticipations(userId);

// Training enrollments
const trainings = await fetchUserTrainingEnrollments(userId);

// Community memberships log
const communities = await fetchUserCommunityMembershipsLog(userId);
```

### Recording Activities

#### `recordActivityToLog(userId, payload)`
Record a generic activity to the log.

```javascript
await recordActivityToLog(userId, {
  type: 'quiz_attempt',
  category: 'Gamification',
  title: 'Completed Quiz: Football Basics',
  description: 'Scored 8/10 on Football Basics quiz',
  metadata: { score: 8, total: 10 },
  status: 'completed',
  isCompleted: true
});
```

#### Specialized Recording Functions

```javascript
// Record venue booking
await recordVenueBooking(userId, {
  venueId: 123,
  venueName: 'Lapangan Sleman',
  venueCity: 'Sleman',
  bookingDate: '2025-05-20',
  bookingTime: '19:00',
  durationHours: 2,
  sport: 'futsal',
  status: 'confirmed'
});

// Record article read
await recordArticleRead(userId, {
  articleId: 456,
  articleTitle: 'Football Tactics',
  articleCategory: 'Training',
  readDurationSeconds: 600,
  completionPercentage: 100
});

// Record tournament participation
await recordTournamentParticipation(userId, {
  tournamentId: 789,
  tournamentName: 'Futsal Championship 2025',
  sport: 'futsal',
  registrationType: 'team',
  registrationStatus: 'registered',
  tournamentStartDate: '2025-05-25',
  status: 'registered'
});

// Record community membership
await recordCommunityMembership(userId, {
  communityId: 111,
  communityName: 'Padel Jogja Community',
  sport: 'Padel',
  status: 'active'
});

// Record training enrollment
await recordTrainingEnrollment(userId, {
  academyId: 222,
  academyName: 'Garuda Football Academy',
  academyCity: 'Sleman',
  programName: 'U-16 Training Program',
  sport: 'sepakbola',
  status: 'enrolled',
  totalClasses: 12
});
```

### Status Management

#### `updateActivityStatus(activityId, status, isCompleted)`
Update an activity's status and completion state.

```javascript
await updateActivityStatus(activity.id, 'completed', true);
```

### Summary & Analytics

#### `getActivitySummary(userId)`
Get comprehensive activity statistics for a user.

```javascript
const summary = await getActivitySummary(userId);
// Returns:
// {
//   totalVenueBookings: 5,
//   totalArticlesRead: 12,
//   totalTournamentsJoined: 3,
//   totalCommunitiesJoined: 2,
//   totalTrainingsEnrolled: 1,
//   totalActivities: 25,
//   runningActivitiesCount: 8,
//   completedActivitiesCount: 17,
//   recentActivities: [...]
// }
```

## UI Component

### ActivityHistoryPage Component
Located at `src/components/ActivityHistoryPage.jsx`

Features:
- **Summary Cards** - Quick stats (total bookings, articles, tournaments, communities)
- **Status Overview** - Count of running vs completed activities
- **Filter Controls** - Filter by type and status
- **Activity Timeline** - List of all activities with icons, timestamps, and status badges
- **Empty State** - Helpful message when no activities match filter

#### Usage
```jsx
import ActivityHistoryPage from './src/components/ActivityHistoryPage.jsx';

<ActivityHistoryPage userId={authUser.id} />
```

### Accessing Activity History
Users can access their activity history in two ways:

1. **User Menu** - Click profile → "Riwayat Aktivitas" (📅 Activity History)
2. **Direct Navigation** - Click the page state: `goTo('activity-history')`

## Integration Points

### When to Record Activities

1. **Venue Bookings**: Record when user completes a booking
   - Called from: Booking flow
   - Trigger: Successful booking confirmation

2. **Articles Read**: Record when user finishes reading
   - Called from: Article detail page
   - Trigger: Article completion or 90%+ scrolled

3. **Tournament Registration**: Record when user registers
   - Called from: Tournament registration flow
   - Trigger: Registration confirmed

4. **Community Joining**: Record when user joins a community
   - Called from: `joinCommunity()` function
   - Trigger: Successful join

5. **Training Enrollment**: Record when user enrolls
   - Called from: Academy/training enrollment flow
   - Trigger: Enrollment completed

6. **Quiz/Points**: Record gamification activities
   - Called from: Gamification hooks
   - Trigger: Quiz completed, points earned

## SQL Setup

Run the SQL migration in Supabase SQL Editor:

```sql
-- Run supabase-community.sql to create all activity tracking tables
-- File location: /supabase-community.sql
```

Tables created:
- ✅ user_activity_log
- ✅ user_venue_bookings
- ✅ user_articles_read
- ✅ user_tournament_participations
- ✅ user_community_memberships_log
- ✅ user_training_enrollments

All tables have:
- Row Level Security (RLS) enabled
- Indexes for performance
- Proper foreign key relationships

## Row Level Security (RLS)

All activity tables are protected with RLS policies that ensure:
- Users can only view their own activities
- Authenticated users can insert their own activities
- Activities cannot be modified by other users

## Example Integration

```javascript
// When user books a venue
async function completeBooking(userId, venueDetails) {
  // ... booking logic ...
  
  // Record to activity history
  await recordVenueBooking(userId, {
    venueId: venueDetails.id,
    venueName: venueDetails.name,
    venueCity: venueDetails.city,
    bookingDate: selectedDate,
    bookingTime: selectedTime,
    durationHours: duration,
    sport: venueDetails.sport,
    status: 'confirmed'
  });
  
  // Record to general activity log
  await recordActivityToLog(userId, {
    type: 'venue_booking',
    category: venueDetails.sport,
    title: `Booked ${venueDetails.name}`,
    description: `Booking untuk ${selectedDate} pukul ${selectedTime}`,
    status: 'active'
  });
}

// View user's activity history
function showActivityHistory(userId) {
  const summary = await getActivitySummary(userId);
  // Display summary stats
  
  const activities = await fetchUserActivityHistory(userId, {
    limit: 100
  });
  // Display timeline
}
```

## Future Enhancements

- Real-time activity notifications
- Activity sharing/export
- Social activity feed
- Achievement badges based on activity history
- Analytics dashboard
- Activity-based recommendations
- Social comparison (leaderboards based on activities)

## Notes

- All timestamps are stored in UTC (TIMESTAMPTZ)
- Activity metadata is stored as JSON for flexibility
- Completion tracking allows for future analytics and gamification
- RLS policies ensure privacy and security
