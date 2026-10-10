import { useEffect, useState } from 'react';
import { Delete, Fingerprint } from 'lucide-react';

interface LockScreenProps {
  hasBiometric: boolean;
  pinLength: number;
  onPin: (pin: string) => Promise<boolean>;
  onBiometric: () => Promise<boolean>;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// Full-screen lock: PIN keypad + fingerprint / Face ID button.
export default function LockScreen({ hasBiometric, pinLength, onPin, onBiometric }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const waiting = waitUntil > now;

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  const submit = async (value: string) => {
    if (await onPin(value)) return;
    const n = fails + 1;
    setFails(n);
    setPin('');
    if (n >= 5) {
      setWaitUntil(Date.now() + 30_000);
      setNow(Date.now());
      setFails(0);
      setError('Demasiados intentos. Espera 30 segundos.');
    } else {
      setError('PIN incorrecto.');
    }
  };

  const press = (k: string) => {
    if (waiting) return;
    setError('');
    if (k === 'del') return setPin(p => p.slice(0, -1));
    const next = (pin + k).slice(0, pinLength);
    setPin(next);
    if (next.length === pinLength) void submit(next);
  };

  // Offer the fingerprint / Face ID prompt right away.
  useEffect(() => {
    if (hasBiometric) void onBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');

    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="Preztame está bloqueado"
      className="fixed inset-0 z-[100] bg-surface text-on-surface flex flex-col items-center justify-center gap-6 p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <img src="./icon.svg" alt="" className="h-16 w-16 rounded-2xl" />
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Preztame está bloqueado</h1>
        <p className="text-sm text-on-surface-variant mt-1">{hasBiometric ? 'Usa tu huella o Face ID, o escribe tu PIN.' : 'Escribe tu PIN para continuar.'}</p>
      </div>

      <div className="flex gap-3 h-4" aria-label={`${pin.length} dígitos escritos`}>
        {Array.from({ length: pinLength }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-primary' : 'border-2 border-outline'}`} />
        ))}
      </div>
      <p role="alert" className="text-sm text-error min-h-5">{waiting ? `Demasiados intentos. Espera ${Math.ceil((waitUntil - now) / 1000)} s.` : error}</p>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) => k === '' ? (
          hasBiometric ? (
            <button key={i} type="button" onClick={() => void onBiometric()} aria-label="Desbloquear con huella o Face ID"
              className="m3-state h-16 w-16 rounded-full text-primary flex items-center justify-center cursor-pointer">
              <Fingerprint className="h-7 w-7" />
            </button>
          ) : <span key={i} />
        ) : (
          <button key={i} type="button" onClick={() => press(k)} disabled={waiting}
            aria-label={k === 'del' ? 'Borrar' : k}
            className={`m3-state h-16 w-16 rounded-full text-2xl font-medium flex items-center justify-center cursor-pointer disabled:opacity-40 ${k === 'del' ? 'text-on-surface-variant' : 'bg-surface-container'}`}>
            {k === 'del' ? <Delete className="h-6 w-6" /> : k}
          </button>
        ))}
      </div>

      {hasBiometric && (
        <button type="button" onClick={() => void onBiometric()}
          className="m3-state h-12 px-6 rounded-full bg-primary-container text-on-primary-container font-semibold inline-flex items-center gap-2 cursor-pointer">
          <Fingerprint className="h-5 w-5" /> Usar huella o Face ID
        </button>
      )}
    </div>
  );
}
