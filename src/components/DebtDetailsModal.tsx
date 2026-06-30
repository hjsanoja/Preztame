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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] transform scale-100 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-3.5 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-[#040d53] text-[17px] flex items-center">
              Ficha del Préstamo Activo
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Cliente: <strong className="text-slate-800 font-extrabold">{debt.contacto}</strong> | Asignado a: <span className="font-bold text-[#040d53]">{debt.cuenta}</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto py-5 flex-grow space-y-6 scrollbar-thin">
          
          {/* Quick Metrics display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#f3f3f6] p-4 rounded-xl border border-[#eeeef0]">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Monto Original</span>
              <span className="text-base font-bold text-[#040d53]">{formatValue(debt.monto)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400">Saldo Exigible</span>
              <span className={`text-base font-extrabold ${debt.saldo > 0 ? 'text-[#ba1a1a]' : 'text-slate-500'}`}>
                {formatValue(debt.saldo)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400 font-sans">Mes de Pago</span>
              <span className="text-sm font-semibold text-slate-700">{formatMonthName(debt.mesPago)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono">Tasa de Cambio</span>
              <span className="text-sm font-semibold font-mono text-slate-700">{displayTasa.toFixed(4)}</span>
            </div>
          </div>

          {/* Rate Conversions display panel */}
          {isConverted && (
            <div className="bg-[#a0f572]/10 border border-[#a0f572]/40 rounded-xl p-3.5 text-xs text-slate-700 flex flex-col sm:flex-row justify-between gap-2.5 font-medium">
              <div>
                <span className="font-bold text-[#2a6c00] uppercase text-[10px] block mb-0.5">Conversiones con Tasa {displayTasa.toFixed(4)}</span>
                Valor convertido a moneda secundaria (VES / Bolívares):
              </div>
              <div className="flex space-x-4">
                <span>Original: <strong className="text-slate-900 font-bold">{formatVES(debt.monto * displayTasa)}</strong></span>
                <span>Pendiente: <strong className="text-[#ba1a1a] font-extrabold">{formatVES(debt.saldo * displayTasa)}</strong></span>
              </div>
            </div>
          )}

          {/* Extended description card */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Concepto de la operación</span>
            <div className="text-xs text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-start space-x-2">
              <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="leading-relaxed">
                <p className="font-medium text-slate-700">{debt.descripcion || "Sin descripción / anotado como préstamo directo."}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-400 font-medium">
                  <span>Fecha Registro: {formatDateLabel(debt.fecha)}</span>
                  <span>Registrado por: {debt.creadoPor}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payments listing area */}
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Historial de Abonos Recibidos</span>
              {debt.estado === 'pendiente' && (
                <button
                  onClick={() => onOpenAbono(debt.id)}
                  className="bg-[#2a6c00] hover:opacity-95 text-white font-bold text-xs px-3 py-2 rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-emerald-50"
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  <span>Abonar Capital</span>
                </button>
              )}
            </div>

            <div className="border border-slate-150 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="bg-[#f3f3f6] border-b border-slate-150 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Fecha Pago</th>
                    <th className="py-2.5 px-4">Monto Recibido</th>
                    <th className="py-2.5 px-4">Nota / Detalle</th>
                    <th className="py-2.5 px-4">Recibió</th>
                    <th className="py-2.5 px-4 text-right">Anular</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {assocPayments.length > 0 ? (
                    assocPayments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition duration-150">
                        <td className="py-2.5 px-4 font-mono text-slate-500">
                          {formatDateLabel(p.fecha)}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[#2a6c00]">
                          + {formatValue(p.monto)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 max-w-[150px] truncate" title={p.nota}>
                          {p.nota || '-'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-semibold">
                          {p.registradoPor}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => onDeletePayment(p.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-full hover:bg-rose-50 transition cursor-pointer"
                            title="Eliminar este abono de capital"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-5 text-center text-slate-400 font-semibold text-xs">
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
        <div className="pt-3.5 border-t border-slate-100 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition active:scale-95 cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>

      </div>
    </div>
  );
}
