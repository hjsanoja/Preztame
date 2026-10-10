import { HandCoins, History, LayoutDashboard, LucideIcon, Moon, Plus, Settings, Sun, SunMoon } from 'lucide-react';
import { ThemePreference } from '../hooks/useTheme';

export type TabId = 'resumen' | 'deudas' | 'movimientos' | 'config';

export const DESTINATIONS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'deudas', label: 'Préstamos', icon: HandCoins },
  { id: 'movimientos', label: 'Historial', icon: History },
  { id: 'config', label: 'Ajustes', icon: Settings }
];

interface NavProps {
  current: TabId;
  onNavigate: (tab: TabId) => void;
}

// M3 navigation bar (phones): 4 destinations, pill indicator on the active one.
export function NavigationBar({ current, onNavigate }: NavProps) {
  return (
    <nav
      aria-label="Secciones"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-surface-container border-t border-outline-variant/60 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 h-20">
        {DESTINATIONS.map(({ id, label, icon: Icon }) => {
          const active = current === id;
          return (
            <li key={id} className="flex">
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className="flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer group"
              >
                <span
                  className={`m3-state flex items-center justify-center h-8 w-16 rounded-full transition-colors duration-300 ease-[var(--ease-emphasized)] ${
                    active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                </span>
                <span className={`text-xs tracking-wide ${active ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant'}`}>
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_LABEL: Record<ThemePreference, string> = { system: 'Tema del sistema', light: 'Tema claro', dark: 'Tema oscuro' };

interface RailProps extends NavProps {
  onNewDebt: () => void;
  theme: ThemePreference;
  onThemeChange: (t: ThemePreference) => void;
}

// M3 navigation rail (tablet/desktop): FAB on top, destinations, theme at the bottom.
export function NavigationRail({ current, onNavigate, onNewDebt, theme, onThemeChange }: RailProps) {
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : SunMoon;
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  return (
    <nav
      aria-label="Secciones"
      className="hidden md:flex fixed inset-y-0 left-0 z-40 w-24 flex-col items-center gap-6 bg-surface border-r border-outline-variant/50 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-6"
    >
      <img src="./icon.svg" alt="DeudaFlow" className="h-10 w-10 rounded-xl" />
      <button
        type="button"
        onClick={onNewDebt}
        title="Nuevo préstamo (N)"
        aria-label="Nuevo préstamo"
        className="m3-state h-14 w-14 rounded-2xl bg-primary-container text-on-primary-container m3-elevation-1 flex items-center justify-center cursor-pointer"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>
      <ul className="flex flex-col gap-3">
        {DESTINATIONS.map(({ id, label, icon: Icon }, i) => {
          const active = current === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                title={`${label} (${i + 1})`}
                className="w-20 flex flex-col items-center gap-1 py-1 cursor-pointer"
              >
                <span
                  className={`m3-state flex items-center justify-center h-8 w-14 rounded-full transition-colors duration-300 ${
                    active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                </span>
                <span className={`text-xs ${active ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant'}`}>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onThemeChange(nextTheme)}
        title={`${THEME_LABEL[theme]} · cambiar`}
        aria-label={`${THEME_LABEL[theme]}. Cambiar a ${THEME_LABEL[nextTheme].toLowerCase()}`}
        className="m3-state mt-auto h-12 w-12 rounded-full text-on-surface-variant flex items-center justify-center cursor-pointer"
      >
        <ThemeIcon className="h-5 w-5" />
      </button>
    </nav>
  );
}
