import React, { useState, useEffect } from 'react';
import { Debt } from '../types';
import { saveDraft, loadDraft, clearDraft } from '../utils/storage';
import { X, Calendar, DollarSign, ArrowUpRight, RefreshCw, Globe } from 'lucide-react';
import { fetchBCVExchangeRate } from '../utils/bcv';

interface DebtFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Debt, 'id' | 'saldo' | 'estado' | 'creadoPor'>) => void;
  activeUser: string;
}

export default function DebtFormModal({
  isOpen,
  onClose,
  onSubmit,
  activeUser
}: DebtFormModalProps) {

  // Primary state fields
  const [cuenta, setCuenta] = useState<'Nina' | 'Nando'>('Nina');
  const [contacto, setContacto] = useState('');
  const [monto, setMonto] = useState('');
  const [mesPago, setMesPago] = useState('');
  const [tasaCambio, setTasaCambio] = useState('1.0000');
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // BCV fetch and error states
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [loadingBcv, setLoadingBcv] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Validations feedback states
  const [contactoTouched, setContactoTouched] = useState(false);
  const [montoTouched, setMontoTouched] = useState(false);
  const [mesTouched, setMesTouched] = useState(false);
  const [tasaTouched, setTasaTouched] = useState(false);

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
        descripcion
      });
    }
  }, [cuenta, contacto, monto, mesPago, tasaCambio, fecha, descripcion, isOpen]);

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
      tipo: 'favor',
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
    setContactoTouched(false);
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
            <ArrowUpRight className="h-5 w-5 mr-1 text-[#ba1a1a]" />
            Registrar Nuevo Préstamo
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 overflow-y-auto pr-1 flex-grow scrollbar-thin">
          
          {/* Account owner */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Asignar a Cuenta de:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`border rounded-xl p-3 flex items-center justify-center space-x-2 cursor-pointer transition ${
                cuenta === 'Nina' 
                  ? 'border-[#040d53] bg-indigo-50/50 text-[#040d53] font-bold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
                <input 
                  type="radio" 
                  name="cuenta" 
                  value="Nina" 
                  checked={cuenta === 'Nina'}
                  onChange={() => setCuenta('Nina')}
                  className="accent-[#040d53]"
                />
                <span className="text-xs">Nina</span>
              </label>
              <label className={`border rounded-xl p-3 flex items-center justify-center space-x-2 cursor-pointer transition ${
                cuenta === 'Nando' 
                  ? 'border-amber-500 bg-amber-50/50 text-amber-800 font-bold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
                <input 
                  type="radio" 
                  name="cuenta" 
                  value="Nando" 
                  checked={cuenta === 'Nando'}
                  onChange={() => setCuenta('Nando')}
                  className="accent-amber-600"
                />
                <span className="text-xs">Nando</span>
              </label>
            </div>
          </div>

          {/* Contact (Debtor) Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Nombre del Solicitante / Cliente
            </label>
            <input 
              type="text"
              placeholder="Ej. Juan Pérez o Tía María"
              value={contacto}
              onChange={(e) => {
                setContacto(e.target.value);
                setContactoTouched(true);
              }}
              onBlur={() => setContactoTouched(true)}
              className={`w-full px-4 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 transition ${
                contactoTouched
                  ? isContactoValid 
                    ? 'border-emerald-500 focus:ring-emerald-500/20' 
                    : 'border-rose-500 focus:ring-rose-500/20'
                  : 'border-[#e2e8f0] focus:ring-[#040d53]/10'
              }`}
              required
            />
            {contactoTouched && !isContactoValid && (
              <span className="text-[10px] text-rose-600 mt-1 block">El nombre debe poseer al menos 2 caracteres.</span>
            )}
          </div>

          {/* Loan value */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Monto del Préstamo ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-bold">$</span>
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
                      ? 'border-emerald-500 focus:ring-emerald-500/20' 
                      : 'border-rose-500 focus:ring-rose-500/20'
                    : 'border-[#e2e8f0] focus:ring-[#040d53]/10'
                }`}
                required
              />
            </div>
            {montoTouched && !isMontoValid && (
              <span className="text-[10px] text-rose-600 mt-1 block">Por favor, introduce un monto válido superior a 0.</span>
            )}
          </div>

          {/* Month Target and Exchange Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                MES DE PAGO
              </label>
              <input 
                type="month"
                value={mesPago}
                onChange={(e) => {
                  setMesPago(e.target.value);
                  setMesTouched(true);
                }}
                className={`w-full px-4 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none bg-white`}
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  TASA
                </label>
                <button
                  type="button"
                  onClick={() => loadBcvRate(true)}
                  disabled={loadingBcv}
                  className="text-[10px] text-[#040d53] hover:text-indigo-800 font-extrabold flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
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
                className={`w-full px-4 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 transition ${
                  tasaTouched && !isTasaValid ? 'border-rose-500' : 'border-[#e2e8f0]'
                }`}
                required
              />
              <div className="mt-1 flex items-center justify-between text-[9px] min-h-[14px]">
                {loadingBcv ? (
                  <span className="text-indigo-600 font-bold animate-pulse flex items-center">
                    Cargando BCV...
                  </span>
                ) : bcvRate ? (
                  <span className="text-emerald-700 font-bold flex items-center">
                    BCV: {bcvRate.toFixed(4)}
                    {parseFloat(tasaCambio) !== bcvRate && (
                      <button
                        type="button"
                        onClick={() => setTasaCambio(bcvRate.toFixed(4))}
                        className="ml-1 text-[#040d53] hover:underline font-extrabold cursor-pointer"
                      >
                        (Usar)
                      </button>
                    )}
                  </span>
                ) : fetchError ? (
                  <span className="text-amber-700 font-bold">
                    Error BCV. Ingresa manual.
                  </span>
                ) : (
                  <span className="text-slate-400 font-medium">Tasa referencial</span>
                )}
              </div>
            </div>
          </div>

          {/* Registration Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Fecha de Registro
            </label>
            <input 
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none"
              required
            />
          </div>

          {/* Description Concept */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Concepto / Notas específicas
            </label>
            <textarea 
              rows={2}
              placeholder="Ej. Compra de refacciones para taller o gastos escolares"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 resize-none transition"
            />
          </div>

          {/* Action keys */}
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
              disabled={!isFormValid}
              className="flex-1 bg-indigo-900 focus:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-1 cursor-pointer shadow-sm shadow-indigo-100"
            >
              <span>Guardar Préstamo</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
