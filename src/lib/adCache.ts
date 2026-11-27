import { supabase } from "./supabase";

const CACHE_PREFIX = "sooq:ads-cache:";
const CACHE_TTL = 45 * 60 * 1000;
const REFRESH_INTERVAL = 60 * 1000;

type CacheEntry<T> = {
  savedAt: number;
  data: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const lastFetched = new Map<string, number>();
const pendingRequests = new Map<string, Promise<unknown>>();
const cacheVersions = new Map<string, number>();
const updateListeners = new Set<() => void>();

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let visibilityListenerAttached = false;

export function getAdsCache<T>(key: string): T | null {
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (cached && Date.now() - cached.savedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;

    if (
      !entry ||
      typeof entry.savedAt !== "number" ||
      Date.now() - entry.savedAt >= CACHE_TTL
    ) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    memoryCache.set(key, entry);
    return entry.data;
  } catch {
    return null;
  }
}

export async function loadAdsCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  onUpdate: (data: T) => void
): Promise<void> {
  const cached = getAdsCache<T>(key);

  if (cached !== null) {
    onUpdate(cached);
  }

  if (Date.now() - (lastFetched.get(key) ?? 0) < REFRESH_INTERVAL) {
    return;
  }

  const version = cacheVersions.get(key) ?? 0;
  const pending = pendingRequests.get(key) as Promise<T> | undefined;

  if (pending) {
    const data = await pending;

    if ((cacheVersions.get(key) ?? 0) === version) {
      onUpdate(data);
    }

    return;
  }
  const request = fetcher()
    .then((data) => {
      if ((cacheVersions.get(key) ?? 0) !== version) {
        return data;
      }

      const entry: CacheEntry<T> = {
        savedAt: Date.now(),
        data,
      };

      memoryCache.set(key, entry);
      lastFetched.set(key, Date.now());

      try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
      } catch {
        // Keep the in-memory cache when local storage is unavailable or full.
      }

      onUpdate(data);
      return data;
    })
    .finally(() => {
      if (pendingRequests.get(key) === request) {
        pendingRequests.delete(key);
      }
    });

  pendingRequests.set(key, request);
  await request;
}

function notifyListeners(forceRefresh: boolean) {
  if (forceRefresh) {
    const keys = new Set([
      ...memoryCache.keys(),
      ...lastFetched.keys(),
      ...pendingRequests.keys(),
      ...cacheVersions.keys(),
    ]);

    keys.forEach((key) => {
      cacheVersions.set(key, (cacheVersions.get(key) ?? 0) + 1);
      lastFetched.delete(key);
      pendingRequests.delete(key);
    });
  }

  updateListeners.forEach((listener) => listener());
}

export function subscribeToAdsUpdates(callback: () => void): () => void {
  console.log("ADS SUBSCRIPTION FUNCTION CALLED");
  updateListeners.add(callback);

  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel("shared-ads-cache-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ads" },
        () => notifyListeners(true)
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("ADS REALTIME CONNECTION ISSUE:", status, err);
        }
      });

    refreshTimer = setInterval(
      () => notifyListeners(true),
      REFRESH_INTERVAL
    );

    if (!visibilityListenerAttached) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
      visibilityListenerAttached = true;
    }
  }

  return () => {
    updateListeners.delete(callback);

    if (updateListeners.size === 0) {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }

      if (realtimeChannel) {
        void supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      if (visibilityListenerAttached) {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        visibilityListenerAttached = false;
      }
    }
  };
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    notifyListeners(true);
  }
}
export function invalidateAdsCache(key: string): void {
  cacheVersions.set(key, (cacheVersions.get(key) ?? 0) + 1);
  memoryCache.delete(key);
  lastFetched.delete(key);
  pendingRequests.delete(key);

  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // Ignore unavailable local storage.
  }
}
