import { useFocusTrap } from '../hooks/useFocusTrap';
import React, { useState, useEffect, useMemo } from 'react';
import { Debt, Payment } from '../types';
import { formatMonthName } from '../utils/storage';
import { Search, X, ClipboardList, DollarSign, User, TrendingUp, ChevronRight, Clock, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  deudas: Debt[];
  pagos: Payment[];
  onOpenDetails: (id: string) => void;
  onOpenNewDebt: () => void;
  onNavigateTab?: (tab: 'resumen' | 'deudas' | 'movimientos' | 'config') => void;
  onToggleAccountView?: (view: 'Ambos' | 'Nina' | 'Nando') => void;
}

export default function QuickSearchModal({
  isOpen,
  onClose,
  deudas,
  pagos,
  onOpenDetails,
  onOpenNewDebt,
  onNavigateTab,
  onToggleAccountView
}: QuickSearchModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [query, setQuery] = useState('');

  // Auto focus input when modal opens
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const formatValue = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  // Filter deudas matching query
  const matchingDebts = useMemo(() => {
    if (!query.trim()) return deudas.slice(0, 5); // Show latest 5 if empty
    const q = query.toLowerCase();
    return deudas.filter(d => 
      d.contacto.toLowerCase().includes(q) ||
      d.descripcion.toLowerCase().includes(q) ||
      d.cuenta.toLowerCase().includes(q) ||
      d.creadoPor.toLowerCase().includes(q) ||
      (d.mesPago && d.mesPago.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [deudas, query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-[calc(4rem+env(safe-area-inset-top))] sm:pt-4 bg-scrim/40" onClick={onClose}>
        <motion.div 
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Búsqueda rápida"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="bg-surface-high text-on-surface rounded-[28px] m3-elevation-3 w-full max-w-xl overflow-hidden flex flex-col max-h-[80dvh]"
        >
          {/* Search Input Bar */}
          <div className="p-4 border-b border-outline-variant flex items-center space-x-3 bg-surface-low/80">
            <Search className="h-5 w-5 text-primary shrink-0" />
            <input 
              type="search" 
              autoFocus
              aria-label="Buscar"
              placeholder="Buscar cliente o concepto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm sm:text-base font-medium text-on-surface focus:outline-none placeholder:text-outline"
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="p-1 hover:bg-surface-high rounded-full text-outline hover:text-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button 
              onClick={onClose}
              aria-label="Cerrar búsqueda"
              className="m3-state h-10 px-3 rounded-full text-on-surface-variant cursor-pointer text-xs font-bold"
            >
              Esc
            </button>
          </div>

          {/* Quick Actions Bar */}
          <div className="p-3 border-b border-outline-variant bg-surface-container/50 flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => { onClose(); onOpenNewDebt(); }}
              className="px-3 py-1.5 bg-primary hover:bg-primary text-on-primary font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>+ Nuevo Préstamo</span>
            </button>
            <button
              onClick={() => { onClose(); onNavigateTab?.('resumen'); }}
              className="px-3 py-1.5 bg-surface-lowest hover:bg-surface-high text-on-surface border border-outline-variant font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span>Resumen</span>
            </button>
            <button
              onClick={() => { onClose(); onNavigateTab?.('deudas'); }}
              className="px-3 py-1.5 bg-surface-lowest hover:bg-surface-high text-on-surface border border-outline-variant font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer"
            >
              <DollarSign className="h-3.5 w-3.5 text-success" />
              <span>Ver Préstamos</span>
            </button>
            <button
              onClick={() => { onClose(); onNavigateTab?.('movimientos'); }}
              className="px-3 py-1.5 bg-surface-lowest hover:bg-surface-high text-on-surface border border-outline-variant font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-tertiary" />
              <span>Historial Abonos</span>
            </button>
          </div>

          {/* Search Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
            <div className="text-[11px] font-bold text-outline uppercase tracking-wider px-2 pt-1">
              {query ? `Resultados Coincidentes (${matchingDebts.length})` : 'Préstamos Recientes'}
            </div>

            {matchingDebts.length > 0 ? (
              matchingDebts.map(debt => (
                <div
                  key={debt.id}
                  onClick={() => {
                    onClose();
                    onOpenDetails(debt.id);
                  }}
                  className="p-3 hover:bg-surface-low border border-outline-variant/60 rounded-2xl flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${debt.estado === 'pendiente' ? 'bg-error-container text-error' : 'bg-success-container text-success'}`}>
                      {debt.estado === 'pendiente' ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-on-surface group-hover:text-primary transition">
                          {debt.contacto}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          debt.cuenta === 'Nina' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-warning text-on-warning'
                        }`}>
                          {debt.cuenta}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                        {debt.descripcion || 'Sin nota'} • Vence: {formatMonthName(debt.mesPago)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="font-bold text-sm text-on-surface tabular-nums block">
                      {formatValue(debt.monto)}
                    </span>
                    <span className={`text-[11px] font-bold block ${debt.saldo > 0 ? 'text-error' : 'text-success'}`}>
                      {debt.saldo > 0 ? `Saldo: ${formatValue(debt.saldo)}` : 'Saldado ✓'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-outline text-xs font-medium">
                No se encontraron coincidencias para "{query}".
              </div>
            )}
          </div>

          {/* Quick Account Switcher Footer */}
          <div className="p-3 border-t border-outline-variant bg-surface-low flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-medium">Filtrar vista global por:</span>
            <div className="flex items-center space-x-1 font-bold">
              <button 
                onClick={() => { onToggleAccountView?.('Ambos'); onClose(); }}
                className="px-2.5 py-1 rounded-full bg-surface-lowest border border-outline-variant hover:bg-surface-container text-on-surface cursor-pointer"
              >
                Ambos
              </button>
              <button 
                onClick={() => { onToggleAccountView?.('Nina'); onClose(); }}
                className="px-2.5 py-1 rounded-full bg-inverse-surface text-inverse-on-surface cursor-pointer"
              >
                Nina
              </button>
              <button 
                onClick={() => { onToggleAccountView?.('Nando'); onClose(); }}
                className="px-2.5 py-1 rounded-full bg-warning text-on-warning cursor-pointer"
              >
                Nando
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
