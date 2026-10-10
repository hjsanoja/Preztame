import { useState } from 'react';
import { Check, Moon, Palette, Sun, SunMoon } from 'lucide-react';
import { ThemePreference } from '../../hooks/useTheme';
import { roundRatePreference, setRoundRatePreference } from '../../lib/rate';
import { SettingsCard } from './SettingsCard';

export default function AppearanceCard({ themePreference, onThemeChange }: { themePreference: ThemePreference; onThemeChange: (t: ThemePreference) => void }) {
  const [roundRate, setRoundRate] = useState(roundRatePreference);
  return (
    <SettingsCard icon={Palette} title="Apariencia y preferencias">
      <div role="radiogroup" aria-label="Tema" className="flex h-10 rounded-full border border-outline overflow-hidden">
        {([['system', 'Sistema', SunMoon], ['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]] as const).map(([value, label, Icon], i) => {
          const selected = themePreference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onThemeChange(value)}
              className={`m3-state flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer ${i > 0 ? 'border-l border-outline' : ''} ${
                selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'
              }`}
            >
              {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-on-surface-variant">"Sistema" sigue el modo claro u oscuro de tu teléfono o computadora.</p>
      <label className="flex items-center justify-between gap-3 pt-3 border-t border-outline-variant/60 cursor-pointer">
        <span>
          <span className="block text-sm font-semibold">Redondear la tasa BCV hacia arriba</span>
          <span className="block text-xs text-on-surface-variant">Al cargar la tasa del día se usa el número entero siguiente (36,47 → 37,00).</span>
        </span>
        <input
          type="checkbox"
          checked={roundRate}
          onChange={e => { setRoundRate(e.target.checked); setRoundRatePreference(e.target.checked); }}
          className="h-5 w-5 shrink-0 accent-[var(--md-primary)] cursor-pointer"
        />
      </label>
    </SettingsCard>
  );
}
