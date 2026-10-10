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
  deleteRows(n: number, count: number) { this.rows.splice(n - 1, count); }
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
      // Like Sheets, a leading apostrophe forces text and is not part of the value.
      setValue: (v: any) => set(row, col, typeof v === 'string' ? v.replace(/^'/, '') : v),
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
          findAll: () => matches(),
          replaceAllWith: (to: string) => {
            const hits = cells().filter(({ r, c }) => (opts.entire ? String(get(r, c)) === text : String(get(r, c)).includes(text)));
            hits.forEach(({ r, c }) => set(r, c, opts.entire ? to : String(get(r, c)).split(text).join(to)));
            return hits.length;
          }
        };
        return finder;
      }
    };
  }
}

function makeEnv() {
  const sheets = new Map<string, FakeSheet>();
  const props = new Map<string, string>();
  const triggers: any[] = [];
  const mails: any[] = [];
  const folders: any[] = [];
  const cache = new Map<string, string>();
  const ss = {
    getSheetByName: (n: string) => sheets.get(n) ?? null,
    insertSheet: (n: string) => { const s = new FakeSheet(n); sheets.set(n, s); return s; },
    getSpreadsheetTimeZone: () => 'America/Caracas',
    getId: () => 'sheet-1'
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
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger: (t: any) => { triggers.splice(triggers.indexOf(t), 1); },
      WeekDay: { SUNDAY: 'SUNDAY' },
      newTrigger: (fn: string) => {
        const b: any = {
          timeBased: () => b, everyDays: () => b, onMonthDay: (d: number) => { b.monthDay = d; return b; }, onWeekDay: (d: string) => { b.weekDay = d; return b; },
          atHour: (h: number) => { b.hour = h; return b; },
          create: () => { triggers.push({ getHandlerFunction: () => fn, hour: b.hour, monthDay: b.monthDay, weekDay: b.weekDay }); }
        };
        return b;
      }
    },
    MailApp: { sendEmail: (m: any) => mails.push(m) },
    DriveApp: (() => {
      let n = 0;
      const folder = { files: [] as any[], getId: () => 'folder-1', getUrl: () => 'https://drive/folder-1',
        getFiles() { const list = this.files.filter((f: any) => !f.trashed); let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; } };
      return {
        folders,
        getFolderById: (id: string) => { if (!folders.length || id !== 'folder-1') throw new Error('no'); return folders[0]; },
        getFoldersByName: () => { let i = 0; return { hasNext: () => i < folders.length, next: () => folders[i++] }; },
        createFolder: () => { folders.push(folder); return folder; },
        getFileById: () => ({
          makeCopy: (name: string, f: any) => {
            const file = { name, created: ++n, trashed: false, getUrl: () => `https://drive/${n}`, getDateCreated: () => new Date(2026, 0, 1, 0, 0, file.created), setTrashed(v: boolean) { file.trashed = v; } };
            f.files.push(file);
            return file;
          }
        })
      };
    })(),
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
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
  return { get, post, batch, sheets, context, triggers, mails, folders };
}

const debt = { id: 'd-1', cuenta: 'Nina', contacto: 'Juan', tipo: 'favor', descripcion: 'x', fecha: '2026-05-10', mesPago: '2026-06', tasaCambio: 1, monto: 100, saldo: 100, estado: 'pendiente', creadoPor: 'Nina' };
const payment = { id: 'p-1', fecha: '2026-05-12', deudaId: 'd-1', monto: 30, nota: '', registradoPor: 'Nina' };

