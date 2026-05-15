import React, { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Filter, Star, Users } from 'lucide-react';
import { searchPublicVenues } from '../../services/supabaseService.js';

const SPORTS = ['Futsal', 'Basket', 'Volley', 'Badminton', 'Tennis', 'Padel', 'Sepak Bola', 'Tenis Meja', 'Esports'];
const INDONESIAN_PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Jambi', 'Sumatera Selatan',
  'Bengkulu', 'Lampung', 'Bangka Belitung', 'Kepulauan Riau', 'DKI Jakarta',
  'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Banten',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat',
  'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Selatan', 'Papua Tengah'
];

export default function PublicVenueListingPage({ onSelectVenue }) {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    sport: '',
    province: '',
    city: '',
    minPrice: '',
    maxPrice: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const results = await searchPublicVenues({
        sport: filters.sport || undefined,
        province: filters.province || undefined,
        city: filters.city || undefined,
        minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
        maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        limit: 50,
      });
      setVenues(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    search();
  }, [search]);

  const filteredVenues = searchQuery
    ? venues.filter(v =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.city.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : venues;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-12">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-4xl font-display mb-2">Temukan Venue Olahraga</h1>
            <p className="text-emerald-50 text-lg">Jelajahi ribuan venue terbaik di seluruh Indonesia</p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari venue, kota, atau olahraga..."
              className="w-full pl-12 pr-4 py-3 rounded-2xl border-none text-neutral-900 placeholder-neutral-500"
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 text-neutral-900 font-semibold mb-6 hover:bg-neutral-200 transition"
        >
          <Filter size={16} />
          {showFilters ? 'Sembunyikan Filter' : 'Tampilkan Filter'}
        </button>

        {/* Filters */}
        {showFilters && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Jenis Olahraga</label>
                <select
                  value={filters.sport}
                  onChange={e => setFilters(f => ({ ...f, sport: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
                >
                  <option value="">Semua Olahraga</option>
                  {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Provinsi</label>
                <select
                  value={filters.province}
                  onChange={e => setFilters(f => ({ ...f, province: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
                >
                  <option value="">Semua Provinsi</option>
                  {INDONESIAN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Kota</label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}
                  placeholder="Nama kota..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Harga Minimum (Rp)</label>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                  placeholder="Rp 0"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-900 mb-2">Harga Maksimal (Rp)</label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                  placeholder="Rp 1.000.000"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setFilters({ sport: '', province: '', city: '', minPrice: '', maxPrice: '' });
              }}
              className="w-full px-4 py-2 rounded-lg border border-neutral-300 text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition"
            >
              Reset Filter
            </button>
          </div>
        )}

        {/* Results */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-40 rounded-2xl bg-neutral-100 animate-pulse" />
              ))}
            </div>
          ) : filteredVenues.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 p-12 text-center">
              <p className="text-neutral-500 mb-2">Tidak ada venue yang cocok dengan filter Anda.</p>
              <p className="text-sm text-neutral-400">Coba ubah filter pencarian Anda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-neutral-600 mb-4">
                Ditemukan {filteredVenues.length} venue
              </p>
              {filteredVenues.map(venue => (
                <button
                  key={venue.id}
                  onClick={() => onSelectVenue?.(venue.id)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white p-5 hover:shadow-lg transition text-left"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-neutral-900">{venue.name}</h3>
                        {venue.is_featured && (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                            ⭐ Featured
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-neutral-600 mb-2 flex-wrap">
                        <MapPin size={14} />
                        <span>{venue.city}, Provinsi</span>
                      </div>
                      <p className="text-sm text-neutral-600 mb-3">{venue.sport}</p>

                      {/* Rating & Review Count */}
                      {venue.reviews_count > 0 && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                size={14}
                                className={i < Math.round(venue.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-semibold">{venue.rating}</span>
                          <span className="text-sm text-neutral-600">({venue.reviews_count} ulasan)</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right space-y-2">
                      <div className="text-2xl font-bold text-emerald-600">
                        Rp {venue.price?.toLocaleString('id-ID')}
                      </div>
                      <p className="text-xs text-neutral-500">/jam</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
