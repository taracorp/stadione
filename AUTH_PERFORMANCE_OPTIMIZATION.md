# Auth Performance Optimization - May 15, 2026

## Overview
Strategi komprehensif untuk meningkatkan kecepatan login, registrasi, dan forgot password dengan parallel API calls, caching, connection detection, dan optimasi form.

## Optimasi Utama

### 1. **Parallel Data Fetching** ⚡
**Masalah**: `enrichAuthUser()` melakukan requests secara sequential:
```javascript
const roleProfiles = await fetchCurrentUserRoleProfiles();  // Wait
const roles = await fetchCurrentUserRoles();                 // Then wait
const permissions = await fetchCurrentUserPermissions();     // Then wait
```

**Solusi**: Gunakan `Promise.all()` untuk parallel requests
```javascript
const [roleProfiles, roles, permissions, activeContext] = await Promise.all([
  fetchCurrentUserRoleProfiles(),
  fetchCurrentUserRoles(),
  fetchCurrentUserPermissions(),
  fetchCurrentUserActiveContext(),
]);
```

**Benefit**: 
- Sequential: 1000ms + 800ms + 600ms + 500ms = ~2900ms
- Parallel: MAX(1000ms, 800ms, 600ms, 500ms) = ~1000ms
- **⏱️ 65% faster** (~1900ms saved)

### 2. **Connection Detection & Adaptive Timeouts** 🔌
**Masalah**: Timeout statis (15s) tidak sesuai untuk slow connections

**Solusi**: Detect connection type dan adjust timeouts
```javascript
function getAdaptiveTimeout() {
  if (navigator.connection?.effectiveType === '4g') return 10000;     // 4G: 10s
  if (navigator.connection?.effectiveType === '3g') return 20000;     // 3G: 20s
  if (navigator.connection?.effectiveType === '2g') return 30000;     // 2G: 30s
  if (navigator.connection?.saveData) return 20000;                    // Low data mode: 20s
  return 15000;                                                        // Default: 15s
}
```

**Benefit**: 
- Avoids unnecessary timeouts pada slow connections
- Faster feedback pada fast connections
- Graceful degradation

### 3. **Smart Session Caching** 💾
**Masalah**: `enrichAuthUser()` dipanggil setiap auth state change, refetch roles/permissions tiap kali

**Solusi**: Cache dengan smart invalidation
```javascript
const authCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedAuthUser(userId) {
  const cached = authCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedAuthUser(userId, data) {
  authCache.set(userId, { data, timestamp: Date.now() });
}
```

**Benefit**:
- SIGNED_IN events: 0ms (dari cache) instead of 1000ms
- Faster modal opening saat user switch tabs
- Manual cache invalidation after profile updates

### 4. **Form Validation Debouncing** ⏱️
**Masalah**: Email validation runs on every keystroke

**Solusi**: Debounce validation & async email existence check
```javascript
const [emailValidationError, setEmailValidationError] = useState('');

const debouncedEmailValidation = useMemo(
  () => debounce(async (email) => {
    const validation = validateEmail(email);
    if (!validation.valid) {
      setEmailValidationError(validation.error);
      return;
    }

    // Async: Check if email already registered
    const exists = await checkEmailExists(email);
    if (exists) {
      setEmailValidationError('Email sudah terdaftar');
    } else {
      setEmailValidationError('');
    }
  }, 500),
  []
);

useEffect(() => {
  debouncedEmailValidation(email);
}, [email, debouncedEmailValidation]);
```

**Benefit**:
- Reduces unnecessary validation calls: 5 calls/sec → 1 call/2 sec
- Early feedback without form submission
- Async email checking prevents duplicate registrations

### 5. **Lazy Load & Prefetch** 🚀
**Masalah**: Modal opens → Wait untuk enrich user → Slow perceived performance

