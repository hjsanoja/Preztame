import React, { useState, useEffect } from 'react';
import { Debt, Payment } from '../types';
import { saveDraft, loadDraft, clearDraft } from '../utils/storage';
import { X, ArrowDownLeft, AlertCircle } from 'lucide-react';

interface AbonoFormModalProps {
  isOpen: boolean;
  deudaId: string | null;
  deudas: Debt[];
  onClose: () => void;
  onSubmit: (data: Omit<Payment, 'id' | 'registradoPor'>) => void;
  activeUser: string;
}

export default function AbonoFormModal({
  isOpen,
  deudaId,
  deudas,
  onClose,
  onSubmit,
  activeUser
}: AbonoFormModalProps) {

  // Fetch associated parent debt
  const parentDebt = deudas.find(d => d.id === deudaId);

  // Core state
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [nota, setNota] = useState('');
  const [montoTouched, setMontoTouched] = useState(false);

  // Initialize dates and drafts
  useEffect(() => {
    if (isOpen && parentDebt) {
      const today = new Date().toISOString().split('T')[0];
      setFecha(today);

      // Default the payment amount to the exact outstanding balance as helper
      setMonto(parentDebt.saldo.toString());

      // Attempt draft load
      const draft = loadDraft("payment_draft");
      if (draft && draft.deudaId === deudaId) {
        if (draft.monto) setMonto(draft.monto);
        if (draft.fecha) setFecha(draft.fecha);
        if (draft.nota) setNota(draft.nota);
      }
    }
  }, [isOpen, deudaId, parentDebt]);

  // Autosave draft
  useEffect(() => {
    if (isOpen && deudaId && monto) {
      saveDraft("payment_draft", {
        deudaId,
        monto,
        fecha,
        nota
      });
    }
  }, [deudaId, monto, fecha, nota, isOpen]);

  if (!isOpen || !parentDebt) return null;

  // Currencies helper
  const formatValue = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  // Field validations
  const parsedMonto = parseFloat(monto);
  const isMontoValid = !isNaN(parsedMonto) && parsedMonto > 0 && parsedMonto <= parentDebt.saldo;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMontoValid) return;

    onSubmit({
      fecha,
      deudaId: parentDebt.id,
      monto: parsedMonto,
      nota: nota.trim()
    });

    clearDraft("payment_draft");
    setMonto('');
    setNota('');
    setMontoTouched(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] transform scale-100 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-[#040d53] text-[17px] flex items-center">
            <ArrowDownLeft className="h-5 w-5 mr-1 text-[#2a6c00]" />
            Registrar Abono / Cobro
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-4 overflow-y-auto pr-1 flex-grow scrollbar-thin">
          
          {/* Associated Parent Debt Summary */}
          <div className="bg-[#f3f3f6] border border-[#eeeef0] rounded-xl p-4 text-xs text-slate-800 space-y-2">
            <div className="flex justify-between font-bold text-slate-900 mb-1">
              <span className={`px-2 py-0.5 rounded-md text-[9px] uppercase font-bold border ${
                parentDebt.cuenta === 'Nina' 
                  ? 'bg-indigo-50 text-[#040d53] border-indigo-150' 
                  : 'bg-amber-50 text-amber-800 border-amber-150'
              }`}>
                Cuenta: {parentDebt.cuenta}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[9px] uppercase font-bold bg-emerald-50 text-[#2a6c00] border border-emerald-150">
                Pagar: {parentDebt.mesPago}
              </span>
            </div>
            
            <p className="font-extrabold text-sm text-slate-900">
              Contacto: {parentDebt.contacto}
            </p>
            {parentDebt.descripcion && (
              <p className="text-slate-500 font-medium leading-relaxed italic border-l border-slate-300 pl-1.5 mt-0.5">
                "{parentDebt.descripcion}"
              </p>
            )}
            <p className="pt-1.5 text-[#ba1a1a] font-extrabold text-sm flex items-center">
              <AlertCircle className="h-4 w-4 mr-1 stroke-[2.2]" />
              Saldo Pendiente Exigible: {formatValue(parentDebt.saldo)}
            </p>
          </div>

          {/* Abono value input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Monto del Abono ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-bold">$</span>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                max={parentDebt.saldo}
                placeholder="0.00"
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value);
                  setMontoTouched(true);
                }}
                onBlur={() => setMontoTouched(true)}
                className={`w-full pl-8 pr-4 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 transition ${
                  montoTouched
                    ? isMontoValid 
                      ? 'border-emerald-500 focus:ring-emerald-500/20' 
                      : 'border-rose-500 focus:ring-rose-500/20'
                    : 'border-[#e2e8f0] focus:ring-[#040d53]/10'
                }`}
                required
              />
            </div>
            {montoTouched && !isMontoValid && (
              <span className="text-[10px] text-rose-600 mt-1 block">
                {parsedMonto > parentDebt.saldo 
                  ? `El abono supera el saldo deudor actual de ${formatValue(parentDebt.saldo)}.` 
                  : 'Por favor, introduce un cobro válido superior a 0.'}
              </span>
            )}
          </div>

          {/* Target Payment Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fecha de Cobro
            </label>
            <input 
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none"
              required
            />
          </div>

          {/* Reference transaction note */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Referencia / Nota del Pago
            </label>
            <input 
              type="text"
              placeholder="Ej. Depósito Oxxo, Transferencia SPEI, Efectivo"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 transition"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex space-x-3 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-650 py-3 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={!isMontoValid}
              className="flex-1 bg-[#2a6c00] outline-none hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-1 cursor-pointer shadow-sm shadow-emerald-100"
            >
              <span>Confirmar Abono</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
