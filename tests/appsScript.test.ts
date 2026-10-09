// Runs apps-script/Code.gs against an in-memory fake of the Google services it
// uses, so changes to the script are tested before anyone pastes it into Sheets.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const SOURCE = readFileSync(resolve(__dirname, '../apps-script/Code.gs'), 'utf8')
  .replace('"__DEUDAFLOW_TOKEN__"', '"test-token"');

class FakeSheet {
  rows: any[][] = [];
  constructor(private name: string) {}
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  // Like Sheets, a leading apostrophe forces text and is not part of the value.
  appendRow(row: any[]) { this.rows.push(row.map(v => (typeof v === 'string' ? v.replace(/^'/, '') : v))); }
  deleteRow(n: number) { this.rows.splice(n - 1, 1); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(row: number, col: number, numRows = 1, numCols = 1) {
    const sheet = this;
    const cells = () => {
      const out: { r: number; c: number }[] = [];
      for (let r = 0; r < numRows; r++) for (let c = 0; c < numCols; c++) out.push({ r: row + r, c: col + c });
      return out;
    };
    const get = (r: number, c: number) => sheet.rows[r - 1]?.[c - 1] ?? '';
    const set = (r: number, c: number, v: any) => {
      while (sheet.rows.length < r) sheet.rows.push([]);
      const target = sheet.rows[r - 1];
      while (target.length < c) target.push('');
      target[c - 1] = v;
    };
    return {
      getValues: () => Array.from({ length: numRows }, (_, r) => Array.from({ length: numCols }, (_, c) => get(row + r, col + c))),
      getValue: () => get(row, col),
      setValue: (v: any) => set(row, col, v),
      setValues: (vals: any[][]) => vals.forEach((rv, r) => rv.forEach((v, c) => set(row + r, col + c, v))),
      createTextFinder: (text: string) => {
        let opts = { entire: false };
        const matches = () => cells().filter(({ r, c }) => {
          const v = String(get(r, c));
          return opts.entire ? v === text : v.includes(text);
        }).map(({ r }) => ({ getRow: () => r }));
        const finder = {
          matchEntireCell: (b: boolean) => { opts.entire = b; return finder; },
          matchCase: () => finder,
          findNext: () => matches()[0] ?? null,
          findAll: () => matches()
        };
        return finder;
      }
    };
  }
}

function makeEnv() {
  const sheets = new Map<string, FakeSheet>();
  const props = new Map<string, string>();
  const cache = new Map<string, string>();
  const ss = {
    getSheetByName: (n: string) => sheets.get(n) ?? null,
    insertSheet: (n: string) => { const s = new FakeSheet(n); sheets.set(n, s); return s; },
    getSpreadsheetTimeZone: () => 'America/Caracas'
  };
  const context: any = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => props.set(k, v) }) },
    CacheService: { getScriptCache: () => ({
      get: (k: string) => cache.get(k) ?? null,
      put: (k: string, v: string) => cache.set(k, v),
      putAll: (m: Record<string, string>) => Object.entries(m).forEach(([k, v]) => cache.set(k, v)),
      getAll: (ks: string[]) => Object.fromEntries(ks.filter(k => cache.has(k)).map(k => [k, cache.get(k)]))
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
    Utilities: { formatDate: (d: Date, _tz: string, fmt: string) => (fmt === 'yyyy-MM' ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10)) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ promedio: 36.5 }) }) },
    Date
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context);

  const get = (params: Record<string, string> = {}) =>
    JSON.parse(context.doGet({ parameter: { token: 'test-token', ...params } }).text);
  const post = (body: any) =>
    JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ token: 'test-token', ...body }) } }).text);
  const batch = (...ops: any[]) => post({ action: 'batch', ops: ops.map((op, i) => ({ opId: `op-${i}`, ...op })) });
  return { get, post, batch, sheets, context };
}

const debt = { id: 'd-1', cuenta: 'Nina', contacto: 'Juan', tipo: 'favor', descripcion: 'x', fecha: '2026-05-10', mesPago: '2026-06', tasaCambio: 1, monto: 100, saldo: 100, estado: 'pendiente', creadoPor: 'Nina' };
const payment = { id: 'p-1', fecha: '2026-05-12', deudaId: 'd-1', monto: 30, nota: '', registradoPor: 'Nina' };

