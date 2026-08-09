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
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
        >
          {/* Search Input Bar */}
          <div className="p-4 border-b border-slate-100 flex items-center space-x-3 bg-slate-50/80">
            <Search className="h-5 w-5 text-blue-600 shrink-0" />
            <input 
              type="text" 
              autoFocus
              placeholder="Buscar cliente, concepto, creador o comando (Cmd+K)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 focus:outline-none placeholder:text-slate-400"
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 cursor-pointer text-xs font-bold"
            >
              Esc
            </button>
          </div>

          {/* Quick Actions Bar */}
          <div className="p-3 border-b border-slate-100 bg-slate-100/50 flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => { onClose(); onOpenNewDebt(); }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>+ Nuevo Préstamo</span>
            </button>
            <button
              onClick={() => { onClose(); onNavigateTab?.('resumen'); }}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
              <span>Resumen</span>
            </button>
            <button
              onClick={() => { onClose(); onNavigateTab?.('deudas'); }}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer"
            >
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ver Préstamos</span>
            </button>
            <button
              onClick={() => { onClose(); onNavigateTab?.('movimientos'); }}
              className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-full flex items-center space-x-1.5 transition cursor-pointer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-purple-600" />
              <span>Historial Abonos</span>
            </button>
          </div>

          {/* Search Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
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
                  className="p-3 hover:bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${debt.estado === 'pendiente' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {debt.estado === 'pendiente' ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">
                          {debt.contacto}
                        </span>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          debt.cuenta === 'Nina' ? 'bg-slate-900 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {debt.cuenta}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {debt.descripcion || 'Sin nota'} • Vence: {formatMonthName(debt.mesPago)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-3">
                    <span className="font-black text-sm text-slate-900 font-mono block">
                      {formatValue(debt.monto)}
                    </span>
                    <span className={`text-[10px] font-bold block ${debt.saldo > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {debt.saldo > 0 ? `Saldo: ${formatValue(debt.saldo)}` : 'Saldado ✓'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                No se encontraron coincidencias para "{query}".
              </div>
            )}
          </div>

          {/* Quick Account Switcher Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Filtrar vista global por:</span>
            <div className="flex items-center space-x-1 font-bold">
              <button 
                onClick={() => { onToggleAccountView?.('Ambos'); onClose(); }}
                className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 cursor-pointer"
              >
                Ambos
              </button>
              <button 
                onClick={() => { onToggleAccountView?.('Nina'); onClose(); }}
                className="px-2.5 py-1 rounded-full bg-slate-900 text-white cursor-pointer"
              >
                Nina
              </button>
              <button 
                onClick={() => { onToggleAccountView?.('Nando'); onClose(); }}
                className="px-2.5 py-1 rounded-full bg-amber-500 text-white cursor-pointer"
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
