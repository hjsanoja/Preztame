import React, { useMemo } from 'react';
import { Debt } from '../types';
import { formatMonthName } from '../utils/storage';
import { Calendar, Clock, AlertTriangle, CheckCircle2, ChevronRight, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';

interface UpcomingDueWidgetProps {
  deudas: Debt[];
  onOpenDetails: (id: string) => void;
}

export default function UpcomingDueWidget({ deudas, onOpenDetails }: UpcomingDueWidgetProps) {
  const formatValue = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const upcomingList = useMemo(() => {
    const active = deudas.filter(d => d.estado === 'pendiente');
    
    // Sort debts: overdue first, then current month, then upcoming
    return active.sort((a, b) => {
      const monthA = a.mesPago || a.fecha || '9999-99';
      const monthB = b.mesPago || b.fecha || '9999-99';
      return monthA.localeCompare(monthB);
    }).slice(0, 5); // top 5 immediate upcoming/overdue
  }, [deudas]);

  return (
    <div id="upcoming-due-agenda" className="bg-surface-lowest border border-outline-variant/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-warning-container text-warning border border-warning/40 rounded-xl shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-on-surface text-base">Agenda de Próximos Vencimientos</h4>
              <p className="text-xs text-on-surface-variant font-medium">Cronograma inmediato de cobros recomendados</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-warning-container text-on-warning-container tabular-nums">
            {upcomingList.length} Pendientes
          </span>
        </div>

        <div className="mt-4 space-y-2.5">
          {upcomingList.length > 0 ? (
            upcomingList.map(debt => {
              const dMonth = debt.mesPago ? debt.mesPago.slice(0, 7) : '';
              const isOverdue = dMonth && dMonth < todayStr;
              const isCurrent = dMonth === todayStr;

              return (
                <div 
                  key={debt.id}
                  onClick={() => onOpenDetails(debt.id)}
                  className={`p-3 border rounded-xl flex items-center justify-between transition cursor-pointer group ${
                    isOverdue ? 'bg-error-container/60 border-error/40 hover:bg-error-container/60' :
                    isCurrent ? 'bg-warning-container/60 border-warning/40 hover:bg-warning-container/60' :
                    'bg-surface-low/80 border-outline-variant/80 hover:bg-surface-container/80'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isOverdue ? 'bg-error-container text-on-error-container' :
                      isCurrent ? 'bg-warning-container text-on-warning-container' :
                      'bg-surface-high text-on-surface'
                    }`}>
                      <Clock className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-on-surface group-hover:text-primary transition">
                          {debt.contacto}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          debt.cuenta === 'Nina' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-warning text-on-warning'
                        }`}>
                          {debt.cuenta}
                        </span>
                      </div>

                      <p className="text-[11px] text-on-surface-variant font-medium line-clamp-1 mt-0.5">
                        {isOverdue ? (
                          <strong className="text-error font-bold">¡Atrasado! ({formatMonthName(debt.mesPago)})</strong>
                        ) : isCurrent ? (
                          <strong className="text-on-warning-container font-bold">Vence este mes ({formatMonthName(debt.mesPago)})</strong>
                        ) : (
                          <span>Vence: {formatMonthName(debt.mesPago)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs text-on-surface tabular-nums block">
                      {formatValue(debt.monto)}
                    </span>
                    <span className="text-[11px] text-error font-semibold tabular-nums block">
                      Saldo: {formatValue(debt.saldo)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-outline text-xs font-medium">
              🎉 No hay cobros urgentes ni vencidos en la agenda.
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-outline mt-3 pt-2 border-t border-outline-variant font-medium">
        💡 Prioriza el contacto con clientes cuyos cobros estén señalados en rojo o amarillo.
      </p>
    </div>
  );
}
