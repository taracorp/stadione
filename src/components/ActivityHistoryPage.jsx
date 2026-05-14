import React, { useState, useEffect } from 'react';
import { 
  fetchUserActivityHistory, 
  getActivitySummary,
  fetchUserVenueBookings,
  fetchUserArticlesRead,
  fetchUserTournamentParticipations,
  fetchUserCommunityMembershipsLog,
  fetchUserTrainingEnrollments
} from '../services/supabaseService.js';

export default function ActivityHistoryPage({ userId }) {
  const [activities, setActivities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadActivityData();
  }, [userId]);

  const loadActivityData = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      // Fetch summary
      const summaryData = await getActivitySummary(userId);
      setSummary(summaryData);

      // Fetch all activities
      const activityData = await fetchUserActivityHistory(userId, { limit: 200 });
      setActivities(activityData || []);
    } catch (err) {
      console.error('Error loading activity data:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const getFiltered = () => {
    let filtered = activities;

    if (filterType !== 'all') {
      filtered = filtered.filter(a => a.activity_type === filterType);
    }

    if (filterStatus !== 'all') {
      if (filterStatus === 'running') {
        filtered = filtered.filter(a => a.status === 'active' && !a.is_completed);
      } else if (filterStatus === 'completed') {
        filtered = filtered.filter(a => a.is_completed || a.status === 'completed');
      }
    }

    return filtered;
  };

  const getActivityIcon = (type) => {
    const icons = {
      venue_booking: '🏟️',
      article_read: '📖',
      tournament_participation: '🏆',
      community_join: '👥',
      training_enrollment: '🎓',
      quiz_attempt: '📝',
      points_earned: '⭐'
    };
    return icons[type] || '📌';
  };

  const getActivityColor = (type) => {
    const colors = {
      venue_booking: 'bg-blue-50 border-blue-200',
      article_read: 'bg-purple-50 border-purple-200',
      tournament_participation: 'bg-red-50 border-red-200',
      community_join: 'bg-green-50 border-green-200',
      training_enrollment: 'bg-yellow-50 border-yellow-200',
      quiz_attempt: 'bg-indigo-50 border-indigo-200',
      points_earned: 'bg-orange-50 border-orange-200'
    };
    return colors[type] || 'bg-gray-50 border-gray-200';
  };

  const getStatusBadge = (activity) => {
    if (activity.is_completed || activity.status === 'completed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Selesai
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        ▶ Berjalan
      </span>
    );
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const filtered = getFiltered();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat riwayat aktivitas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📅 Riwayat Aktivitas</h1>
          <p className="text-gray-600">Lihat semua aktivitas dan riwayat Anda di Stadione</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Booking Lapangan</div>
              <div className="text-2xl font-bold text-blue-600">{summary.totalVenueBookings}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Trivia Diselesaikan</div>
              <div className="text-2xl font-bold text-purple-600">{summary.totalArticlesRead}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Turnamen Diikuti</div>
              <div className="text-2xl font-bold text-red-600">{summary.totalTournamentsJoined}</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">Komunitas Bergabung</div>
              <div className="text-2xl font-bold text-green-600">{summary.totalCommunitiesJoined}</div>
            </div>
          </div>

          {/* Status Overview */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-center">
              <div className="text-xl font-bold text-blue-600">{summary.runningActivitiesCount}</div>
              <div className="text-xs text-gray-600">Berjalan</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-center">
              <div className="text-xl font-bold text-green-600">{summary.completedActivitiesCount}</div>
              <div className="text-xs text-gray-600">Selesai</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-center">
              <div className="text-xl font-bold text-orange-600">{summary.totalTrainingsEnrolled}</div>
              <div className="text-xs text-gray-600">Pelatihan</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Tipe Aktivitas
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Semua Tipe</option>
                <option value="venue_booking">🏟️ Booking Lapangan</option>
                <option value="article_read">🧠 Trivia</option>
                <option value="tournament_participation">🏆 Turnamen</option>
                <option value="community_join">👥 Komunitas</option>
                <option value="training_enrollment">🎓 Pelatihan</option>
                <option value="quiz_attempt">📝 Quiz</option>
                <option value="points_earned">⭐ Poin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">Semua Status</option>
                <option value="running">▶ Berjalan</option>
                <option value="completed">✓ Selesai</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">Tidak ada aktivitas yang cocok dengan filter</p>
            <p className="text-gray-500 text-sm mt-2">Coba ubah filter atau mulai kegiatan baru</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((activity) => (
              <div
                key={activity.id}
                className={`bg-white rounded-lg border-l-4 p-4 shadow-sm ${getActivityColor(activity.activity_type)} hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-3xl mt-1">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {activity.activity_title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {activity.activity_description}
                      </p>
                      {activity.activity_category && (
                        <p className="text-xs text-gray-500 mt-2">
                          Kategori: <span className="font-medium">{activity.activity_category}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        📅 {formatDate(activity.activity_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {getStatusBadge(activity)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
