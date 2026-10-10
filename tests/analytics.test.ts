import { describe, expect, it } from 'vitest';
import { agingBuckets, byPaymentMonth, debtorsForMonth, lastMonths, monthsAround, outstandingByMonth, pendingByTag, summarize, topDebtors } from '../src/lib/analytics';
import { Debt, Payment } from '../src/types';

const today = new Date(2026, 9, 9);
const debt = (o: Partial<Debt>): Debt => ({ id: 'd', cuenta: 'Nina', contacto: 'Ana', tipo: 'favor', descripcion: '', fecha: '2026-08-01', mesPago: '2026-09', tasaCambio: 1, monto: 100, saldo: 100, estado: 'pendiente', creadoPor: 'Nina', ...o });
const pay = (o: Partial<Payment>): Payment => ({ id: 'p', fecha: '2026-09-15', deudaId: 'd', monto: 40, nota: '', registradoPor: 'Nina', ...o });

const deudas = [
  debt({ id: 'a', contacto: 'Ana', saldo: 60 }),
  debt({ id: 'b', contacto: 'Beto', fecha: '2026-10-02', mesPago: '2026-10', monto: 50, saldo: 50, tipo: 'negocio' }),
  debt({ id: 'c', contacto: 'ana ', fecha: '2026-06-01', monto: 20, saldo: 0, estado: 'saldado' })
];
const pagos = [pay({ id: 'p1', deudaId: 'a', monto: 40 }), pay({ id: 'p2', deudaId: 'c', fecha: '2026-07-01', monto: 20 })];

describe('analytics', () => {
  it('lists months oldest first', () => {
    expect(lastMonths(3, today)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
  it('computes month-end outstanding balance', () => {
    expect(outstandingByMonth(deudas, pagos, ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']).map(r => r.saldo))
      .toEqual([20, 0, 100, 60, 110]);
  });
  it('buckets pending balance by age', () => {
    const b = agingBuckets(deudas, today);
    expect(b[0]).toMatchObject({ saldo: 50, count: 1 }); // 7 days
    expect(b[2]).toMatchObject({ saldo: 60, count: 1 }); // 69 days
  });
  it('groups by tag and debtor', () => {
    expect(pendingByTag(deudas).map(r => r.tag)).toEqual(['favor', 'negocio']);
    expect(topDebtors(deudas)[0]).toMatchObject({ name: 'Ana', saldo: 60, count: 1 });
  });
  it('summarizes', () => {
    expect(summarize(deudas, pagos, today)).toMatchObject({
      porCobrar: 110, activos: 2, personas: 2, prestado: 170, recuperado: 60, vencido: 60, venceMes: 50, cobradoMes: 0
    });
  });

  it('groups by payment month: collected never exceeds what was due', () => {
    expect(monthsAround(today, 1, 1)).toEqual(['2026-09', '2026-10', '2026-11']);
    const rows = byPaymentMonth(deudas, ['2026-09', '2026-10']);
    expect(rows[0]).toMatchObject({ total: 120, cobrado: 60, pendiente: 60, prestamos: 2 });
    expect(rows[1]).toMatchObject({ total: 50, cobrado: 0, pendiente: 50 });
  });
  it('lists who has to pay in a month', () => {
    const rows = debtorsForMonth(deudas, '2026-09', today);
    expect(rows).toHaveLength(1); // "Ana" and "ana " are the same person
    expect(rows[0]).toMatchObject({ name: 'Ana', total: 120, cobrado: 60, pendiente: 60, estado: 'vencido' });
    expect(debtorsForMonth(deudas, '2026-10', today)[0]).toMatchObject({ name: 'Beto', estado: 'pendiente' });
  });
});
