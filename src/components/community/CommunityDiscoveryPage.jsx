import React, { useMemo, useState } from 'react';
import { ArrowRight, Bookmark, CheckCircle, Flame, MapPin, Search, ShieldCheck, Sparkles, Users, Zap } from 'lucide-react';
import { useCommunities, useRecommendedCommunities } from '../../hooks/useSupabase.js';
import { saveCommunityRecommendationFeedback, toggleCommunityBookmark } from '../../services/supabaseService.js';
import {
  COMMUNITY_ACTIVITY_TYPES,
  COMMUNITY_CATEGORY_GROUPS,
  COMMUNITY_DISCOVERY_SECTIONS,
  COMMUNITY_LEVELS,
  COMMUNITY_SPORT_FILTERS,
  COMMUNITY_STATUSES,
  COMMUNITY_TIMES,
  COMMUNITY_TYPES,
} from '../../data/communityDiscovery.js';

const mapCommunityType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'public') return 'Open Play';
  if (normalized === 'private') return 'Social';
  if (normalized === 'invite only') return 'Competitive';
  return value || 'Social';
};

const mapActivityLevel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'low') return 'Rendah';
  if (normalized === 'medium') return 'Sedang';
  if (normalized === 'high') return 'Tinggi';
  if (normalized === 'very high') return 'Sangat tinggi';
  return value || 'Sedang';
};

const deriveStatuses = (row) => {
  if (Array.isArray(row?.badges) && row.badges.length > 0) return row.badges;
  const statuses = [];
  if (row?.verified) statuses.push('Verified');
  if (String(row?.skill_level || '').toLowerCase().includes('beginner') || String(row?.tagline || '').toLowerCase().includes('beginner')) {
    statuses.push('Beginner Friendly');
  }
  if (Number(row?.members_count || 0) >= 250 || String(row?.activity_level || '').toLowerCase() === 'very high') {
    statuses.push('Most Active');
  }
  if (Number(row?.members_count || 0) >= 180 || String(row?.activity_level || '').toLowerCase() === 'high') {
    statuses.push('Trending');
  }
  if (statuses.length === 0) statuses.push('Trending');
  return statuses;
};

const normalizeCommunityRecord = (row, index = 0) => ({
  id: row?.id || `community-${index}`,
  name: row?.name || 'Community Hub',
  sport: row?.sport || 'Sport Community',
  province: row?.province || 'Indonesia',
  city: row?.city || 'Kota belum diatur',
  district: row?.district || row?.city || 'Area komunitas',
  level: row?.skill_level || 'Casual',
  type: COMMUNITY_TYPES.includes(row?.community_type) ? row.community_type : mapCommunityType(row?.community_type),
  time: COMMUNITY_TIMES.includes(row?.activity_time) ? row.activity_time : 'Weekend',
  statuses: deriveStatuses(row),
  members: Number(row?.members_count || 0),
  activityLevel: mapActivityLevel(row?.activity_level),
  upcomingEvent: row?.latestEvent?.title
    ? `${row.latestEvent.title} · ${row.latestEvent.event_date || row.latestEvent.time_label || 'Jadwal segera diumumkan'}`
    : row?.tagline
      ? `Community Update · ${row.tagline}`
      : 'Open play & gathering schedule akan diumumkan segera',
  distanceKm: Number(row?.distance_km || (1.5 + (index * 1.2))),
  createdAt: row?.created_at || new Date().toISOString(),
  isBookmarked: Boolean(row?.isBookmarked),
  isJoined: Boolean(row?.isJoined),
  latestFeedPost: row?.latestFeedPost || row?.feedPosts?.[0] || null,
  recommendationReason: row?.recommendationReason || '',
  tags: [row?.name, row?.sport, row?.city, row?.skill_level, row?.activity_level].filter(Boolean),
});

