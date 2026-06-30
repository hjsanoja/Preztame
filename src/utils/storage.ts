import { Debt, Payment } from '../types';

// Preconfigured default public script URL
const DEFAULT_SHEETS_URL = "https://script.google.com/macros/s/AKfycbw2VcdTcdl2Avf--jI9IYVZoehaoZTmPqoxUgh_s8_xkGCELmeUp1U8f4AWqfGclV4/exec";

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

// Helper to determine active source
export function getStoredSource(): 'sheets' | 'local' {
  const src = localStorage.getItem("df_datasource");
  return (src === "local") ? "local" : "sheets";
}

// Get saved Sheets Apps Script Web App URL
export function getStoredSheetUrl(): string {
  return localStorage.getItem("df_sheet_url") || DEFAULT_SHEETS_URL;
}

// Keep a backup of data in local storage
export function getLocalFallbackData(): { deudas: Debt[]; pagos: Payment[] } {
  try {
    const debtsStr = localStorage.getItem("df_local_deudas");
    const paymentsStr = localStorage.getItem("df_local_pagos");
    if (debtsStr && paymentsStr) {
      return {
        deudas: JSON.parse(debtsStr),
        pagos: JSON.parse(paymentsStr)
      };
    }
  } catch (e) {
    console.error("Failed to parse local fallback data", e);
  }
  
  // Save initial mocks
  localStorage.setItem("df_local_deudas", JSON.stringify(MOCK_DEBTS));
  localStorage.setItem("df_local_pagos", JSON.stringify(MOCK_PAYMENTS));
  return { deudas: MOCK_DEBTS, pagos: MOCK_PAYMENTS };
}

// Save local mode data changes
export function saveLocalChanges(deudas: Debt[], pagos: Payment[]) {
  localStorage.setItem("df_local_deudas", JSON.stringify(deudas));
  localStorage.setItem("df_local_pagos", JSON.stringify(pagos));
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
