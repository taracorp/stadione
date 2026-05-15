import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Clock, Star, Users, Wifi, Zap, Wind, Navigation, ChevronRight, MessageCircle } from 'lucide-react';
import { supabase } from '../../config/supabase.js';
import { fetchPublicVenueDetails, fetchVenueReviewSummary, submitVenueReview } from '../../services/supabaseService.js';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const FACILITY_ICONS = {
  parking: '🅿️', wifi: '📶', ac: '❄️', lounge: '🛋️', 
  cafe: '☕', shower: '🚿', locker: '🔒', medical: '🏥',
};

function formatTime(time) {
  if (!time) return '—';
  return String(time).slice(0, 5);
}

export default function PublicVenuePage({ venueId, onBooking }) {
  const [venueData, setVenueData] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: '',
    comment: '',
    reviewerName: '',
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!venueId) return;
    setLoading(true);
    try {
      const [details, summary] = await Promise.all([
        fetchPublicVenueDetails(venueId),
        fetchVenueReviewSummary(venueId),
      ]);

      if (!details) {
        showToast('error', 'Venue tidak ditemukan.');
        return;
      }

      setVenueData(details);
      setReviewSummary(summary);
    } catch (err) {
      console.error('Venue page load error:', err);
      showToast('error', 'Gagal memuat venue.');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmitReview() {
    if (!reviewForm.comment.trim()) {
      showToast('error', 'Komentar tidak boleh kosong.');
      return;
    }

    setSubmittingReview(true);
    try {
      const result = await submitVenueReview(venueId, {
        ...reviewForm,
        userId: supabase.auth.user?.id,
      });

      if (result.error) throw new Error(result.error);
      showToast('success', 'Review berhasil dikirim untuk moderasi.');
      setShowReviewForm(false);
      setReviewForm({ rating: 5, title: '', comment: '', reviewerName: '' });
      load();
    } catch (err) {
      showToast('error', err.message || 'Gagal mengirim review.');
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-2xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!venueData) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-neutral-500">Venue tidak ditemukan.</p>
      </div>
    );
  }

  const { venue, photos, facilities, reviews, operatingHours, courts } = venueData;
  const coverPhoto = photos.find(p => p.is_cover) || photos[0];
  const averageRating = reviewSummary?.average_rating || 0;
  const totalReviews = reviewSummary?.total_reviews || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl text-white font-semibold shadow-lg text-sm ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header & Cover Photo */}
      <div className="space-y-4">
        {coverPhoto && (
          <div className="relative rounded-3xl overflow-hidden h-96 bg-neutral-100">
            <img
              src={coverPhoto.photo_url}
              alt={venue.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h1 className="text-4xl font-display mb-1">{venue.name}</h1>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={14} />
                    <span>{venue.city}, {venue.province}</span>
                  </div>
                </div>
                {venue.is_featured && (
                  <div className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold">
                    ⭐ Featured
                  </div>
                )}
              </div>
              {totalReviews > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-400'}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-semibold">{averageRating} ({totalReviews} ulasan)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Photo Gallery */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setActivePhotoIndex(idx)}
                className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition ${
                  activePhotoIndex === idx ? 'border-emerald-600' : 'border-neutral-200'
                }`}
              >
                <img src={photo.photo_url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-200 p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Tipe Olahraga</div>
          <div className="text-lg font-bold text-neutral-900">{venue.sport}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Harga per Jam</div>
          <div className="text-lg font-bold text-emerald-600">Rp {venue.price?.toLocaleString('id-ID')}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 p-4 space-y-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Total Lapangan</div>
          <div className="text-lg font-bold text-neutral-900">{courts.length} Lapangan</div>
        </div>
      </div>

      {/* Description */}
      {venue.description && (
        <div className="rounded-2xl border border-neutral-200 p-6 space-y-2">
          <h2 className="text-lg font-bold text-neutral-900">Tentang Venue Ini</h2>
          <p className="text-neutral-600 leading-relaxed">{venue.description}</p>
        </div>
      )}

      {/* Operating Hours */}
      {operatingHours.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-neutral-900">Jam Operasional</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {operatingHours.map((hours) => (
              <div key={hours.day_of_week} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-neutral-700">{DAYS[hours.day_of_week]}</span>
                {hours.is_open ? (
                  <span className="text-neutral-600">{formatTime(hours.open_time)} - {formatTime(hours.close_time)}</span>
                ) : (
                  <span className="text-red-600 font-semibold">Tutup</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facilities */}
      {facilities.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-neutral-900">Fasilitas</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {facilities.map((facility) => (
              <div key={facility.id} className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-2xl">{FACILITY_ICONS[facility.facility_name.toLowerCase()] || '✓'}</span>
                <div>
                  <div className="font-semibold text-neutral-900 text-sm">{facility.facility_name}</div>
                  {facility.description && <div className="text-xs text-neutral-600">{facility.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Courts */}
      {courts.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-neutral-900">Lapangan Tersedia</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {courts.map((court) => (
              <div key={court.id} className="rounded-xl border border-neutral-200 p-4 space-y-2">
                <div className="font-bold text-neutral-900">{court.name}</div>
                <div className="text-sm text-neutral-600 space-y-1">
                  <div>Jenis: {court.sport_type}</div>
                  <div>Kapasitas: {court.capacity} orang</div>
                  <div className="flex gap-2 flex-wrap">
                    {court.indoor && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Indoor</span>}
                    {court.has_lighting && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Pencahayaan</span>}
                    {court.has_ac && <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded">AC</span>}
                  </div>
                </div>
                <div className="font-bold text-emerald-600">Rp {court.price_per_hour?.toLocaleString('id-ID')}/jam</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="rounded-2xl border border-neutral-200 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 mb-1">Ulasan Pelanggan</h2>
            {totalReviews > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < Math.round(averageRating) ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}
                    />
                  ))}
                </div>
                <span className="font-semibold">{averageRating}</span>
                <span className="text-neutral-600">({totalReviews} ulasan)</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition"
          >
            <MessageCircle size={14} className="inline mr-2" />
            Beri Ulasan
          </button>
        </div>

        {showReviewForm && (
          <div className="rounded-xl bg-neutral-50 p-4 space-y-3">
            <div>
              <label className="block text-sm font-bold text-neutral-900 mb-1">Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setReviewForm(f => ({ ...f, rating: num }))}
                    className="p-1"
                  >
                    <Star
                      size={24}
                      className={num <= reviewForm.rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-900 mb-1">Nama</label>
              <input
                type="text"
                value={reviewForm.reviewerName}
                onChange={e => setReviewForm(f => ({ ...f, reviewerName: e.target.value }))}
                placeholder="Nama Anda"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-900 mb-1">Judul</label>
              <input
                type="text"
                value={reviewForm.title}
                onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ringkasan ulasan Anda"
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-neutral-900 mb-1">Ulasan</label>
              <textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="Bagikan pengalaman Anda di venue ini..."
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {submittingReview ? 'Mengirim...' : 'Kirim Ulasan'}
              </button>
              <button
                onClick={() => setShowReviewForm(false)}
                className="px-4 py-2 rounded-lg border border-neutral-200 text-sm font-bold text-neutral-600"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {reviews.length > 0 ? (
          <div className="space-y-3 pt-4 border-t border-neutral-200">
            {reviews.map((review) => (
              <div key={review.id} className="p-4 rounded-xl border border-neutral-100 bg-neutral-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-bold text-neutral-900">{review.reviewer_name}</div>
                    <div className="flex items-center gap-1 text-xs text-neutral-600 mt-0.5">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-300'}
                          />
                        ))}
                      </div>
                      {review.verified_booking && <span className="text-emerald-600 font-bold">✓ Verified</span>}
                    </div>
                  </div>
                </div>
                {review.title && <div className="font-semibold text-neutral-900 text-sm mb-1">{review.title}</div>}
                <p className="text-sm text-neutral-700">{review.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-neutral-500">Belum ada ulasan. Jadilah yang pertama memberikan ulasan!</div>
        )}
      </div>

      {/* CTA */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 text-white space-y-4">
        <h2 className="text-2xl font-display">Siap Booking Sekarang?</h2>
        <p className="text-emerald-50">Pilih lapangan dan jadwalkan sesi Anda sekarang di {venue.name}.</p>
        <button
          onClick={() => onBooking?.(venueId)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-600 font-bold hover:bg-neutral-50 transition"
        >
          Buka Form Booking
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Contact */}
      {venue.contact_number || venue.maps_url && (
        <div className="rounded-2xl border border-neutral-200 p-6 space-y-4">
          <h2 className="text-lg font-bold text-neutral-900">Hubungi Kami</h2>
          <div className="space-y-2">
            {venue.contact_number && (
              <a
                href={`https://wa.me/${venue.contact_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition text-sm font-semibold text-neutral-900"
              >
                📱 {venue.contact_number}
              </a>
            )}
            {venue.maps_url && (
              <a
                href={venue.maps_url}
                target="_blank"
                rel="noreferrer"
                className="block px-4 py-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition text-sm font-semibold text-neutral-900"
              >
                <Navigation size={14} className="inline mr-2" />
                Lihat Lokasi di Google Maps
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
