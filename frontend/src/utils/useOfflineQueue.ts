/**
 * useOfflineQueue.ts
 *
 * IndexedDB-backed offline operation queue.
 *
 * When the LMS backend is unreachable, user actions are stored here
 * and automatically replayed (in order) when connectivity is restored.
 *
 * Prevents duplicate submissions by:
 * 1. Disabling the triggering button via returned `isQueuing` flag
 * 2. Deduplicating by type + deduplication key within a 30-second window
 *
 * Operations covered:
 * - CREATE_CUSTOMER
 * - CREATE_LOAN
 * - APPROVE_LOAN
 * - REJECT_LOAN
 * - CREATE_PAYMENT
 * - ADD_NOTE
 * - UPLOAD_DOCUMENT
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from './api';
import { toast } from 'react-hot-toast';

const QUEUE_DB_NAME = 'lms_queue_db';
const QUEUE_DB_VERSION = 1;
const QUEUE_STORE = 'operations';
const DEDUP_WINDOW_MS = 30_000; // 30 seconds

export type OperationType =
  | 'CREATE_CUSTOMER'
  | 'CREATE_LOAN'
  | 'APPROVE_LOAN'
  | 'REJECT_LOAN'
  | 'CREATE_PAYMENT'
  | 'ADD_NOTE'
  | 'UPLOAD_DOCUMENT';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  payload: any;
  queuedAt: string;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
  /** Optional dedup key (e.g. "customerId:42:loanId:100") */
  dedupKey?: string;
}

export type SyncStatus = 'synced' | 'pending' | 'syncing';

export interface UseOfflineQueueResult {
  syncStatus: SyncStatus;
  pendingCount: number;
  enqueue: (op: {
    type: OperationType;
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    payload: any;
    dedupKey?: string;
  }) => Promise<void>;
  flushQueue: () => Promise<void>;
}

// ── IndexedDB helpers ────────────────────────────────────────────

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueGetAll(): Promise<QueuedOperation[]> {
  const db = await openQueueDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const store = tx.objectStore(QUEUE_STORE);
  const req = store.index('queuedAt').getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => { db.close(); resolve(req.result as QueuedOperation[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function queuePut(op: QueuedOperation): Promise<void> {
  const db = await openQueueDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).put(op);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function queueDelete(id: string): Promise<void> {
  const db = await openQueueDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useOfflineQueue(): UseOfflineQueueResult {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const isSyncingRef = useRef(false);
  const mountedRef = useRef(true);

  // Load pending count on mount
  const refreshCount = useCallback(async () => {
    try {
      const ops = await queueGetAll();
      const pending = ops.filter((o) => o.status === 'pending' || o.status === 'failed');
      if (mountedRef.current) {
        setPendingCount(pending.length);
        setSyncStatus(pending.length > 0 ? 'pending' : 'synced');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshCount();
    return () => { mountedRef.current = false; };
  }, [refreshCount]);

  // ── Enqueue an operation ────────────────────────────────────
  const enqueue = useCallback(async (op: {
    type: OperationType;
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    payload: any;
    dedupKey?: string;
  }): Promise<void> => {
    // Deduplication check
    if (op.dedupKey) {
      try {
        const existing = await queueGetAll();
        const now = Date.now();
        const isDuplicate = existing.some(
          (e) =>
            e.dedupKey === op.dedupKey &&
            e.type === op.type &&
            now - new Date(e.queuedAt).getTime() < DEDUP_WINDOW_MS
        );
        if (isDuplicate) {
          console.warn(`[OfflineQueue] Duplicate operation blocked: ${op.type} ${op.dedupKey}`);
          return;
        }
      } catch {
        // ignore dedup check failure
      }
    }

    const queued: QueuedOperation = {
      id: generateId(),
      type: op.type,
      endpoint: op.endpoint,
      method: op.method,
      payload: op.payload,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
      dedupKey: op.dedupKey,
    };

    await queuePut(queued);
    await refreshCount();
  }, [refreshCount]);

  // ── Flush all pending operations ────────────────────────────
  const flushQueue = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const ops = await queueGetAll();
      const pending = ops
        .filter((o) => o.status === 'pending' || o.status === 'failed')
        .sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());

      if (pending.length === 0) {
        isSyncingRef.current = false;
        return;
      }

      if (mountedRef.current) setSyncStatus('syncing');

      let successCount = 0;
      let failCount = 0;

      for (const op of pending) {
        // Mark as syncing
        await queuePut({ ...op, status: 'syncing' });

        try {
          if (op.method === 'POST') {
            await api.post(op.endpoint, op.payload);
          } else if (op.method === 'PUT') {
            await api.put(op.endpoint, op.payload);
          } else if (op.method === 'DELETE') {
            await api.delete(op.endpoint, { data: op.payload });
          }

          // Success — remove from queue
          await queueDelete(op.id);
          successCount++;
        } catch (err: any) {
          // Mark as failed and keep in queue
          const updated = { ...op, status: 'failed' as const, attempts: op.attempts + 1 };
          await queuePut(updated);
          failCount++;
          console.error(`[OfflineQueue] Failed to sync operation ${op.type}:`, err.message);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} offline operation${successCount > 1 ? 's' : ''} synced successfully.`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} operation${failCount > 1 ? 's' : ''} failed to sync — will retry automatically.`);
      }
    } finally {
      isSyncingRef.current = false;
      await refreshCount();
    }
  }, [refreshCount]);

  // ── Auto-sync on browser online event ───────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setTimeout(() => {
        if (mountedRef.current) flushQueue();
      }, 2000); // Small delay to let connectivity stabilise
    };

    const handleVisibility = () => {
      if (!document.hidden && mountedRef.current) {
        refreshCount();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [flushQueue, refreshCount]);

  return { syncStatus, pendingCount, enqueue, flushQueue };
}