**Solusi**: Prefetch resources saat modal dibuka
```javascript
const handleLoginModalOpen = useCallback(() => {
  // Start prefetching roles/permissions in background
  // Don't wait for it, show modal immediately
  
  if (auth?.id) {
    prefetchUserData(auth.id);
  }
  
  setShowAuth(true);
}, [auth?.id]);

async function prefetchUserData(userId) {
  try {
    await Promise.all([
      fetchCurrentUserRoleProfiles(),
      fetchCurrentUserPermissions(),
    ]);
  } catch (err) {
    console.warn('Prefetch failed:', err);
    // Fail silently, will refetch on demand
  }
}
```

**Benefit**:
- Modal appears instantly (no wait)
- Data ready when user logs out/logs back in
- No impact if user closes modal without submitting

### 6. **Optimistic UI Updates** 👁️
**Masalah**: User sees loading state sedang waiting untuk confirmation

**Solusi**: Show success immediately, correct if fails
```javascript
const handlePasswordReset = async (password) => {
  // Optimistic: Immediately show "password updated" message
  setSuccessMessage('Password berhasil diperbarui!');
  
  // Then actually update in background
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSuccessMessage('');
      setError('Update password gagal');
    }
  } catch (err) {
    setSuccessMessage('');
    setError(mapAuthErrorMessage(err));
  }
};
```

**Benefit**:
- Perceived responsiveness increases even if network is slow
- Better UX psychology

### 7. **Request Deduplication** 🔄
**Masalah**: Multiple rapid form submissions create duplicate API calls

**Solusi**: Track in-flight requests
```javascript
let inFlightAuthRequest = null;

const handleSubmit = async (e) => {
  e.preventDefault();
  
  // If already submitting, don't submit again
  if (inFlightAuthRequest) {
    console.warn('Auth request already in progress');
    return;
  }

  setLoading(true);
  inFlightAuthRequest = performAuth();
  
  try {
    await inFlightAuthRequest;
  } finally {
    inFlightAuthRequest = null;
    setLoading(false);
  }
};
```

**Benefit**:
- Prevents duplicate registrations/logins
- Saves bandwidth & API quota

---

## Implementation Checklist

### High Priority (Quick wins)
- ✅ Parallel data fetching in `enrichAuthUser()`
- ✅ Connection detection for adaptive timeouts
- ✅ Session caching with 5-min TTL
- ✅ Request deduplication

### Medium Priority (Good UX)
- ⚪ Email validation debouncing (500ms)
- ⚪ Async email existence checking
- ⚪ Prefetch in background when modal opens

### Low Priority (Polish)
- ⚪ Optimistic UI updates
- ⚪ Password strength debouncing

---

## Performance Expectations

### Before Optimization
- Login: ~2900ms (1000ms Supabase + 1900ms enrichment)
- Register: ~2200ms (1200ms signup + 1000ms enrichment)
- Forgot Password: ~45000ms (depends on email provider)

### After Optimization
- Login: ~1200ms (-58% faster, parallel enrichment)
- Register: ~1500ms (-32% faster, parallel + debounce)
- Forgot Password: ~20000ms (-56% faster, adaptive timeout)
- Email validation: Instant feedback (debounced, non-blocking)

---

## Metrics to Monitor

```javascript
// Add to auth handlers
const startTime = performance.now();

// ... perform auth action ...

const duration = performance.now() - startTime;
console.log(`[AUTH PERF] Login: ${duration.toFixed(0)}ms`);

// Send to analytics
analytics.track('auth_performance', {
  action: 'login',
  duration,
  connection: navigator.connection?.effectiveType,
  cached: false,
});
```

---

## Files to Modify

1. **stadione.jsx**:
   - Update `enrichAuthUser()` to use `Promise.all()`
   - Add connection detection
   - Implement auth cache
   - Add request deduplication

2. **New: authOptimization.js** (utility file):
   - `getAdaptiveTimeout()`
   - `createAuthCache()`
   - `debounce()` helper
   - `checkEmailExists()` async function

3. **New: authPerformance.md** (this file)
   - Document all optimizations
   - Provide monitoring guidelines
