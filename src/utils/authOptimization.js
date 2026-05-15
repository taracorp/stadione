/**
 * Auth Optimization Utilities
 * Provides helpers for faster login, registration, and password recovery
 * - Adaptive timeouts based on connection type
 * - Smart session caching with TTL
 * - Request deduplication
 * - Debouncing utilities
 */

// ============ CONNECTION DETECTION ============
/**
 * Detect effective connection type and return adaptive timeout
 * - 4G: 10s (fast connections)
 * - 3G: 20s (medium connections)
 * - 2G/slow-2g: 30s (slow connections)
 * - Low data mode: 20s
 * - Fallback: 15s
 */
export function getAdaptiveAuthTimeout(baseMs = 15000) {
  if (typeof navigator === 'undefined' || !navigator.connection) {
    return baseMs;
  }

  const conn = navigator.connection;
  
  if (conn.saveData) {
    return Math.max(baseMs, 20000); // Low data mode users need more time
  }

  switch (conn.effectiveType) {
    case '4g':
      return Math.max(baseMs, 10000); // Fast: can be faster
    case '3g':
      return Math.max(baseMs, 20000); // Medium: needs more time
    case '2g':
    case 'slow-2g':
      return Math.max(baseMs, 30000); // Slow: definitely needs more time
    default:
      return baseMs;
  }
}

/**
 * Monitor connection changes and log for debugging
 */
export function monitorConnectionQuality() {
  if (typeof navigator === 'undefined' || !navigator.connection) return;

  const conn = navigator.connection;

  const logConnInfo = () => {
    console.log('[AUTH] Connection:', {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
      rtt: conn.rtt,
      saveData: conn.saveData,
      adaptiveTimeout: getAdaptiveAuthTimeout(),
    });
  };

  logConnInfo();
  conn.addEventListener?.('change', logConnInfo);
}

// ============ SESSION CACHING ============
class AuthSessionCache {
  constructor(ttlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  get(userId) {
    if (!userId) return null;

    const cached = this.cache.get(userId);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.ttlMs;
    if (isExpired) {
      this.cache.delete(userId);
      console.log('[AUTH CACHE] Expired:', userId);
      return null;
    }

    console.log('[AUTH CACHE] HIT:', userId);
    return cached.data;
  }

  set(userId, data) {
    if (!userId || !data) return;

    this.cache.set(userId, {
      data,
      timestamp: Date.now(),
    });

    console.log('[AUTH CACHE] SET:', userId, data.roles?.length || 0, 'roles');
  }

  invalidate(userId) {
    if (userId) {
      this.cache.delete(userId);
      console.log('[AUTH CACHE] INVALIDATED:', userId);
    } else {
      this.cache.clear();
      console.log('[AUTH CACHE] CLEARED ALL');
    }
  }

  getStats() {
    return {
      entries: this.cache.size,
      ttlMs: this.ttlMs,
    };
  }
}

export const authSessionCache = new AuthSessionCache();

// ============ DEBOUNCING ============
/**
 * Simple debounce utility
 * Usage: const debouncedFn = debounce(originalFn, 500);
 */
export function debounce(fn, delayMs) {
  let timerId;

  return function debouncedFn(...args) {
    if (timerId) clearTimeout(timerId);

    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, delayMs);
  };
}

/**
 * Debounce with promise (for async functions)
 * Usage: const debouncedAsync = debounceAsync(asyncFn, 500);
 */
export function debounceAsync(fn, delayMs) {
  let timerId;
  let lastPromise = null;

  return async function debouncedAsyncFn(...args) {
    if (timerId) clearTimeout(timerId);

    return new Promise((resolve, reject) => {
      timerId = setTimeout(async () => {
        try {
          const result = await fn.apply(this, args);
          lastPromise = Promise.resolve(result);
          resolve(result);
        } catch (error) {
          lastPromise = Promise.reject(error);
          reject(error);
        }
        timerId = null;
      }, delayMs);
    });
  };
}

/**
 * Throttle utility (run at most once per interval)
 */
export function throttle(fn, intervalMs) {
  let lastRun = 0;
  let timerId;

  return function throttledFn(...args) {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;

    if (timeSinceLastRun >= intervalMs) {
      lastRun = now;
      fn.apply(this, args);
    } else {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        lastRun = Date.now();
        fn.apply(this, args);
      }, intervalMs - timeSinceLastRun);
    }
  };
}

// ============ REQUEST DEDUPLICATION ============
/**
 * Track in-flight auth requests to prevent duplicates
 * Usage in form handler:
 * 
 * let inFlightRequest = createRequestTracker();
 * 
 * const handleSubmit = async (e) => {
 *   e.preventDefault();
 *   if (inFlightRequest.isInFlight()) {
 *     console.warn('Auth request already in progress');
 *     return;
 *   }
 *   
 *   inFlightRequest.start();
 *   try {
 *     await performAuth();
 *   } finally {
 *     inFlightRequest.end();
 *   }
 * };
 */
export function createRequestTracker() {
  let request = null;

  return {
    isInFlight: () => request !== null,

    start: () => {
      request = Promise.resolve();
      console.log('[AUTH] Request started');
    },

    end: () => {
      request = null;
      console.log('[AUTH] Request ended');
    },

    getPromise: () => request,

    wait: async () => {
      if (request) await request;
    },
  };
}

