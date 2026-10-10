import { useFocusTrap } from '../hooks/useFocusTrap';
import React, { useState, useEffect, useMemo } from 'react';
import { Debt } from '../types';
import { saveDraft, loadDraft, clearDraft } from '../utils/storage';
import { X, Calendar, DollarSign, ArrowUpRight, RefreshCw, Globe, AlertTriangle } from 'lucide-react';
import { fetchBCVExchangeRate } from '../utils/bcv';
import { normalizeTag, tagColorVar, tagLabel, tagOptions } from '../lib/tags';
import { Check, Plus } from 'lucide-react';

interface DebtFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Debt, 'id' | 'saldo' | 'estado' | 'creadoPor'>) => void;
  activeUser: string;
  deudas: Debt[];
  clientLimits: Record<string, number>;
}

export default function DebtFormModal({
  isOpen,
  onClose,
  onSubmit,
  activeUser,
  deudas,
  clientLimits
}: DebtFormModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Primary state fields
  const [cuenta, setCuenta] = useState<'Nina' | 'Nando'>('Nina');
  const [contacto, setContacto] = useState('');
  const [monto, setMonto] = useState('');
  const [mesPago, setMesPago] = useState('');
  const [tasaCambio, setTasaCambio] = useState('1.0000');
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('favor');
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const tags = useMemo(() => {
    const opts = tagOptions(deudas.map(d => d.tipo));
    return opts.includes(tipo) || !tipo ? opts : [tipo, ...opts];
  }, [deudas, tipo]);
  const knownContacts = useMemo(() => [...new Set(deudas.map(d => d.contacto.trim()))].sort((a, b) => a.localeCompare(b)), [deudas]);

  // BCV fetch and error states
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [loadingBcv, setLoadingBcv] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Validations feedback states
  const [contactoTouched, setContactoTouched] = useState(false);
  const [montoTouched, setMontoTouched] = useState(false);
  const [mesTouched, setMesTouched] = useState(false);
  const [tasaTouched, setTasaTouched] = useState(false);

  // Credit limit calculation for live warning
  const limitCheck = useMemo(() => {
    if (!contacto.trim() || !monto) return null;
    const clientName = contacto.trim();
    
    // Find key with case-insensitive search
    const matchingKey = Object.keys(clientLimits).find(
      key => key.toLowerCase() === clientName.toLowerCase()
    );
    const limit = matchingKey ? clientLimits[matchingKey] : 0;
    if (!limit || limit <= 0) return null;

    // Sum outstanding balances
    const currentOutstanding = deudas
      .filter(d => d.contacto && d.contacto.trim().toLowerCase() === clientName.toLowerCase() && d.estado === 'pendiente')
      .reduce((sum, d) => sum + d.saldo, 0);

    const newLoanAmount = parseFloat(monto) || 0;
    const totalEstimated = currentOutstanding + newLoanAmount;
    const isExceeded = totalEstimated > limit;

    return {
      limit,
      currentOutstanding,
      newLoanAmount,
      totalEstimated,
      isExceeded,
      exceededBy: totalEstimated - limit
    };
  }, [contacto, monto, deudas, clientLimits]);

  // Helper to load current BCV rate
  const loadBcvRate = async (force = false) => {
    setLoadingBcv(true);
    setFetchError(false);
    try {
      const rate = await fetchBCVExchangeRate();
      if (rate) {
        setBcvRate(rate);
        setTasaCambio((current) => {
          // If the user hasn't customized the default 1.0000 rate,
          // or if they clicked manual refresh, apply the fetched rate automatically.
          if (force || current === '1.0000' || current === '1' || current === '') {
            return rate.toFixed(4);
          }
          return current;
        });
      } else {
        setFetchError(true);
      }
    } catch (err) {
      setFetchError(true);
    } finally {
      setLoadingBcv(false);
    }
  };

  // Initialize dates and drafts
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      const curMonth = new Date().toISOString().slice(0, 7);
      
      // Default initial states
      setFecha(today);
      setMesPago(curMonth);
      setCuenta(activeUser === 'Nando' ? 'Nando' : 'Nina');
      setTasaCambio('1.0000');
      setBcvRate(null);
      setFetchError(false);

      // Attempt to load existing draft
      const draft = loadDraft("debt_draft");
      if (draft) {
        if (draft.cuenta) setCuenta(draft.cuenta);
        if (draft.contacto) setContacto(draft.contacto);
        if (draft.monto) setMonto(draft.monto);
        if (draft.mesPago) setMesPago(draft.mesPago);
        if (draft.tasaCambio) setTasaCambio(draft.tasaCambio);
        if (draft.fecha) setFecha(draft.fecha);
        if (draft.descripcion) setDescripcion(draft.descripcion);
        if (draft.tipo) setTipo(draft.tipo);
      }

      // Automatically fetch current BCV exchange rate
      loadBcvRate();
    }
  }, [isOpen, activeUser]);

  // Autosave current inputs as draft
  useEffect(() => {
    if (isOpen && (contacto || monto || descripcion)) {
      saveDraft("debt_draft", {
        cuenta,
        contacto,
        monto,
        mesPago,
        tasaCambio,
        fecha,
        descripcion,
        tipo
      });
    }
  }, [cuenta, contacto, monto, mesPago, tasaCambio, fecha, descripcion, tipo, isOpen]);

  if (!isOpen) return null;

  // Validation rules
  const isContactoValid = contacto.trim().length >= 2;
  const isMontoValid = !isNaN(parseFloat(monto)) && parseFloat(monto) > 0;
  const isMesValid = mesPago !== "";
  const isTasaValid = !isNaN(parseFloat(tasaCambio)) && parseFloat(tasaCambio) > 0;

  const isFormValid = isContactoValid && isMontoValid && isMesValid && isTasaValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    onSubmit({
      cuenta,
      contacto: contacto.trim(),
      monto: parseFloat(monto),
      tipo: normalizeTag(tipo) || 'favor',
      descripcion: descripcion.trim(),
      fecha,
      mesPago,
      tasaCambio: parseFloat(tasaCambio)
    });

    // Reset fields and clear draft
    clearDraft("debt_draft");
    setContacto('');
    setMonto('');
    setDescripcion('');
    setTipo('favor');
    setContactoTouched(false);
    setMontoTouched(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-scrim/40 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-form-title"
        className="bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] max-w-md w-full p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 m3-elevation-3 flex flex-col max-h-[92dvh] animate-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-outline-variant shrink-0">
          <h3 id="debt-form-title" className="font-bold text-on-surface text-[17px] flex items-center">
            <ArrowUpRight className="h-5 w-5 mr-1 text-error" />
            Registrar Nuevo Préstamo
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
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 overflow-y-auto pr-1 flex-grow scrollbar-thin">
          
          {/* Account owner */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Asignar a Cuenta de:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`border rounded-xl p-3 flex items-center justify-center space-x-2 cursor-pointer transition ${
                cuenta === 'Nina' 
                  ? 'border-primary bg-primary-container/50 text-on-surface font-bold'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-low'
              }`}>
                <input 
                  type="radio" 
                  name="cuenta" 
                  value="Nina" 
                  checked={cuenta === 'Nina'}
                  onChange={() => setCuenta('Nina')}
                  className="accent-primary"
                />
                <span className="text-xs">Nina</span>
              </label>
              <label className={`border rounded-xl p-3 flex items-center justify-center space-x-2 cursor-pointer transition ${
                cuenta === 'Nando' 
                  ? 'border-warning bg-warning-container/50 text-on-warning-container font-bold'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-low'
              }`}>
                <input 
                  type="radio" 
                  name="cuenta" 
                  value="Nando" 
                  checked={cuenta === 'Nando'}
                  onChange={() => setCuenta('Nando')}
                  className="accent-warning"
                />
                <span className="text-xs">Nando</span>
              </label>
            </div>
          </div>

          {/* Contact (Debtor) Name */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Nombre del Solicitante / Cliente
            </label>
            <input 
              type="text"
              placeholder="Ej. Juan Pérez o Tía María"
              list="df-known-contacts"
              autoComplete="off"
              value={contacto}
              onChange={(e) => {
                setContacto(e.target.value);
                setContactoTouched(true);
              }}
              onBlur={() => setContactoTouched(true)}
              className={`w-full px-4 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 transition ${
                contactoTouched
                  ? isContactoValid 
                    ? 'border-success focus:ring-success/20' 
                    : 'border-error focus:ring-error/20'
                  : 'border-outline-variant focus:ring-primary/10'
              }`}
              required
            />
            <datalist id="df-known-contacts">
              {knownContacts.map(c => <option key={c} value={c} />)}
            </datalist>
            {contactoTouched && !isContactoValid && (
              <span className="text-[11px] text-error mt-1 block">El nombre debe poseer al menos 2 caracteres.</span>
            )}
          </div>

          {/* Loan value */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Monto del Préstamo ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-outline font-bold">$</span>
              <input 
                type="number"
                step="0.01"
                min="0.01"
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
              <span className="text-[11px] text-error mt-1 block">Por favor, introduce un monto válido superior a 0.</span>
            )}

            {/* Live credit limit indicator */}
            {limitCheck && limitCheck.isExceeded && (
              <div className="bg-error-container border border-error/40 text-on-error-container rounded-xl p-3.5 mt-2.5 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-on-error-container">
                  <AlertTriangle className="h-4 w-4 text-error shrink-0" />
                  <span>¡Alerta: Límite de Crédito Superado!</span>
                </div>
                <p className="text-[11px] font-normal leading-relaxed text-on-error-container">
                  {contacto.trim()} tiene un límite de <strong>${limitCheck.limit}</strong>. Su deuda activa actual es <strong>${limitCheck.currentOutstanding}</strong> y ascendería a <strong>${limitCheck.totalEstimated}</strong>, superando el límite por <strong>${limitCheck.exceededBy.toFixed(0)}</strong>.
                </p>
              </div>
            )}
            {limitCheck && !limitCheck.isExceeded && (
              <div className="bg-success-container border border-success/40 text-on-success-container rounded-xl p-3 mt-2.5 flex items-center justify-between text-[11px]">
                <span className="font-medium text-on-success-container">Cupo de crédito disponible:</span>
                <span className="tabular-nums font-bold text-on-success-container">${(limitCheck.limit - limitCheck.currentOutstanding - limitCheck.newLoanAmount).toFixed(0)} de ${limitCheck.limit}</span>
              </div>
            )}
          </div>

          {/* Month Target and Exchange Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                MES DE PAGO
              </label>
              <input 
                type="month"
                value={mesPago}
                onChange={(e) => {
                  setMesPago(e.target.value);
                  setMesTouched(true);
                }}
                className={`w-full px-4 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none bg-surface-lowest`}
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                  TASA
                </label>
                <button
                  type="button"
                  onClick={() => loadBcvRate(true)}
                  disabled={loadingBcv}
                  className="text-[11px] text-on-surface hover:text-on-primary-container font-semibold flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Recargar tasa oficial del Banco Central de Venezuela"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingBcv ? 'animate-spin' : ''}`} />
                  <span>BCV</span>
                </button>
              </div>
              <input 
                type="number"
                step="0.0001"
                min="0.0001"
                value={tasaCambio}
                onChange={(e) => {
                  setTasaCambio(e.target.value);
                  setTasaTouched(true);
                }}
                className={`w-full px-4 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 transition ${
                  tasaTouched && !isTasaValid ? 'border-error' : 'border-outline-variant'
                }`}
                required
              />
              <div className="mt-1 flex items-center justify-between text-[11px] min-h-[14px]">
                {loadingBcv ? (
                  <span className="text-primary font-bold animate-pulse flex items-center">
                    Cargando BCV...
                  </span>
                ) : bcvRate ? (
                  <span className="text-on-success-container font-bold flex items-center">
                    BCV: {bcvRate.toFixed(4)}
                    {parseFloat(tasaCambio) !== bcvRate && (
                      <button
                        type="button"
                        onClick={() => setTasaCambio(bcvRate.toFixed(4))}
                        className="ml-1 text-on-surface hover:underline font-semibold cursor-pointer"
                      >
                        (Usar)
                      </button>
                    )}
                  </span>
                ) : fetchError ? (
                  <span className="text-on-warning-container font-bold">
                    Error BCV. Ingresa manual.
                  </span>
                ) : (
                  <span className="text-outline font-medium">Tasa referencial</span>
                )}
              </div>
            </div>
          </div>

          {/* Registration Date */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Fecha de Registro
            </label>
            <input 
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-xs sm:text-sm focus:outline-none"
              required
            />
          </div>

          {/* Tag */}
          <fieldset>
            <legend className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Etiqueta</legend>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 10).map(t => {
                const selected = normalizeTag(tipo) === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTipo(t)}
                    className={`m3-state h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer border ${
                      selected ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline-variant text-on-surface-variant'
                    }`}
                  >
                    {selected ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="h-2 w-2 rounded-full" style={{ background: tagColorVar(t) }} aria-hidden="true" />}
                    {tagLabel(t)}
                  </button>
                );
              })}
              {addingTag ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    autoFocus
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (normalizeTag(newTag)) setTipo(normalizeTag(newTag));
                        setNewTag(''); setAddingTag(false);
                      }
                    }}
                    onBlur={() => {
                      if (normalizeTag(newTag)) setTipo(normalizeTag(newTag));
                      setNewTag(''); setAddingTag(false);
                    }}
                    placeholder="Nueva etiqueta"
                    maxLength={24}
                    className="h-8 w-36 px-3 rounded-lg border border-primary bg-surface-lowest text-sm focus:outline-none"
                  />
                </span>
              ) : (
                <button type="button" onClick={() => setAddingTag(true)} className="m3-state h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1 cursor-pointer text-primary">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Nueva
                </button>
              )}
            </div>
          </fieldset>

          {/* Description Concept */}
          <div>
            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Concepto / Notas específicas
            </label>
            <textarea 
              rows={2}
              placeholder="Ej. Compra de refacciones para taller o gastos escolares"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/10 resize-none transition"
            />
          </div>

          {/* Action keys */}
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
              disabled={!isFormValid}
              className="flex-1 bg-inverse-surface focus:opacity-90 disabled:opacity-50 text-inverse-on-surface py-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-1 cursor-pointer shadow-sm shadow-shadow"
            >
              <span>Guardar Préstamo</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
