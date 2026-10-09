import { describe, expect, it } from 'vitest';
import { applyOp, applyOps, LedgerData } from '../src/lib/ledger';
import { Debt, Payment } from '../src/types';

const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd-1', cuenta: 'Nina', contacto: 'Juan', tipo: 'favor', descripcion: '', fecha: '2026-05-10',
  mesPago: '2026-06', tasaCambio: 1, monto: 100, saldo: 100, estado: 'pendiente', creadoPor: 'Nina', ...over
});
const pay = (over: Partial<Payment> = {}): Payment => ({
  id: 'p-1', fecha: '2026-05-12', deudaId: 'd-1', monto: 30, nota: '', registradoPor: 'Nina', ...over
});
const base: LedgerData = { deudas: [debt()], pagos: [], clientLimits: {} };

describe('applyOp', () => {
  it('adds a payment and reduces the balance', () => {
    const next = applyOp(base, { action: 'addPayment', payment: pay() });
    expect(next.deudas[0].saldo).toBe(70);
    expect(next.deudas[0].estado).toBe('pendiente');
    expect(next.pagos).toHaveLength(1);
  });

  it('is idempotent: the same payment twice only counts once', () => {
    const op = { action: 'addPayment' as const, payment: pay() };
    expect(applyOps(base, [op, op]).deudas[0].saldo).toBe(70);
  });

  it('settles the debt when paid in full', () => {
    const next = applyOp(base, { action: 'addPayment', payment: pay({ monto: 100 }) });
    expect(next.deudas[0]).toMatchObject({ saldo: 0, estado: 'saldado' });
  });

  it('keeps cents exact across many payments', () => {
    let data: LedgerData = { ...base, deudas: [debt({ monto: 1, saldo: 1 })] };
    for (let i = 0; i < 10; i++) data = applyOp(data, { action: 'addPayment', payment: pay({ id: `p-${i}`, monto: 0.1 }) });
    expect(data.deudas[0]).toMatchObject({ saldo: 0, estado: 'saldado' });
  });

  it('deleting a payment restores the balance', () => {
    const paid = applyOp(base, { action: 'addPayment', payment: pay({ monto: 100 }) });
    const undone = applyOp(paid, { action: 'deletePayment', id: 'p-1' });
    expect(undone.deudas[0]).toMatchObject({ saldo: 100, estado: 'pendiente' });
    expect(undone.pagos).toHaveLength(0);
  });

  it('deleting a debt removes its payments', () => {
    const paid = applyOp(base, { action: 'addPayment', payment: pay() });
    const next = applyOp(paid, { action: 'deleteDebt', id: 'd-1' });
    expect(next.deudas).toHaveLength(0);
    expect(next.pagos).toHaveLength(0);
  });

  it('ignores a duplicate debt id', () => {
    expect(applyOp(base, { action: 'addDebt', debt: debt() })).toBe(base);
  });

  it('sets and removes client limits case-insensitively', () => {
    const withLimit = applyOp(base, { action: 'setClientLimit', contacto: 'Juan', limite: 200 });
    expect(withLimit.clientLimits).toEqual({ Juan: 200 });
    const removed = applyOp(withLimit, { action: 'setClientLimit', contacto: 'juan', limite: 0 });
    expect(removed.clientLimits).toEqual({});
  });
});