// ============ PERFORMANCE TRACKING ============
/**
 * Track auth operation performance
 */
export class AuthPerformanceTracker {
  constructor() {
    this.marks = {};
  }

  start(operationName) {
    this.marks[operationName] = {
      startTime: performance.now(),
      startMark: `auth_${operationName}_start`,
    };

    if (typeof performance.mark === 'function') {
      performance.mark(this.marks[operationName].startMark);
    }
  }

  end(operationName, metadata = {}) {
    if (!this.marks[operationName]) {
      console.warn(`[PERF] No start mark for ${operationName}`);
      return null;
    }

    const endMark = `auth_${operationName}_end`;
    const duration = performance.now() - this.marks[operationName].startTime;

    if (typeof performance.mark === 'function') {
      performance.mark(endMark);
      try {
        performance.measure(
          `auth_${operationName}`,
          this.marks[operationName].startMark,
          endMark
        );
      } catch (e) {
        // Ignore measure errors
      }
    }

    const log = {
      operation: operationName,
      durationMs: duration.toFixed(2),
      ...metadata,
    };

    console.log(`[AUTH PERF] ${operationName}: ${duration.toFixed(2)}ms`, metadata);

    delete this.marks[operationName];
    return log;
  }

  getMetrics() {
    if (typeof performance.getEntriesByType !== 'function') return [];

    return performance
      .getEntriesByType('measure')
      .filter(entry => entry.name.startsWith('auth_'))
      .map(entry => ({
        operation: entry.name.replace('auth_', ''),
        durationMs: entry.duration.toFixed(2),
      }));
  }
}

export const authPerfTracker = new AuthPerformanceTracker();

// ============ EMAIL VALIDATION ============
/**
 * Quick email format validation (synchronous)
 */
export function isValidEmailFormat(email) {
  const normalized = String(email || '').trim();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(normalized) && normalized.length <= 254;
}

/**
 * Async email existence check
 * Requires Supabase service to be configured
 */
export async function checkEmailExists(email, supabaseClient) {
  if (!email || !supabaseClient) return false;

  try {
    const normalized = email.trim().toLowerCase();

    // Query auth.users to check if email exists
    const { data: users, error } = await supabaseClient
      .from('auth.users')
      .select('id', { count: 'exact' })
      .eq('email', normalized);

    if (error) {
      console.warn('[AUTH] Email check failed:', error);
      return false;
    }

    return users && users.length > 0;
  } catch (err) {
    console.error('[AUTH] Email check error:', err);
    return false;
  }
}

// ============ BATCH OPERATIONS ============
/**
 * Fetch multiple user data in parallel
 * More efficient than sequential fetches
 */
export async function fetchUserDataBatch({
  supabaseClient,
  userId,
  fetchRoleProfiles,
  fetchRoles,
  fetchPermissions,
  fetchActiveContext,
}) {
  if (!userId) return {};

  const startTime = performance.now();

  try {
    // All requests in parallel
    const results = await Promise.allSettled([
      fetchRoleProfiles?.(userId) || Promise.resolve(null),
      fetchRoles?.(userId) || Promise.resolve(null),
      fetchPermissions?.(userId) || Promise.resolve(null),
      fetchActiveContext?.(userId) || Promise.resolve(null),
    ]);

    const duration = performance.now() - startTime;

    return {
      roleProfiles: results[0]?.value || [],
      roles: results[1]?.value || [],
      permissions: results[2]?.value || [],
      activeContext: results[3]?.value || null,
      duration: duration.toFixed(2),
    };
  } catch (err) {
    console.error('[AUTH] Batch fetch failed:', err);
    return {};
  }
}

// ============ LOCAL STORAGE HELPERS ============
/**
 * Cache auth state to localStorage for faster startup
 */
export function cacheAuthStateLocally(userId, authData) {
  if (!userId || typeof localStorage === 'undefined') return;

  try {
    const cacheKey = `auth_cache_${userId}`;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        ...authData,
        cachedAt: Date.now(),
      })
    );
  } catch (err) {
    console.warn('[AUTH] Local cache failed:', err);
  }
}

/**
 * Retrieve cached auth state from localStorage
 */
export function getAuthStateFromCache(userId, maxAgeMins = 5) {
  if (!userId || typeof localStorage === 'undefined') return null;

  try {
    const cacheKey = `auth_cache_${userId}`;
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return null;

    const data = JSON.parse(cached);
    const ageMs = Date.now() - data.cachedAt;
    const maxAgeMs = maxAgeMins * 60 * 1000;

    if (ageMs > maxAgeMs) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('[AUTH] Cache retrieval failed:', err);
    return null;
  }
}

/**
 * Clear cached auth state
 */
export function clearAuthStateCache(userId) {
  if (!userId || typeof localStorage === 'undefined') return;

  try {
    const cacheKey = `auth_cache_${userId}`;
    localStorage.removeItem(cacheKey);
  } catch (err) {
    console.warn('[AUTH] Cache clear failed:', err);
  }
}
