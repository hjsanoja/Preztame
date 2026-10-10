import { useState } from 'react';
import { AlertTriangle, Check, Cloud, Copy, ExternalLink, HardDrive, Loader2, ShieldAlert, Stethoscope } from 'lucide-react';
import { fetchSnapshot, SheetsError, describeSheetsError } from '../../lib/sheetsApi';
import { saveDraftToken } from '../../utils/storage';
import { btn, field, fieldLabel, SettingsCard } from './SettingsCard';

interface ConnectionCardProps {
  sheetUrl: string;
  sheetToken: string;
  tokenInput: string;
  onTokenInput: (token: string) => void;
  onSaveConnection: (url: string, token: string) => void;
  onClearSettings: () => void;
  isLocalMode: boolean;
  onToggleLocal: (local: boolean) => void;
  partnerLink: () => string | null;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error-cors' | 'error-config';

// Where the data lives: Google Sheets (URL + key) or a local test mode.
export default function ConnectionCard({ sheetUrl, sheetToken, tokenInput, onTokenInput, onSaveConnection, onClearSettings, isLocalMode, onToggleLocal, partnerLink }: ConnectionCardProps) {
  const [urlInput, setUrlInput] = useState(sheetUrl);
  const [test, setTest] = useState<{ status: TestStatus; message?: string }>({ status: 'idle' });
  const [copied, setCopied] = useState<'token' | 'link' | null>(null);

  const flash = (what: 'token' | 'link') => { setCopied(what); setTimeout(() => setCopied(null), 2000); };

  const runTest = async () => {
    const url = urlInput.trim();
    if (!url) return setTest({ status: 'error-config', message: 'Escribe la URL de la aplicación web.' });
    if (url.includes('/edit')) return setTest({ status: 'error-config', message: 'Esa es la URL de edición de la hoja. Usa la URL de la Aplicación Web publicada, la que termina en /exec.' });
    if (!url.includes('/exec')) return setTest({ status: 'error-config', message: 'La URL no termina en /exec. En Apps Script crea una implementación de tipo Aplicación web y copia su URL.' });
    if (!tokenInput.trim()) return setTest({ status: 'error-config', message: 'Falta la clave de acceso.' });

    setTest({ status: 'testing', message: 'Probando la conexión con Google…' });
    const cfg = { url, token: tokenInput.trim() };
    try {
      const started = performance.now();
      const snap = await fetchSnapshot(cfg, null, { fresh: true });
      const ms = Math.round(performance.now() - started);
      if (snap.kind === 'data' && !snap.version) {
        return setTest({ status: 'error-config', message: 'La hoja respondió con un código muy antiguo que no verifica la clave. Copia el código del paso 3 y publica una nueva versión.' });
      }
      const count = snap.kind === 'data' ? `${snap.data.deudas.length} préstamos y ${snap.data.pagos.length} abonos` : 'tus datos';
      setTest({ status: 'success', message: `¡Conexión correcta! Se leyeron ${count} en ${ms} ms (Apps Script v${snap.apiVersion}).` });
    } catch (err) {
      if (err instanceof SheetsError && err.code === 'unauthorized') {
        const appEnd = tokenInput.trim().slice(-4);
        return setTest({
          status: 'error-config',
          message: err.keyHint
            ? `La clave no coincide: el Apps Script publicado tiene una clave que termina en "…${err.keyHint}" y la app usa una que termina en "…${appEnd}". Copia el código de nuevo (ya trae la clave de la app), pégalo en Apps Script y publica una NUEVA VERSIÓN.`
            : `La clave no coincide con la del Apps Script publicado (la de la app termina en "…${appEnd}"). Copia el código de nuevo, pégalo en Apps Script y publica una NUEVA VERSIÓN.`
        });
      }
      if (err instanceof SheetsError && err.code === 'server') {
        return setTest({ status: 'error-config', message: `El Apps Script respondió con un error interno: "${err.message}". Suele ser temporal (Google ocupado); prueba de nuevo en un minuto.` });
      }
      if (err instanceof SheetsError && err.code === 'timeout') {
        return setTest({ status: 'error-config', message: 'Google tardó más de 15 segundos en leer la hoja completa. Suele pasar la primera vez tras actualizar el script; prueba de nuevo.' });
      }
      if (err instanceof SheetsError && err.code !== 'network') {
        return setTest({ status: 'error-config', message: describeSheetsError(err.code) });
      }
      // The full read failed at the network level: check whether a normal
      // (cached) read works, like the app's own sync does.
      try {
        await fetchSnapshot(cfg, null);
        return setTest({ status: 'error-config', message: 'La conexión funciona (así sincroniza la app), pero la lectura completa de la hoja falló esta vez. Prueba de nuevo en un minuto; tus datos no corren riesgo.' });
      } catch {
        setTest({ status: 'error-cors', message: 'Google no dejó conectar ("Failed to fetch").' });
      }
    }
  };

  const copyLink = () => {
    const link = partnerLink();
    if (!link) return;
    void navigator.clipboard.writeText(link);
    flash('link');
  };

  return (
    <SettingsCard icon={isLocalMode ? HardDrive : Cloud} title="Dónde se guardan tus datos">
      <div role="radiogroup" aria-label="Modo de datos" className="flex h-10 rounded-full border border-outline overflow-hidden">
        {([[false, 'Google Sheets'], [true, 'Prueba local']] as const).map(([local, label], i) => {
          const selected = isLocalMode === local;
          return (
            <button key={label} type="button" role="radio" aria-checked={selected} onClick={() => onToggleLocal(local)}
              className={`m3-state flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer ${i > 0 ? 'border-l border-outline' : ''} ${selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'}`}>
              {selected && <Check className="h-4 w-4" aria-hidden="true" />}
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-on-surface-variant">
        {isLocalMode
          ? 'Prueba local guarda los datos solo en este navegador. Sirve para probar la app sin configurar nada.'
          : 'Todo se guarda en tu hoja de Google Sheets y se comparte entre los teléfonos conectados.'}
      </p>

      {!isLocalMode && (
        <>
          <form onSubmit={e => { e.preventDefault(); onSaveConnection(urlInput.trim(), tokenInput.trim()); }} className="space-y-3 pt-3 border-t border-outline-variant/60">
            <div>
              <label htmlFor="df-url" className={fieldLabel}>URL de la aplicación web (Apps Script)</label>
              <input id="df-url" type="url" required placeholder="https://script.google.com/macros/s/.../exec" value={urlInput}
                onChange={e => { setUrlInput(e.target.value); setTest({ status: 'idle' }); }}
                className={`${field} font-mono text-sm`} />
              {sheetUrl && urlInput.trim() && urlInput.trim() !== sheetUrl && (
                <p className="text-xs text-on-surface-variant mt-1">Esta URL es distinta de la que usa la app ahora. La app sigue con la anterior hasta que toques «Guardar conexión».</p>
              )}
            </div>
            <div>
              <label htmlFor="df-token" className={fieldLabel}>Clave de acceso (va dentro del Apps Script)</label>
              <div className="flex gap-2">
                <input id="df-token" type="text" required autoComplete="off" spellCheck={false} value={tokenInput}
                  onChange={e => { onTokenInput(e.target.value); saveDraftToken(e.target.value.trim()); setTest({ status: 'idle' }); }}
                  className={`${field} min-w-0 flex-1 font-mono text-sm`} />
                <button type="button" title="Copiar clave" aria-label="Copiar clave"
                  onClick={() => { void navigator.clipboard.writeText(tokenInput.trim()); flash('token'); }}
                  className="m3-state h-12 w-12 shrink-0 rounded-full border border-outline-variant text-on-surface-variant flex items-center justify-center cursor-pointer">
                  {copied === 'token' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                {sheetToken
                  ? 'Si cambias la clave, copia el código de nuevo y vuelve a implementar el script.'
                  : 'Clave generada para ti. El código del paso 3 ya la incluye: cópialo, pégalo y vuelve a implementar.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btn.filled}>Guardar conexión</button>
              <button type="button" onClick={() => void runTest()} className={btn.outlined}>
                <Stethoscope className="h-4 w-4" /> Probar conexión
              </button>
              <button type="button" onClick={() => { setUrlInput(''); onClearSettings(); setTest({ status: 'idle' }); }} className={btn.danger}>
                Desconectar
              </button>
            </div>
          </form>

          {test.status !== 'idle' && (
            <div role="status" className={`rounded-2xl p-4 text-sm space-y-2 ${
              test.status === 'testing' ? 'bg-surface-container' :
              test.status === 'success' ? 'bg-success-container text-on-success-container' :
              test.status === 'error-cors' ? 'bg-error-container text-on-error-container' : 'bg-warning-container text-on-warning-container'
            }`}>
              <p className="font-semibold flex items-start gap-2">
                {test.status === 'testing' ? <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" /> :
                  test.status === 'success' ? <Check className="h-4 w-4 mt-0.5 shrink-0" /> :
                  test.status === 'error-cors' ? <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                {test.message}
              </p>
              {test.status === 'error-cors' && (
                <>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>En Apps Script ve a <strong>Implementar → Administrar implementaciones</strong>. En <strong>Quién tiene acceso</strong> debe decir <strong>Cualquiera</strong>. Ojo: «Cualquier usuario con cuenta de Google» <em>no</em> sirve (en el navegador abre, pero la app no puede).</li>
                    <li>Revisa que la URL sea la de esa implementación. Si creaste una <strong>Nueva implementación</strong>, la URL cambió: lo normal es editar la que ya tenías y elegir «Nueva versión».</li>
                    <li>Abre la URL en el navegador y acepta los permisos si te los pide. Si ves <code className="font-mono text-xs">{'{"ok":false,"error":"unauthorized"}'}</code> está bien: el script funciona y solo falta la clave, que pone la app.</li>
                  </ol>
                  {urlInput && (
                    <a href={urlInput} target="_blank" rel="noreferrer" className={`${btn.filled} bg-error text-on-error`}>
                      <ExternalLink className="h-4 w-4" /> Abrir la URL para autorizar
                    </a>
                  )}
                </>
              )}
            </div>
          )}

          {sheetUrl && (
            <div className="space-y-2 pt-3 border-t border-outline-variant/60">
              <p className="text-sm font-semibold">Abrir en otro teléfono</p>
              <p className="text-xs text-on-surface-variant">Copia un enlace que abre Preztame ya conectada a esta hoja. En ese teléfono queda elegida la siguiente persona de la lista (se puede cambiar).</p>
              <button type="button" onClick={copyLink} className={btn.tonal}>
                {copied === 'link' ? <><Check className="h-4 w-4" /> ¡Enlace copiado!</> : <><Copy className="h-4 w-4" /> Copiar link de autoconfiguración</>}
              </button>
            </div>
          )}
        </>
      )}
    </SettingsCard>
  );
}
