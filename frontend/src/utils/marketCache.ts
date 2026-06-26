/**
 * marketCache.ts
 * IndexedDB-first, localStorage-fallback dual-layer cache for market rates.
 * Used by useMarketConnectivity to provide instant offline access to rates.
 */

const DB_NAME = 'lms_market_db';
const DB_VERSION = 1;
const STORE_NAME = 'market_rates';
const LS_FALLBACK_KEY = 'lms_market_cache';
const CACHE_VERSION = 1;
const EXPIRY_HOURS = 24;

export interface MarketCacheEntry {
  asset: string;
  rate: number;
  source: 'live' | 'db_cache' | 'local_cache';
  /** ISO timestamp of last successful live API fetch */
  lastSuccessfulSync: string | null;
  /** ISO timestamp of last fetch attempt (success or failure) */
  lastAttempt: string;
  /** lastSuccessfulSync + EXPIRY_HOURS */
  expiresAt: string | null;
  cacheVersion: number;
  status: 'fresh' | 'stale' | 'expired';
  /** True when rate was set manually by an Admin — API sync must not overwrite */
  isAdminOverride: boolean;
  /** Additional metadata from backend */
  dailyChange?: number;
  weeklyChange?: number;
  updatedAt?: string;
}

export interface MarketCacheSnapshot {
  rates: MarketCacheEntry[];
  savedAt: string;
  cacheVersion: number;
}

// ── IndexedDB helpers ────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'asset' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSave(entries: MarketCacheEntry[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const entry of entries) {
      store.put(entry);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('[MarketCache] IndexedDB save failed, will fallback:', err);
    throw err;
  }
}

async function idbLoad(): Promise<MarketCacheEntry[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => { db.close(); resolve(request.result as MarketCacheEntry[]); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  } catch (err) {
    console.warn('[MarketCache] IndexedDB load failed:', err);
    throw err;
  }
}

// ── LocalStorage fallback ────────────────────────────────────────

function lsSave(entries: MarketCacheEntry[]): void {
  try {
    const snapshot: MarketCacheSnapshot = {
      rates: entries,
      savedAt: new Date().toISOString(),
      cacheVersion: CACHE_VERSION,
    };
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[MarketCache] localStorage save failed:', err);
  }
}

function lsLoad(): MarketCacheEntry[] {
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return [];
    const snapshot: MarketCacheSnapshot = JSON.parse(raw);
    // Reject stale cache version
    if (snapshot.cacheVersion !== CACHE_VERSION) return [];
    return snapshot.rates || [];
  } catch {
    return [];
  }
}

// ── Freshness helpers ────────────────────────────────────────────

function deriveStatus(lastSuccessfulSync: string | null): MarketCacheEntry['status'] {
  if (!lastSuccessfulSync) return 'stale';
  const syncedAt = new Date(lastSuccessfulSync).getTime();
  const now = Date.now();
  const ageMs = now - syncedAt;
  if (ageMs < EXPIRY_HOURS * 60 * 60 * 1000) return 'fresh';
  if (ageMs < EXPIRY_HOURS * 2 * 60 * 60 * 1000) return 'stale';
  return 'expired';
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Build a MarketCacheEntry from a raw backend market rate object.
 */
export function buildCacheEntry(
  raw: any,
  source: MarketCacheEntry['source'],
  lastSuccessfulSync: string | null
): MarketCacheEntry {
  const now = new Date().toISOString();
  const expiresAt = lastSuccessfulSync
    ? new Date(new Date(lastSuccessfulSync).getTime() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
    : null;

  return {
    asset: raw.asset,
    rate: raw.rate,
    source,
    lastSuccessfulSync,
    lastAttempt: now,
    expiresAt,
    cacheVersion: CACHE_VERSION,
    status: deriveStatus(lastSuccessfulSync),
    isAdminOverride: raw.source === 'MANUAL',
    dailyChange: raw.dailyChange,
    weeklyChange: raw.weeklyChange,
    updatedAt: raw.updatedAt,
  };
}

/**
 * Save market rate entries to IndexedDB (primary) and localStorage (fallback).
 */
export async function saveRates(entries: MarketCacheEntry[]): Promise<void> {
  // Always try both — localStorage is our safety net
  lsSave(entries);
  try {
    await idbSave(entries);
  } catch {
    // localStorage already saved above, so we're fine
  }
}

/**
 * Load market rate entries from IndexedDB first, fallback to localStorage.
 * Returns empty array if nothing cached.
 */
export async function loadRates(): Promise<MarketCacheEntry[]> {
  try {
    const idbRates = await idbLoad();
    if (idbRates.length > 0) return idbRates;
  } catch {
    // fall through to localStorage
  }
  return lsLoad();
}

/**
 * Clear all cached market rate data from both stores.
 */
export async function clearMarketCache(): Promise<void> {
  localStorage.removeItem(LS_FALLBACK_KEY);
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    db.close();
  } catch {
    // ignore
  }
}
