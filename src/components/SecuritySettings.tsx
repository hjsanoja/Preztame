import { useEffect, useState } from 'react';
import { Fingerprint, Lock, ShieldCheck } from 'lucide-react';
import { biometricAvailable, checkPin, isValidPin, LockSettings } from '../lib/appLock';

interface SecuritySettingsProps {
  settings: LockSettings;
  userName: string;
  setPin: (pin: string) => Promise<void>;
  disable: () => void;
  enableBiometric: (userName: string) => Promise<void>;
  disableBiometric: () => void;
  setTimeoutMin: (m: number) => void;
  lockNow: () => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const TIMEOUTS: [number, string][] = [[0, 'Siempre que salgas'], [1, 'Después de 1 minuto'], [5, 'Después de 5 minutos'], [15, 'Después de 15 minutos']];

const pinInput = 'h-10 w-28 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-base tracking-[0.4em] focus:outline-none focus:border-primary';

// "Seguridad": PIN + fingerprint / Face ID to open the app on this device.
export default function SecuritySettings({ settings, userName, setPin, disable, enableBiometric, disableBiometric, setTimeoutMin, lockNow, onNotify }: SecuritySettingsProps) {
  const [canBio, setCanBio] = useState(false);
  const [step, setStep] = useState<'idle' | 'new' | 'change' | 'off'>('idle');
  const [current, setCurrent] = useState('');
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void biometricAvailable().then(setCanBio); }, []);

  const reset = () => { setStep('idle'); setCurrent(''); setPin1(''); setPin2(''); setError(''); };

  const savePin = async () => {
    if (step === 'change' && !(await checkPin(current, settings))) return setError('El PIN actual no es correcto.');
    if (!isValidPin(pin1)) return setError('El PIN debe tener de 4 a 6 números.');
    if (pin1 !== pin2) return setError('Los dos PIN no coinciden.');
    await setPin(pin1);
    onNotify(step === 'change' ? 'PIN actualizado.' : 'Bloqueo activado. Se pedirá el PIN al abrir Preztame.', 'success');
    reset();
  };

  const turnOff = async () => {
    if (!(await checkPin(current, settings))) return setError('El PIN no es correcto.');
    disable();
    onNotify('Bloqueo desactivado.', 'info');
    reset();
  };

  const toggleBio = async () => {
    if (settings.credentialId) { disableBiometric(); onNotify('Huella / Face ID desactivado.', 'info'); return; }
    try {
      await enableBiometric(userName);
      onNotify('Listo: puedes abrir Preztame con tu huella o Face ID.', 'success');
    } catch {
      onNotify('No se pudo activar. Revisa que tu teléfono tenga huella o Face ID configurado.', 'warning');
    }
  };

  const pinFields = (
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void (step === 'off' ? turnOff() : savePin()); }}>
      {(step === 'change' || step === 'off') && (
        <label className="flex items-center justify-between gap-3 text-sm">
          PIN actual
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={current} onChange={e => setCurrent(e.target.value.replace(/\D/g, ''))} className={pinInput} />
        </label>
      )}
      {step !== 'off' && (
        <>
          <label className="flex items-center justify-between gap-3 text-sm">
            Nuevo PIN (4 a 6 números)
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin1} onChange={e => setPin1(e.target.value.replace(/\D/g, ''))} className={pinInput} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Repite el PIN
            <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} className={pinInput} />
          </label>
        </>
      )}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={`m3-state h-10 px-4 rounded-full text-sm font-semibold cursor-pointer ${step === 'off' ? 'bg-error text-on-error' : 'bg-primary text-on-primary'}`}>
          {step === 'off' ? 'Desactivar bloqueo' : 'Guardar PIN'}
        </button>
        <button type="button" onClick={reset} className="m3-state h-10 px-4 rounded-full text-primary text-sm font-semibold cursor-pointer">Cancelar</button>
      </div>
    </form>
  );

  return (
    <div className="m3-card rounded-3xl p-6 space-y-4">
      <div>
        <h4 className="font-semibold text-on-surface text-base flex items-center">
          <ShieldCheck className="h-5 w-5 mr-2 text-primary" />
          Seguridad
        </h4>
        <p className="text-xs text-on-surface-variant mt-1">Pide un PIN o tu huella / Face ID para abrir Preztame en este dispositivo.</p>
      </div>

      {step !== 'idle' ? pinFields : !settings.enabled ? (
        <button type="button" onClick={() => setStep('new')} className="m3-state h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
          <Lock className="h-4 w-4" /> Activar bloqueo con PIN
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm flex items-center gap-2"><Lock className="h-4 w-4 text-success" /> Bloqueo activo con PIN de {settings.pinLength} dígitos.</p>

          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="text-sm font-semibold flex items-center gap-1.5"><Fingerprint className="h-4 w-4" /> Huella o Face ID</span>
              <span className="block text-xs text-on-surface-variant">{canBio ? 'Desbloquea sin escribir el PIN.' : 'Este dispositivo o navegador no lo permite.'}</span>
            </span>
            <button type="button" role="switch" aria-checked={!!settings.credentialId} aria-label="Huella o Face ID" disabled={!canBio}
              onClick={() => void toggleBio()}
              className={`relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors cursor-pointer disabled:opacity-40 ${settings.credentialId ? 'bg-primary border-primary' : 'bg-surface-highest border-outline'}`}>
              <span className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${settings.credentialId ? 'left-[calc(100%-1.625rem)] h-6 w-6 bg-on-primary' : 'left-1.5 h-4 w-4 bg-outline'}`} />
            </button>
          </label>

          <label className="block">
            <span className="block text-xs text-on-surface-variant mb-1">Volver a bloquear</span>
            <select value={settings.timeoutMin} onChange={e => setTimeoutMin(Number(e.target.value))}
              className="h-10 px-2 rounded-lg border border-outline-variant bg-surface-lowest text-sm focus:outline-none focus:border-primary">
              {TIMEOUTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={lockNow} className="m3-state h-10 px-4 rounded-full border border-outline text-primary text-sm font-semibold cursor-pointer">Bloquear ahora</button>
            <button type="button" onClick={() => setStep('change')} className="m3-state h-10 px-4 rounded-full text-primary text-sm font-semibold cursor-pointer">Cambiar PIN</button>
            <button type="button" onClick={() => setStep('off')} className="m3-state h-10 px-4 rounded-full text-error text-sm font-semibold cursor-pointer">Desactivar</button>
          </div>
        </div>
      )}
      <p className="text-xs text-on-surface-variant">Es una protección de este teléfono. Tus datos en Google Sheets siguen protegidos por la clave de acceso.</p>
    </div>
  );
}
