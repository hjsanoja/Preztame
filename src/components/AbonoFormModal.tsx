import { useFocusTrap } from '../hooks/useFocusTrap';
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
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

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
    <div className="fixed inset-0 bg-scrim/40 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="abono-form-title"
        className="bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] max-w-md w-full p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 m3-elevation-3 flex flex-col max-h-[92dvh] animate-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-outline-variant shrink-0">
          <h3 id="abono-form-title" className="font-bold text-on-surface text-[17px] flex items-center">
            <ArrowDownLeft className="h-5 w-5 mr-1 text-success" />
            Registrar Abono / Cobro
          </h3>
          <button 
            onClick={onClose}
            aria-label="Cerrar"
            className="m3-state h-12 w-12 -mr-3 flex items-center justify-center text-on-surface-variant rounded-full cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4 pt-4 overflow-y-auto pr-1 flex-grow scrollbar-thin">
          
          {/* Associated Parent Debt Summary */}
          <div className="bg-surface-container border border-surface-container rounded-xl p-4 text-xs text-on-surface space-y-2">
            <div className="flex justify-between font-bold text-on-surface mb-1">
              <span className={`px-2 py-0.5 rounded-md text-[11px] uppercase font-bold border ${
                parentDebt.cuenta === 'Nina' 
                  ? 'bg-primary-container text-on-surface border-primary/40' 
                  : 'bg-warning-container text-on-warning-container border-warning/40'
              }`}>
                Cuenta: {parentDebt.cuenta}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[11px] uppercase font-bold bg-success-container text-success border border-success/40">
                Pagar: {parentDebt.mesPago}
              </span>
            </div>
            
            <p className="font-semibold text-sm text-on-surface">
              Contacto: {parentDebt.contacto}
            </p>
            {parentDebt.descripcion && (
              <p className="text-on-surface-variant font-medium leading-relaxed italic border-l border-outline-variant pl-1.5 mt-0.5">
                "{parentDebt.descripcion}"
              </p>
            )}
            <p className="pt-1.5 text-error font-semibold text-sm flex items-center">
              <AlertCircle className="h-4 w-4 mr-1 stroke-[2.2]" />
              Saldo Pendiente Exigible: {formatValue(parentDebt.saldo)}
            </p>
          </div>

          {/* Abono value input */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Monto del Abono ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-outline font-bold">$</span>
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
                      ? 'border-success focus:ring-success/20' 
                      : 'border-error focus:ring-error/20'
                    : 'border-outline-variant focus:ring-primary/10'
                }`}
                required
              />
            </div>
            {montoTouched && !isMontoValid && (
              <span className="text-[11px] text-error mt-1 block">
                {parsedMonto > parentDebt.saldo 
                  ? `El abono supera el saldo deudor actual de ${formatValue(parentDebt.saldo)}.` 
                  : 'Por favor, introduce un cobro válido superior a 0.'}
              </span>
            )}
          </div>

          {/* Target Payment Date */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Fecha de Cobro
            </label>
            <input 
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-xs sm:text-sm focus:outline-none"
              required
            />
          </div>

          {/* Reference transaction note */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Referencia / Nota del Pago
            </label>
            <input 
              type="text"
              placeholder="Ej. Depósito Oxxo, Transferencia SPEI, Efectivo"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex space-x-3 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 border border-outline-variant hover:bg-surface-low text-on-surface py-3 rounded-xl font-bold text-xs sm:text-sm transition active:scale-95 cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={!isMontoValid}
              className="flex-1 bg-success outline-none hover:opacity-90 disabled:opacity-50 text-on-success py-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-1 cursor-pointer shadow-sm shadow-shadow"
            >
              <span>Confirmar Abono</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
