import { useFocusTrap } from '../hooks/useFocusTrap';
import { AccountChip } from './ui';
import React, { useState, useEffect } from 'react';
import { Debt, Payment } from '../types';
import { saveDraft, loadDraft, clearDraft, formatMonthName } from '../utils/storage';
import { X, ArrowDownLeft, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { fetchBCVExchangeRate } from '../utils/bcv';
import { roundMoney } from '../lib/money';
import { formatUsd, formatVes, localDay } from '../lib/format';
import { formatRate, presentRate, roundUpRate } from '../lib/rate';

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
  // Payment received in bolívares: amount in Bs + that day's rate.
  const [moneda, setMoneda] = useState<'USD' | 'VES'>('USD');
  const [montoBs, setMontoBs] = useState('');
  const [tasa, setTasa] = useState('');
  const [loadingRate, setLoadingRate] = useState(false);
  const tasaTouched = React.useRef(false);
  const [bcv, setBcv] = useState<number | null>(null);

  // The automatic lookup never overwrites a rate the user already typed;
  // the "BCV" button (force) does.
  const loadRate = async (force = false) => {
    setLoadingRate(true);
    const rate = await fetchBCVExchangeRate().catch(() => null);
    if (rate && (force || !tasaTouched.current)) setTasa(force ? formatRate(rate) : presentRate(rate));
    if (rate) setBcv(rate);
    setLoadingRate(false);
  };

  const switchCurrency = (next: 'USD' | 'VES') => {
    setMoneda(next);
    if (next === 'VES' && !tasa) void loadRate();
  };

  // Initialize dates and drafts
  useEffect(() => {
    if (isOpen && parentDebt) {
      const today = localDay();
      setFecha(today);

      // Default the payment amount to the exact outstanding balance as helper
      setMonto(parentDebt.saldo.toString());
      setMoneda('USD');
      setMontoBs('');

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

  // Field validations
  const parsedTasa = parseFloat(tasa);
  const parsedBs = parseFloat(montoBs);
  const bsToUsd = moneda === 'VES' && parsedTasa > 0 && parsedBs > 0 ? roundMoney(parsedBs / parsedTasa) : NaN;
  // Paying the whole balance in Bs can round a cent over: treat it as the balance.
  const parsedMonto = moneda === 'VES'
    ? (Math.abs(bsToUsd - parentDebt.saldo) <= 0.01 ? parentDebt.saldo : bsToUsd)
    : parseFloat(monto);
  const isMontoValid = !isNaN(parsedMonto) && parsedMonto > 0 && parsedMonto <= parentDebt.saldo;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMontoValid) return;

    onSubmit({
      fecha,
      deudaId: parentDebt.id,
      monto: parsedMonto,
      nota: nota.trim(),
      ...(moneda === 'VES' ? { moneda: 'VES' as const, montoBs: roundMoney(parsedBs), tasaCambio: parsedTasa } : {})
    });

    clearDraft("payment_draft");
    setMonto('');
    setNota('');
    setMontoTouched(false);
    onClose();
  };

  const labelCls = 'block text-sm font-medium text-on-surface-variant mb-1.5';
  const inputCls = 'w-full h-12 px-4 rounded-xl border bg-surface-lowest text-on-surface text-base focus:outline-none focus:ring-2 transition';
  const okBorder = 'border-outline-variant focus:border-primary focus:ring-primary/20';
  const errBorder = 'border-error focus:border-error focus:ring-error/20';
  const showMontoError = montoTouched && !isMontoValid;

  return (
    <div className="fixed inset-0 bg-scrim/40 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="abono-form-title"
        className="bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] max-w-md w-full m3-elevation-3 flex flex-col max-h-[92dvh] animate-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mt-3 h-1 w-8 rounded-full bg-outline shrink-0" aria-hidden="true" />

        {/* Header */}
        <header className="flex items-center gap-3 px-6 pt-4 pb-2 shrink-0">
          <span className="h-10 w-10 rounded-full bg-success-container text-on-success-container flex items-center justify-center shrink-0" aria-hidden="true">
            <ArrowDownLeft className="h-5 w-5" />
          </span>
          <h2 id="abono-form-title" className="flex-1 min-w-0 text-2xl font-semibold leading-tight">
            Registrar abono / cobro
          </h2>
          <button 
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="m3-state h-12 w-12 -mr-3 flex items-center justify-center text-on-surface-variant rounded-full cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Scrollable Form */}
        <form onSubmit={handleFormSubmit} className="space-y-5 px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 overflow-y-auto flex-grow scrollbar-thin">
          
          {/* Associated Parent Debt Summary */}
          <div className="rounded-2xl bg-surface-container p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <AccountChip cuenta={parentDebt.cuenta} />
              <span className="inline-flex items-center h-6 px-2 rounded-md bg-secondary-container text-on-secondary-container text-xs font-medium">
                Pago: {formatMonthName(parentDebt.mesPago)}
              </span>
            </div>
            <p className="text-base font-semibold truncate">
              {parentDebt.contacto}
            </p>
            {parentDebt.descripcion && (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                "{parentDebt.descripcion}"
              </p>
            )}
            <div className="pt-2 mt-1 border-t border-outline-variant/60 flex items-center justify-between gap-2">
              <span className="text-sm text-on-surface-variant flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                Saldo pendiente
              </span>
              <span className="text-xl font-bold tabular-nums text-error">{formatUsd(parentDebt.saldo)}</span>
            </div>
          </div>

          {/* Currency */}
          <div role="radiogroup" aria-label="Moneda del abono" className="flex h-10 rounded-full border border-outline overflow-hidden">
            {([['USD', 'Dólares'], ['VES', 'Bolívares']] as const).map(([value, label], i) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={moneda === value}
                onClick={() => switchCurrency(value)}
                className={`m3-state flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer ${i > 0 ? 'border-l border-outline' : ''} ${
                  moneda === value ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'
                }`}
              >
                {moneda === value && <Check className="h-4 w-4" aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>

          {moneda === 'VES' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="abono-monto-bs" className={labelCls}>Monto en Bs</label>
                  <input
                    id="abono-monto-bs"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={montoBs}
                    onChange={(e) => { setMontoBs(e.target.value); setMontoTouched(true); }}
                    aria-invalid={showMontoError}
                    className={`${inputCls} tabular-nums ${showMontoError && !isNaN(parsedMonto) ? errBorder : okBorder}`}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="abono-tasa" className="block text-sm font-medium text-on-surface-variant">Tasa Bs/$</label>
                    <button type="button" onClick={() => void loadRate(true)} aria-label="Usar tasa BCV de hoy" className="m3-state -my-2 -mr-2 h-8 px-2 rounded-full inline-flex items-center gap-1 text-sm font-semibold text-primary cursor-pointer">
                      <RefreshCw className={`h-4 w-4 ${loadingRate ? 'animate-spin' : ''}`} aria-hidden="true" /> BCV
                    </button>
                  </div>
                  <input
                    id="abono-tasa"
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    placeholder={loadingRate ? 'Consultando…' : '0.00'}
                    value={tasa}
                    onChange={(e) => { tasaTouched.current = true; setTasa(e.target.value); }}
                    className={`${inputCls} tabular-nums ${okBorder}`}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-container px-4 py-3 text-sm">
                <span className="text-on-surface-variant">Equivale a</span>
                <strong className="text-base font-bold tabular-nums">{isNaN(parsedMonto) ? '—' : formatUsd(parsedMonto)}</strong>
              </div>
              <div className="flex flex-wrap gap-2">
                {bcv && tasa !== formatRate(roundUpRate(bcv)) && (
                  <button type="button" onClick={() => { tasaTouched.current = true; setTasa(formatRate(roundUpRate(bcv))); }}
                    className="m3-state h-8 px-3 rounded-lg bg-secondary-container text-on-secondary-container text-sm font-medium tabular-nums cursor-pointer">
                    Redondear tasa hacia arriba: {roundUpRate(bcv)}
                  </button>
                )}
                {parsedTasa > 0 && (
                  <button type="button" onClick={() => setMontoBs((parentDebt.saldo * parsedTasa).toFixed(2))} className="m3-state h-8 px-3 rounded-lg border border-outline text-primary text-sm font-medium tabular-nums cursor-pointer">
                    Pagar todo el saldo: {formatVes(parentDebt.saldo * parsedTasa)}
                  </button>
                )}
              </div>
              {showMontoError && !isNaN(parsedMonto) && (
                <span className="text-xs text-error px-4 block">El abono supera el saldo de {formatUsd(parentDebt.saldo)}.</span>
              )}
            </div>
          ) : (
          <div>
            <label htmlFor="abono-monto" className={labelCls}>
              Monto del abono ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant" aria-hidden="true">$</span>
              <input 
                id="abono-monto"
                type="number"
                step="0.01"
                min="0.01"
                max={parentDebt.saldo}
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value);
                  setMontoTouched(true);
                }}
                onBlur={() => { if (monto) setMontoTouched(true); }}
                aria-invalid={showMontoError}
                className={`${inputCls} pl-8 tabular-nums ${showMontoError ? errBorder : okBorder}`}
                required
              />
            </div>
            {showMontoError && (
              <span className="text-xs text-error mt-1 px-4 block">
                {parsedMonto > parentDebt.saldo 
                  ? `El abono supera el saldo deudor actual de ${formatUsd(parentDebt.saldo)}.` 
                  : 'Por favor, introduce un cobro válido superior a 0.'}
              </span>
            )}
          </div>

          )}

          {/* Target Payment Date */}
          <div>
            <label htmlFor="abono-fecha" className={labelCls}>
              Fecha de cobro
            </label>
            <input 
              id="abono-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={`${inputCls} ${okBorder}`}
              required
            />
          </div>

          {/* Reference transaction note */}
          <div>
            <label htmlFor="abono-nota" className={labelCls}>
              Referencia / Nota del pago
            </label>
            <input 
              id="abono-nota"
              type="text"
              placeholder="Ej. Pago móvil, Zelle, efectivo"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className={`${inputCls} ${okBorder}`}
            />
          </div>

          {/* Action buttons */}
          <div className="pt-1 flex justify-end gap-2 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              className="m3-state h-10 px-4 rounded-full text-primary text-sm font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={!isMontoValid}
              className="m3-state h-10 px-6 rounded-full bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Confirmar abono
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
