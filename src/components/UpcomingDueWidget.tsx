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
    <div id="upcoming-due-agenda" className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-base">Agenda de Próximos Vencimientos</h4>
              <p className="text-xs text-slate-500 font-medium">Cronograma inmediato de cobros recomendados</p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-mono">
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
                    isOverdue ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-100/60' :
                    isCurrent ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/60' :
                    'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isOverdue ? 'bg-rose-100 text-rose-700' :
                      isCurrent ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      <Clock className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-xs text-slate-900 group-hover:text-blue-600 transition">
                          {debt.contacto}
                        </span>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          debt.cuenta === 'Nina' ? 'bg-slate-900 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {debt.cuenta}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                        {isOverdue ? (
                          <strong className="text-rose-600 font-bold">¡Atrasado! ({formatMonthName(debt.mesPago)})</strong>
                        ) : isCurrent ? (
                          <strong className="text-amber-700 font-bold">Vence este mes ({formatMonthName(debt.mesPago)})</strong>
                        ) : (
                          <span>Vence: {formatMonthName(debt.mesPago)}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-black text-xs text-slate-900 font-mono block">
                      {formatValue(debt.monto)}
                    </span>
                    <span className="text-[10px] text-rose-600 font-extrabold font-mono block">
                      Saldo: {formatValue(debt.saldo)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs font-medium">
              🎉 No hay cobros urgentes ni vencidos en la agenda.
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100 font-medium">
        💡 Prioriza el contacto con clientes cuyos cobros estén señalados en rojo o amarillo.
      </p>
    </div>
  );
}
