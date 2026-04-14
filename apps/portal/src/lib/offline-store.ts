// ═══════════════════════════════════════════════════════════
// OFFLINE STORE — IndexedDB via idb
// Persiste: citas, diagnósticos, alergias, recetas,
//           resultados, mensajes, diario adicciones
// Maneja sync_pending y timestamp local
// ═══════════════════════════════════════════════════════════
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SgciDB extends DBSchema {
  appointments:  { key: string; value: any };
  diagnoses:     { key: string; value: any };
  allergies:     { key: string; value: any };
  prescriptions: { key: string; value: any };
  results:       { key: string; value: any };
  messages:      { key: string; value: any; indexes: { 'by-pending': boolean } };
  diary:         { key: string; value: any; indexes: { 'by-pending': boolean; 'by-date': string } };
  catalogs:      { key: string; value: any };
  meta:          { key: string; value: any };
}

const DB_NAME = 'sgci-portal';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SgciDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<SgciDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SgciDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('appointments',  { keyPath: 'id' });
        db.createObjectStore('diagnoses',     { keyPath: 'id' });
        db.createObjectStore('allergies',     { keyPath: 'id' });
        db.createObjectStore('prescriptions', { keyPath: 'id' });
        db.createObjectStore('results',       { keyPath: 'id' });
        const msgs = db.createObjectStore('messages', { keyPath: 'id' });
        msgs.createIndex('by-pending', 'syncPending');
        const diary = db.createObjectStore('diary', { keyPath: 'id' });
        diary.createIndex('by-pending', 'syncPending');
        diary.createIndex('by-date', 'fecha');
        db.createObjectStore('catalogs', { keyPath: 'key' });
        db.createObjectStore('meta',     { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// ─── Helpers de lectura ──────────────────────────────────
export async function getAll<T>(store: keyof SgciDB): Promise<T[]> {
  const db = await getDb();
  return db.getAll(store as any) as Promise<T[]>;
}

export async function put<T>(store: keyof SgciDB, value: T): Promise<void> {
  const db = await getDb();
  await db.put(store as any, value);
}

export async function putMany<T>(store: keyof SgciDB, values: T[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(store as any, 'readwrite');
  await Promise.all([...values.map(v => tx.store.put(v)), tx.done]);
}

export async function getMeta(key: string): Promise<any> {
  const db = await getDb();
  const record = await db.get('meta', key);
  return record?.value;
}

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await getDb();
  await db.put('meta', { key, value });
}

// ─── Cargar prefetch del servidor a IndexedDB ─────────────
export async function loadPrefetch(data: {
  citas: any[];
  diagnosticosActivos: any[];
  alergias: any[];
  recetas: any[];
  resultados: any[];
  mensajes: any[];
  diarioMesActual: any[];
  generadoAt: string;
}) {
  await Promise.all([
    putMany('appointments',  data.citas),
    putMany('diagnoses',     data.diagnosticosActivos),
    putMany('allergies',     data.alergias),
    putMany('prescriptions', data.recetas),
    putMany('results',       data.resultados),
    putMany('messages',      data.mensajes),
    putMany('diary',         data.diarioMesActual),
    setMeta('lastPrefetch',  data.generadoAt),
    setMeta('lastSyncAt',    new Date().toISOString()),
  ]);
}

// ─── Diario offline ───────────────────────────────────────
export async function saveDiaryEntry(entry: {
  expedienteAdiccionId: string;
  fecha: string;
  huboConsumo: boolean;
  sustancias?: any[];
  estadoAnimo?: number;
  nivelAnsiedad?: number;
  factoresRiesgo?: string[];
  notas?: string;
}): Promise<string> {
  const id = `local-diary-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const record = {
    ...entry,
    id,
    syncPending: true,
    creadoOffline: true,
    timestampLocal: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  await put('diary', record);
  return id;
}

export async function getPendingDiary(): Promise<any[]> {
  const db = await getDb();
  return db.getAllFromIndex('diary', 'by-pending', IDBKeyRange.only(true));
}

// ─── Mensajes offline ─────────────────────────────────────
export async function saveOfflineMessage(msg: {
  sedeId: string;
  asunto?: string;
  contenido: string;
}): Promise<string> {
  const id = `local-msg-${Date.now()}`;
  await put('messages', {
    ...msg,
    id,
    syncPending: true,
    creadoOffline: true,
    leido: false,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getPendingMessages(): Promise<any[]> {
  const db = await getDb();
  return db.getAllFromIndex('messages', 'by-pending', IDBKeyRange.only(true));
}

// ─── Marcar registros como sincronizados ─────────────────
export async function markSynced(store: 'diary' | 'messages', ids: string[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(store, 'readwrite');
  for (const id of ids) {
    const record = await tx.store.get(id);
    if (record) {
      record.syncPending = false;
      await tx.store.put(record);
    }
  }
  await tx.done;
}

// ─── Aplicar cambios del servidor (delta sync) ────────────
export async function applyServerChanges(changes: {
  citas?: any[];
  resultados?: any[];
  recetas?: any[];
  mensajes?: any[];
}): Promise<void> {
  await Promise.all([
    changes.citas?.length      ? putMany('appointments',  changes.citas) : Promise.resolve(),
    changes.resultados?.length ? putMany('results',       changes.resultados) : Promise.resolve(),
    changes.recetas?.length    ? putMany('prescriptions', changes.recetas) : Promise.resolve(),
    changes.mensajes?.length   ? putMany('messages',      changes.mensajes) : Promise.resolve(),
  ]);
  await setMeta('lastSyncAt', new Date().toISOString());
}

// ─── Verificar si hay datos frescos disponibles ───────────
export async function hasFreshCache(maxAgeMinutes = 30): Promise<boolean> {
  const lastPrefetch = await getMeta('lastPrefetch');
  if (!lastPrefetch) return false;
  const age = (Date.now() - new Date(lastPrefetch).getTime()) / 60000;
  return age < maxAgeMinutes;
}
