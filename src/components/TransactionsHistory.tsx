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
      <div className="m3-card rounded-2xl p-5 shadow-xs">
        <h4 className="font-bold text-on-surface text-lg">Historial de Movimientos</h4>
        <p className="text-xs text-on-surface-variant mt-1">
          Auditoría de todos los desembolsos de capital y cobros realizados. Los cambios realizados se sincronizan en tiempo real.
        </p>
      </div>

      {/* Dynamic Filter & Search Toolbar */}
      <div className="m3-card rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Text Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-outline" />
            <input 
              type="text"
              placeholder="Buscar por cliente, nota o registrado por..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-outline-variant/80 rounded-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </div>

          {/* Type Filter Select */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-outline" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="text-xs font-bold tabular-nums text-on-primary-container bg-surface-low border border-outline-variant rounded-full py-2 px-3.5 focus:outline-none cursor-pointer min-w-[150px]"
            >
              <option value="todos">Todos los Flujos</option>
              <option value="deuda">💸 Préstamos (Salidas)</option>
              <option value="pago">📈 Abonos (Entradas)</option>
            </select>
          </div>
        </div>

        {/* Audit mini totals badge */}
        <div className="bg-surface-low/80 border border-outline-variant/60 rounded-xl p-3 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-on-surface-variant justify-between items-center">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>Capital Prestado: <strong className="text-error font-bold tabular-nums">{formatValue(auditTotals.prestado)}</strong></span>
            <span>Capital Recuperado: <strong className="text-success font-bold tabular-nums">{formatValue(auditTotals.cobrado)}</strong></span>
            <span>Balance de Caja: <strong className={`tabular-nums font-bold ${auditTotals.neto >= 0 ? 'text-success' : 'text-error'}`}>{auditTotals.neto >= 0 ? '+' : ''}{formatValue(auditTotals.neto)}</strong></span>
          </div>

          {(search !== '' || typeFilter !== 'todos') && (
            <button 
              onClick={() => { setSearch(''); setTypeFilter('todos'); }}
              className="text-[11px] text-primary hover:underline font-semibold uppercase tracking-wider bg-surface-lowest border border-outline-variant px-2.5 py-0.5 rounded-full shadow-2xs"
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
                className="bg-surface-lowest border border-outline-variant rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:border-primary/25"
              >
                {/* Visual Status Accent Indicator */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${isDeuda ? 'bg-error' : 'bg-success'}`} />
                
                {/* Header Information */}
                <div className="pl-2 flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    {isDeuda ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[8px] font-bold bg-error-container text-error border border-error/40 uppercase tracking-widest">
                        Préstamo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[8px] font-bold bg-success-container text-success border border-success-container/40 uppercase tracking-widest">
                        Abono
                      </span>
                    )}

                    {t.cuenta === 'Nina' ? (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-sm bg-primary-container text-on-primary-container tabular-nums">
                        NINA
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-sm bg-warning-container text-on-warning-container tabular-nums border border-warning/40">
                        NANDO
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-outline tabular-nums">
                    {formatDateLabel(t.fecha)}
                  </span>
                </div>

                {/* Content details */}
                <div className="pl-2 my-2.5">
                  <h5 className="font-semibold text-on-surface text-sm">{t.contacto}</h5>
                  <p className="text-[11px] text-on-surface-variant font-normal mt-1 leading-relaxed">
                    {t.concepto}
                  </p>
                </div>

                {/* Footer and Money flow */}
                <div className="pl-2 pt-3 border-t border-outline-variant flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold block">Registrado por</span>
                    <span className="text-xs font-bold text-on-surface-variant">{t.registradoPor}</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`text-base font-bold tabular-nums ${isDeuda ? 'text-error' : 'text-success'}`}>
                      {isDeuda ? '-' : '+'}{formatValue(t.monto)}
                    </span>

                    <button
                      onClick={() => handleDeleteTransaction(t)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container border border-outline-variant rounded-lg transition-all active:scale-95"
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
          <div className="bg-surface-lowest border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant text-xs font-semibold">
            No se encontraron movimientos registrados con los filtros aplicados.
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (Hidden on mobile) */}
      <div className="hidden md:block bg-surface-lowest border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead className="bg-surface-container border-b border-outline-variant text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
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
            <tbody className="text-sm divide-y divide-outline-variant">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(t => {
                  const isDeuda = t.type === 'deuda';
                  return (
                    <tr 
                      key={`${t.type}-${t.id}`}
                      className="hover:bg-surface-low/50 transition-colors duration-150 text-on-surface"
                    >
                      {/* Date */}
                      <td className="py-4 px-6 tabular-nums font-medium text-on-surface-variant">
                        {formatDateLabel(t.fecha)}
                      </td>

                      {/* Account indicator Badge */}
                      <td className="py-4 px-6">
                        {t.cuenta === 'Nina' ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-primary-container text-on-surface border border-primary/40">
                            Nina
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-warning-container text-on-warning-container border border-warning/40">
                            Nando
                          </span>
                        )}
                      </td>

                      {/* Movement Flow Category badge */}
                      <td className="py-4 px-6">
                        {isDeuda ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-error-container text-error border border-error/40 uppercase">
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                            Prestado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-container/20 text-success border border-success-container uppercase">
                            <ArrowDownLeft className="h-3 w-3 mr-1" />
                            Cobrado
                          </span>
                        )}
                      </td>

                      {/* Debtor client */}
                      <td className="py-4 px-6 font-bold text-on-surface">
                        {t.contacto}
                      </td>

                      {/* Description notes */}
                      <td 
                        className="py-4 px-6 text-on-surface-variant max-w-xs truncate" 
                        title={t.concepto}
                      >
                        {t.concepto}
                      </td>

                      {/* Flow value */}
                      <td className="py-4 px-6 font-semibold">
                        {isDeuda ? (
                          <span className="text-error font-semibold">
                            - {formatValue(t.monto)}
                          </span>
                        ) : (
                          <span className="text-success font-semibold">
                            + {formatValue(t.monto)}
                          </span>
                        )}
                      </td>

                      {/* Operator Name */}
                      <td className="py-4 px-6 font-medium text-on-surface-variant">
                        {t.registradoPor}
                      </td>

                      {/* Undo Trigger Button */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleDeleteTransaction(t)}
                          className="text-outline hover:text-error p-1.5 rounded-lg border border-outline-variant hover:bg-error-container transition cursor-pointer"
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
                  <td colSpan={8} className="py-12 text-center text-outline">
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
