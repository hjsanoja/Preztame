export interface Debt {
  id: string; // ID of the debt
  cuenta: string; // Account owner (one of the configured users)
  contacto: string; // Customer who owes the money (Juan Perez, Mamá, etc.)
  tipo: string; // e.g. "favor" / "negocio"
  descripcion: string; // Detail note
  fecha: string; // Date (YYYY-MM-DD)
  mesPago: string; // Target month (YYYY-MM)
  tasaCambio: number; // Conversion rate, defaults to 1.0
  monto: number; // Original amount in dollars (or base currency)
  saldo: number; // Outstanding balance
  estado: 'pendiente' | 'saldado'; // Current status
  creadoPor: string; // Creator name
}

export interface Payment {
  id: string; // ID of the payment
  fecha: string; // Date (YYYY-MM-DD)
  deudaId: string; // Connected Debt ID
  monto: number; // Amount paid
  nota: string; // Description/Reference
  registradoPor: string; // Who authorized it
  moneda?: 'USD' | 'VES'; // Currency the payment was received in
  tasaCambio?: number; // Bs per USD on the payment day (VES payments)
  montoBs?: number; // Amount received in Bs (VES payments)
}

// Entry of the change log ("Historial de cambios").
export interface ChangeLogEntry {
  fecha: string; // ISO timestamp of when the change was made
  usuario: string;
  accion: string;
  refId: string;
  detalle: string;
  pendiente?: boolean; // not yet confirmed by Google Sheets
}

export interface ChartDataPoint {
  mes: string; // Display month (e.g. "Ene 2026")
  sortKey: string; // "YYYY-MM"
  montoTotal: number;
  saldoPendiente: number;
  recuperado: number;
}

export interface ContactDataPoint {
  name: string;
  count: number;
  totalOriginal: number;
  totalPendiente: number;
}