describe('Apps Script v6', () => {
  let env: ReturnType<typeof makeEnv>;
  beforeEach(() => { env = makeEnv(); });

  it('rejects requests without the right token', () => {
    expect(JSON.parse(env.context.doGet({ parameter: {} }).text)).toEqual({ ok: false, error: 'unauthorized', keyHint: 'oken' });
    expect(JSON.parse(env.context.doGet({ parameter: { token: 'nope' } }).text).error).toBe('unauthorized');
    const res = JSON.parse(env.context.doPost({ postData: { contents: JSON.stringify({ action: 'deleteDebt', id: 'd-1' }) } }).text);
    expect(res.error).toBe('unauthorized');
  });

  it('reports a script without a key, and accepts a key with stray spaces', () => {
    const ctx: any = { ...env.context };
    vm.createContext(ctx);
    vm.runInContext(SOURCE.replace('"test-token"', '"__DEUDAFLOW_TOKEN__"'), ctx);
    expect(JSON.parse(ctx.doGet({ parameter: { token: 'x' } }).text)).toEqual({ ok: false, error: 'no-key' });
    expect(JSON.parse(env.context.doGet({ parameter: { token: ' test-token ' } }).text).ok).toBe(true);
  });

  it('creates the sheets and returns an empty payload with a version', () => {
    const res = env.get();
    expect(res).toMatchObject({ ok: true, deudas: [], pagos: [], clientLimits: {} });
    expect(res.version).toBeTruthy();
    expect([...env.sheets.keys()].sort()).toEqual(['Deudas', 'Limites', 'Pagos']);
  });

  it('applies a batch and is idempotent on retry', () => {
    const first = env.batch({ action: 'addDebt', debt }, { action: 'addPayment', payment });
    expect(first.results.every((r: any) => r.ok)).toBe(true);
    // Same ops again (e.g. the response was lost and the app retried).
    env.batch({ action: 'addDebt', debt }, { action: 'addPayment', payment });

    const data = env.get();
    expect(data.deudas).toHaveLength(1);
    expect(data.pagos).toHaveLength(1);
    expect(data.deudas[0]).toMatchObject({ saldo: 70, estado: 'pendiente', mesPago: '2026-06' });
  });

  it('answers notModified when the version has not changed, and changes after writes', () => {
    const { version } = env.get();
    expect(env.get({ v: version })).toMatchObject({ ok: true, notModified: true });
    const write = env.batch({ action: 'addDebt', debt });
    expect(write.versionBefore).toBe(version);
    expect(write.version).not.toBe(version);
    expect(env.get({ v: version }).deudas).toHaveLength(1);
  });

  it('settles, then restores the balance when a payment is deleted', () => {
    env.batch({ action: 'addDebt', debt }, { action: 'addPayment', payment: { ...payment, monto: 100 } });
    expect(env.get().deudas[0]).toMatchObject({ saldo: 0, estado: 'saldado' });
    env.batch({ action: 'deletePayment', id: 'p-1' });
    const data = env.get();
    expect(data.deudas[0]).toMatchObject({ saldo: 100, estado: 'pendiente' });
    expect(data.pagos).toHaveLength(0);
  });

  it('deletes a debt together with its payments', () => {
    env.batch(
      { action: 'addDebt', debt },
      { action: 'addDebt', debt: { ...debt, id: 'd-2' } },
      { action: 'addPayment', payment },
      { action: 'addPayment', payment: { ...payment, id: 'p-2', deudaId: 'd-2' } },
      { action: 'deleteDebt', id: 'd-1' }
    );
    const data = env.get();
    expect(data.deudas.map((d: any) => d.id)).toEqual(['d-2']);
    expect(data.pagos.map((p: any) => p.id)).toEqual(['p-2']);
  });

  it('reports a failed op without dropping the others', () => {
    const res = env.batch(
      { action: 'addPayment', payment: { ...payment, deudaId: 'missing' } },
      { action: 'addDebt', debt }
    );
    expect(res.results[0].ok).toBe(false);
    expect(res.results[1].ok).toBe(true);
  });

  it('sets, updates and removes client limits', () => {
    env.batch({ action: 'setClientLimit', contacto: 'Juan', limite: 200 });
    env.batch({ action: 'setClientLimit', contacto: 'juan', limite: 300 });
    expect(env.get().clientLimits).toEqual({ Juan: 300 });
    env.batch({ action: 'setClientLimit', contacto: 'Juan', limite: 0 });
    expect(env.get().clientLimits).toEqual({});
  });

  it('keeps working with columns in a different order (sheets from older versions)', () => {
    env.get(); // creates sheets
    const deudas = env.sheets.get('Deudas')!;
    deudas.rows = [['monto', 'id', 'saldo', 'estado', 'contacto', 'cuenta', 'tipo', 'descripcion', 'fecha', 'creadoPor', 'mesPago', 'tasaCambio']];
    env.batch({ action: 'addDebt', debt }, { action: 'addPayment', payment });
    expect(env.get().deudas[0]).toMatchObject({ id: 'd-1', monto: 100, saldo: 70 });
  });

  it('formats Date cells as plain dates', () => {
    env.get();
    env.sheets.get('Pagos')!.rows.push(['p-9', new Date('2026-05-12T00:00:00Z'), 'd-1', 5, '', 'Nina']);
    env.batch({ action: 'addDebt', debt }); // bump version
    expect(env.get().pagos[0].fecha).toBe('2026-05-12');
  });

  it('returns the BCV rate', () => {
    expect(env.get({ action: 'bcv' })).toMatchObject({ ok: true, rate: 36.5 });
  });
});
