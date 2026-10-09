import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSnapshot, normalizeDebt, pushOps, SheetsError } from '../src/lib/sheetsApi';

const cfg = { url: 'https://script.google.com/macros/s/abc/exec', token: 'secret' };

function mockFetch(body: unknown) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('normalizeDebt', () => {
  it('parses numbers and keeps plain dates', () => {
    const d = normalizeDebt({ id: 5, monto: '120.5', saldo: '50', fecha: '2026-05-10', mesPago: "'2026-06", tasaCambio: '' });
    expect(d).toMatchObject({ id: '5', monto: 120.5, saldo: 50, fecha: '2026-05-10', mesPago: '2026-06', tasaCambio: 1, cuenta: 'Nina', estado: 'pendiente' });
  });

  it('converts ISO timestamps from old scripts to local dates', () => {
    const iso = new Date(2026, 4, 10).toISOString();
    expect(normalizeDebt({ id: 'x', fecha: iso, mesPago: iso }).fecha).toBe('2026-05-10');
    expect(normalizeDebt({ id: 'x', fecha: iso, mesPago: iso }).mesPago).toBe('2026-05');
  });
});

describe('fetchSnapshot', () => {
  it('sends the token and known version', async () => {
    const fn = mockFetch({ ok: true, notModified: true, version: '7' });
    const res = await fetchSnapshot(cfg, '7');
    expect(res).toEqual({ kind: 'notModified', version: '7' });
    const url = new URL(fn.mock.calls[0][0] as string);
    expect(url.searchParams.get('token')).toBe('secret');
    expect(url.searchParams.get('v')).toBe('7');
  });

  it('maps unauthorized responses', async () => {
    mockFetch({ ok: false, error: 'unauthorized' });
    await expect(fetchSnapshot(cfg, null)).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('requires url and token', async () => {
    await expect(fetchSnapshot({ url: '', token: '' }, null)).rejects.toBeInstanceOf(SheetsError);
  });
});

describe('pushOps', () => {
  it('treats a v5 script response (no results) as outdated so pending ops are kept', async () => {
    mockFetch({ status: 'success', deudas: [], pagos: [] });
    await expect(pushOps(cfg, [{ action: 'deleteDebt', id: 'd-1', opId: 'op-1', queuedAt: 0 }]))
      .rejects.toMatchObject({ code: 'outdated-script' });
  });

  it('sends a single batch request with the token', async () => {
    const fn = mockFetch({ ok: true, results: [{ opId: 'op-1', ok: true }], versionBefore: '1', version: '2' });
    const res = await pushOps(cfg, [{ action: 'deleteDebt', id: 'd-1', opId: 'op-1', queuedAt: 0 }]);
    expect(res.version).toBe('2');
    const body = JSON.parse((fn.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ action: 'batch', token: 'secret' });
    expect(body.ops).toHaveLength(1);
  });
});
