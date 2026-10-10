import { createContext, useContext, type ReactNode } from 'react';
import { AlarmClock, CalendarClock, CalendarDays, Check, CheckCircle2, CircleAlert, CircleHelp } from 'lucide-react';
import { DueStatus } from '../lib/dueStatus';
import { initials } from '../lib/format';
import { tagColorVar, tagLabel } from '../lib/tags';

const AVATAR_TONES = [
  'bg-primary-container text-on-primary-container',
  'bg-tertiary-container text-on-tertiary-container',
  'bg-secondary-container text-on-secondary-container',
  'bg-success-container text-on-success-container',
  'bg-account-2-container text-on-account-2-container'
];

function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  return (
    <span aria-hidden="true" className={`${dims} ${toneFor(name.trim().toLowerCase())} shrink-0 rounded-full font-bold flex items-center justify-center select-none`}>
      {initials(name)}
    </span>
  );
}

// Tag = colored dot (identity) + label in text ink (never colored text).
export function TagChip({ tag, className = '' }: { tag: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-outline-variant text-xs font-medium text-on-surface-variant whitespace-nowrap ${className}`}>
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: tagColorVar(tag) }} aria-hidden="true" />
      {tagLabel(tag)}
    </span>
  );
}

const DUE_STYLE: Record<DueStatus['kind'], { cls: string; Icon: typeof CircleAlert }> = {
  vencido: { cls: 'bg-error-container text-on-error-container', Icon: CircleAlert },
  hoy: { cls: 'bg-warning-container text-on-warning-container', Icon: AlarmClock },
  pronto: { cls: 'bg-warning-container text-on-warning-container', Icon: AlarmClock },
  mes: { cls: 'bg-tertiary-container text-on-tertiary-container', Icon: CalendarClock },
  futuro: { cls: 'bg-surface-container text-on-surface-variant', Icon: CalendarDays },
  saldado: { cls: 'bg-success-container text-on-success-container', Icon: CheckCircle2 },
  'sin-fecha': { cls: 'bg-surface-container text-on-surface-variant', Icon: CircleHelp }
};

// Status always carries an icon + label, never color alone.
export function DueChip({ status, className = '' }: { status: DueStatus; className?: string }) {
  const { cls, Icon } = DUE_STYLE[status.kind];
  return (
    <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap ${cls} ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {status.label}
    </span>
  );
}

// ---------------- Accounts (people who use the app) ----------------

const ACCOUNT_TONES = [
  { container: 'bg-account-1-container text-on-account-1-container', solid: 'bg-account-1 text-on-account-1', dot: 'bg-account-1' },
  { container: 'bg-account-2-container text-on-account-2-container', solid: 'bg-account-2 text-on-account-2', dot: 'bg-account-2' },
  { container: 'bg-account-3-container text-on-account-3-container', solid: 'bg-account-3 text-on-account-3', dot: 'bg-account-3' },
  { container: 'bg-account-4-container text-on-account-4-container', solid: 'bg-account-4 text-on-account-4', dot: 'bg-account-4' }
];

const AccountsContext = createContext<string[]>(['Nina', 'Nando']);
export const AccountsProvider = AccountsContext.Provider;
export const useAccounts = () => useContext(AccountsContext);

// Each account keeps its color by position in the configured list.
export function accountTone(cuenta: string, accounts: string[]) {
  let i = accounts.indexOf(cuenta);
  if (i < 0) {
    let h = 0;
    for (let k = 0; k < cuenta.length; k++) h = (h * 31 + cuenta.charCodeAt(k)) >>> 0;
    i = h;
  }
  return ACCOUNT_TONES[i % ACCOUNT_TONES.length];
}

export function AccountChip({ cuenta }: { cuenta: string }) {
  const accounts = useAccounts();
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-md text-[11px] font-bold whitespace-nowrap ${accountTone(cuenta, accounts).container}`}>
      {cuenta}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
      <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[var(--ease-emphasized)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

const PUNCTUALITY_STYLE = {
  puntual: { cls: 'bg-success-container text-on-success-container', Icon: CheckCircle2 },
  'a-veces': { cls: 'bg-warning-container text-on-warning-container', Icon: AlarmClock },
  atrasado: { cls: 'bg-error-container text-on-error-container', Icon: CircleAlert },
  'sin-historial': { cls: 'bg-surface-container text-on-surface-variant', Icon: CircleHelp }
} as const;

export function PunctualityChip({ value, label }: { value: keyof typeof PUNCTUALITY_STYLE; label: string }) {
  const { cls, Icon } = PUNCTUALITY_STYLE[value];
  return (
    <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap ${cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

// M3 filter chip (selected = tonal with a check mark).
export function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`m3-state h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
        selected
          ? 'bg-secondary-container text-on-secondary-container border-transparent'
          : 'border-outline-variant text-on-surface-variant'
      }`}
    >
      {selected && <Check className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}
