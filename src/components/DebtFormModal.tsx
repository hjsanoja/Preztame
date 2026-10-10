import { useFocusTrap } from '../hooks/useFocusTrap';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Debt } from '../types';
import { saveDraft, loadDraft, clearDraft } from '../utils/storage';
import { X, ArrowUpRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchBCVExchangeRate } from '../utils/bcv';
import { formatRate, presentRate, roundUpRate } from '../lib/rate';
import { formatUsd, localDay, nextMonthKey } from '../lib/format';
import { normalizeTag, tagColorVar, tagLabel, tagOptions } from '../lib/tags';
import { DebtChanges } from '../lib/ledger';
import { accountTone, useAccounts } from './ui';
import ClientPicker from './ClientPicker';
import { Check, Plus } from 'lucide-react';

interface DebtFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Debt, 'id' | 'saldo' | 'estado' | 'creadoPor'>) => void;
  // Edit mode: the loan being edited and where to send the changes.
  editing?: Debt | null;
  onUpdate?: (id: string, changes: DebtChanges) => void;
  // New loan for a known person (from their profile).
  initialContacto?: string;
  // Saved client list ("Clientes" sheet).
  clients?: string[];
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
  clientLimits,
  editing = null,
  onUpdate,
  initialContacto,
  clients
}: DebtFormModalProps) {
  const accounts = useAccounts();
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Primary state fields
  const [cuenta, setCuenta] = useState<string>('');
  const [contacto, setContacto] = useState('');
  const [monto, setMonto] = useState('');
  const [mesPago, setMesPago] = useState('');
  const [tasaCambio, setTasaCambio] = useState('1.00');
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

  // New loan over the client's credit limit: ask before saving.
  const [confirmOverLimit, setConfirmOverLimit] = useState(false);
  const montoRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLButtonElement>(null);

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
          // If the user hasn't customized the default 1.00 rate,
          // or if they clicked manual refresh, apply the fetched rate automatically.
          if (force || current === '1.00' || current === '1.0000' || current === '1' || current === '') {
            return presentRate(rate);
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
      const today = localDay();
      // New loans are usually paid the following month.
      const curMonth = nextMonthKey();
      
      // Default initial states
      setFecha(today);
      setMesPago(curMonth);
      setCuenta(accounts.includes(activeUser) ? activeUser : accounts[0] || activeUser);
      setTasaCambio('1.00');
      setBcvRate(null);
      setFetchError(false);
      setConfirmOverLimit(false);

      if (editing) {
        setCuenta(editing.cuenta);
        setContacto(editing.contacto);
        setMonto(String(editing.monto));
        setMesPago(editing.mesPago);
        setTasaCambio(String(editing.tasaCambio || 1));
        setFecha(editing.fecha);
        setDescripcion(editing.descripcion);
        setTipo(normalizeTag(editing.tipo) || 'favor');
        return;
      }

      // Attempt to load existing draft
      const draft = loadDraft("debt_draft");
      if (initialContacto) {
        setContacto(initialContacto);
      } else if (draft) {
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
  }, [isOpen, activeUser, editing, initialContacto]);

  // Autosave current inputs as draft
  useEffect(() => {
    if (isOpen && !editing && (contacto || monto || descripcion)) {
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

  // Move focus into the confirmation panel when it appears.
  useEffect(() => {
    if (confirmOverLimit) reviewRef.current?.focus();
  }, [confirmOverLimit]);

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
    // While the over-limit confirmation is showing, only its buttons decide.
    if (confirmOverLimit) return;
    if (!editing && limitCheck?.isExceeded) {
      setConfirmOverLimit(true);
      return;
    }
    save();
  };

  const reviewAmount = () => {
    setConfirmOverLimit(false);
    requestAnimationFrame(() => {
      montoRef.current?.focus();
      montoRef.current?.select();
    });
  };

  const save = () => {
    if (!isFormValid) return;
    setConfirmOverLimit(false);

    if (editing) {
      const next = {
        cuenta,
        contacto: contacto.trim(),
        monto: parseFloat(monto),
        tipo: normalizeTag(tipo) || 'favor',
        descripcion: descripcion.trim(),
        fecha,
        mesPago,
        tasaCambio: parseFloat(tasaCambio)
      };
      const changes: DebtChanges = {};
      (Object.keys(next) as (keyof typeof next)[]).forEach(k => {
        if (next[k] !== editing[k]) (changes as any)[k] = next[k];
      });
      if (Object.keys(changes).length) onUpdate?.(editing.id, changes);
      onClose();
      return;
    }

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

  const labelCls = 'block text-sm font-medium text-on-surface-variant mb-1.5';
  const inputCls = 'w-full h-12 px-4 rounded-xl border bg-surface-lowest text-on-surface text-base focus:outline-none focus:ring-2 transition';
  const okBorder = 'border-outline-variant focus:border-primary focus:ring-primary/20';
  const errBorder = 'border-error focus:border-error focus:ring-error/20';
  const clientName = contacto.trim();

  return (
    <div className="fixed inset-0 bg-scrim/40 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-form-title"
        className="bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] max-w-md w-full m3-elevation-3 flex flex-col max-h-[92dvh] animate-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mt-3 h-1 w-8 rounded-full bg-outline shrink-0" aria-hidden="true" />

        {/* Header */}
        <header className="flex items-center gap-3 px-6 pt-4 pb-2 shrink-0">
          <span className="h-10 w-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center shrink-0" aria-hidden="true">
            <ArrowUpRight className="h-5 w-5" />
          </span>
          <h2 id="debt-form-title" className="flex-1 min-w-0 text-2xl font-semibold leading-tight">
            {editing ? 'Editar préstamo' : 'Registrar nuevo préstamo'}
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
        <form onSubmit={handleSubmit} className="space-y-5 px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 overflow-y-auto flex-grow scrollbar-thin">
          
          {/* Account owner */}
          <div>
            <span className={labelCls}>Asignar a cuenta de</span>
            <div role="radiogroup" aria-label="Cuenta" className="flex flex-wrap gap-2">
              {accounts.map(name => {
                const selected = cuenta === name;
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCuenta(name)}
                    className={`m3-state h-10 px-4 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer border ${
                      selected ? `${accountTone(name, accounts).container} border-transparent` : 'border-outline text-on-surface-variant'
                    }`}
                  >
                    {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact (Debtor) Name */}
          <div>
            <span className={labelCls}>Cliente</span>
            <ClientPicker
              value={contacto}
              onChange={(v) => { setContacto(v); setContactoTouched(true); setConfirmOverLimit(false); }}
              // Only flag the name after something was typed, so the message
              // does not shift the form while tapping other fields.
              onBlur={() => { if (contacto.trim()) setContactoTouched(true); }}
              clients={clients ?? knownContacts}
              invalid={contactoTouched && !isContactoValid}
            />
            {contactoTouched && !isContactoValid && (
              <span className="text-xs text-error mt-1 px-4 block">El nombre debe poseer al menos 2 caracteres.</span>
            )}
          </div>

          {/* Loan value */}
          <div>
            <label htmlFor="debt-monto" className={labelCls}>
              Monto del préstamo ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-on-surface-variant" aria-hidden="true">$</span>
              <input 
                ref={montoRef}
                id="debt-monto"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value);
                  setMontoTouched(true);
                  setConfirmOverLimit(false);
                }}
                onBlur={() => { if (monto) setMontoTouched(true); }}
                aria-invalid={montoTouched && !isMontoValid}
                className={`${inputCls} pl-8 tabular-nums ${montoTouched && !isMontoValid ? errBorder : okBorder}`}
                required
              />
            </div>
            {montoTouched && !isMontoValid && (
              <span className="text-xs text-error mt-1 px-4 block">Por favor, introduce un monto válido superior a 0.</span>
            )}

            {/* Live credit limit indicator */}
            {limitCheck && limitCheck.isExceeded && !confirmOverLimit && (
              <div className="mt-3 rounded-2xl bg-error-container text-on-error-container p-4 flex gap-3 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold">Límite de crédito superado</p>
                  <p className="leading-relaxed">
                    {clientName} tiene un límite de <strong className="tabular-nums">{formatUsd(limitCheck.limit)}</strong>. Su deuda activa actual es <strong className="tabular-nums">{formatUsd(limitCheck.currentOutstanding)}</strong> y ascendería a <strong className="tabular-nums">{formatUsd(limitCheck.totalEstimated)}</strong>, superando el límite por <strong className="tabular-nums">{formatUsd(limitCheck.exceededBy)}</strong>.
                  </p>
                </div>
              </div>
            )}
            {limitCheck && !limitCheck.isExceeded && (
              <div className="mt-3 rounded-2xl bg-success-container text-on-success-container px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <span>Cupo de crédito disponible</span>
                <span className="tabular-nums font-semibold">{formatUsd(limitCheck.limit - limitCheck.currentOutstanding - limitCheck.newLoanAmount)} de {formatUsd(limitCheck.limit)}</span>
              </div>
            )}
          </div>

          {/* Month Target and Exchange Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="debt-mes" className={labelCls}>
                Mes de pago
              </label>
              <input 
                id="debt-mes"
                type="month"
                value={mesPago}
                onChange={(e) => {
                  setMesPago(e.target.value);
                  setMesTouched(true);
                }}
                className={`${inputCls} ${mesTouched && !isMesValid ? errBorder : okBorder}`}
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="debt-tasa" className="block text-sm font-medium text-on-surface-variant">
                  Tasa
                </label>
                <button
                  type="button"
                  onClick={() => loadBcvRate(true)}
                  disabled={loadingBcv}
                  className="m3-state -my-2 -mr-2 h-8 px-2 rounded-full text-sm text-primary font-semibold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  title="Recargar tasa oficial del Banco Central de Venezuela"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingBcv ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>BCV</span>
                </button>
              </div>
              <input 
                id="debt-tasa"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={tasaCambio}
                onChange={(e) => {
                  setTasaCambio(e.target.value);
                  setTasaTouched(true);
                }}
                aria-invalid={tasaTouched && !isTasaValid}
                className={`${inputCls} tabular-nums ${tasaTouched && !isTasaValid ? errBorder : okBorder}`}
                required
              />
            </div>
            <div className="col-span-2 -mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs min-h-6" aria-live="polite">
              {loadingBcv ? (
                <span className="text-on-surface-variant animate-pulse">
                  Cargando BCV...
                </span>
              ) : bcvRate ? (
                <>
                  <span className="text-on-surface-variant tabular-nums">BCV: {formatRate(bcvRate)}</span>
                  {tasaCambio !== formatRate(bcvRate) && (
                    <button
                      type="button"
                      onClick={() => setTasaCambio(formatRate(bcvRate))}
                      className="m3-state h-6 px-2 rounded-full text-primary font-semibold cursor-pointer"
                    >
                      (Usar)
                    </button>
                  )}
                  {tasaCambio !== formatRate(roundUpRate(bcvRate)) && (
                    <button
                      type="button"
                      onClick={() => setTasaCambio(formatRate(roundUpRate(bcvRate)))}
                      title="Redondear hacia arriba"
                      className="m3-state h-6 px-2.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold tabular-nums cursor-pointer"
                    >
                      ↑ {roundUpRate(bcvRate)}
                    </button>
                  )}
                </>
              ) : fetchError ? (
                <span className="text-error">
                  Error BCV. Ingresa manual.
                </span>
              ) : (
                <span className="text-on-surface-variant">Tasa referencial</span>
              )}
            </div>
          </div>

          {/* Registration Date */}
          <div>
            <label htmlFor="debt-fecha" className={labelCls}>
              Fecha de registro
            </label>
            <input 
              id="debt-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={`${inputCls} ${okBorder}`}
              required
            />
          </div>

          {/* Tag */}
          <fieldset>
            <legend className={labelCls}>Etiqueta</legend>
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
                      selected ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface-variant'
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
                    aria-label="Nueva etiqueta"
                    maxLength={24}
                    className="h-8 w-36 px-3 rounded-lg border border-primary bg-surface-lowest text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            <label htmlFor="debt-descripcion" className={labelCls}>
              Concepto / Notas específicas
            </label>
            <textarea 
              id="debt-descripcion"
              rows={2}
              placeholder="Ej. Compra de refacciones para taller o gastos escolares"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border bg-surface-lowest text-on-surface text-base focus:outline-none focus:ring-2 resize-none transition ${okBorder}`}
            />
          </div>

          {/* Over-limit confirmation (new loans only) or action keys */}
          {confirmOverLimit && limitCheck?.isExceeded ? (
            <div role="alert" className="rounded-2xl bg-warning-container text-on-warning-container p-4 space-y-3 text-sm">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <p className="font-semibold">{clientName} superaría su límite de crédito</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <dt>Límite</dt>
                <dd className="text-right font-semibold tabular-nums">{formatUsd(limitCheck.limit)}</dd>
                <dt>Deuda actual</dt>
                <dd className="text-right font-semibold tabular-nums">{formatUsd(limitCheck.currentOutstanding)}</dd>
                <dt>Quedaría en</dt>
                <dd className="text-right font-semibold tabular-nums">{formatUsd(limitCheck.totalEstimated)}</dd>
                <dt>Excede por</dt>
                <dd className="text-right font-bold tabular-nums">{formatUsd(limitCheck.exceededBy)}</dd>
              </dl>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  ref={reviewRef}
                  type="button"
                  onClick={reviewAmount}
                  className="m3-state h-10 px-4 rounded-full border border-outline text-on-warning-container text-sm font-semibold cursor-pointer"
                >
                  Revisar monto
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="m3-state h-10 px-6 rounded-full bg-primary text-on-primary text-sm font-semibold cursor-pointer"
                >
                  Registrar de todos modos
                </button>
              </div>
            </div>
          ) : (
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
                disabled={!isFormValid}
                className="m3-state h-10 px-6 rounded-full bg-primary text-on-primary text-sm font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                {editing ? 'Guardar cambios' : 'Guardar préstamo'}
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
