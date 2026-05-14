export const createCrmLruCache = (maxEntries = 40) => {
  const cache = new Map();
  const limit = Math.max(Number(maxEntries) || 40, 1);

  const touch = (key, value) => {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > limit) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
    return value;
  };

  return {
    get(key) {
      if (!cache.has(key)) return null;
      return touch(key, cache.get(key));
    },
    set(key, value) {
      touch(key, value);
      return value;
    },
    delete(key) {
      cache.delete(key);
    },
    clear() {
      cache.clear();
    }
  };
};

export const crmLeadPageCache = createCrmLruCache(24);
export const crmContactDetailCache = createCrmLruCache(40);
