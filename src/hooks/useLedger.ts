import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyOp, applyOps, EMPTY_LEDGER, LedgerData, LedgerOp, newId, QueuedOp } from '../lib/ledger';
import { describeSheetsError, fetchSnapshot, pushOps, SheetsConfig, SheetsError, SheetsErrorCode } from '../lib/sheetsApi';
import {
  getLocalModeData,
  getOutbox,
  getSheetsCache,
  saveLocalModeData,
  saveOutbox,
  saveSheetsCache
} from '../utils/storage';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'error';

interface UseLedgerOptions {
  mode: 'local' | 'sheets';
  url: string;
  token: string;
  onSyncError?: (message: string, code: SheetsErrorCode) => void;
  onOpsRejected?: (count: number, firstError: string) => void;
}

const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];
const REFRESH_ON_FOCUS_AFTER_MS = 30000;

// Fuente única de verdad para préstamos, abonos y límites.
//  - Lo que se ve = último estado del servidor + cambios pendientes en cola.
//  - Cada cambio se aplica al instante y se guarda en una cola persistente.
//  - La cola se envía en lote; si falla, se reintenta con espera creciente y
//    al recuperar la conexión. Nada se pierde al cerrar la app.
export function useLedger({ mode, url, token, onSyncError, onOpsRejected }: UseLedgerOptions) {
  const isSheets = mode === 'sheets';

  const [base, setBase] = useState<LedgerData>(EMPTY_LEDGER);
  const [outbox, setOutbox] = useState<QueuedOp[]>([]);
  const [status, setStatus] = useState<SyncStatus>(isSheets ? 'pending' : 'local');
  const [errorCode, setErrorCode] = useState<SheetsErrorCode | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Refs para el código asíncrono (evitan closures con datos viejos).
  const baseRef = useRef(base);
  const outboxRef = useRef(outbox);
  const versionRef = useRef<string | null>(null);
  const cfgRef = useRef<SheetsConfig>({ url, token });
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const syncQueuedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const lastSyncRef = useRef(0);
  const lastErrorRef = useRef<SheetsErrorCode | null>(null);
  const callbacksRef = useRef({ onSyncError, onOpsRejected });
  callbacksRef.current = { onSyncError, onOpsRejected };

  const data = useMemo(() => applyOps(base, outbox), [base, outbox]);

  const commitBase = useCallback((next: LedgerData, version: string | null) => {
    baseRef.current = next;
    versionRef.current = version;
    setBase(next);
    if (cfgRef.current.url) {
      saveSheetsCache(cfgRef.current.url, { data: next, version, syncedAt: Date.now() });
    }
  }, []);

  const commitOutbox = useCallback((next: QueuedOp[]) => {
    outboxRef.current = next;
    setOutbox(next);
    if (cfgRef.current.url) saveOutbox(cfgRef.current.url, next);
  }, []);

  const reportError = useCallback((err: unknown) => {
    const code: SheetsErrorCode = err instanceof SheetsError ? err.code : 'network';
    setStatus('error');
    setErrorCode(code);
    // Solo avisar cuando cambia el tipo de error, para no repetir el mismo toast.
    if (lastErrorRef.current !== code) {
      lastErrorRef.current = code;
      callbacksRef.current.onSyncError?.(describeSheetsError(code), code);
    }
    return code;
  }, []);

  const clearRetry = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  };

  // ---------------- Operaciones de red (siempre en serie) ----------------

  const flushInner = useCallback(async (): Promise<boolean> => {
    const batch = outboxRef.current;
    if (batch.length === 0) return false;

    const cfg = cfgRef.current;
    const res = await pushOps(cfg, batch);
    if (cfgRef.current !== cfg) return false; // la configuración cambió mientras tanto
    const answered = new Map(res.results.filter(r => r.opId).map(r => [r.opId as string, r]));
    if (answered.size === 0) throw new SheetsError('bad-response', 'El script no confirmó ninguna operación');
    const applied = batch.filter(op => answered.get(op.opId)?.ok);
    const rejected = batch.filter(op => answered.get(op.opId) && !answered.get(op.opId)!.ok);

    // Si nadie más escribió entre medio, basta con aplicar nuestras operaciones
    // al estado conocido. Si no, hay que releer la hoja.
    const someoneElseWrote = !res.versionBefore || res.versionBefore !== versionRef.current;
    commitBase(applyOps(baseRef.current, applied), someoneElseWrote ? versionRef.current : res.version);
    commitOutbox(outboxRef.current.filter(op => !answered.has(op.opId)));

    if (rejected.length > 0) {
      callbacksRef.current.onOpsRejected?.(rejected.length, answered.get(rejected[0].opId)?.error || 'error');
    }
    return someoneElseWrote;
  }, [commitBase, commitOutbox]);

  const refreshInner = useCallback(async (fresh = false) => {
    const cfg = cfgRef.current;
    const snap = await fetchSnapshot(cfg, fresh ? null : versionRef.current, { fresh });
    if (cfgRef.current !== cfg) return;
    if (snap.kind === 'data') commitBase(snap.data, snap.version);
    else if (cfgRef.current.url) {
      saveSheetsCache(cfgRef.current.url, { data: baseRef.current, version: snap.version, syncedAt: Date.now() });
    }
  }, [commitBase]);

  const scheduleRetry = useCallback((run: () => void) => {
    clearRetry();
    const delay = RETRY_DELAYS_MS[Math.min(retryAttemptRef.current, RETRY_DELAYS_MS.length - 1)];
    retryAttemptRef.current += 1;
    retryTimerRef.current = setTimeout(run, delay);
  }, []);

  // Envía la cola pendiente y luego trae cambios. Las llamadas se encadenan
  // para que nunca haya dos peticiones compitiendo; varias llamadas seguidas
  // se agrupan en una sola sincronización.
  const sync = useCallback((opts: { fresh?: boolean; skipRefresh?: boolean } = {}): Promise<void> => {
    if (mode !== 'sheets') return Promise.resolve();
    if (syncQueuedRef.current && !opts.fresh) return chainRef.current;
    syncQueuedRef.current = true;

    const run = async () => {
      syncQueuedRef.current = false;
      clearRetry();
      setStatus('pending');
      try {
        let needsRefresh = !opts.skipRefresh;
        // La cola puede crecer mientras se envía: repetir hasta vaciarla.
        const cfg = cfgRef.current;
        while (outboxRef.current.length > 0 && cfgRef.current === cfg) {
          const stale = await flushInner();
          if (stale) needsRefresh = true;
        }
        if (needsRefresh || opts.fresh) await refreshInner(opts.fresh);
        retryAttemptRef.current = 0;
        lastErrorRef.current = null;
        lastSyncRef.current = Date.now();
        setLastSyncedAt(lastSyncRef.current);
        setErrorCode(null);
        setStatus('synced');
      } catch (err) {
        const code = reportError(err);
        const retryable = code !== 'unauthorized' && code !== 'no-key' && code !== 'outdated-script' && code !== 'not-configured';
        if (retryable && outboxRef.current.length > 0) scheduleRetry(() => { void sync({ skipRefresh: true }); });
      } finally {
        setHasLoaded(true);
      }
    };

    chainRef.current = chainRef.current.then(run, run);
    return chainRef.current;
  }, [mode, flushInner, refreshInner, reportError, scheduleRetry]);

  // ---------------- Carga inicial / cambio de configuración ----------------

  useEffect(() => {
    cfgRef.current = { url, token };
    clearRetry();
    retryAttemptRef.current = 0;
    lastErrorRef.current = null;
    setErrorCode(null);

    if (mode === 'local') {
      const local = getLocalModeData();
      baseRef.current = local;
      outboxRef.current = [];
      versionRef.current = null;
      setBase(local);
      setOutbox([]);
      setStatus('local');
      setHasLoaded(true);
      return;
    }

    // 1. Pintar al instante lo que hay en caché (si existe) + pendientes.
    const cached = url ? getSheetsCache(url) : null;
    const pending = url ? getOutbox(url) : [];
    baseRef.current = cached?.data ?? EMPTY_LEDGER;
    versionRef.current = cached?.version ?? null;
    outboxRef.current = pending;
    setBase(baseRef.current);
    setOutbox(pending);
    setHasLoaded(!!cached);
    setLastSyncedAt(cached?.syncedAt ?? null);

    if (!url || !token) {
      reportError(new SheetsError('not-configured'));
      setHasLoaded(true);
      return;
    }

    // 2. En segundo plano: enviar pendientes y traer cambios.
    void sync();
  }, [mode, url, token, sync, reportError]);

  // Reintentar al recuperar conexión y refrescar al volver a la app.
  useEffect(() => {
    if (mode !== 'sheets') return;
    const onOnline = () => { void sync(); };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSyncRef.current > REFRESH_ON_FOCUS_AFTER_MS) {
        void sync();
      }
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearRetry();
    };
  }, [mode, sync]);

  // ---------------- API pública ----------------

  const dispatch = useCallback((op: LedgerOp) => {
    if (mode === 'local') {
      const next = applyOp(baseRef.current, op);
      baseRef.current = next;
      setBase(next);
      saveLocalModeData(next);
      return;
    }
    const queued: QueuedOp = { ...op, opId: newId('op'), queuedAt: Date.now() };
    commitOutbox([...outboxRef.current, queued]);
    if (cfgRef.current.url && cfgRef.current.token) void sync({ skipRefresh: true });
  }, [mode, commitOutbox, sync]);

  // Reemplaza todos los datos (solo modo local: importar respaldo).
  const replaceLocalData = useCallback((next: LedgerData) => {
    if (mode !== 'local') return false;
    baseRef.current = next;
    setBase(next);
    saveLocalModeData(next);
    return true;
  }, [mode]);

  return {
    data,
    status,
    errorCode,
    errorMessage: errorCode ? describeSheetsError(errorCode) : null,
    pendingCount: outbox.length,
    lastSyncedAt,
    hasLoaded,
    dispatch,
    sync,
    replaceLocalData
  };
}
