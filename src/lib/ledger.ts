import { Debt, Payment } from '../types';
import { addMoney, roundMoney, subMoney } from './money';

export interface LedgerData {
  deudas: Debt[];
  pagos: Payment[];
  clientLimits: Record<string, number>;
}

export type LedgerOp =
  | { action: 'addDebt'; debt: Debt }
  | { action: 'addPayment'; payment: Payment }
  | { action: 'deleteDebt'; id: string }
  | { action: 'deletePayment'; id: string }
  | { action: 'setClientLimit'; contacto: string; limite: number };

export type QueuedOp = LedgerOp & { opId: string; queuedAt: number };

export const EMPTY_LEDGER: LedgerData = { deudas: [], pagos: [], clientLimits: {} };

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
  }
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
