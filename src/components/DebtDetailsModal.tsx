import { useFocusTrap } from '../hooks/useFocusTrap';
import { Avatar, AccountChip, DueChip, TagChip } from './ui';
import { getDueStatus } from '../lib/dueStatus';
import React, { useMemo } from 'react';
import { Debt, Payment } from '../types';
import { formatDateLabel, formatMonthName } from '../utils/storage';
import { X, Calendar, DollarSign, ArrowDownLeft, FileText, Trash2, Clipboard } from 'lucide-react';

interface DebtDetailsModalProps {
  isOpen: boolean;
  deudaId: string | null;
  deudas: Debt[];
  pagos: Payment[];
  onClose: () => void;
  onOpenAbono: (deudaId: string) => void;
  onDeletePayment: (id: string) => void;
  activeUser: string;
}

export default function DebtDetailsModal({
  isOpen,
  deudaId,
  deudas,
  pagos,
  onClose,
  onOpenAbono,
  onDeletePayment,
  activeUser
}: DebtDetailsModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Retrieve selected debt
  const debt = useMemo(() => {
    return deudas.find(d => d.id === deudaId);
  }, [deudas, deudaId]);

  // Associated payments
  const assocPayments = useMemo(() => {
    if (!deudaId) return [];
    const list = pagos.filter(p => p.deudaId === deudaId);
    list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return list;
  }, [pagos, deudaId]);

  if (!isOpen || !debt) return null;

  const formatValue = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  const formatVES = (num: number) => {
    const formattedVal = new Intl.NumberFormat('es-VE', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
    return `Bs. ${formattedVal}`;
  };

  const displayTasa = debt.tasaCambio || 1;
  const isConverted = displayTasa !== 1;

  return (
    <div className="fixed inset-0 bg-scrim/40 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in" onClick={onClose}>
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        className="bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] max-w-2xl w-full p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 m3-elevation-3 flex flex-col max-h-[92dvh] animate-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="sm:hidden mx-auto -mt-2 mb-3 h-1 w-8 rounded-full bg-outline shrink-0" aria-hidden="true" />
        <div className="flex justify-between items-start gap-3 pb-4 border-b border-outline-variant shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar name={debt.contacto} size="lg" />
            <div className="min-w-0">
              <h3 id="detail-title" className="text-2xl font-semibold leading-tight truncate">{debt.contacto}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AccountChip cuenta={debt.cuenta} />
                <DueChip status={getDueStatus(debt)} />
                <TagChip tag={debt.tipo} />
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Cerrar"
            className="m3-state h-12 w-12 -mr-3 flex items-center justify-center text-on-surface-variant rounded-full cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto py-5 flex-grow space-y-6 scrollbar-thin">
          
          {/* Quick Metrics display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-surface-low p-4 rounded-xl border border-outline-variant/80">
            <div>
              <span className="block text-[11px] uppercase font-bold text-outline">Monto Original</span>
              <span className="text-base font-bold text-on-surface tabular-nums">{formatValue(debt.monto)}</span>
            </div>
            <div>
              <span className="block text-[11px] uppercase font-bold text-outline">Saldo Exigible</span>
              <span className={`text-base font-bold tabular-nums ${debt.saldo > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                {formatValue(debt.saldo)}
              </span>
            </div>
            <div>
              <span className="block text-[11px] uppercase font-bold text-outline font-sans">Mes de Pago</span>
              <span className="text-sm font-semibold text-on-surface">{formatMonthName(debt.mesPago)}</span>
            </div>
            <div>
              <span className="block text-[11px] uppercase font-bold text-outline tabular-nums">Tasa de Cambio</span>
              <span className="text-sm font-semibold tabular-nums text-on-surface">{displayTasa.toFixed(2)}</span>
            </div>
          </div>

          {/* Rate Conversions display panel */}
          {isConverted && (
            <div className="bg-success-container/70 border border-success/80 rounded-xl p-3.5 text-xs text-on-surface flex flex-col sm:flex-row justify-between gap-2.5 font-medium">
              <div>
                <span className="font-bold text-on-success-container uppercase text-[11px] block mb-0.5 tabular-nums">Conversiones con Tasa {displayTasa.toFixed(2)}</span>
                Valor convertido a moneda secundaria (VES / Bolívares):
              </div>
              <div className="flex space-x-4">
                <span>Original: <strong className="text-on-surface font-bold tabular-nums">{formatVES(debt.monto * displayTasa)}</strong></span>
                <span>Pendiente: <strong className="text-error font-bold tabular-nums">{formatVES(debt.saldo * displayTasa)}</strong></span>
              </div>
            </div>
          )}

          {/* Extended description card */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-outline uppercase tracking-wider">Concepto de la operación</span>
            <div className="text-xs text-on-surface-variant bg-surface-low/50 p-4 rounded-xl border border-outline-variant/80 flex items-start space-x-2">
              <FileText className="h-4 w-4 text-outline mt-0.5 shrink-0" />
              <div className="leading-relaxed">
                <p className="font-medium text-on-surface">{debt.descripcion || "Sin descripción / anotado como préstamo directo."}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-outline font-medium">
                  <span>Fecha Registro: {formatDateLabel(debt.fecha)}</span>
                  <span>Registrado por: {debt.creadoPor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payments listing area */}
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="block text-xs font-bold text-outline uppercase tracking-wider">Historial de Abonos Recibidos</span>
              {debt.estado === 'pendiente' && (
                <button
                  onClick={() => onOpenAbono(debt.id)}
                  className="bg-success hover:bg-success text-on-success font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-shadow/20 active:scale-95 duration-150"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  <span>Abonar Capital</span>
                </button>
              )}
            </div>

            <div className="border border-outline-variant/80 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="bg-surface-low border-b border-outline-variant/80 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider tabular-nums">
                  <tr>
                    <th className="py-2.5 px-4">Fecha Pago</th>
                    <th className="py-2.5 px-4">Monto Recibido</th>
                    <th className="py-2.5 px-4">Nota / Detalle</th>
                    <th className="py-2.5 px-4">Recibió</th>
                    <th className="py-2.5 px-4 text-right">Anular</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-on-surface bg-surface-lowest">
                  {assocPayments.length > 0 ? (
                    assocPayments.map(p => (
                      <tr key={p.id} className="hover:bg-surface-low/60 transition duration-150">
                        <td className="py-2.5 px-4 tabular-nums text-on-surface-variant">
                          {formatDateLabel(p.fecha)}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-success tabular-nums">
                          + {formatValue(p.monto)}
                        </td>
                        <td className="py-2.5 px-4 text-on-surface-variant max-w-[150px] truncate" title={p.nota}>
                          {p.nota || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-on-surface-variant font-semibold">
                          {p.registradoPor}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => onDeletePayment(p.id)}
                            className="text-outline hover:text-error p-1 rounded-full hover:bg-error-container transition cursor-pointer"
                            title="Eliminar este abono de capital"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-5 text-center text-outline font-medium text-xs">
                        No hay abonos registrados para este préstamo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer actions */}
        <div className="pt-3.5 border-t border-outline-variant flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="m3-state h-10 px-5 rounded-full text-primary text-sm font-semibold cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>

      </div>
    </div>
  );
}
