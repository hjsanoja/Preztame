import { useState } from 'react';
import { Check, Download, Link2, Share, Smartphone, SquarePlus } from 'lucide-react';
import { btn, field, fieldLabel, SettingsCard } from './SettingsCard';

interface InstallCardProps {
  pwa: { isStandalone: boolean; isIos: boolean; canInstall: boolean; onInstall: () => void };
  onApplyAutoConfigLink: (link: string) => boolean;
}

// Install as an app + paste an auto-config link.
export default function InstallCard({ pwa, onApplyAutoConfigLink }: InstallCardProps) {
  const [link, setLink] = useState('');
  return (
    <SettingsCard icon={Smartphone} title="App en tu teléfono">
      {pwa.isStandalone ? (
        <p className="text-sm rounded-2xl bg-success-container text-on-success-container px-4 py-3 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" /> Estás usando Preztame instalada. Funciona aunque no tengas conexión.
        </p>
      ) : pwa.canInstall ? (
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">Instálala para abrirla desde tu pantalla de inicio, a pantalla completa y sin conexión.</p>
          <button type="button" onClick={pwa.onInstall} className={btn.filled}>
            <Download className="h-4 w-4" /> Instalar app
          </button>
        </div>
      ) : pwa.isIos ? (
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-on-surface-variant">
          <li>Abre esta página en <strong>Safari</strong>.</li>
          <li>Toca <Share className="inline h-4 w-4 -mt-0.5 text-primary" aria-label="Compartir" /> <strong>Compartir</strong>.</li>
          <li>Elige <SquarePlus className="inline h-4 w-4 -mt-0.5" aria-hidden="true" /> <strong>Agregar a inicio</strong>.</li>
          <li>En el iPhone la app instalada guarda sus datos aparte de Safari: ábrela y pega abajo tu link de autoconfiguración.</li>
        </ol>
      ) : (
        <p className="text-sm text-on-surface-variant">
          En el teléfono, abre esta página con Chrome (Android) o Safari (iPhone) y usa <strong>"Instalar app"</strong> o <strong>"Agregar a inicio"</strong> en el menú del navegador.
        </p>
      )}

      <form
        className="space-y-2 border-t border-outline-variant/60 pt-4"
        onSubmit={e => { e.preventDefault(); if (onApplyAutoConfigLink(link)) setLink(''); }}
      >
        <label htmlFor="df-autoconfig-link" className={fieldLabel}>¿Tienes un link de autoconfiguración?</label>
        <div className="flex gap-2">
          <input
            id="df-autoconfig-link"
            type="url"
            inputMode="url"
            placeholder="Pega aquí el link…"
            value={link}
            onChange={e => setLink(e.target.value)}
            className={`${field} min-w-0 flex-1 font-mono text-sm`}
          />
          <button type="submit" disabled={!link.trim()} className={`${btn.tonal} h-12 shrink-0`}>
            <Link2 className="h-4 w-4" /> Aplicar
          </button>
        </div>
      </form>
    </SettingsCard>
  );
}
