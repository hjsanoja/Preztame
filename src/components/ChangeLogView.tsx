import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudUpload, History, Loader2, RefreshCw } from 'lucide-react';
import { ChangeLogEntry } from '../types';
import { QueuedOp } from '../lib/ledger';
import { fetchChangeLog, SheetsError, describeSheetsError } from '../lib/sheetsApi';
import { getLocalLog } from '../utils/storage';
import { AccountChip } from './ui';

interface ChangeLogViewProps {
  mode: 'local' | 'sheets';
  url: string;
  token: string;
  apiVersion: number | null;
  pendingOps: QueuedOp[];
  refreshKey: number; // changes when data changes, to reload the log
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Sin fecha';
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
};

// "Historial de cambios": who changed what, and when.
export default function ChangeLogView({ mode, url, token, apiVersion, pendingOps, refreshKey }: ChangeLogViewProps) {
  const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsUpdate = mode === 'sheets' && apiVersion !== null && apiVersion < 7;

  const load = useCallback(async () => {
    if (mode === 'local') { setEntries(getLocalLog()); return; }
    if (needsUpdate || !url || !token) return;
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchChangeLog({ url, token }, 300));
    } catch (err) {
      setError(err instanceof SheetsError ? describeSheetsError(err.code) : 'No se pudo cargar el historial.');
    } finally {
      setLoading(false);
    }
  }, [mode, url, token, needsUpdate]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const all = useMemo(() => {
    const pending: ChangeLogEntry[] = pendingOps.filter(op => op.desc).map(op => ({
      fecha: new Date(op.queuedAt).toISOString(), usuario: op.by || '', accion: op.action, refId: '', detalle: op.desc!, pendiente: true
    }));
    return [...pending.reverse(), ...entries];
  }, [entries, pendingOps]);

  const groups = useMemo(() => {
    const map = new Map<string, ChangeLogEntry[]>();
    all.forEach(e => { const k = dayLabel(e.fecha); map.set(k, [...(map.get(k) || []), e]); });
    return [...map.entries()];
  }, [all]);

  if (needsUpdate) {
    return (
      <div className="rounded-3xl border border-dashed border-outline-variant p-8 text-center space-y-2">
        <History className="h-10 w-10 mx-auto text-outline" aria-hidden="true" />
        <p className="font-semibold">Actualiza tu Apps Script a v7</p>
        <p className="text-sm text-on-surface-variant">El historial de cambios se guarda en una hoja nueva. Copia el código desde Ajustes y publica una nueva versión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-on-surface-variant">
          {mode === 'local' ? 'Cambios hechos en este dispositivo.' : 'Cambios guardados en la hoja "Historial" de tu Google Sheet.'}
        </p>
        {mode === 'sheets' && (
          <button type="button" onClick={() => void load()} aria-label="Actualizar historial" className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer shrink-0">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      {groups.length === 0 && !loading ? (
        <div className="rounded-3xl border border-dashed border-outline-variant p-8 text-center space-y-2">
          <History className="h-10 w-10 mx-auto text-outline" aria-hidden="true" />
          <p className="font-semibold">Aún no hay cambios registrados</p>
          <p className="text-sm text-on-surface-variant">Cada préstamo, abono, edición o eliminación aparecerá aquí con quién lo hizo y cuándo.</p>
        </div>
      ) : (
        groups.map(([day, list]) => (
          <section key={day}>
            <h3 className="text-sm font-semibold text-on-surface-variant capitalize mb-2">{day}</h3>
            <ol className="m3-card rounded-3xl divide-y divide-outline-variant/60 overflow-hidden">
              {list.map((e, i) => (
                <li key={`${e.fecha}-${i}`} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-xs text-on-surface-variant tabular-nums w-12 shrink-0 pt-0.5">{timeLabel(e.fecha)}</span>
                  <span className="flex-1 min-w-0 text-sm">{e.detalle}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {e.pendiente && (
                      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-warning-container text-on-warning-container text-[11px] font-semibold">
                        <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" /> Pendiente
                      </span>
                    )}
                    {e.usuario && <AccountChip cuenta={e.usuario} />}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
