import { Debt, Payment } from '../types';
import { dueDateOf, getDueStatus } from './dueStatus';
import { fromCents, toCents } from './money';

export const personKey = (name: string) => name.trim().toLowerCase();

export type Punctuality = 'puntual' | 'a-veces' | 'atrasado' | 'sin-historial';

export interface PersonSummary {
  key: string;
  name: string;
  deudas: Debt[];
  pagos: Payment[];
  porCobrar: number;
  prestado: number;
  abonado: number;
  activos: number;
  vencidos: number;
  ultimoMovimiento: string; // YYYY-MM-DD
  punctuality: Punctuality;
  onTimeRate: number | null; // 0..1
  avgDaysLate: number | null;
}

const DAY = 24 * 60 * 60 * 1000;
const parseDay = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

// How reliably someone pays: settled loans paid by their due month count as
// on time; overdue loans (still pending) and late settlements count as late.
export function punctualityOf(deudas: Debt[], pagos: Payment[], today: Date = new Date()) {
  let onTime = 0;
  const lateDays: number[] = [];
  for (const d of deudas) {
    const due = dueDateOf(d.mesPago);
    if (!due) continue;
    if (d.estado === 'saldado') {
      const last = pagos.filter(p => p.deudaId === d.id).map(p => p.fecha).sort().pop();
      const paidOn = last ? parseDay(last) : null;
      if (!paidOn || paidOn <= due) onTime++;
      else lateDays.push(Math.round((paidOn.getTime() - due.getTime()) / DAY));
    } else if (getDueStatus(d, today).kind === 'vencido') {
      lateDays.push(-(getDueStatus(d, today).days ?? 0));
    }
  }
  const total = onTime + lateDays.length;
  if (total === 0) return { punctuality: 'sin-historial' as Punctuality, onTimeRate: null, avgDaysLate: null };
  const rate = onTime / total;
  return {
    punctuality: (rate >= 0.8 ? 'puntual' : rate >= 0.5 ? 'a-veces' : 'atrasado') as Punctuality,
    onTimeRate: rate,
    avgDaysLate: lateDays.length ? Math.round(lateDays.reduce((a, b) => a + b, 0) / lateDays.length) : null
  };
}

export const PUNCTUALITY_LABEL: Record<Punctuality, string> = {
  puntual: 'Paga a tiempo',
  'a-veces': 'A veces se atrasa',
  atrasado: 'Suele atrasarse',
  'sin-historial': 'Sin historial aún'
};

export function summarizePeople(deudas: Debt[], pagos: Payment[], today: Date = new Date()): PersonSummary[] {
  const groups = new Map<string, Debt[]>();
  deudas.forEach(d => {
    const k = personKey(d.contacto);
    groups.set(k, [...(groups.get(k) || []), d]);
  });
  return [...groups.entries()].map(([key, list]) => {
    const ids = new Set(list.map(d => d.id));
    const own = pagos.filter(p => ids.has(p.deudaId));
    const newest = [...list].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const prestado = list.reduce((s, d) => s + toCents(d.monto), 0);
    const porCobrar = list.reduce((s, d) => s + toCents(d.saldo), 0);
    const dates = [...list.map(d => d.fecha), ...own.map(p => p.fecha)].filter(Boolean).sort();
    return {
      key,
      name: newest.contacto.trim(),
      deudas: list,
      pagos: own,
      porCobrar: fromCents(porCobrar),
      prestado: fromCents(prestado),
      abonado: fromCents(own.reduce((s, p) => s + toCents(p.monto), 0)),
      activos: list.filter(d => d.estado === 'pendiente').length,
      vencidos: list.filter(d => getDueStatus(d, today).kind === 'vencido').length,
      ultimoMovimiento: dates[dates.length - 1] || '',
      ...punctualityOf(list, own, today)
    };
  }).sort((a, b) => b.porCobrar - a.porCobrar || b.ultimoMovimiento.localeCompare(a.ultimoMovimiento));
}
