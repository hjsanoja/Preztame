import { useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';

interface InstallBannerProps {
  canInstall: boolean;
  isIos: boolean;
  isStandalone: boolean;
  onInstall: () => void;
}

const DISMISS_KEY = 'df_install_dismissed_at';
const DISMISS_DAYS = 14;

function wasDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// Suggests installing the app: a button on Android/desktop Chrome, and
// step-by-step instructions on iPhone (Safari has no install prompt).
export default function InstallBanner({ canInstall, isIos, isStandalone, onInstall }: InstallBannerProps) {
  const [hidden, setHidden] = useState(wasDismissedRecently);

  if (isStandalone || hidden || (!canInstall && !isIos)) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setHidden(true);
  };

  return (
    <div className="gemini-card rounded-2xl p-4 mb-6 flex items-start gap-3 animate-fade-in" role="region" aria-label="Instalar la app">
      <img src="./pwa-192.png" alt="" className="h-11 w-11 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">Instala DeudaFlow en tu teléfono</p>
        {canInstall ? (
          <p className="text-xs text-slate-500 mt-0.5">Ábrela desde tu pantalla de inicio, a pantalla completa y aunque no tengas conexión.</p>
        ) : (
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            En Safari toca <Share className="inline h-3.5 w-3.5 -mt-0.5 text-blue-600" aria-label="Compartir" /> <strong>Compartir</strong> y luego
            {' '}<SquarePlus className="inline h-3.5 w-3.5 -mt-0.5 text-slate-700" aria-hidden="true" /> <strong>Agregar a inicio</strong>.
          </p>
        )}
        {canInstall && (
          <button
            type="button"
            onClick={onInstall}
            className="mt-2.5 inline-flex items-center gap-1.5 gemini-gradient-bg text-white text-xs font-bold px-4 py-2 rounded-full active:scale-95 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar app
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="p-1.5 -m-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        aria-label="Ocultar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
