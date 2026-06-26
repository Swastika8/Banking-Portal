/**
 * useMarketConnectivity.ts
 *
 * React hook for market rate connectivity management.
 *
 * Features:
 * - 5-minute polling interval
 * - Exponential backoff on failure: 10s → 30s → 60s → 300s (cap)
 * - Immediate reconnect refresh on browser `online` event
 * - Three-tier cache: Live API → PostgreSQL DB → IndexedDB/localStorage
 * - Distinguishes backend offline vs. market API offline
 * - Admin override protection: MANUAL source rates are never overwritten client-side
 * - Manual refresh trigger
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from './api';
import {
  buildCacheEntry,
  loadRates,
  saveRates,
  type MarketCacheEntry,
} from './marketCache';

export type ConnectivityStatus =
  | 'loading'
  | 'live'        // live API responding, rates fresh from server
  | 'cached'      // backend online but market API unavailable, using DB/local cache
  | 'backend_offline'; // backend itself unreachable

export interface MarketRate {
  id: number;
  asset: string;
  rate: number;
  source: string;
  dailyChange: number;
  weeklyChange: number;
  apiEndpoint: string | null;
  updatedAt: string;
}

export interface UseMarketConnectivityResult {
  marketRates: MarketRate[];
  connectivityStatus: ConnectivityStatus;
  lastSuccessfulSync: Date | null;
  lastAttempt: Date | null;
  isOnline: boolean;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Exponential backoff steps in milliseconds
const BACKOFF_STEPS_MS = [10_000, 30_000, 60_000, 300_000]; // 10s, 30s, 1m, 5m

function getBackoffDelay(attempt: number): number {
  return BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
}

// Convert MarketCacheEntry back to MarketRate-compatible shape
function cacheEntryToMarketRate(entry: MarketCacheEntry): MarketRate {
  return {
    id: 0, // not available from cache
    asset: entry.asset,
    rate: entry.rate,
    source: entry.source === 'live' ? 'API' : entry.source === 'local_cache' ? 'CACHE' : entry.source,
    dailyChange: entry.dailyChange ?? 0,
    weeklyChange: entry.weeklyChange ?? 0,
    apiEndpoint: null,
    updatedAt: entry.updatedAt || entry.lastAttempt,
  };
}

export function useMarketConnectivity(): UseMarketConnectivityResult {
  const [marketRates, setMarketRates] = useState<MarketRate[]>([]);
  const [connectivityStatus, setConnectivityStatus] = useState<ConnectivityStatus>('loading');
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState<Date | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const failureCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // ── Core fetch function ──────────────────────────────────────
  const fetchRates = useCallback(async (isManual = false): Promise<void> => {
    if (!mountedRef.current) return;

    if (isManual) setIsRefreshing(true);

    const now = new Date();
    setLastAttempt(now);

    try {
      const res = await api.get('/market-rates');
      const rawRates: MarketRate[] = res.data;

      if (!mountedRef.current) return;

      // Determine if these are truly live or DB-cached
      // Backend returns source='API' for live-synced, 'MANUAL' for admin-set, others for cached
      const syncTime = new Date().toISOString();
      const cacheEntries = rawRates.map((r) =>
        buildCacheEntry(r, 'live', syncTime)
      );

      // Persist to IndexedDB + localStorage
      await saveRates(cacheEntries);

      setMarketRates(rawRates);
      setLastSuccessfulSync(new Date());
      setConnectivityStatus('live');
      failureCountRef.current = 0;
    } catch (err: any) {
      if (!mountedRef.current) return;

      // Distinguish backend offline from market API issues
      const isBackendDown =
        !err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED');

      if (isBackendDown) {
        setConnectivityStatus('backend_offline');
      } else {
        // Backend is up but market fetch failed — use cached data
        setConnectivityStatus('cached');
      }

      // Load from IndexedDB / localStorage cache
      const cached = await loadRates();
      if (cached.length > 0) {
        setMarketRates(cached.map(cacheEntryToMarketRate));
        if (cached[0].lastSuccessfulSync) {
          setLastSuccessfulSync(new Date(cached[0].lastSuccessfulSync));
        }
      }

      // Increment failure counter for backoff
      failureCountRef.current = failureCountRef.current + 1;

      // Schedule backoff retry
      const delay = getBackoffDelay(failureCountRef.current - 1);
      console.log(`[MarketConnectivity] Fetch failed (attempt ${failureCountRef.current}). Retrying in ${delay / 1000}s`);

      if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
      backoffTimerRef.current = setTimeout(() => {
        if (mountedRef.current) fetchRates();
      }, delay);
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, []);

  // ── Schedule next 5-minute poll ──────────────────────────────
  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        fetchRates();
        schedulePoll();
      }
    }, POLL_INTERVAL_MS);
  }, [fetchRates]);

  // ── On mount: load cache immediately, then fetch live ────────
  useEffect(() => {
    mountedRef.current = true;

    // Show cached data instantly while fetch is in flight
    loadRates().then((cached) => {
      if (cached.length > 0 && mountedRef.current) {
        setMarketRates(cached.map(cacheEntryToMarketRate));
        if (cached[0].lastSuccessfulSync) {
          setLastSuccessfulSync(new Date(cached[0].lastSuccessfulSync));
        }
        setConnectivityStatus('cached');
      }
    });

    fetchRates();
    schedulePoll();

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
    };
  }, [fetchRates, schedulePoll]);

  // ── Browser online/offline event listeners ───────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Immediately refetch when connection restores
      if (mountedRef.current) {
        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
        fetchRates();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      // navigator.onLine is not reliable for LMS since backend is localhost
      // but we update the flag for supplementary use
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchRates]);

  // ── Manual refresh ───────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    await fetchRates(true);
    schedulePoll(); // reset the 5-min clock
  }, [fetchRates, schedulePoll]);

  return {
    marketRates,
    connectivityStatus,
    lastSuccessfulSync,
    lastAttempt,
    isOnline,
    refresh,
    isRefreshing,
  };
}
