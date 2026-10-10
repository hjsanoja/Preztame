import { useEffect, useState } from 'react';
import { BellRing, Loader2, Mail } from 'lucide-react';
import { NotifyState } from '../hooks/useDueNotifications';
import { describeSheetsError, ReminderSettings, SheetsError, updateReminders } from '../lib/sheetsApi';

interface RemindersSettingsProps {
  mode: 'local' | 'sheets';
  url: string;
  token: string;
  apiVersion: number | null;
  isIos: boolean;
  isStandalone: boolean;
  notify: { state: NotifyState; background: boolean; enable: () => Promise<NotifyState>; disable: () => Promise<void> };
  onNotify: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

// "Recordatorios de cobro": device notifications + daily e-mail from Apps Script.
export default function RemindersSettings({ mode, url, token, apiVersion, isIos, isStandalone, notify, onNotify }: RemindersSettingsProps) {
  const [remote, setRemote] = useState<ReminderSettings | null>(null);
  const [emails, setEmails] = useState('');
  const [hour, setHour] = useState(8);
  const [busy, setBusy] = useState<string | null>(null);
  const canEmail = mode === 'sheets' && !!url && !!token && (apiVersion === null || apiVersion >= 7);

  useEffect(() => {
    if (!canEmail) return;
    let alive = true;
    updateReminders({ url, token }, 'getReminders').then(r => {
      if (!alive) return;
      setRemote(r);
      setEmails(r.emails.join(', '));
      setHour(r.hour);
    }).catch(() => {});
    return () => { alive = false; };
  }, [canEmail, url, token]);

  const run = async (action: 'setupReminders' | 'disableReminders' | 'testReminder') => {
    setBusy(action);
    try {
      const list = emails.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean);
      const r = await updateReminders({ url, token }, action, { emails: list, hour });
      setRemote(r);
      setEmails(r.emails.join(', '));
      if (action === 'setupReminders') onNotify(`Recordatorio diario activado a las ${r.hour}:00 para ${r.emails.join(', ')}.`, 'success');
      if (action === 'disableReminders') onNotify('Recordatorios por correo desactivados.', 'info');
      if (action === 'testReminder') onNotify(r.sent ? 'Correo de prueba enviado. Revisa tu bandeja.' : 'No se pudo enviar el correo de prueba.', r.sent ? 'success' : 'warning');
    } catch (err) {
      onNotify(err instanceof SheetsError ? describeSheetsError(err.code) : 'No se pudo conectar con Google Sheets.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const toggleDevice = async () => {
    if (notify.state === 'on') return notify.disable();
    const next = await notify.enable();
    if (next === 'on') onNotify('Avisos activados. Te avisaremos de los cobros vencidos una vez al día.', 'success');
    else if (next === 'blocked') onNotify('El navegador bloqueó las notificaciones. Actívalas en los ajustes del sitio.', 'warning');
  };

  return (
    <div className="m3-card rounded-3xl p-6 space-y-5">
      <h4 className="font-semibold text-on-surface text-base flex items-center">
        <BellRing className="h-5 w-5 mr-2 text-primary" />
        Recordatorios de cobro
      </h4>

      {/* Device notifications */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Avisos en este dispositivo</p>
            <p className="text-xs text-on-surface-variant">
              {notify.state === 'unsupported' ? 'Este navegador no permite notificaciones.'
                : notify.state === 'blocked' ? 'Bloqueadas en el navegador: actívalas en los permisos del sitio.'
                : notify.state === 'on' ? (notify.background ? 'Activos, también con la app cerrada.' : 'Activos: te avisamos al abrir la app, una vez al día.')
                : 'Te avisamos de cobros vencidos o que vencen en 3 días.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notify.state === 'on'}
            aria-label="Avisos en este dispositivo"
            disabled={notify.state === 'unsupported' || notify.state === 'blocked'}
            onClick={() => void toggleDevice()}
            className={`relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors cursor-pointer disabled:opacity-40 ${
              notify.state === 'on' ? 'bg-primary border-primary' : 'bg-surface-highest border-outline'
            }`}
          >
            <span className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
              notify.state === 'on' ? 'left-[calc(100%-1.625rem)] h-6 w-6 bg-on-primary' : 'left-1.5 h-4 w-4 bg-outline'
            }`} />
          </button>
        </div>
        {isIos && !isStandalone && notify.state !== 'unsupported' && (
          <p className="text-xs text-on-surface-variant">En iPhone, los avisos solo funcionan con la app instalada en la pantalla de inicio. Para recibirlos siempre, usa el correo.</p>
        )}
      </section>

      {/* E-mail reminders */}
      <section className="space-y-3 border-t border-outline-variant/60 pt-4">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5"><Mail className="h-4 w-4" /> Correo diario</p>
          <p className="text-xs text-on-surface-variant">Tu Apps Script envía cada día un correo con los cobros vencidos y los que vencen en la semana. Funciona en cualquier teléfono, aunque no abras la app.</p>
        </div>
        {mode === 'local' ? (
          <p className="text-xs text-on-surface-variant">Disponible al conectar Google Sheets.</p>
        ) : !canEmail ? (
          <p className="text-xs text-on-surface-variant">Actualiza tu Apps Script a v7 (paso 3 de la guía) para usar los recordatorios por correo.</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="block">
                <span className="block text-xs text-on-surface-variant mb-1">Enviar a (separa con comas)</span>
                <input
                  type="text"
                  inputMode="email"
                  value={emails}
                  onChange={e => setEmails(e.target.value)}
                  placeholder="tu correo (por defecto)"
                  className="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-sm focus:outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-on-surface-variant mb-1">Hora</span>
                <select value={hour} onChange={e => setHour(Number(e.target.value))}
                  className="h-10 px-2 rounded-lg border border-outline-variant bg-surface-lowest text-sm focus:outline-none focus:border-primary">
                  {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-on-surface-variant" aria-live="polite">
              Estado: {remote ? (remote.active ? `activo, todos los días a las ${remote.hour}:00` : 'desactivado') : 'consultando…'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void run('setupReminders')} disabled={!!busy}
                className="m3-state h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                {busy === 'setupReminders' && <Loader2 className="h-4 w-4 animate-spin" />} {remote?.active ? 'Guardar' : 'Activar'}
              </button>
              <button type="button" onClick={() => void run('testReminder')} disabled={!!busy}
                className="m3-state h-10 px-4 rounded-full border border-outline text-primary text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                {busy === 'testReminder' && <Loader2 className="h-4 w-4 animate-spin" />} Enviar prueba
              </button>
              {remote?.active && (
                <button type="button" onClick={() => void run('disableReminders')} disabled={!!busy}
                  className="m3-state h-10 px-4 rounded-full text-error text-sm font-semibold cursor-pointer disabled:opacity-50">
                  Desactivar
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
