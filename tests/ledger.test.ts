import { describe, expect, it } from 'vitest';
import { accountsOf, applyOp, applyOps, LedgerData } from '../src/lib/ledger';
import { Debt, Payment } from '../src/types';

const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd-1', cuenta: 'Nina', contacto: 'Juan', tipo: 'favor', descripcion: '', fecha: '2026-05-10',
  mesPago: '2026-06', tasaCambio: 1, monto: 100, saldo: 100, estado: 'pendiente', creadoPor: 'Nina', ...over
});
const pay = (over: Partial<Payment> = {}): Payment => ({
  id: 'p-1', fecha: '2026-05-12', deudaId: 'd-1', monto: 30, nota: '', registradoPor: 'Nina', ...over
});
const base: LedgerData = { deudas: [debt()], pagos: [], clientLimits: {}, usuarios: [] };

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

  it('edits a loan: new amount minus what was paid', () => {
    const paid = applyOp(base, { action: 'addPayment', payment: pay({ monto: 30 }) });
    const edited = applyOp(paid, { action: 'updateDebt', id: 'd-1', changes: { monto: 50, contacto: ' Juan P ' } });
    expect(edited.deudas[0]).toMatchObject({ monto: 50, saldo: 20, estado: 'pendiente', contacto: 'Juan P' });
    expect(applyOp(paid, { action: 'updateDebt', id: 'd-1', changes: { monto: 25 } }).deudas[0]).toMatchObject({ saldo: 0, estado: 'saldado' });
    expect(applyOp(paid, { action: 'updateDebt', id: 'd-1', changes: { descripcion: 'x' } }).deudas[0].saldo).toBe(70);
  });

  it('sets and renames users', () => {
    const withUsers = applyOp(base, { action: 'setUsers', usuarios: [' Nina ', 'Nando', 'Nina', ''] });
    expect(withUsers.usuarios).toEqual(['Nina', 'Nando']);
    const renamed = applyOp(applyOp(withUsers, { action: 'addPayment', payment: pay() }), { action: 'renameUser', from: 'Nina', to: 'Carolina' });
    expect(renamed.usuarios).toEqual(['Carolina', 'Nando']);
    expect(renamed.deudas[0]).toMatchObject({ cuenta: 'Carolina', creadoPor: 'Carolina' });
    expect(renamed.pagos[0].registradoPor).toBe('Carolina');
  });

  it('derives accounts from the data when none are configured', () => {
    expect(accountsOf(base)).toEqual(['Nina', 'Nando']);
    expect(accountsOf({ ...base, deudas: [{ ...base.deudas[0], cuenta: 'Ana' }] })).toEqual(['Nina', 'Nando', 'Ana']);
    expect(accountsOf({ ...base, usuarios: ['Ana'] })).toEqual(['Ana']);
  });
});
