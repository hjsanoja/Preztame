import { describe, expect, it } from 'vitest';
import { dueDigest } from '../src/lib/reminders';
import { Debt } from '../src/types';

const today = new Date(2026, 9, 29);
const debt = (o: Partial<Debt>): Debt => ({ id: 'd', cuenta: 'Nina', contacto: 'Ana', tipo: 'favor', descripcion: '', fecha: '2026-05-01', mesPago: '2026-10', tasaCambio: 1, monto: 100, saldo: 100, estado: 'pendiente', creadoPor: 'Nina', ...o });

describe('dueDigest', () => {
  it('summarizes overdue and soon-due loans', () => {
    const d = dueDigest([
      debt({ id: 'a', contacto: 'Ana', mesPago: '2026-09', saldo: 40 }),
      debt({ id: 'b', contacto: 'Beto', mesPago: '2026-10', saldo: 60 }), // due Oct 31 → in 2 days
      debt({ id: 'c', contacto: 'Caro', mesPago: '2026-12' }),
      debt({ id: 'd', contacto: 'Dani', mesPago: '2026-01', estado: 'saldado', saldo: 0 })
    ], today)!;
    expect(d.vencidos.map(x => x.id)).toEqual(['a']);
    expect(d.pronto.map(x => x.id)).toEqual(['b']);
    expect(d.title).toBe('Preztame: 1 cobro vencido ($40) · 1 vence pronto ($60)');
    expect(d.body).toBe('Por cobrar a Ana, Beto.');
  });
  it('returns null when nothing is due', () => {
    expect(dueDigest([debt({ mesPago: '2027-01' })], today)).toBeNull();
  });
});
