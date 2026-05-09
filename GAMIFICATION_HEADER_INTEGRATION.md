// Quick Integration: Add Gamification to Header
// This shows how to modify the existing Header component to display coins/points

import { useUserGamification } from '../hooks/useGamification';
import { UserGamificationBadge } from '../components/GamificationUI';

/**
 * Updated Header Component with Gamification
 * 
 * Usage:
 * <Header 
 *   current={current}
 *   onNav={onNav}
 *   auth={auth}
 *   onOpenAuth={onOpenAuth}
 *   onLogout={onLogout}
 *   onChat={onChat}
 * />
 */

// Inside your stadione.jsx or wherever Header is imported:

// 1. Add the hook call inside the Header component:
const Header = ({ current, onNav, auth, onOpenAuth, onLogout, onChat }) => {
  const { stats, loading } = useUserGamification(auth?.id);
  
  // ... existing code ...
  
  // 2. Update the header JSX to include the gamification badge
  // Replace this section (around line 370-380):
  
  // OLD:
  {auth && (
    <>
      <button onClick={onChat} className="relative p-2.5 hover:bg-neutral-200 rounded-full" title="Pesan">
        <MessageCircle size={18} />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#E11D2E' }}>
            {totalUnread}
          </span>
        )}
      </button>
      {/* ... rest of auth UI ... */}
    </>
  )}

  // NEW: Add before the chat button
  {auth && (
    <>
      {/* Gamification Badge */}
      <UserGamificationBadge stats={stats} loading={loading} />
      
      <button onClick={onChat} className="relative p-2.5 hover:bg-neutral-200 rounded-full" title="Pesan">
        <MessageCircle size={18} />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: '#E11D2E' }}>
            {totalUnread}
          </span>
        )}
      </button>
      {/* ... rest of auth UI ... */}
    </>
  )}
};

// 3. Optional: Add a profile/stats link in user menu
// Find this section in the user menu:
<button onClick={() => { onNav('coach-dashboard'); setUserMenu(false); }} className="...">
  <BarChart3 size={14} /> Dashboard Pelatih
</button>

// Add this new button:
<button onClick={() => { onNav('profile'); setUserMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-neutral-50 flex items-center gap-3">
  <Trophy size={14} /> Profil & Statistik
</button>

// This is a complete example of how to integrate gamification display
// into the existing header component.
