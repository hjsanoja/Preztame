import { Debt, Payment } from '../types';
import { addMoney, roundMoney, subMoney } from './money';

export interface LedgerData {
  deudas: Debt[];
  pagos: Payment[];
  clientLimits: Record<string, number>;
  // People who use the app (accounts). Empty = derive from the data.
  usuarios: string[];
}

export type DebtChanges = Partial<Pick<Debt, 'cuenta' | 'contacto' | 'tipo' | 'descripcion' | 'fecha' | 'mesPago' | 'tasaCambio' | 'monto'>>;

export type LedgerOp =
  | { action: 'addDebt'; debt: Debt }
  | { action: 'addPayment'; payment: Payment }
  | { action: 'deleteDebt'; id: string }
  | { action: 'deletePayment'; id: string }
  | { action: 'setClientLimit'; contacto: string; limite: number }
  | { action: 'updateDebt'; id: string; changes: DebtChanges }
  | { action: 'setUsers'; usuarios: string[] }
  | { action: 'renameUser'; from: string; to: string };

// What the change log records with every operation.
export interface OpMeta {
  by?: string; // who made the change
  desc?: string; // human readable description
}

export type QueuedOp = LedgerOp & OpMeta & { opId: string; queuedAt: number };

// Operations that need Apps Script v7.
export const V7_ACTIONS: LedgerOp['action'][] = ['updateDebt', 'setUsers', 'renameUser'];

export const EMPTY_LEDGER: LedgerData = { deudas: [], pagos: [], clientLimits: {}, usuarios: [] };

const paidFor = (pagos: Payment[], debtId: string) =>
  pagos.filter(p => p.deudaId === debtId).reduce((sum, p) => addMoney(sum, p.monto), 0);

// Aplica una operación sobre los datos. Es la misma regla que sigue el
// Apps Script, y es idempotente: aplicar dos veces la misma operación no
// duplica registros ni descuenta un abono dos veces.
export function applyOp(data: LedgerData, op: LedgerOp): LedgerData {
  switch (op.action) {
    case 'addDebt': {
      if (data.deudas.some(d => d.id === op.debt.id)) return data;
      return { ...data, deudas: [op.debt, ...data.deudas] };
    }

    case 'addPayment': {
      const { payment } = op;
      if (data.pagos.some(p => p.id === payment.id)) return data;
      if (!data.deudas.some(d => d.id === payment.deudaId)) return data;
      return {
        ...data,
        pagos: [payment, ...data.pagos],
        deudas: data.deudas.map(d => {
          if (d.id !== payment.deudaId) return d;
          const saldo = Math.max(0, subMoney(d.saldo, payment.monto));
          return { ...d, saldo, estado: saldo <= 0 ? 'saldado' : 'pendiente' };
        })
      };
    }

    case 'deleteDebt': {
      if (!data.deudas.some(d => d.id === op.id) && !data.pagos.some(p => p.deudaId === op.id)) return data;
      return {
        ...data,
        deudas: data.deudas.filter(d => d.id !== op.id),
        pagos: data.pagos.filter(p => p.deudaId !== op.id)
      };
    }

    case 'deletePayment': {
      const target = data.pagos.find(p => p.id === op.id);
      if (!target) return data;
      return {
        ...data,
        pagos: data.pagos.filter(p => p.id !== op.id),
        deudas: data.deudas.map(d => {
          if (d.id !== target.deudaId) return d;
          const saldo = Math.min(d.monto, addMoney(d.saldo, target.monto));
          return { ...d, saldo, estado: saldo > 0 ? 'pendiente' : 'saldado' };
        })
      };
    }

    case 'setClientLimit': {
      const name = op.contacto.trim();
      const limit = roundMoney(op.limite);
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(data.clientLimits)) {
        if (k.toLowerCase() !== name.toLowerCase()) next[k] = v;
      }
      if (limit > 0) next[name] = limit;
      return { ...data, clientLimits: next };
    }

    case 'updateDebt': {
      const target = data.deudas.find(d => d.id === op.id);
      if (!target) return data;
      const changes = { ...op.changes };
      if (changes.contacto !== undefined) changes.contacto = changes.contacto.trim();
      if (changes.monto !== undefined) changes.monto = roundMoney(changes.monto);
      const updated: Debt = { ...target, ...changes };
      if (changes.monto !== undefined) {
        // The balance follows the new amount minus what was already paid.
        updated.saldo = Math.max(0, subMoney(updated.monto, paidFor(data.pagos, op.id)));
        updated.estado = updated.saldo <= 0 ? 'saldado' : 'pendiente';
      }
      return { ...data, deudas: data.deudas.map(d => (d.id === op.id ? updated : d)) };
    }

    case 'setUsers': {
      const usuarios = [...new Set(op.usuarios.map(u => u.trim()).filter(Boolean))];
      return { ...data, usuarios };
    }

    case 'renameUser': {
      const from = op.from.trim();
      const to = op.to.trim();
      if (!from || !to || from === to) return data;
      const swap = (v: string) => (v === from ? to : v);
      return {
        ...data,
        usuarios: [...new Set(data.usuarios.map(swap))],
        deudas: data.deudas.map(d => (d.cuenta === from || d.creadoPor === from ? { ...d, cuenta: swap(d.cuenta), creadoPor: swap(d.creadoPor) } : d)),
        pagos: data.pagos.map(p => (p.registradoPor === from ? { ...p, registradoPor: to } : p))
      };
    }
  }
}

// The accounts to show: the configured list, or (until one is configured)
// the original two plus anyone else who appears in the data.
export function accountsOf(data: LedgerData): string[] {
  if (data.usuarios.length) return data.usuarios;
  const list = ['Nina', 'Nando'];
  data.deudas.forEach(d => { if (d.cuenta && !list.includes(d.cuenta)) list.push(d.cuenta); });
  return list;
}

export function applyOps(data: LedgerData, ops: LedgerOp[]): LedgerData {
  return ops.reduce(applyOp, data);
}

export function newId(prefix: 'd' | 'p' | 'op'): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}${rand}`;
}
