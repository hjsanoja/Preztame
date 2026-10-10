import { useEffect, useState } from 'react';
import { DatabaseBackup, ExternalLink, Loader2 } from 'lucide-react';
import { BackupSettings as Backup, describeSheetsError, SheetsError, updateBackup } from '../../lib/sheetsApi';

interface BackupSettingsProps {
  mode: 'local' | 'sheets';
  url: string;
  token: string;
  apiVersion: number | null;
  onNotify: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// "Respaldo automático": copies of the Google Sheet in a Drive folder.
export default function BackupSettings({ mode, url, token, apiVersion, onNotify }: BackupSettingsProps) {
  const [state, setState] = useState<Backup | null>(null);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [keep, setKeep] = useState(14);
  const [busy, setBusy] = useState<string | null>(null);
  const available = mode === 'sheets' && !!url && !!token && (apiVersion === null || apiVersion >= 8);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    updateBackup({ url, token }, 'getBackup').then(b => {
      if (!alive) return;
      setState(b);
      setFrequency(b.frequency);
      setKeep(b.keep);
    }).catch(() => {});
    return () => { alive = false; };
  }, [available, url, token]);

  const run = async (action: 'setupBackup' | 'disableBackup' | 'backupNow') => {
    setBusy(action);
    try {
      const b = await updateBackup({ url, token }, action, { frequency, keep });
      setState(b);
      if (action === 'setupBackup') onNotify(`Respaldo ${b.frequency === 'weekly' ? 'semanal' : 'diario'} activado. Se guardan las últimas ${b.keep} copias.`, 'success');
      if (action === 'disableBackup') onNotify('Respaldo automático desactivado.', 'info');
      if (action === 'backupNow') onNotify('Copia de respaldo creada en tu Drive.', 'success');
    } catch (err) {
      onNotify(err instanceof SheetsError ? describeSheetsError(err.code) : 'No se pudo conectar con Google Sheets.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="m3-card rounded-3xl p-4 sm:p-6 space-y-4">
      <div>
        <h4 className="font-semibold text-on-surface text-base flex items-center">
          <DatabaseBackup className="h-5 w-5 mr-2 text-primary" />
          Respaldo automático
        </h4>
        <p className="text-xs text-on-surface-variant mt-1">Tu Apps Script guarda una copia completa de la hoja en la carpeta "Preztame · respaldos" de tu Google Drive y borra las más viejas.</p>
      </div>

      {mode === 'local' ? (
        <p className="text-xs text-on-surface-variant">Disponible al conectar Google Sheets. En modo local usa "Exportar copia (.json)".</p>
      ) : !available ? (
        <p className="text-xs text-on-surface-variant">Actualiza tu Apps Script a v8 (paso 3 de la guía) para activar los respaldos.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs text-on-surface-variant mb-1">Frecuencia</span>
              <select value={frequency} onChange={e => setFrequency(e.target.value as 'daily' | 'weekly')}
                className="w-full h-10 px-2 rounded-lg border border-outline-variant bg-surface-lowest text-sm focus:outline-none focus:border-primary">
                <option value="daily">Cada día (3 a. m.)</option>
                <option value="weekly">Cada domingo (3 a. m.)</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-on-surface-variant mb-1">Copias a conservar</span>
              <select value={keep} onChange={e => setKeep(Number(e.target.value))}
                className="w-full h-10 px-2 rounded-lg border border-outline-variant bg-surface-lowest text-sm focus:outline-none focus:border-primary">
                {[7, 14, 30, 60].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs text-on-surface-variant" aria-live="polite">
            {state
              ? <>Estado: {state.active ? (state.frequency === 'weekly' ? 'semanal' : 'diario') : 'desactivado'}{state.lastBackup && <> · última copia {when(state.lastBackup)}</>}</>
              : 'Consultando…'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void run('setupBackup')} disabled={!!busy}
              className="m3-state h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              {busy === 'setupBackup' && <Loader2 className="h-4 w-4 animate-spin" />} {state?.active ? 'Guardar' : 'Activar'}
            </button>
            <button type="button" onClick={() => void run('backupNow')} disabled={!!busy}
              className="m3-state h-10 px-4 rounded-full border border-outline text-primary text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              {busy === 'backupNow' && <Loader2 className="h-4 w-4 animate-spin" />} Respaldar ahora
            </button>
            {state?.folderUrl && (
              <a href={state.folderUrl} target="_blank" rel="noreferrer"
                className="m3-state h-10 px-4 rounded-full text-primary text-sm font-semibold inline-flex items-center gap-1.5">
                Abrir carpeta <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {state?.active && (
              <button type="button" onClick={() => void run('disableBackup')} disabled={!!busy}
                className="m3-state h-10 px-4 rounded-full text-error text-sm font-semibold cursor-pointer disabled:opacity-50">
                Desactivar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
