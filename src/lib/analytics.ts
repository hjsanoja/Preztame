import { Debt, Payment } from '../types';
import { ageInDays, getDueStatus } from './dueStatus';
import { addMoney, fromCents, toCents } from './money';
import { normalizeTag } from './tags';

const pad = (n: number) => String(n).padStart(2, '0');
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

// The last `n` month keys ending at `today`'s month, oldest first.
export function lastMonths(n: number, today: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 1)));
}

// Trims leading months before the first loan so charts don't start empty.
export function activeMonths(deudas: Debt[], n: number, today: Date = new Date()): string[] {
  const months = lastMonths(n, today);
  const first = deudas.map(d => d.fecha.slice(0, 7)).filter(Boolean).sort()[0];
  if (!first) return months.slice(-6);
  const trimmed = months.filter(m => m >= first);
  return trimmed.length >= 2 ? trimmed : months.slice(-Math.max(2, trimmed.length));
}

// Outstanding balance at the end of each month (loans made minus payments received by then).
export function outstandingByMonth(deudas: Debt[], pagos: Payment[], months: string[]) {
  const paidByDebt = new Map<string, Payment[]>();
  pagos.forEach(p => paidByDebt.set(p.deudaId, [...(paidByDebt.get(p.deudaId) || []), p]));
  return months.map(m => {
    let cents = 0;
    for (const d of deudas) {
      if (!d.fecha || d.fecha.slice(0, 7) > m) continue;
      const paid = (paidByDebt.get(d.id) || []).filter(p => p.fecha.slice(0, 7) <= m).reduce((s, p) => s + toCents(p.monto), 0);
      cents += Math.max(0, toCents(d.monto) - paid);
    }
    return { mes: m, saldo: fromCents(cents) };
  });
}

// Money lent (by loan date) and recovered (by payment date) per month.
export function flowByMonth(deudas: Debt[], pagos: Payment[], months: string[]) {
  const set = new Set(months);
  const rows = new Map(months.map(m => [m, { mes: m, prestado: 0, cobrado: 0 }]));
  deudas.forEach(d => { const m = d.fecha.slice(0, 7); if (set.has(m)) rows.get(m)!.prestado = addMoney(rows.get(m)!.prestado, d.monto); });
  pagos.forEach(p => { const m = p.fecha.slice(0, 7); if (set.has(m)) rows.get(m)!.cobrado = addMoney(rows.get(m)!.cobrado, p.monto); });
  return months.map(m => rows.get(m)!);
}

export const AGING_BUCKETS = [
  { label: '0–30 días', max: 30 },
  { label: '31–60 días', max: 60 },
  { label: '61–90 días', max: 90 },
  { label: 'Más de 90', max: Infinity }
];

// Pending balance grouped by how long ago the loan was made.
export function agingBuckets(deudas: Debt[], today: Date = new Date()) {
  const out = AGING_BUCKETS.map(b => ({ label: b.label, saldo: 0, count: 0 }));
  deudas.filter(d => d.estado === 'pendiente' && d.saldo > 0).forEach(d => {
    const age = ageInDays(d.fecha, today);
    const i = AGING_BUCKETS.findIndex(b => age <= b.max);
    out[i].saldo = addMoney(out[i].saldo, d.saldo);
    out[i].count += 1;
  });
  return out;
}

export function pendingByTag(deudas: Debt[]) {
  const map = new Map<string, { tag: string; saldo: number; count: number }>();
  deudas.filter(d => d.estado === 'pendiente' && d.saldo > 0).forEach(d => {
    const tag = normalizeTag(d.tipo) || 'sin etiqueta';
    const row = map.get(tag) || { tag, saldo: 0, count: 0 };
    row.saldo = addMoney(row.saldo, d.saldo);
    row.count += 1;
    map.set(tag, row);
  });
  return [...map.values()].sort((a, b) => b.saldo - a.saldo);
}

export function topDebtors(deudas: Debt[], n = 5) {
  const map = new Map<string, { name: string; saldo: number; monto: number; count: number; debtIds: string[] }>();
  deudas.filter(d => d.estado === 'pendiente' && d.saldo > 0).forEach(d => {
    const key = d.contacto.trim().toLowerCase();
    const row = map.get(key) || { name: d.contacto.trim(), saldo: 0, monto: 0, count: 0, debtIds: [] };
    row.saldo = addMoney(row.saldo, d.saldo);
    row.monto = addMoney(row.monto, d.monto);
    row.count += 1;
    row.debtIds.push(d.id);
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => b.saldo - a.saldo).slice(0, n);
}

export function summarize(deudas: Debt[], pagos: Payment[], today: Date = new Date()) {
  const pending = deudas.filter(d => d.estado === 'pendiente' && d.saldo > 0);
  const thisMonth = monthKey(today);
  const sum = (list: Debt[], f: (d: Debt) => number) => fromCents(list.reduce((s, d) => s + toCents(f(d)), 0));
  const overdue = pending.filter(d => getDueStatus(d, today).kind === 'vencido');
  const dueThisMonth = pending.filter(d => d.mesPago === thisMonth);
  const prestado = sum(deudas, d => d.monto);
  const porCobrar = sum(pending, d => d.saldo);
  return {
    porCobrar,
    activos: pending.length,
    personas: new Set(pending.map(d => d.contacto.trim().toLowerCase())).size,
    prestado,
    recuperado: fromCents(toCents(prestado) - toCents(sum(deudas, d => d.saldo))),
    vencido: sum(overdue, d => d.saldo),
    vencidoIds: overdue.map(d => d.id),
    venceMes: sum(dueThisMonth, d => d.saldo),
    venceMesIds: dueThisMonth.map(d => d.id),
    cobradoMes: fromCents(pagos.filter(p => p.fecha.slice(0, 7) === thisMonth).reduce((s, p) => s + toCents(p.monto), 0))
  };
}
