import { Debt, Payment } from '../types';
import { LedgerData, QueuedOp } from '../lib/ledger';
import { normalizeLedger } from '../lib/sheetsApi';

const MOCK_DEBTS: Debt[] = [
  { id: "d-1", cuenta: "Nina", contacto: "Mamá de Nina", tipo: "favor", descripcion: "Préstamo familiar para refacciones", fecha: "2026-05-10", mesPago: "2026-06", tasaCambio: 18.25, monto: 120.00, saldo: 50.00, estado: "pendiente", creadoPor: "Nina" },
  { id: "d-2", cuenta: "Nando", contacto: "Socio Juan", tipo: "negocio", descripcion: "Inyección de capital temporal (mercancías)", fecha: "2026-05-15", mesPago: "2026-07", tasaCambio: 1.00, monto: 280.00, saldo: 280.00, estado: "pendiente", creadoPor: "Nando" },
  { id: "d-3", cuenta: "Nina", contacto: "Roberto Gómez", tipo: "favor", descripcion: "Préstamo efectivo de emergencia", fecha: "2026-05-01", mesPago: "2026-05", tasaCambio: 1.05, monto: 15.00, saldo: 0.00, estado: "saldado", creadoPor: "Nina" },
  { id: "d-4", cuenta: "Nando", contacto: "Carlos Herrera", tipo: "favor", descripcion: "Préstamo herramientas taller", fecha: "2026-04-20", mesPago: "2026-06", tasaCambio: 18.10, monto: 350.00, saldo: 150.00, estado: "pendiente", creadoPor: "Nando" },
  { id: "d-5", cuenta: "Nina", contacto: "Sofía Martínez", tipo: "negocio", descripcion: "Suministro de materia prima", fecha: "2026-04-12", mesPago: "2026-05", tasaCambio: 1.00, monto: 450.00, saldo: 0.00, estado: "saldado", creadoPor: "Nina" }
];

const MOCK_PAYMENTS: Payment[] = [
  { id: "p-1", fecha: "2026-05-12", deudaId: "d-1", monto: 70.00, nota: "Abono inicial transferencia bancaria", registradoPor: "Nina" },
  { id: "p-2", fecha: "2026-05-02", deudaId: "d-3", monto: 15.00, nota: "Pago en mano, liquidado completo", registradoPor: "Nina" },
  { id: "p-3", fecha: "2026-05-25", deudaId: "d-4", monto: 200.00, nota: "Abono recibido en efectivo", registradoPor: "Nando" },
  { id: "p-4", fecha: "2026-05-10", deudaId: "d-5", monto: 450.00, nota: "Sin saldo pendiente", registradoPor: "Nina" }
];

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`No se pudo guardar ${key}`, e);
  }
}

// Helper to determine active source
export function getStoredSource(): 'sheets' | 'local' {
  const src = localStorage.getItem("df_datasource");
  return (src === "local") ? "local" : "sheets";
}

// Saved Sheets Apps Script Web App URL (no default: each user deploys their own)
export function getStoredSheetUrl(): string {
  return localStorage.getItem("df_sheet_url") || "";
}

export function getStoredToken(): string {
  return localStorage.getItem("df_sheet_token") || "";
}

export function saveToken(token: string) {
  localStorage.setItem("df_sheet_token", token);
}

// Key shown in Configuración before the connection is saved. Kept in storage so
// it does not change between visits while the user is deploying the script.
export function getOrCreateDraftToken(): string {
  const existing = localStorage.getItem("df_sheet_token") || localStorage.getItem("df_sheet_token_draft");
  if (existing) return existing;
  const token = generateToken();
  localStorage.setItem("df_sheet_token_draft", token);
  return token;
}

export function saveDraftToken(token: string) {
  localStorage.setItem("df_sheet_token_draft", token);
}

export function generateToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
}

// ---------------- Local (demo) mode ----------------

export function getLocalModeData(): LedgerData {
  const deudas = readJson<Debt[]>("df_local_deudas");
  const pagos = readJson<Payment[]>("df_local_pagos");
  const clientLimits = readJson<Record<string, number>>("df_client_limits") || {};
  if (deudas && pagos) return normalizeLedger({ deudas, pagos, clientLimits });

  const seeded: LedgerData = { deudas: MOCK_DEBTS, pagos: MOCK_PAYMENTS, clientLimits: {} };
  saveLocalModeData(seeded);
  return seeded;
}

export function saveLocalModeData(data: LedgerData) {
  writeJson("df_local_deudas", data.deudas);
  writeJson("df_local_pagos", data.pagos);
  writeJson("df_client_limits", data.clientLimits);
}

// ---------------- Google Sheets mode ----------------
// The cache and the pending-changes queue are keyed by script URL so that
// switching to another sheet never mixes data or pushes changes to the wrong one.

export interface SheetsCache {
  data: LedgerData;
  version: string | null;
  syncedAt: number;
}

export function getSheetsCache(url: string): SheetsCache | null {
  const cached = readJson<SheetsCache>(`df_cache::${url}`);
  if (!cached || !cached.data) return null;
  return { ...cached, data: normalizeLedger(cached.data) };
}

export function saveSheetsCache(url: string, cache: SheetsCache) {
  writeJson(`df_cache::${url}`, cache);
}

export function getOutbox(url: string): QueuedOp[] {
  return readJson<QueuedOp[]>(`df_outbox::${url}`) || [];
}

export function saveOutbox(url: string, ops: QueuedOp[]) {
  if (ops.length === 0) localStorage.removeItem(`df_outbox::${url}`);
  else writeJson(`df_outbox::${url}`, ops);
}

// Convert month string "YYYY-MM" to readable "Mes Año"
export function formatMonthName(monthStr: string): string {
  if (!monthStr) return "";
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const monthNum = parseInt(parts[1], 10) - 1;
  const year = parts[0];
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[monthNum]} ${year}`;
}

// Format date "YYYY-MM-DD" to standard Spanish "DD/MM/YYYY"
export function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Persist form inputs dynamically in case of crash or accidental page close
export function saveDraft(key: "debt_draft" | "payment_draft", data: any) {
  localStorage.setItem(`df_draft_${key}`, JSON.stringify(data));
}

export function loadDraft(key: "debt_draft" | "payment_draft"): any | null {
  const d = localStorage.getItem(`df_draft_${key}`);
  if (d) {
    try {
      return JSON.parse(d);
    } catch {
      return null;
    }
  }
  return null;
}

export function clearDraft(key: "debt_draft" | "payment_draft") {
  localStorage.removeItem(`df_draft_${key}`);
}
