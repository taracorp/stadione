import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../../AdminLayout';
import { DataContext } from '../../../../context/DataContext';
import supabase from '../../../../config/supabase';

export default function MembershipManagementPage({ venueId }) {
  const { user } = useContext(DataContext);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [toast, setToast] = useState(null);

  // Form state for new/edit tier
  const [formData, setFormData] = useState({
    tier_name: 'Bronze',
    tier_level: 1,
    discount_percent: 5,
    has_priority_booking: false,
    bonus_hours_per_month: 0,
    annual_fee_idr: 500000,
    description: '',
  });

  // Load membership tiers
  useEffect(() => {
    if (venueId && user?.id) {
      loadTiers();
    }
  }, [venueId, user?.id]);

  const loadTiers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('membership_types')
        .select('*')
        .eq('venue_id', venueId)
        .order('tier_level', { ascending: true });

      if (error) throw error;
      setTiers(data || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenModal = (tier = null) => {
    if (tier) {
      setEditingTier(tier);
      setFormData({
        tier_name: tier.tier_name,
        tier_level: tier.tier_level,
        discount_percent: tier.discount_percent,
        has_priority_booking: tier.has_priority_booking,
        bonus_hours_per_month: tier.bonus_hours_per_month,
        annual_fee_idr: tier.annual_fee_idr,
        description: tier.description || '',
      });
    } else {
      setEditingTier(null);
      setFormData({
        tier_name: 'Bronze',
        tier_level: 1,
        discount_percent: 5,
        has_priority_booking: false,
        bonus_hours_per_month: 0,
        annual_fee_idr: 500000,
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTier(null);
  };

  const handleSave = async () => {
    try {
      // Validate
      if (!formData.tier_name || formData.annual_fee_idr <= 0) {
        showToast('Mohon isi semua field dengan benar', 'error');
        return;
      }

      if (editingTier) {
        // Update
        const { error } = await supabase
          .from('membership_types')
          .update({
            discount_percent: formData.discount_percent,
            has_priority_booking: formData.has_priority_booking,
            bonus_hours_per_month: formData.bonus_hours_per_month,
            annual_fee_idr: formData.annual_fee_idr,
            description: formData.description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTier.id);

        if (error) throw error;
        showToast('Tier berhasil diperbarui');
      } else {
        // Create
        const { error } = await supabase
          .from('membership_types')
          .insert({
            venue_id: venueId,
            tier_name: formData.tier_name,
            tier_level: formData.tier_level,
            discount_percent: formData.discount_percent,
            has_priority_booking: formData.has_priority_booking,
            bonus_hours_per_month: formData.bonus_hours_per_month,
            annual_fee_idr: formData.annual_fee_idr,
            description: formData.description,
            is_active: true,
          });

        if (error) throw error;
        showToast('Tier berhasil dibuat');
      }

      handleCloseModal();
      loadTiers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleActive = async (tier) => {
    try {
      const { error } = await supabase
        .from('membership_types')
        .update({ is_active: !tier.is_active })
        .eq('id', tier.id);

      if (error) throw error;
      showToast(tier.is_active ? 'Tier dinonaktifkan' : 'Tier diaktifkan');
      loadTiers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const getTierColor = (tierName) => {
    const colors = {
      Bronze: 'bg-amber-100 text-amber-900',
      Silver: 'bg-slate-100 text-slate-900',
      Gold: 'bg-yellow-100 text-yellow-900',
      Platinum: 'bg-purple-100 text-purple-900',
    };
    return colors[tierName] || 'bg-gray-100 text-gray-900';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Membership</h1>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Tambah Tier
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              toast.type === 'error'
                ? 'bg-red-100 text-red-900'
                : 'bg-green-100 text-green-900'
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              Belum ada tier membership. Buat yang pertama!
            </div>
          ) : (
            tiers.map((tier) => (
              <div
                key={tier.id}
                className={`p-4 rounded-lg border-2 ${getTierColor(tier.tier_name)} ${
                  !tier.is_active ? 'opacity-50' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{tier.tier_name}</h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      tier.is_active
                        ? 'bg-green-200 text-green-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {tier.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <div className="text-sm space-y-1 mb-3">
                  <p>💰 {tier.discount_percent}% Diskon</p>
                  <p>⭐ Prioritas Booking: {tier.has_priority_booking ? 'Ya' : 'Tidak'}</p>
                  <p>⏰ {tier.bonus_hours_per_month} Jam Bonus/Bulan</p>
                  <p className="font-bold mt-2">
                    Rp {tier.annual_fee_idr?.toLocaleString('id-ID') || 0}/Tahun
                  </p>
                </div>

                {tier.description && (
                  <p className="text-xs mb-3 italic border-t-2 pt-2">{tier.description}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(tier)}
                    className="flex-1 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(tier)}
                    className={`flex-1 px-3 py-1 text-sm rounded transition ${
                      tier.is_active
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {tier.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Edit/Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {editingTier ? `Edit ${editingTier.tier_name}` : 'Tambah Tier Baru'}
              </h2>

              <div className="space-y-3">
                {/* Tier Name (disabled if editing) */}
                {!editingTier && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Nama Tier</label>
                    <select
                      value={formData.tier_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          tier_name: e.target.value,
                          tier_level: ['Bronze', 'Silver', 'Gold', 'Platinum'].indexOf(
                            e.target.value
                          ) + 1,
                        })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Bronze">Bronze</option>
                      <option value="Silver">Silver</option>
                      <option value="Gold">Gold</option>
                      <option value="Platinum">Platinum</option>
                    </select>
                  </div>
                )}

                {/* Discount Percent */}
                <div>
                  <label className="block text-sm font-medium mb-1">Diskon (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, discount_percent: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Priority Booking */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.has_priority_booking}
                      onChange={(e) =>
                        setFormData({ ...formData, has_priority_booking: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <span className="ml-2 text-sm font-medium">Aktifkan Prioritas Booking</span>
                  </label>
                </div>

                {/* Bonus Hours Per Month */}
                <div>
                  <label className="block text-sm font-medium mb-1">Jam Bonus/Bulan</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.bonus_hours_per_month}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bonus_hours_per_month: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Annual Fee */}
                <div>
                  <label className="block text-sm font-medium mb-1">Biaya Tahunan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.annual_fee_idr}
                    onChange={(e) =>
                      setFormData({ ...formData, annual_fee_idr: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-1">Deskripsi (opsional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Contoh: Untuk member loyal dengan booking reguler"
                    rows="2"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