const SectionHero = ({ kicker, title, subtitle }) => (
  <section className="border-b border-neutral-300 relative overflow-hidden grain" style={{ background: '#F4F4F4' }}>
    <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #E11D2E, transparent 70%)' }} />
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-20 relative">
      <div className="text-xs uppercase tracking-widest font-bold text-neutral-500 mb-4">{kicker}</div>
      <div className="grid lg:grid-cols-2 gap-8 items-end">
        <h1 className="font-display text-6xl lg:text-9xl leading-[0.85] text-neutral-900">{title}</h1>
        <div>
          <p className="text-lg text-neutral-700 max-w-md">{subtitle}</p>
        </div>
      </div>
    </div>
  </section>
);

export default function CommunityDiscoveryPage({ auth, openAuth, onSelectCommunity }) {
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('Trending Community');
  const [selectedSports, setSelectedSports] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedTimes, setSelectedTimes] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [actionMessage, setActionMessage] = useState('');
  const { communities, loading, refetch } = useCommunities(auth?.id || null);
  const { communities: recommendedCommunities, loading: recommendationsLoading, refetch: refetchRecommendations } = useRecommendedCommunities(auth?.id || null, { limit: 3 });

  const communitySource = useMemo(() => {
    const liveCommunities = (communities || []).map((item, index) => normalizeCommunityRecord(item, index));
    return liveCommunities;
  }, [communities]);

  const provinces = useMemo(() => ['all', ...new Set(communitySource.map((item) => item.province))], [communitySource]);
  const cities = useMemo(() => {
    const pool = selectedProvince === 'all'
      ? communitySource
      : communitySource.filter((item) => item.province === selectedProvince);
    return ['all', ...new Set(pool.map((item) => item.city))];
  }, [communitySource, selectedProvince]);
  const districts = useMemo(() => {
    const pool = communitySource.filter((item) => {
      if (selectedProvince !== 'all' && item.province !== selectedProvince) return false;
      if (selectedCity !== 'all' && item.city !== selectedCity) return false;
      return true;
    });
    return ['all', ...new Set(pool.map((item) => item.district))];
  }, [communitySource, selectedProvince, selectedCity]);

  const toggleArrayFilter = (value, setState) => {
    setState((prev) => prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]);
  };

  const filteredCommunities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const now = new Date('2026-05-16');

    return communitySource.filter((community) => {
      if (normalizedQuery) {
        const haystack = [
          community.name,
          community.sport,
          community.city,
          community.district,
          community.province,
          community.level,
          community.activityLevel,
          community.type,
          ...(community.tags || []),
        ].join(' ').toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      if (selectedSports.length > 0 && !selectedSports.includes(community.sport)) return false;
      if (selectedLevels.length > 0 && !selectedLevels.includes(community.level)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(community.type)) return false;
      if (selectedTimes.length > 0 && !selectedTimes.includes(community.time)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.every((status) => community.statuses.includes(status))) return false;

      if (selectedProvince !== 'all' && community.province !== selectedProvince) return false;
      if (selectedCity !== 'all' && community.city !== selectedCity) return false;
      if (selectedDistrict !== 'all' && community.district !== selectedDistrict) return false;

      if (activeSection === 'Trending Community' && !community.statuses.includes('Trending')) return false;
      if (activeSection === 'Nearby Community' && community.distanceKm > 8) return false;
      if (activeSection === 'Beginner Friendly' && !community.statuses.includes('Beginner Friendly')) return false;
      if (activeSection === 'Women Community' && community.type !== 'Women Only') return false;
      if (activeSection === 'Weekend Activity' && community.time !== 'Weekend') return false;
      if (activeSection === 'Most Active' && !community.statuses.includes('Most Active')) return false;
      if (activeSection === 'New Community') {
        const diff = Math.round((now.getTime() - new Date(community.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 120) return false;
      }

      return true;
    }).sort((a, b) => b.members - a.members);
  }, [
    activeSection,
    communitySource,
    query,
    selectedCity,
    selectedDistrict,
    selectedLevels,
    selectedProvince,
    selectedSports,
    selectedStatuses,
    selectedTimes,
    selectedTypes,
  ]);

  const statusBadge = (status) => {
    if (status === 'Verified') return { icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Verified Community' };
    if (status === 'Beginner Friendly') return { icon: CheckCircle, cls: 'bg-lime-100 text-lime-700 border-lime-200', label: 'Beginner Friendly' };
    if (status === 'Trending') return { icon: Flame, cls: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Trending' };
    if (status === 'Most Active') return { icon: Zap, cls: 'bg-sky-100 text-sky-700 border-sky-200', label: 'Most Active' };
    return { icon: Sparkles, cls: 'bg-neutral-100 text-neutral-700 border-neutral-200', label: status };
  };

  const resetFilters = () => {
    setQuery('');
    setSelectedSports([]);
    setSelectedLevels([]);
    setSelectedTypes([]);
    setSelectedTimes([]);
    setSelectedStatuses([]);
    setSelectedProvince('all');
    setSelectedCity('all');
    setSelectedDistrict('all');
  };

  const handleBookmark = async (community) => {
    if (!auth?.id) {
      openAuth?.('login');
      return;
    }

    const result = await toggleCommunityBookmark(auth.id, community);
    setActionMessage(result.message || 'Aksi bookmark diproses.');

    if (result.success) {
      refetch();
      refetchRecommendations();
    }
  };

  const handleRecommendationFeedback = async (community, verdict) => {
    if (!auth?.id) {
      openAuth?.('login');
      return;
    }

    const result = await saveCommunityRecommendationFeedback(auth.id, community.id, verdict, {
      source: 'community_discovery',
      reason: community.recommendationReason || 'Personalized discovery match',
      sport: community.sport,
      city: community.city,
    });

    setActionMessage(result.success
      ? verdict === 'dismissed'
        ? 'Preferensi rekomendasi diperbarui.'
        : 'Rekomendasi disimpan ke preferensi Anda.'
      : (result.message || 'Gagal menyimpan feedback rekomendasi.'));

    if (result.success) {
      refetchRecommendations();
    }
  };

  return (
    <div>
      <SectionHero
        kicker="/ FITUR 04"
        title={<>COMMUNITY<br /><span className="font-serif-it font-normal" style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic' }}>&amp; discovery.</span></>}
        subtitle="Sports social ecosystem dengan 40+ kategori komunitas, smart search, dan discovery engine untuk menemukan circle olahraga yang paling cocok."
      />

      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-10 space-y-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 lg:p-7">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500">/ Community Discovery System</div>
            <div className="text-[11px] font-semibold text-neutral-500">
              {loading ? 'Memuat komunitas...' : communities?.length > 0 ? 'Data live dari Supabase' : 'Mode fallback mock data'}
            </div>
          </div>
          {actionMessage && <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">{actionMessage}</div>}
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-neutral-300 bg-neutral-50 text-sm"
              placeholder="Cari komunitas..."
            />
          </div>
          <div className="mt-3 text-xs text-neutral-500">Smart search: nama komunitas, olahraga, kota, level, dan activity.</div>
          <div className="mt-2 text-xs text-neutral-400">Contoh: “Padel Jogja”, “Futsal wanita”, “Running beginner”, “Basket kampus”.</div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 lg:p-7 space-y-6">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Discovery Section</div>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_DISCOVERY_SECTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => setActiveSection(item)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${activeSection === item ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300 hover:border-neutral-900'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Filter by Sport</div>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_SPORT_FILTERS.map((sport) => (
                <button
                  key={sport}
                  onClick={() => toggleArrayFilter(sport, setSelectedSports)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${selectedSports.includes(sport) ? 'bg-[#E11D2E] text-white border-[#E11D2E]' : 'bg-white text-neutral-700 border-neutral-300'}`}
                >
                  {sport}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">Province</div>
              <select value={selectedProvince} onChange={(event) => { setSelectedProvince(event.target.value); setSelectedCity('all'); setSelectedDistrict('all'); }} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                {provinces.map((province) => <option key={province} value={province}>{province === 'all' ? 'Semua Province' : province}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">City</div>
              <select value={selectedCity} onChange={(event) => { setSelectedCity(event.target.value); setSelectedDistrict('all'); }} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                {cities.map((city) => <option key={city} value={city}>{city === 'all' ? 'Semua City' : city}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">District</div>
              <select value={selectedDistrict} onChange={(event) => setSelectedDistrict(event.target.value)} className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                {districts.map((district) => <option key={district} value={district}>{district === 'all' ? 'Semua District' : district}</option>)}
              </select>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">Filter by Level</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMUNITY_LEVELS.map((level) => (
                  <button key={level} onClick={() => toggleArrayFilter(level, setSelectedLevels)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${selectedLevels.includes(level) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>{level}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">Filter by Type</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMUNITY_TYPES.map((type) => (
                  <button key={type} onClick={() => toggleArrayFilter(type, setSelectedTypes)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${selectedTypes.includes(type) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>{type}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">Filter by Time</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMUNITY_TIMES.map((time) => (
                  <button key={time} onClick={() => toggleArrayFilter(time, setSelectedTimes)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${selectedTimes.includes(time) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>{time}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">Filter by Status</div>
              <div className="flex flex-wrap gap-1.5">
                {COMMUNITY_STATUSES.map((status) => (
                  <button key={status} onClick={() => toggleArrayFilter(status, setSelectedStatuses)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${selectedStatuses.includes(status) ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-300'}`}>{status}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-1">/ Community Cards</div>
              <div className="font-display text-3xl text-neutral-900">{filteredCommunities.length} COMMUNITY MATCH</div>
            </div>
            <button onClick={resetFilters} className="px-4 py-2 rounded-full border border-neutral-300 text-xs font-bold text-neutral-700 hover:border-neutral-900">RESET FILTER</button>
          </div>

          {filteredCommunities.length === 0 ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center text-neutral-500">Tidak ada komunitas yang cocok dengan kombinasi search & filter saat ini.</div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCommunities.map((community) => (
                <article key={community.id} className="rounded-3xl border border-neutral-200 bg-white p-5 hover-lift">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <button onClick={() => onSelectCommunity?.(community)} className="font-display text-left text-2xl text-neutral-900 leading-tight hover:text-[#E11D2E] transition-colors">{community.name}</button>
                      <div className="text-xs text-neutral-500 mt-1 flex items-center gap-2"><MapPin size={11} /> {community.district}, {community.city}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleBookmark(community)}
                        className={`w-9 h-9 rounded-full border flex items-center justify-center ${community.isBookmarked ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-600 hover:border-neutral-900'}`}
                        aria-label="Bookmark community"
                      >
                        <Bookmark size={14} />
                      </button>
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-neutral-100 text-neutral-700">{community.sport}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                    <div className="rounded-xl bg-neutral-100 p-2.5"><div className="text-neutral-500 uppercase tracking-wider font-bold">Member</div><div className="font-bold text-neutral-900 mt-0.5">{community.members.toLocaleString('id-ID')}</div></div>
                    <div className="rounded-xl bg-neutral-100 p-2.5"><div className="text-neutral-500 uppercase tracking-wider font-bold">Activity</div><div className="font-bold text-neutral-900 mt-0.5">{community.activityLevel}</div></div>
                    <div className="rounded-xl bg-neutral-100 p-2.5"><div className="text-neutral-500 uppercase tracking-wider font-bold">Skill</div><div className="font-bold text-neutral-900 mt-0.5">{community.level}</div></div>
                    <div className="rounded-xl bg-neutral-100 p-2.5"><div className="text-neutral-500 uppercase tracking-wider font-bold">Type</div><div className="font-bold text-neutral-900 mt-0.5">{community.type}</div></div>
                  </div>

                  <div className="text-xs text-neutral-600 mb-4">Upcoming Event: <span className="font-semibold text-neutral-800">{community.upcomingEvent}</span></div>

                  {community.latestFeedPost?.content && (
                    <div className="mb-4 rounded-2xl bg-neutral-100 px-3 py-3 text-xs text-neutral-600">
                      <div className="font-bold uppercase tracking-[0.18em] text-neutral-500 mb-1">Recent Feed</div>
                      <div className="line-clamp-2 text-neutral-700">{community.latestFeedPost.content}</div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {community.statuses.map((status) => {
                      const item = statusBadge(status);
                      const Icon = item.icon;
                      return <span key={status} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${item.cls}`}><Icon size={11} /> {item.label}</span>;
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-neutral-500">{community.distanceKm.toFixed(1)} km dari lokasi Anda</div>
                    <button onClick={() => onSelectCommunity?.(community)} className="inline-flex items-center gap-1 text-xs font-bold text-neutral-900 hover:text-[#E11D2E]">
                      Detail <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 lg:p-7">
          <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Badge System</div>
          <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-2 text-xs">
            {[
              { text: 'Verified Community', icon: ShieldCheck },
              { text: 'Beginner Friendly', icon: CheckCircle },
              { text: 'Trending', icon: Flame },
              { text: 'Most Active', icon: Zap },
              { text: 'Women Only', icon: Users },
            ].map((item) => {
              const Icon = item.icon;
              return <div key={item.text} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 font-semibold text-neutral-700 flex items-center gap-2"><Icon size={13} /> {item.text}</div>;
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 lg:p-7">
          <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ 40+ Community Category Options</div>
          <div className="grid lg:grid-cols-3 gap-5">
            {COMMUNITY_CATEGORY_GROUPS.map((group, index) => {
              const offset = COMMUNITY_CATEGORY_GROUPS.slice(0, index).reduce((total, current) => total + current.items.length, 0);
              return (
                <div key={group.title} className="rounded-2xl border border-neutral-200 p-4">
                  <div className="font-bold text-sm text-neutral-900 mb-2 uppercase tracking-wider">{group.title}</div>
                  <div className="space-y-1.5 text-sm text-neutral-700">
                    {group.items.map((item, itemIndex) => <div key={item}><span className="text-neutral-500 mr-1.5">{offset + itemIndex + 1}.</span>{item}</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 lg:p-7">
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Community Activity System</div>
            <div className="font-display text-4xl leading-[0.9] text-neutral-900 mb-3">ACTIVITY-DRIVEN ECOSYSTEM</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {COMMUNITY_ACTIVITY_TYPES.map((activityType) => <div key={activityType} className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold text-neutral-700">{activityType}</div>)}
            </div>
            <div className="mt-4 text-sm text-neutral-600">Open Play Example: <span className="font-semibold text-neutral-900">Padel Open Play · Need 2 Players · Tonight 19:00</span></div>
            <div className="mt-2 text-sm text-neutral-600">Sparring Finder: <span className="font-semibold text-neutral-900">Basketball Sparring · Intermediate · Yogyakarta · Saturday</span></div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 lg:p-7">
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Integration Flow</div>
            <div className="rounded-2xl bg-neutral-900 text-white p-4 mb-4 text-sm">Create Activity → Choose Venue → Invite Members → Booking Confirmed</div>
            <div className="space-y-2 text-sm">
              <div className="rounded-xl border border-neutral-200 px-3 py-2"><span className="font-semibold">Community + Tournament:</span> Weekend Futsal Cup hosted by komunitas.</div>
              <div className="rounded-xl border border-neutral-200 px-3 py-2"><span className="font-semibold">Community + Training:</span> coaching clinic, workshop, skill camp.</div>
              <div className="rounded-xl border border-neutral-200 px-3 py-2"><span className="font-semibold">Community + News:</span> aktivitas komunitas muncul di halaman berita.</div>
              <div className="rounded-xl border border-neutral-200 px-3 py-2"><span className="font-semibold">Community Feed:</span> match result, event recap, open play request, sparring request, achievement.</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5"><div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Leaderboard</div><div className="space-y-2 text-sm text-neutral-700"><div>Most Active Community</div><div>Most Attendance</div><div>Fastest Growing</div><div>Most Event</div></div></div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5"><div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Gamification</div><div className="text-sm text-neutral-700 mb-3">User earn points dari join activity, attendance, trivia, contribution.</div><div className="grid grid-cols-2 gap-2 text-xs">{['Rookie', 'Active', 'Core Member', 'Leader', 'Legend'].map((item) => <div key={item} className="rounded-lg bg-neutral-100 px-2.5 py-2 font-semibold">{item}</div>)}</div><div className="mt-3 text-xs font-bold text-neutral-700">Verified Community Leader</div></div>
          <div className="rounded-3xl border border-neutral-200 bg-white p-5"><div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Privacy & Analytics</div><div className="text-xs text-neutral-600 mb-3">Mode: Public · Private · Invite Only</div><div className="space-y-1.5 text-sm text-neutral-700"><div>Active member</div><div>Attendance rate</div><div>Event participation</div><div>Growth member</div></div></div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 lg:p-7"><div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-3">/ Sponsorship & Marketplace (Future)</div><div className="space-y-2 text-sm text-neutral-700"><div>Membuka sponsor dan partnership komunitas.</div><div>Jersey sponsor dan kolaborasi event.</div><div>Future marketplace: merchandise, jersey, coaching, equipment.</div></div></div>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-900 text-white p-5 lg:p-7">
            <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-400 mb-3">/ AI Recommendation</div>
            <div className="font-display text-4xl leading-[0.9] mb-4">RECOMMENDED FOR YOU</div>
            <div className="space-y-3">
              {(recommendedCommunities.length > 0 ? recommendedCommunities : communitySource.slice(0, 3)).map((community) => (
                <div key={`recommendation-${community.id}`} className="rounded-2xl bg-white/10 border border-white/20 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <button onClick={() => onSelectCommunity?.(community)} className="font-semibold text-left hover:text-[#F5B7BD]">{community.name}</button>
                      <div className="opacity-80 mt-1">{community.city} · {community.sport}</div>
                      <div className="text-xs text-neutral-300 mt-2">{community.recommendationReason || 'Berdasarkan lokasi, olahraga favorit, level bermain, dan aktivitas Anda.'}</div>
                    </div>
                    <div className="text-[11px] font-bold text-neutral-200">#{community.recommendationScore || 0}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => handleRecommendationFeedback(community, 'accepted')} className="px-3 py-1.5 rounded-full bg-white text-neutral-900 text-[11px] font-black">COCOK UNTUK SAYA</button>
                    <button onClick={() => handleRecommendationFeedback(community, 'dismissed')} className="px-3 py-1.5 rounded-full border border-white/20 text-[11px] font-black text-white">LEWATI</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-neutral-400 mt-3">{recommendationsLoading ? 'Menyiapkan rekomendasi live...' : 'Rekomendasi dihitung dari bookmark, komunitas yang diikuti, lokasi, badge, dan aktivitas komunitas.'}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-6 lg:p-8">
          <div className="text-xs uppercase tracking-[0.2em] font-black text-neutral-500 mb-2">/ Final Insight</div>
          <div className="font-display text-4xl lg:text-5xl leading-[0.92] text-neutral-900 mb-4">SPORTS SOCIAL OPERATING ECOSYSTEM</div>
          <p className="text-sm lg:text-base text-neutral-600 max-w-4xl leading-relaxed">Ketika community, venue, activity, tournament, training, sponsorship, dan gamification digabung, STADIONE bergerak dari sekadar sports app menjadi ekosistem sosial olahraga yang menghubungkan orang, menggerakkan aktivitas nyata, dan membangun identity plus participation economy olahraga Indonesia.</p>
        </div>
      </div>
    </div>
  );
}
