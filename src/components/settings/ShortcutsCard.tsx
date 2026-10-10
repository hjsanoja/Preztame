import { Fragment } from 'react';
import { Keyboard } from 'lucide-react';
import { SettingsCard } from './SettingsCard';

const SHORTCUTS = [['Ctrl/⌘ K', 'Buscar'], ['N', 'Nuevo préstamo'], ['1 – 4', 'Cambiar de sección'], ['Esc', 'Cerrar ventana']];

// Only useful with a keyboard, so hidden on phones.
export default function ShortcutsCard() {
  return (
    <SettingsCard icon={Keyboard} title="Atajos de teclado" className="hidden md:block">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {SHORTCUTS.map(([k, v]) => (
          <Fragment key={k}>
            <dt><kbd className="text-xs font-semibold border border-outline-variant bg-surface-container rounded-md px-2 py-0.5">{k}</kbd></dt>
            <dd className="text-on-surface-variant">{v}</dd>
          </Fragment>
        ))}
      </dl>
    </SettingsCard>
  );
}
