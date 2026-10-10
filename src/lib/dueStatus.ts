import { Debt } from '../types';
import { formatMonthName } from '../utils/storage';

export type DueKind = 'saldado' | 'vencido' | 'hoy' | 'pronto' | 'mes' | 'futuro' | 'sin-fecha';

export interface DueStatus {
  kind: DueKind;
  label: string;
  // Days until the due date (negative = overdue). null when settled / no date.
  days: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

// A loan is due by the last day of its payment month (mesPago "YYYY-MM").
export function dueDateOf(mesPago: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mesPago || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]), 0); // day 0 of next month = last day
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function getDueStatus(debt: Pick<Debt, 'estado' | 'mesPago' | 'saldo'>, today: Date = new Date()): DueStatus {
  if (debt.estado === 'saldado' || debt.saldo <= 0) return { kind: 'saldado', label: 'Saldado', days: null };
  const due = dueDateOf(debt.mesPago);
  if (!due) return { kind: 'sin-fecha', label: 'Sin mes de pago', days: null };

  const days = Math.round((startOfDay(due).getTime() - startOfDay(today).getTime()) / DAY);
  const plural = (n: number) => `${n} día${n === 1 ? '' : 's'}`;
  if (days < 0) return { kind: 'vencido', label: `Vencido hace ${plural(-days)}`, days };
  if (days === 0) return { kind: 'hoy', label: 'Vence hoy', days };
  if (days <= 7) return { kind: 'pronto', label: `Vence en ${plural(days)}`, days };
  const sameMonth = due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth();
  if (sameMonth) return { kind: 'mes', label: `Vence en ${plural(days)}`, days };
  return { kind: 'futuro', label: `Para ${formatMonthName(debt.mesPago)}`, days };
}

// Days since the loan was made (for the aging chart).
export function ageInDays(fecha: string, today: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha || '');
  if (!m) return 0;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.max(0, Math.round((startOfDay(today).getTime() - d.getTime()) / DAY));
}
