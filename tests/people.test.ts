import { describe, expect, it } from 'vitest';
import { punctualityOf, summarizePeople } from '../src/lib/people';
import { Debt, Payment } from '../src/types';

const today = new Date(2026, 9, 10);
const debt = (o: Partial<Debt>): Debt => ({ id: 'd', cuenta: 'Nina', contacto: 'Ana', tipo: 'favor', descripcion: '', fecha: '2026-05-01', mesPago: '2026-06', tasaCambio: 1, monto: 100, saldo: 0, estado: 'saldado', creadoPor: 'Nina', ...o });
const pay = (o: Partial<Payment>): Payment => ({ id: 'p', fecha: '2026-06-10', deudaId: 'd', monto: 100, nota: '', registradoPor: 'Nina', ...o });

describe('people', () => {
  it('rates punctuality', () => {
    const onTime = [debt({ id: 'a' }), debt({ id: 'b' })];
    expect(punctualityOf(onTime, [pay({ deudaId: 'a' }), pay({ deudaId: 'b' })], today)).toMatchObject({ punctuality: 'puntual', onTimeRate: 1 });

    const mixed = [debt({ id: 'a' }), debt({ id: 'b' }), debt({ id: 'c', estado: 'pendiente', saldo: 50, mesPago: '2026-09' })];
    const pagos = [pay({ deudaId: 'a' }), pay({ deudaId: 'b', fecha: '2026-07-10' })];
    expect(punctualityOf(mixed, pagos, today)).toMatchObject({ punctuality: 'atrasado', avgDaysLate: 10 });
    expect(punctualityOf([debt({ estado: 'pendiente', saldo: 10, mesPago: '2026-12' })], [], today).punctuality).toBe('sin-historial');
  });

  it('groups loans by person regardless of spelling and sorts by balance', () => {
    const list = summarizePeople([
      debt({ id: 'a', contacto: 'ana', fecha: '2026-01-01' }),
      debt({ id: 'b', contacto: 'Ana ', estado: 'pendiente', saldo: 40, mesPago: '2026-12', fecha: '2026-09-01' }),
      debt({ id: 'c', contacto: 'Beto', estado: 'pendiente', saldo: 90, mesPago: '2026-12' })
    ], [pay({ deudaId: 'a' }), pay({ id: 'p2', deudaId: 'b', monto: 60, fecha: '2026-09-20' })], today);
    expect(list.map(p => p.name)).toEqual(['Beto', 'Ana']);
    expect(list[1]).toMatchObject({ porCobrar: 40, prestado: 200, abonado: 160, activos: 1, ultimoMovimiento: '2026-09-20' });
  });
});
