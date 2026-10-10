import { useFocusTrap } from '../hooks/useFocusTrap';
import { AccountChip, accountTone, useAccounts } from './ui';
import { useState, useEffect, useMemo } from 'react';
import { Debt, Payment } from '../types';
import { formatMonthName } from '../utils/storage';
import { Search, X, ClipboardList, Plus, TrendingUp, Clock, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  deudas: Debt[];
  pagos: Payment[];
  onOpenDetails: (id: string) => void;
  onOpenNewDebt: () => void;
  onNavigateTab?: (tab: 'resumen' | 'deudas' | 'movimientos' | 'config') => void;
  onToggleAccountView?: (view: string) => void;
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
  const accounts = useAccounts();
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

  const chip = 'm3-state h-8 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-sm font-medium inline-flex items-center gap-2 cursor-pointer';

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
          {/* Search bar */}
          <div className="h-16 pl-5 pr-2 border-b border-outline-variant flex items-center gap-3 shrink-0">
            <Search className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden="true" />
            <input
              type="search"
              autoFocus
              aria-label="Buscar"
              placeholder="Buscar cliente o concepto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-base text-on-surface focus:outline-none placeholder:text-on-surface-variant"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
                className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar búsqueda"
              className="m3-state h-10 px-3 rounded-full text-on-surface-variant text-sm font-semibold cursor-pointer shrink-0"
            >
              Esc
            </button>
          </div>

          {/* Quick actions */}
          <div className="px-4 py-3 border-b border-outline-variant flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { onClose(); onOpenNewDebt(); }}
              className="m3-state h-8 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo préstamo
            </button>
            <button type="button" onClick={() => { onClose(); onNavigateTab?.('resumen'); }} className={chip}>
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              Resumen
            </button>
            <button type="button" onClick={() => { onClose(); onNavigateTab?.('deudas'); }} className={chip}>
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
              Ver préstamos
            </button>
            <button type="button" onClick={() => { onClose(); onNavigateTab?.('movimientos'); }} className={chip}>
              <ArrowRightLeft className="h-4 w-4 text-primary" aria-hidden="true" />
              Historial de abonos
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto py-2">
            <h3 className="px-5 pt-1 pb-2 text-sm font-semibold text-on-surface-variant">
              {query ? `Resultados coincidentes (${matchingDebts.length})` : 'Préstamos recientes'}
            </h3>

            {matchingDebts.length > 0 ? (
              <ul>
                {matchingDebts.map(debt => {
                  const pending = debt.estado === 'pendiente';
                  return (
                    <li key={debt.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenDetails(debt.id);
                        }}
                        className="m3-state w-full px-5 py-3 flex items-center gap-3 text-left cursor-pointer"
                      >
                        <span
                          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${pending ? 'bg-surface-container text-on-surface-variant' : 'bg-success-container text-on-success-container'}`}
                          aria-hidden="true"
                        >
                          {pending ? <Clock className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold text-on-surface truncate">{debt.contacto}</span>
                            <AccountChip cuenta={debt.cuenta} />
                          </span>
                          <span className="block text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                            {debt.descripcion || 'Sin nota'} · Vence: {formatMonthName(debt.mesPago)}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-bold text-on-surface tabular-nums">
                            {formatValue(debt.monto)}
                          </span>
                          <span className={`block text-xs font-semibold tabular-nums ${debt.saldo > 0 ? 'text-error' : 'text-success'}`}>
                            {debt.saldo > 0 ? `Saldo: ${formatValue(debt.saldo)}` : 'Saldado'}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-on-surface-variant">
                No se encontraron coincidencias para "{query}".
              </p>
            )}
          </div>

          {/* Account filter */}
          <div className="px-4 py-3 border-t border-outline-variant flex flex-wrap items-center justify-between gap-2 shrink-0">
            <span className="text-xs text-on-surface-variant">Filtrar vista global por:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { onToggleAccountView?.('Ambos'); onClose(); }}
                className="m3-state h-8 px-3 rounded-lg border border-outline-variant text-on-surface-variant text-sm font-medium cursor-pointer"
              >
                Ambos
              </button>
              {accounts.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onToggleAccountView?.(name); onClose(); }}
                  className={`m3-state h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer ${accountTone(name, accounts).container}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
