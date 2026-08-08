const SIDEBAR_PAGE_CACHE_VERSION = 1;
const SIDEBAR_PAGE_CACHE_PREFIX = 'sidebar-page-cache';

const runtimePageCache = new Map();

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toTrimmedString = (value) => String(value || '').trim();

const parseStoredEntry = (rawValue) => {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const getLocalStorageCandidate = () => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.localStorage;
    const probeKey = '__sidebar_page_cache_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
};

const getSessionStorageCandidate = () => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = window.sessionStorage;
    const probeKey = '__sidebar_page_cache_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
};

const getAvailableStorage = () => getLocalStorageCandidate() || getSessionStorageCandidate();

export const resolveCacheUserId = () => {
  if (typeof window === 'undefined') return 'anonymous';

  try {
    const storedUser = JSON.parse(window.localStorage.getItem('user') || 'null');
    const explicitUserId = toTrimmedString(
      storedUser?.id || storedUser?._id || window.localStorage.getItem('userId')
    );
    return explicitUserId || 'anonymous';
  } catch {
    return toTrimmedString(window.localStorage.getItem('userId')) || 'anonymous';
  }
};

const buildCacheKey = (namespace, currentUserId) => {
  const normalizedNamespace = toTrimmedString(namespace);
  const normalizedUserId = toTrimmedString(currentUserId);
  if (!normalizedNamespace || !normalizedUserId) return '';
  return [
    SIDEBAR_PAGE_CACHE_PREFIX,
    `v${SIDEBAR_PAGE_CACHE_VERSION}`,
    normalizedUserId,
    normalizedNamespace
  ].join(':');
};

const normalizeEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const updatedAt = toPositiveNumber(entry.updatedAt, Date.now());
  const expiresAt = toPositiveNumber(entry.expiresAt, updatedAt);
  return {
    updatedAt,
    expiresAt,
    data: entry.data ?? null
  };
};

export const readSidebarPageCache = (
  namespace,
  { currentUserId = resolveCacheUserId(), allowStale = true } = {}
) => {
  const cacheKey = buildCacheKey(namespace, currentUserId);
  if (!cacheKey) return null;

  const now = Date.now();
  const runtimeEntry = normalizeEntry(runtimePageCache.get(cacheKey));
  if (runtimeEntry) {
    const isStale = runtimeEntry.expiresAt <= now;
    if (!isStale || allowStale) {
      return {
        key: cacheKey,
        data: runtimeEntry.data,
        updatedAt: runtimeEntry.updatedAt,
        expiresAt: runtimeEntry.expiresAt,
        isStale
      };
    }
    runtimePageCache.delete(cacheKey);
  }

  const storage = getAvailableStorage();
  if (!storage) return null;

  const storedEntry = normalizeEntry(parseStoredEntry(storage.getItem(cacheKey)));
  if (!storedEntry) return null;

  runtimePageCache.set(cacheKey, storedEntry);

  const isStale = storedEntry.expiresAt <= now;
  if (isStale && !allowStale) {
    runtimePageCache.delete(cacheKey);
    storage.removeItem(cacheKey);
    return null;
  }

  return {
    key: cacheKey,
    data: storedEntry.data,
    updatedAt: storedEntry.updatedAt,
    expiresAt: storedEntry.expiresAt,
    isStale
  };
};

export const writeSidebarPageCache = (
  namespace,
  data,
  { currentUserId = resolveCacheUserId(), ttlMs = 10 * 60 * 1000 } = {}
) => {
  const cacheKey = buildCacheKey(namespace, currentUserId);
  if (!cacheKey) return null;

  const now = Date.now();
  const expiresAt = now + Math.max(1000, toPositiveNumber(ttlMs, 10 * 60 * 1000));
  const nextEntry = {
    updatedAt: now,
    expiresAt,
    data: data ?? null
  };

  runtimePageCache.set(cacheKey, nextEntry);

  const storage = getAvailableStorage();
  if (storage) {
    try {
      storage.setItem(cacheKey, JSON.stringify(nextEntry));
    } catch (error) {
      console.warn(`Failed to persist sidebar cache for ${namespace}:`, error);
    }
  }

  return nextEntry;
};

export const clearSidebarPageCache = (
  namespace,
  { currentUserId = resolveCacheUserId() } = {}
) => {
  const cacheKey = buildCacheKey(namespace, currentUserId);
  if (!cacheKey) return false;

  runtimePageCache.delete(cacheKey);
  const storage = getAvailableStorage();
  if (storage) {
    try {
      storage.removeItem(cacheKey);
    } catch (error) {
      console.warn(`Failed to clear sidebar cache for ${namespace}:`, error);
    }
  }

  return true;
};

export const evictSidebarPageCache = clearSidebarPageCache;
