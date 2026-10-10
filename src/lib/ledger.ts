import { Debt, Payment } from '../types';
import { addMoney, roundMoney, subMoney } from './money';

export interface LedgerData {
  deudas: Debt[];
  pagos: Payment[];
  clientLimits: Record<string, number>;
  // People who use the app (accounts). Empty = derive from the data.
  usuarios: string[];
  // Client list ("Clientes" sheet). New names are added automatically.
  clientes: string[];
  // Phone of each client (for WhatsApp), keyed by the name in the list.
  telefonos: Record<string, string>;
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
  | { action: 'renameUser'; from: string; to: string }
  | { action: 'setClient'; nombre: string; telefono: string }
  | { action: 'renameClient'; from: string; to: string }
  | { action: 'deleteClient'; nombre: string };

// What the change log records with every operation.
export interface OpMeta {
  by?: string; // who made the change
  desc?: string; // human readable description
}

export type QueuedOp = LedgerOp & OpMeta & { opId: string; queuedAt: number };

// The Apps Script version each newer operation needs.
const MIN_API: Partial<Record<LedgerOp['action'], number>> = {
  updateDebt: 7, setUsers: 7, renameUser: 7,
  setClient: 9, renameClient: 9, deleteClient: 9
};
export const minApiFor = (action: LedgerOp['action']) => MIN_API[action] ?? 0;

// Version of apps-script/Code.gs bundled with this app (checked by a test).
export const LATEST_API = 9;

export const EMPTY_LEDGER: LedgerData = { deudas: [], pagos: [], clientLimits: {}, usuarios: [], clientes: [], telefonos: {} };

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Drops every key matching a name (any casing) from a name-keyed record.
const without = <T,>(rec: Record<string, T>, name: string): Record<string, T> =>
  Object.fromEntries(Object.entries(rec).filter(([k]) => !sameName(k, name)));
const lookup = <T,>(rec: Record<string, T>, name: string): T | undefined =>
  Object.entries(rec).find(([k]) => sameName(k, name))?.[1];

// Adds a client name to the list unless it is already there (any casing).
export function withClient(clientes: string[], name: string): string[] {
  const n = name.trim();
  return !n || clientes.some(c => sameName(c, n)) ? clientes : [...clientes, n];
}

const paidFor = (pagos: Payment[], debtId: string) =>
  pagos.filter(p => p.deudaId === debtId).reduce((sum, p) => addMoney(sum, p.monto), 0);

// Aplica una operación sobre los datos. Es la misma regla que sigue el
// Apps Script, y es idempotente: aplicar dos veces la misma operación no
// duplica registros ni descuenta un abono dos veces.
export function applyOp(data: LedgerData, op: LedgerOp): LedgerData {
  switch (op.action) {
    case 'addDebt': {
      if (data.deudas.some(d => d.id === op.debt.id)) return data;
      return { ...data, deudas: [op.debt, ...data.deudas], clientes: withClient(data.clientes, op.debt.contacto) };
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
      return {
        ...data,
        deudas: data.deudas.map(d => (d.id === op.id ? updated : d)),
        clientes: changes.contacto ? withClient(data.clientes, changes.contacto) : data.clientes
      };
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

    case 'setClient': {
      const nombre = op.nombre.trim();
      if (!nombre) return data;
      const clientes = withClient(data.clientes, nombre);
      const key = clientes.find(c => sameName(c, nombre))!;
      const tel = op.telefono.trim();
      const telefonos = without(data.telefonos, nombre);
      if (tel) telefonos[key] = tel;
      return { ...data, clientes, telefonos };
    }

    case 'renameClient': {
      // Renames a client everywhere; when the new name already exists both
      // become one: its loans (and their payments) move to the new name, and
      // the new name keeps its own limit and phone, or takes the old ones.
      const from = op.from.trim();
      const to = op.to.trim();
      if (!from || !to || from === to) return data;
      const limit = lookup(data.clientLimits, to) ?? lookup(data.clientLimits, from);
      const tel = lookup(data.telefonos, to) || lookup(data.telefonos, from);
      const clientLimits = without(without(data.clientLimits, from), to);
      if (limit) clientLimits[to] = limit;
      const telefonos = without(without(data.telefonos, from), to);
      if (tel) telefonos[to] = tel;
      const kept = data.clientes.filter(c => !sameName(c, from) && !sameName(c, to));
      return {
        ...data,
        deudas: data.deudas.map(d => (sameName(d.contacto, from) ? { ...d, contacto: to } : d)),
        clientes: [...kept, to],
        clientLimits,
        telefonos
      };
    }

    case 'deleteClient': {
      return {
        ...data,
        clientes: data.clientes.filter(c => !sameName(c, op.nombre)),
        clientLimits: without(data.clientLimits, op.nombre),
        telefonos: without(data.telefonos, op.nombre)
      };
    }
  }
}

export const phoneOf = (data: LedgerData, name: string) => lookup(data.telefonos, name) ?? '';
export const limitOf = (data: LedgerData, name: string) => lookup(data.clientLimits, name) ?? 0;

// The accounts to show: the configured list, or (until one is configured)
// the original two plus anyone else who appears in the data.
export function accountsOf(data: LedgerData): string[] {
  if (data.usuarios.length) return data.usuarios;
  const list = ['Nina', 'Nando'];
  data.deudas.forEach(d => { if (d.cuenta && !list.includes(d.cuenta)) list.push(d.cuenta); });
  return list;
}

// Clients for the picker: the saved list plus anyone already in a loan.
export function clientsOf(data: LedgerData): string[] {
  let list = data.clientes;
  data.deudas.forEach(d => { list = withClient(list, d.contacto); });
  return [...list].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
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
