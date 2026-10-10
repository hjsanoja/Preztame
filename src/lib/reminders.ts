import { Debt } from '../types';
import { getDueStatus } from './dueStatus';
import { formatUsd } from './format';
import { addMoney } from './money';

export interface DueDigest {
  vencidos: Debt[];
  pronto: Debt[]; // due today or in the next 3 days
  title: string;
  body: string;
}

// What a reminder should say today, or null when nothing needs attention.
export function dueDigest(deudas: Debt[], today: Date = new Date()): DueDigest | null {
  const pending = deudas.filter(d => d.estado === 'pendiente' && d.saldo > 0);
  const withStatus = pending.map(d => ({ d, s: getDueStatus(d, today) }));
  const vencidos = withStatus.filter(x => x.s.kind === 'vencido').sort((a, b) => (a.s.days ?? 0) - (b.s.days ?? 0)).map(x => x.d);
  const pronto = withStatus.filter(x => x.s.days !== null && x.s.days >= 0 && x.s.days <= 3).sort((a, b) => (a.s.days ?? 0) - (b.s.days ?? 0)).map(x => x.d);
  if (!vencidos.length && !pronto.length) return null;

  const sum = (list: Debt[]) => formatUsd(list.reduce((s, d) => addMoney(s, d.saldo), 0));
  const parts: string[] = [];
  if (vencidos.length) parts.push(`${vencidos.length} cobro${vencidos.length === 1 ? '' : 's'} vencido${vencidos.length === 1 ? '' : 's'} (${sum(vencidos)})`);
  if (pronto.length) parts.push(`${pronto.length} vence${pronto.length === 1 ? '' : 'n'} pronto (${sum(pronto)})`);
  const names = [...new Set([...vencidos, ...pronto].map(d => d.contacto.trim()))];
  const who = names.slice(0, 3).join(', ') + (names.length > 3 ? ` y ${names.length - 3} más` : '');
  return { vencidos, pronto, title: `Preztame: ${parts.join(' · ')}`, body: `Por cobrar a ${who}.` };
}
