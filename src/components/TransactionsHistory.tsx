import React, { useMemo, useState } from 'react';
import { Debt, Payment } from '../types';
import { formatDateLabel, formatMonthName } from '../utils/storage';
import { Undo2, PlusCircle, ArrowUpRight, ArrowDownLeft, Receipt, Trash2, Search, Filter, BookOpen, DollarSign } from 'lucide-react';

interface TransactionsHistoryProps {
  deudas: Debt[];
  pagos: Payment[];
  accountView: 'Ambos' | 'Nina' | 'Nando';
  onDeleteDebt: (id: string) => void;
  onDeletePayment: (id: string) => void;
}

interface CombinedTransaction {
  type: 'deuda' | 'pago';
  id: string;
  fecha: string;
  cuenta: 'Nina' | 'Nando';
  contacto: string;
  concepto: string;
  monto: number;
  registradoPor: string;
}

export default function TransactionsHistory({
  deudas,
  pagos,
  accountView,
  onDeleteDebt,
  onDeletePayment
}: TransactionsHistoryProps) {

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'deuda' | 'pago'>('todos');

  const formatValue = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  // Compile full chronologically combined transaction records
  const unifiedTransactions = useMemo(() => {
    const list: CombinedTransaction[] = [];

    // 1. Add debts as disbursements/outflows
    deudas.forEach(d => {
      // Filter by accountView
      if (accountView !== 'Ambos' && d.cuenta !== accountView) return;

      list.push({
        type: 'deuda',
        id: d.id,
        fecha: d.fecha,
        cuenta: d.cuenta,
        contacto: d.contacto,
        concepto: `Desembolso préstamo (Mes: ${formatMonthName(d.mesPago)}). Nota: ${d.descripcion || 'Sin concepto'}`,
        monto: d.monto,
        registradoPor: d.creadoPor || "Desconocido"
      });
    });

    // 2. Add payments as recovery receipts/inflows
    pagos.forEach(p => {
      const parent = deudas.find(d => d.id === p.deudaId);
      if (!parent) return;

      // Filter by accountView
      if (accountView !== 'Ambos' && parent.cuenta !== accountView) return;

      list.push({
        type: 'pago',
        id: p.id,
        fecha: p.fecha,
        cuenta: parent.cuenta,
        contacto: parent.contacto,
        concepto: `Abono de capital recibido. Nota: ${p.nota || 'Sin nota de abono'}`,
        monto: p.monto,
        registradoPor: p.registradoPor || "Desconocido"
      });
    });

    // Sort descending by date, secondary by ID
    list.sort((a, b) => {
      const dateDiff = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    });

    return list;
  }, [deudas, pagos, accountView]);

  // Apply search and type filters
  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter(t => {
      // Filter by transaction type
      if (typeFilter !== 'todos' && t.type !== typeFilter) return false;

      // Filter by text search (name, concept, operator)
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const matchesContact = t.contacto.toLowerCase().includes(query);
        const matchesConcept = t.concepto.toLowerCase().includes(query);
        const matchesOperator = t.registradoPor.toLowerCase().includes(query);
        return matchesContact || matchesConcept || matchesOperator;
      }

      return true;
    });
  }, [unifiedTransactions, search, typeFilter]);

  // Dynamic calculations on filtered list
  const auditTotals = useMemo(() => {
    let prestado = 0;
    let cobrado = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'deuda') {
        prestado += t.monto;
      } else {
        cobrado += t.monto;
      }
    });
    return {
      prestado,
      cobrado,
      neto: cobrado - prestado
    };
  }, [filteredTransactions]);

  const handleDeleteTransaction = (t: CombinedTransaction) => {
    const isDeuda = t.type === 'deuda';
    const confirmMessage = isDeuda 
      ? `¿Estás seguro de que deseas eliminar este préstamo original por ${formatValue(t.monto)} a favor de ${t.contacto}?\n\n¡ADVERTENCIA! Se borrarán también todos los abonos o pagos asociados de forma permanente.`
      : `¿Deseas anular y descontar este abono de capital por ${formatValue(t.monto)} recibido de ${t.contacto}?`;

    if (window.confirm(confirmMessage)) {
      if (isDeuda) {
        onDeleteDebt(t.id);
      } else {
        onDeletePayment(t.id);
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info Banner */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
        <h4 className="font-bold text-[#040d53] text-lg">Historial de Movimientos</h4>
        <p className="text-xs text-slate-500 mt-1">
          Auditoría de todos los desembolsos de capital y cobros realizados. Los cambios realizados se sincronizan en tiempo real.
        </p>
      </div>

      {/* Dynamic Filter & Search Toolbar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Text Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por cliente, nota o registrado por..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-[#e2e8f0] rounded-xl focus:outline-none focus:border-[#040d53] focus:ring-1 focus:ring-[#040d53]"
            />
          </div>

          {/* Type Filter Select */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="text-xs font-bold font-mono text-[#040d53] bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none cursor-pointer min-w-[150px]"
            >
              <option value="todos">Todos los Flujos</option>
              <option value="deuda">💸 Préstamos (Salidas)</option>
              <option value="pago">📈 Abonos (Entradas)</option>
            </select>
          </div>
        </div>

        {/* Audit mini totals badge */}
        <div className="bg-[#f3f3f6] border border-[#eeeef0] rounded-xl p-3 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-600 justify-between items-center">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>Capital Prestado: <strong className="text-[#ba1a1a] font-bold font-mono">{formatValue(auditTotals.prestado)}</strong></span>
            <span>Capital Recuperado: <strong className="text-[#2a6c00] font-bold font-mono">{formatValue(auditTotals.cobrado)}</strong></span>
            <span>Balance de Caja: <strong className={`font-mono font-bold ${auditTotals.neto >= 0 ? 'text-[#2a6c00]' : 'text-[#ba1a1a]'}`}>{auditTotals.neto >= 0 ? '+' : ''}{formatValue(auditTotals.neto)}</strong></span>
          </div>

          {(search !== '' || typeFilter !== 'todos') && (
            <button 
              onClick={() => { setSearch(''); setTypeFilter('todos'); }}
              className="text-[10px] text-[#040d53] hover:underline font-extrabold uppercase tracking-wider bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      </div>

      {/* MOBILE TIMELINE CARDS (Visible on small screens only) */}
      <div className="block md:hidden space-y-4">
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map(t => {
            const isDeuda = t.type === 'deuda';
            return (
              <div 
                key={`${t.type}-${t.id}`}
                id={`mobile-trans-${t.type}-${t.id}`}
                className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-[#040d53]/25"
              >
                {/* Visual Status Accent Indicator */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${isDeuda ? 'bg-[#ba1a1a]' : 'bg-[#70C145]'}`} />
                
                {/* Header Information */}
                <div className="pl-2 flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    {isDeuda ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[8px] font-black bg-rose-50 text-[#ba1a1a] border border-rose-100 uppercase tracking-widest">
                        Préstamo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[8px] font-black bg-emerald-50 text-[#2c7100] border border-[#a0f572]/40 uppercase tracking-widest">
                        Abono
                      </span>
                    )}

                    {t.cuenta === 'Nina' ? (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-sm bg-[#dfe0ff] text-[#071155] font-mono">
                        NINA
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-sm bg-amber-50 text-amber-800 font-mono border border-amber-100">
                        NANDO
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDateLabel(t.fecha)}
                  </span>
                </div>

                {/* Content details */}
                <div className="pl-2 my-2.5">
                  <h5 className="font-extrabold text-slate-900 text-sm">{t.contacto}</h5>
                  <p className="text-[11px] text-slate-500 font-normal mt-1 leading-relaxed">
                    {t.concepto}
                  </p>
                </div>

                {/* Footer and Money flow */}
                <div className="pl-2 pt-3 border-t border-slate-150 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-450 uppercase tracking-wider font-semibold block">Registrado por</span>
                    <span className="text-xs font-bold text-slate-600">{t.registradoPor}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`text-base font-black font-mono ${isDeuda ? 'text-[#ba1a1a]' : 'text-[#2a6c00]'}`}>
                      {isDeuda ? '-' : '+'}{formatValue(t.monto)}
                    </span>

                    <button
                      onClick={() => handleDeleteTransaction(t)}
                      className="p-1.5 text-slate-450 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-all active:scale-95"
                      title={isDeuda ? "Eliminar este préstamo" : "Deshacer este abono"}
                    >
                      {isDeuda ? <Trash2 className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        ) : (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center text-slate-450 text-xs font-semibold">
            No se encontraron movimientos registrados con los filtros aplicados.
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (Hidden on mobile) */}
      <div className="hidden md:block bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className="bg-[#f3f3f6] border-b border-[#e2e8f0] text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Fecha</th>
                <th className="py-4 px-6">Cuenta</th>
                <th className="py-4 px-6">Tipo Flujo</th>
                <th className="py-4 px-6">Cliente</th>
                <th className="py-4 px-6">Concepto / Nota</th>
                <th className="py-4 px-6">Importe</th>
                <th className="py-4 px-6">Confirmado por</th>
                <th className="py-4 px-6 text-center">Deshacer</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(t => {
                  const isDeuda = t.type === 'deuda';
                  return (
                    <tr 
                      key={`${t.type}-${t.id}`}
                      className="hover:bg-slate-50/50 transition-colors duration-150 text-slate-700"
                    >
                      {/* Date */}
                      <td className="py-4 px-6 font-mono font-medium text-slate-500">
                        {formatDateLabel(t.fecha)}
                      </td>

                      {/* Account indicator Badge */}
                      <td className="py-4 px-6">
                        {t.cuenta === 'Nina' ? (
                          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 text-[#040d53] border border-indigo-100">
                            Nina
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-amber-50 text-amber-800 border border-amber-100">
                            Nando
                          </span>
                        )}
                      </td>

                      {/* Movement Flow Category badge */}
                      <td className="py-4 px-6">
                        {isDeuda ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-[#ba1a1a] border border-rose-100 uppercase">
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                            Prestado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#a0f572]/20 text-[#2c7100] border border-[#a0f572] uppercase">
                            <ArrowDownLeft className="h-3 w-3 mr-1" />
                            Cobrado
                          </span>
                        )}
                      </td>

                      {/* Debtor client */}
                      <td className="py-4 px-6 font-bold text-slate-800">
                        {t.contacto}
                      </td>

                      {/* Description notes */}
                      <td 
                        className="py-4 px-6 text-slate-500 max-w-xs truncate" 
                        title={t.concepto}
                      >
                        {t.concepto}
                      </td>

                      {/* Flow value */}
                      <td className="py-4 px-6 font-semibold">
                        {isDeuda ? (
                          <span className="text-[#ba1a1a] font-extrabold">
                            - {formatValue(t.monto)}
                          </span>
                        ) : (
                          <span className="text-[#2a6c00] font-extrabold">
                            + {formatValue(t.monto)}
                          </span>
                        )}
                      </td>

                      {/* Operator Name */}
                      <td className="py-4 px-6 font-medium text-slate-500">
                        {t.registradoPor}
                      </td>

                      {/* Undo Trigger Button */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleDeleteTransaction(t)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 transition cursor-pointer"
                          title={isDeuda ? "Eliminar este préstamo" : "Deshacer este abono"}
                        >
                          {isDeuda ? <Trash2 className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No se han encontrado movimientos para la búsqueda indicada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
