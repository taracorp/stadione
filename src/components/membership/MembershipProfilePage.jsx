import React, { useState, useEffect, useContext } from 'react';
import { DataContext } from '../../../../context/DataContext';
import supabase from '../../../../config/supabase';

export default function MembershipProfilePage({ venueId }) {
  const { user } = useContext(DataContext);
  const [membership, setMembership] = useState(null);
  const [bonusHours, setBonusHours] = useState([]);
  const [pointsHistory, setPointsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview'); // overview | points | bonus | history

  useEffect(() => {
    if (venueId && user?.id) {
      loadMembershipData();
    }
  }, [venueId, user?.id]);

  const loadMembershipData = async () => {
    try {
      setLoading(true);

      // Get active membership
      const { data: membershipData, error: membershipError } = await supabase
        .from('customer_memberships')
        .select('*, membership_types(*)')
        .eq('customer_id', user.id)
        .eq('venue_id', venueId)
        .eq('status', 'active')
        .single();

      if (membershipError && membershipError.code !== 'PGRST116') throw membershipError;

      if (membershipData) {
        setMembership(membershipData);

        // Get bonus hours
        const { data: bonusData } = await supabase
          .from('bonus_hours')
          .select('*')
          .eq('membership_id', membershipData.id)
          .order('expiration_date', { ascending: true });

        setBonusHours(bonusData || []);

        // Get points history
        const { data: pointsData } = await supabase
          .from('reward_points_log')
          .select('*')
          .eq('membership_id', membershipData.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setPointsHistory(pointsData || []);
      }
    } catch (err) {
      console.error('Error loading membership:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tierName) => {
    const colors = {
      Bronze: 'from-amber-400 to-amber-600',
      Silver: 'from-slate-300 to-slate-500',
      Gold: 'from-yellow-400 to-yellow-600',
      Platinum: 'from-purple-400 to-purple-600',
    };
    return colors[tierName] || 'from-gray-400 to-gray-600';
  };

  const getTierIcon = (tierName) => {
    const icons = {
      Bronze: '🥉',
      Silver: '🥈',
      Gold: '🥇',
      Platinum: '👑',
    };
    return icons[tierName] || '⭐';
  };

  const calculateTotalBonusHours = () => {
    return bonusHours.reduce((total, item) => total + (item.hours_remaining || 0), 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="p-6 text-center">
        <div className="text-6xl mb-4">😔</div>
        <h2 className="text-2xl font-bold mb-2">Belum Ada Membership Aktif</h2>
        <p className="text-gray-600 mb-6">
          Anda belum memiliki membership aktif di venue ini. Daftarkan diri Anda sekarang untuk mendapatkan diskon dan benefit eksklusif!
        </p>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
          Daftar Membership
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Membership Header Card */}
      <div
        className={`bg-gradient-to-br ${getTierColor(membership.membership_types?.tier_name)} rounded-lg p-6 text-white mb-6 shadow-lg`}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {getTierIcon(membership.membership_types?.tier_name)} {membership.membership_types?.tier_name}
            </h1>
            <p className="text-lg opacity-90">Member sejak {formatDate(membership.start_date)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Status</p>
            <p className="text-2xl font-bold">AKTIF</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white border-opacity-30">
          <div className="text-center">
            <p className="text-3xl font-bold">{membership.reward_points_balance}</p>
            <p className="text-sm opacity-90">Poin Reward</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{calculateTotalBonusHours()}</p>
            <p className="text-sm opacity-90">Jam Bonus</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{membership.membership_types?.discount_percent}%</p>
            <p className="text-sm opacity-90">Diskon</p>
          </div>
        </div>

        <p className="text-sm mt-4 opacity-75">
          ⏰ Berlaku sampai {formatDate(membership.end_date)}
        </p>
      </div>

      {/* Benefits Overview */}
      <div className="bg-white rounded-lg border-2 border-blue-200 p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">Benefit Membership Anda</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl mb-2">💰</p>
            <p className="text-sm font-medium">{membership.membership_types?.discount_percent}% Diskon</p>
          </div>
          {membership.membership_types?.has_priority_booking && (
            <div className="p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl mb-2">⭐</p>
              <p className="text-sm font-medium">Prioritas Booking</p>
            </div>
          )}
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-2xl mb-2">🎁</p>
            <p className="text-sm font-medium">{membership.membership_types?.bonus_hours_per_month}h/Bulan</p>
          </div>
          <div className="p-3 bg-yellow-50 rounded-lg">
            <p className="text-2xl mb-2">🏆</p>
            <p className="text-sm font-medium">Poin Reward</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'bonus', label: '⏰ Bonus Hours' },
          { id: 'points', label: '🎁 Reward Points' },
          { id: 'history', label: '📝 Riwayat' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 font-medium transition ${
              tab === t.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border-2 p-4">
            <h4 className="font-bold mb-3">Informasi Membership</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tier</span>
                <span className="font-medium">{membership.membership_types?.tier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tanggal Daftar</span>
                <span className="font-medium">{formatDate(membership.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Berlaku Hingga</span>
                <span className="font-medium text-blue-600">{formatDate(membership.end_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className="font-medium px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Aktif</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border-2 p-4">
            <h4 className="font-bold mb-3">Statistik Penggunaan</h4>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Poin Reward Tersisa</p>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{
                      width: `${Math.min((membership.reward_points_balance / 1000) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {membership.reward_points_balance} poin (= Rp {(membership.reward_points_balance * 100).toLocaleString('id-ID')})
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Jam Bonus Tersisa</p>
                <p className="text-2xl font-bold text-green-600">{calculateTotalBonusHours()} jam</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'bonus' && (
        <div className="space-y-4">
          {bonusHours.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Belum ada bonus hours yang dialokasikan
            </div>
          ) : (
            bonusHours.map((bonus) => (
              <div key={bonus.id} className="bg-white rounded-lg border-2 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold">{bonus.hours_allocated} Jam Bonus</p>
                    <p className="text-sm text-gray-600">
                      Dialokasikan: {formatDate(bonus.allocated_date)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      bonus.expiration_date < new Date().toISOString().split('T')[0]
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {bonus.expiration_date < new Date().toISOString().split('T')[0]
                      ? 'Kadaluarsa'
                      : 'Aktif'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{bonus.hours_allocated}</p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{bonus.hours_used}</p>
                    <p className="text-xs text-gray-600">Digunakan</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{bonus.hours_remaining}</p>
                    <p className="text-xs text-gray-600">Sisa</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500">Berlaku hingga {formatDate(bonus.expiration_date)}</p>

                {bonus.hours_remaining > 0 && (
                  <button className="w-full mt-3 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition">
                    Gunakan Jam Bonus
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'points' && (
        <div className="bg-white rounded-lg border-2 p-6">
          <h4 className="font-bold mb-4">Reward Points Anda</h4>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Points</p>
              <p className="text-3xl font-bold text-blue-600">{membership.reward_points_balance}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Nilai (Rp)</p>
              <p className="text-3xl font-bold text-green-600">
                {(membership.reward_points_balance * 100).toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-3">💡 Dapatkan 1 poin untuk setiap Rp 100 yang dibelanjakan</p>

          <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
            Tukarkan Poin untuk Diskon
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {pointsHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Belum ada riwayat transaksi points
            </div>
          ) : (
            pointsHistory.map((item) => (
              <div key={item.id} className="bg-white rounded-lg border-2 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {item.transaction_type === 'earned' ? '✅ Poin Diterima' : '💸 Poin Digunakan'}
                    </p>
                    <p className="text-sm text-gray-600">{item.reason}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${
                        item.transaction_type === 'earned'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {item.transaction_type === 'earned' ? '+' : '-'}
                      {item.points_amount}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
