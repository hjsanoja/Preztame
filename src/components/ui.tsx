import { AlarmClock, CalendarClock, CalendarDays, CheckCircle2, CircleAlert, CircleHelp } from 'lucide-react';
import { DueStatus } from '../lib/dueStatus';
import { initials } from '../lib/format';
import { tagColorVar, tagLabel } from '../lib/tags';

const AVATAR_TONES = [
  'bg-primary-container text-on-primary-container',
  'bg-tertiary-container text-on-tertiary-container',
  'bg-secondary-container text-on-secondary-container',
  'bg-success-container text-on-success-container',
  'bg-nando-container text-on-nando-container'
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

export function AccountChip({ cuenta }: { cuenta: 'Nina' | 'Nando' }) {
  return (
    <span className={`inline-flex items-center h-6 px-2 rounded-md text-[11px] font-bold ${
      cuenta === 'Nina' ? 'bg-nina-container text-on-nina-container' : 'bg-nando-container text-on-nando-container'
    }`}>
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
