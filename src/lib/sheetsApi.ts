import { Debt, Payment } from '../types';
import { LedgerData, QueuedOp } from './ledger';
import { roundMoney } from './money';

export type SheetsErrorCode =
  | 'not-configured'
  | 'unauthorized'
  | 'outdated-script'
  | 'busy'
  | 'timeout'
  | 'network'
  | 'http'
  | 'bad-response';

export class SheetsError extends Error {
  constructor(public code: SheetsErrorCode, message?: string) {
    super(message || code);
    this.name = 'SheetsError';
  }
}

export function describeSheetsError(code: SheetsErrorCode): string {
  switch (code) {
    case 'not-configured': return 'Falta configurar la URL o la clave de Google Sheets.';
    case 'unauthorized': return 'Clave de acceso incorrecta. Revisa la clave en Configuración.';
    case 'outdated-script': return 'Tu Apps Script está desactualizado. Copia el código v6 desde Configuración.';
    case 'busy': return 'Google Sheets está ocupado. Se reintentará en unos segundos.';
    case 'timeout': return 'Google Sheets tardó demasiado en responder.';
    case 'network': return 'Sin conexión con Google Sheets.';
    case 'http': return 'Google Sheets respondió con un error.';
    case 'bad-response': return 'Respuesta inesperada de Google Sheets. Revisa que el código esté completo.';
  }
}

// ---------------------------------------------------------------------------
// Normalización: todas las respuestas pasan por aquí, sin importar la acción.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

// Acepta "YYYY-MM-DD", "YYYY-MM" o un ISO con hora (scripts antiguos enviaban
// fechas serializadas en UTC). Las ISO se convierten a la fecha local para no
// correr el día según la zona horaria.
function normalizeDate(value: unknown, kind: 'day' | 'month'): string {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value).trim().replace(/^'/, '');
  const plain = kind === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;
  if (plain.test(str)) return str;
  if (kind === 'month' && /^\d{4}-\d{2}-\d{2}$/.test(str)) return str.slice(0, 7);
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      return kind === 'month' ? ym : `${ym}-${pad(d.getDate())}`;
    }
  }
  return str;
}

const num = (v: unknown, fallback = 0): number => {
  const n = parseFloat(String(v));
  return isNaN(n) ? fallback : n;
};

export function normalizeDebt(raw: any): Debt {
  const monto = roundMoney(num(raw.monto));
  const saldo = roundMoney(num(raw.saldo, monto));
  return {
    id: String(raw.id),
    cuenta: raw.cuenta === 'Nando' ? 'Nando' : 'Nina',
    contacto: String(raw.contacto || 'Desconocido').trim(),
    tipo: String(raw.tipo || 'favor'),
    descripcion: String(raw.descripcion ?? ''),
    fecha: normalizeDate(raw.fecha, 'day'),
    mesPago: normalizeDate(raw.mesPago, 'month'),
    tasaCambio: num(raw.tasaCambio, 1) || 1,
    monto,
    saldo,
    estado: raw.estado === 'saldado' ? 'saldado' : 'pendiente',
    creadoPor: String(raw.creadoPor || 'Nina')
  };
}

export function normalizePayment(raw: any): Payment {
  return {
    id: String(raw.id),
    fecha: normalizeDate(raw.fecha, 'day'),
    deudaId: String(raw.deudaId),
    monto: roundMoney(num(raw.monto)),
    nota: String(raw.nota ?? ''),
    registradoPor: String(raw.registradoPor || 'Nina')
  };
}

export function normalizeLimits(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      const n = num(v);
      if (k.trim() && n > 0) out[k.trim()] = n;
    }
  }
  return out;
}

export function normalizeLedger(raw: any): LedgerData {
  return {
    deudas: (Array.isArray(raw?.deudas) ? raw.deudas : []).filter((d: any) => d && d.id !== '' && d.id != null).map(normalizeDebt),
    pagos: (Array.isArray(raw?.pagos) ? raw.pagos : []).filter((p: any) => p && p.id !== '' && p.id != null).map(normalizePayment),
    clientLimits: normalizeLimits(raw?.clientLimits)
  };
}

// ---------------------------------------------------------------------------
// Transporte
// ---------------------------------------------------------------------------

export interface SheetsConfig {
  url: string;
  token: string;
}

function withParams(url: string, params: Record<string, string | undefined>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.searchParams.set(k, v);
  }
  return u.toString();
}

async function request(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    throw new SheetsError(err?.name === 'AbortError' ? 'timeout' : 'network', String(err?.message || err));
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new SheetsError('http', `HTTP ${res.status}`);
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new SheetsError('bad-response', 'Respuesta no es JSON');
  }
  if (json && json.ok === false) {
    const code: SheetsErrorCode = json.error === 'unauthorized' ? 'unauthorized' : json.error === 'busy' ? 'busy' : 'bad-response';
    throw new SheetsError(code, json.error);
  }
  return json;
}

function assertConfigured(cfg: SheetsConfig) {
  if (!cfg.url || !cfg.token) throw new SheetsError('not-configured');
}

export type SnapshotResult =
  | { kind: 'notModified'; version: string }
  | { kind: 'data'; data: LedgerData; version: string | null };

// Lee los datos. Si `knownVersion` coincide con la del servidor, el script
// responde solo {notModified} sin tocar la hoja.
export async function fetchSnapshot(cfg: SheetsConfig, knownVersion: string | null, opts: { fresh?: boolean } = {}): Promise<SnapshotResult> {
  assertConfigured(cfg);
  const url = withParams(cfg.url, {
    token: cfg.token,
    v: opts.fresh ? undefined : knownVersion ?? undefined,
    fresh: opts.fresh ? '1' : undefined
  });
  const json = await request(url, { method: 'GET' }, 15000);
  if (json?.notModified) return { kind: 'notModified', version: String(json.version) };
  if (!json || !Array.isArray(json.deudas)) throw new SheetsError('bad-response');
  return { kind: 'data', data: normalizeLedger(json), version: json.version ? String(json.version) : null };
}

export interface PushResult {
  results: { opId: string | null; ok: boolean; error?: string }[];
  versionBefore: string | null;
  version: string | null;
}

// Envía todas las operaciones pendientes en una sola petición.
export async function pushOps(cfg: SheetsConfig, ops: QueuedOp[]): Promise<PushResult> {
  assertConfigured(cfg);
  const json = await request(cfg.url, {
    method: 'POST',
    // text/plain evita el preflight CORS que Apps Script no soporta.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'batch', token: cfg.token, ops })
  }, 30000);
  // Un script v5 ignora "batch" y devuelve los datos completos sin "results":
  // en ese caso NO se descartan las operaciones pendientes.
  if (!json || !Array.isArray(json.results)) throw new SheetsError('outdated-script');
  return {
    results: json.results,
    versionBefore: json.versionBefore ? String(json.versionBefore) : null,
    version: json.version ? String(json.version) : null
  };
}

export async function fetchBcvFromScript(cfg: SheetsConfig): Promise<number | null> {
  try {
    assertConfigured(cfg);
    const json = await request(withParams(cfg.url, { token: cfg.token, action: 'bcv' }), { method: 'GET' }, 10000);
    const rate = num(json?.rate);
    return rate > 0 ? rate : null;
  } catch {
    return null;
  }
}
