export interface Debt {
  id: string; // ID of the debt
  cuenta: 'Nina' | 'Nando'; // Account owner
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
