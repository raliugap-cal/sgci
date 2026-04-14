// ═══════════════════════════════════════════════════════════
// SYNC HOOK — useSync
// Detecta conexión, ejecuta sync delta automático
// Precarga datos cuando está online
// ═══════════════════════════════════════════════════════════
'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  loadPrefetch, getPendingDiary, getPendingMessages,
  markSynced, applyServerChanges, getMeta, setMeta,
} from './offline-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Cliente API simple para el portal (sin interceptor de refresh complejo)
export const portalApi = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 20000,
});

portalApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('portal_token') : null;
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ─── Hook principal de sync ───────────────────────────────
export function useSync(pacienteId: string | null) {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const syncRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar cambios de conexión
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Contar pendientes al montar
  useEffect(() => {
    countPending();
  }, []);

  // Escuchar mensaje del Service Worker (Background Sync)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC' && event.data?.action === 'PROCESS_QUEUE') {
        runSync();
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [pacienteId]);

  // Auto-sync cuando vuelve la conexión
  useEffect(() => {
    if (online && pacienteId) {
      runSync();
    }
  }, [online, pacienteId]);

  // Sync periódico cada 3 minutos cuando está online
  useEffect(() => {
    if (!online || !pacienteId) return;
    syncRef.current = setInterval(runSync, 3 * 60 * 1000);
    return () => { if (syncRef.current) clearInterval(syncRef.current); };
  }, [online, pacienteId]);

  const countPending = async () => {
    const [diary, msgs] = await Promise.all([getPendingDiary(), getPendingMessages()]);
    setPendingCount(diary.length + msgs.length);
  };

  const runSync = useCallback(async () => {
    if (!pacienteId || !navigator.onLine || syncing) return;
    setSyncing(true);

    try {
      // 1. Obtener registros pendientes de sync
      const [diaryPending, msgsPending] = await Promise.all([
        getPendingDiary(),
        getPendingMessages(),
      ]);

      const lastSyncAt = (await getMeta('lastSyncAt')) ?? new Date(0).toISOString();

      // 2. Enviar al servidor
      const { data } = await portalApi.post('/sync/patient', {
        pacienteId,
        lastSyncAt,
        deviceId: getDeviceId(),
        diaryEntries: diaryPending,
        messages: msgsPending,
      });

      // 3. Marcar como sincronizados
      if (diaryPending.length > 0) {
        await markSynced('diary', diaryPending.map(d => d.id));
      }
      if (msgsPending.length > 0) {
        await markSynced('messages', msgsPending.map(m => m.id));
      }

      // 4. Aplicar cambios del servidor
      if (data.serverChanges) {
        await applyServerChanges(data.serverChanges);
      }

      // 5. Si no hay datos frescos, descargar prefetch
      const { data: prefetch } = await portalApi.get(`/sync/prefetch/${pacienteId}`);
      await loadPrefetch(prefetch);

      setLastSync(new Date());
      setPendingCount(0);
    } catch (e) {
      console.warn('[Sync] Error durante la sincronización:', e);
    } finally {
      setSyncing(false);
    }
  }, [pacienteId, syncing]);

  return { online, syncing, lastSync, pendingCount, sync: runSync };
}

// ─── Device ID persistente ────────────────────────────────
function getDeviceId(): string {
  let id = localStorage.getItem('sgci_device_id');
  if (!id) {
    id = `portal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('sgci_device_id', id);
  }
  return id;
}