describe('Apps Script v9', () => {
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
    expect([...env.sheets.keys()].sort()).toEqual(['Clientes', 'Deudas', 'Historial', 'Limites', 'Pagos', 'Usuarios']);
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

  it('reports apiVersion 9 and the configured users', () => {
    env.batch({ action: 'setUsers', usuarios: ['Nina', 'Nando', 'Ana', 'Nina'] });
    const res = env.get();
    expect(res.apiVersion).toBe(9);
    expect(res.usuarios).toEqual(['Nina', 'Nando', 'Ana']);
    expect(env.get({ v: res.version })).toMatchObject({ notModified: true, apiVersion: 9 });
  });

  it('edits a loan and recomputes the balance from its payments', () => {
    env.batch({ action: 'addDebt', debt }, { action: 'addPayment', payment });
    env.batch({ action: 'updateDebt', id: 'd-1', changes: { monto: 50, contacto: ' Juan P ', mesPago: '2026-08' } });
    expect(env.get().deudas[0]).toMatchObject({ monto: 50, saldo: 20, estado: 'pendiente', contacto: 'Juan P', mesPago: '2026-08' });
    env.batch({ action: 'updateDebt', id: 'd-1', changes: { monto: 30 } });
    expect(env.get().deudas[0]).toMatchObject({ saldo: 0, estado: 'saldado' });
  });

  it('renames a user everywhere', () => {
    env.batch({ action: 'setUsers', usuarios: ['Nina', 'Nando'] }, { action: 'addDebt', debt }, { action: 'addPayment', payment });
    env.batch({ action: 'renameUser', from: 'Nina', to: 'Carolina' });
    const data = env.get();
    expect(data.usuarios).toEqual(['Carolina', 'Nando']);
    expect(data.deudas[0]).toMatchObject({ cuenta: 'Carolina', creadoPor: 'Carolina' });
    expect(data.pagos[0].registradoPor).toBe('Carolina');
  });

  it('stores payments received in bolívares', () => {
    env.batch({ action: 'addDebt', debt }, { action: 'addPayment', payment: { ...payment, monto: 10, moneda: 'VES', tasaCambio: 36.5, montoBs: 365 } });
    expect(env.get().pagos[0]).toMatchObject({ monto: 10, moneda: 'VES', tasaCambio: 36.5, montoBs: 365 });
  });

  it('logs every applied change, newest first, and skips retried duplicates', () => {
    env.batch({ action: 'addDebt', debt, by: 'Nina', desc: 'Préstamo a Juan por $100', queuedAt: Date.UTC(2026, 9, 1) });
    env.batch({ action: 'addDebt', debt, by: 'Nina', desc: 'duplicado' });
    env.batch({ action: 'addPayment', payment, by: 'Nando', desc: 'Abono de $30 de Juan' });
    const res = env.get({ action: 'log', limit: '10' });
    expect(res.log.map((e: any) => e.detalle)).toEqual(['Abono de $30 de Juan', 'Préstamo a Juan por $100']);
    expect(res.log[1]).toMatchObject({ usuario: 'Nina', accion: 'addDebt', refId: 'd-1', fecha: '2026-10-01T00:00:00.000Z' });
  });

  it('sets up, tests and disables e-mail reminders', () => {
    env.batch({ action: 'addDebt', debt: { ...debt, mesPago: '2020-01' } });
    const on = env.post({ action: 'setupReminders', emails: ['a@b.co', 'no-es-correo'], hour: 7 });
    expect(on).toMatchObject({ active: true, emails: ['a@b.co'], hour: 7 });
    expect(env.triggers).toHaveLength(1);
    env.post({ action: 'setupReminders', emails: [], hour: 9 });
    expect(env.triggers).toHaveLength(1); // replaced, not duplicated
    expect(env.post({ action: 'getReminders' }).emails).toEqual(['owner@example.com']);

    env.context.enviarRecordatorios();
    expect(env.mails).toHaveLength(1);
    expect(env.mails[0].subject).toContain('1 vencido');
    expect(env.mails[0].htmlBody).toContain('Juan');

    expect(env.post({ action: 'testReminder' }).sent).toBe(true);
    expect(env.post({ action: 'disableReminders' }).active).toBe(false);
    expect(env.triggers).toHaveLength(0);
  });

  it('does not e-mail when nothing is due (except a test)', () => {
    env.batch({ action: 'addDebt', debt: { ...debt, mesPago: '2099-01' } });
    env.context.enviarRecordatorios();
    expect(env.mails).toHaveLength(0);
  });

  it('keeps a client list: new loans add their client once', () => {
    env.batch({ action: 'addDebt', debt }, { action: 'addDebt', debt: { ...debt, id: 'd-2', contacto: ' juan ' } });
    expect(env.get().clientes).toEqual(['Juan']);
    env.batch({ action: 'updateDebt', id: 'd-2', changes: { contacto: 'Ana' } });
    expect(env.get().clientes).toEqual(['Juan', 'Ana']);
  });

  it('seeds the client list from existing loans when upgrading', () => {
    env.get(); // creates sheets
    env.sheets.delete('Clientes');
    env.sheets.get('Deudas')!.rows.push(['d-7', 'Nina', 'Zoe', 'favor', '', '2026-01-01', 10, 10, 'pendiente', 'Nina', '2026-02', 1]);
    env.sheets.get('Deudas')!.rows.push(['d-8', 'Nina', 'ana', 'favor', '', '2026-01-01', 10, 10, 'pendiente', 'Nina', '2026-02', 1]);
    env.sheets.get('Deudas')!.rows.push(['d-9', 'Nina', 'Ana', 'favor', '', '2026-01-01', 10, 10, 'pendiente', 'Nina', '2026-02', 1]);
    env.batch({ action: 'addDebt', debt: { ...debt, id: 'd-10', contacto: 'Zoe' } });
    expect(env.get({ fresh: '1' }).clientes).toEqual(['ana', 'Zoe']);
  });

  it('backs up the sheet to a Drive folder and keeps the last N copies', () => {
    const on = env.post({ action: 'setupBackup', frequency: 'weekly', keep: 2 });
    expect(on).toMatchObject({ active: true, frequency: 'weekly', keep: 2 });
    expect(env.triggers[0]).toMatchObject({ weekDay: 'SUNDAY' });
    for (let i = 0; i < 3; i++) env.context.respaldoAutomatico();
    const state = env.post({ action: 'backupNow' });
    expect(state.folderUrl).toBe('https://drive/folder-1');
    expect(state.lastUrl).toBe('https://drive/4');
    expect(env.folders[0].files.filter((f: any) => !f.trashed).map((f: any) => f.created)).toEqual([3, 4]);
    expect(env.post({ action: 'disableBackup' }).active).toBe(false);
  });

  it('sends a monthly summary of the previous month', () => {
    env.batch({ action: 'addDebt', debt: { ...debt, fecha: '2026-09-05', mesPago: '2026-09' } }, { action: 'addPayment', payment: { ...payment, fecha: '2026-09-20' } });
    const on = env.post({ action: 'setupReminders', emails: ['a@b.co'], hour: 7, daily: false, monthly: true });
    expect(on).toMatchObject({ active: false, monthly: true });
    expect(env.triggers[0]).toMatchObject({ monthDay: 1, hour: 7 });
    const res = env.post({ action: 'testMonthly' });
    expect(res.sent).toBe(true);
    const mail = env.mails[env.mails.length - 1];
    expect(mail.to).toBe('a@b.co');
    expect(mail.subject).toMatch(/^Preztame: resumen de /);
    expect(env.post({ action: 'disableReminders' })).toMatchObject({ active: false, monthly: false });
  });

  it('saves a client phone (keeping the leading zero) and clears it', () => {
    env.batch({ action: 'setClient', nombre: 'Pedro', telefono: '04141234567' });
    expect(env.get()).toMatchObject({ clientes: ['Pedro'], telefonos: { Pedro: '04141234567' } });
    env.batch({ action: 'setClient', nombre: 'pedro', telefono: '' });
    expect(env.get()).toMatchObject({ clientes: ['Pedro'], telefonos: {} });
  });

  it('renames a client in loans, limits and the client list', () => {
    env.batch({ action: 'addDebt', debt }, { action: 'setClientLimit', contacto: 'Juan', limite: 200 }, { action: 'setClient', nombre: 'Juan', telefono: '0412' });
    env.batch({ action: 'renameClient', from: 'juan', to: 'Juan Pérez' });
    const res = env.get();
    expect(res.deudas[0].contacto).toBe('Juan Pérez');
    expect(res.clientLimits).toEqual({ 'Juan Pérez': 200 });
    expect(res.clientes).toEqual(['Juan Pérez']);
    expect(res.telefonos).toEqual({ 'Juan Pérez': '0412' });
  });

  it('unifies two clients: loans and payments move, the target keeps its limit, takes the missing phone', () => {
    env.batch(
      { action: 'addDebt', debt },
      { action: 'addPayment', payment },
      { action: 'addDebt', debt: { ...debt, id: 'd-2', contacto: 'Juan P' } },
      { action: 'addDebt', debt: { ...debt, id: 'd-3', contacto: 'Ana' } },
      { action: 'setClientLimit', contacto: 'Juan', limite: 50 },
      { action: 'setClientLimit', contacto: 'Juan P', limite: 300 },
      { action: 'setClient', nombre: 'Juan', telefono: '0414' }
    );
    env.batch({ action: 'renameClient', from: 'Juan', to: 'Juan P', desc: 'Unificó a Juan en Juan P' });
    const res = env.get();
    expect(res.deudas.map((d: any) => d.contacto).sort()).toEqual(['Ana', 'Juan P', 'Juan P']);
    expect(res.pagos[0].deudaId).toBe('d-1');
    expect(res.clientLimits).toEqual({ 'Juan P': 300 });
    expect(res.clientes.sort()).toEqual(['Ana', 'Juan P']);
    expect(res.telefonos).toEqual({ 'Juan P': '0414' });
    expect(env.get({ action: 'log' }).log[0]).toMatchObject({ accion: 'renameClient', detalle: 'Unificó a Juan en Juan P' });
  });

  it('deletes a client from the list and its limit', () => {
    env.batch({ action: 'setClient', nombre: 'Zoe', telefono: '' }, { action: 'setClientLimit', contacto: 'Zoe', limite: 10 });
    env.batch({ action: 'deleteClient', nombre: 'zoe' });
    expect(env.get()).toMatchObject({ clientes: [], clientLimits: {} });
  });
});
