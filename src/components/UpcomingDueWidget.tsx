import { AccountChip } from './ui';
import { useMemo } from 'react';
import { Debt } from '../types';
import { formatMonthName } from '../utils/storage';
import { AlarmClock, CalendarClock, CalendarDays, CircleAlert, Lightbulb, PartyPopper } from 'lucide-react';

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
    <section id="upcoming-due-agenda" className="m3-card rounded-3xl p-5 flex flex-col justify-between" aria-labelledby="upcoming-due-title">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="h-10 w-10 rounded-full bg-warning-container text-on-warning-container flex items-center justify-center shrink-0" aria-hidden="true">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h4 id="upcoming-due-title" className="text-base font-semibold text-on-surface">Agenda de próximos vencimientos</h4>
              <p className="text-xs text-on-surface-variant">Cronograma inmediato de cobros recomendados</p>
            </div>
          </div>
          <span className="inline-flex items-center h-7 px-2.5 rounded-lg bg-secondary-container text-on-secondary-container text-xs font-semibold tabular-nums whitespace-nowrap shrink-0">
            {upcomingList.length} pendientes
          </span>
        </div>

        <ul className="mt-4 rounded-2xl border border-outline-variant divide-y divide-outline-variant/60 overflow-hidden">
          {upcomingList.length > 0 ? (
            upcomingList.map(debt => {
              const dMonth = debt.mesPago ? debt.mesPago.slice(0, 7) : '';
              const isOverdue = dMonth && dMonth < todayStr;
              const isCurrent = dMonth === todayStr;
              const Icon = isOverdue ? CircleAlert : isCurrent ? AlarmClock : CalendarDays;

              return (
                <li key={debt.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDetails(debt.id)}
                    className="m3-state w-full px-4 py-3 flex items-center gap-3 text-left cursor-pointer"
                  >
                    <span
                      className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                        isOverdue ? 'bg-error-container text-on-error-container' :
                        isCurrent ? 'bg-warning-container text-on-warning-container' :
                        'bg-surface-container text-on-surface-variant'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-on-surface truncate">{debt.contacto}</span>
                        <AccountChip cuenta={debt.cuenta} />
                      </span>
                      <span className="block text-xs line-clamp-1 mt-0.5">
                        {isOverdue ? (
                          <span className="text-error font-semibold">¡Atrasado! ({formatMonthName(debt.mesPago)})</span>
                        ) : isCurrent ? (
                          <span className="text-on-surface font-semibold">Vence este mes ({formatMonthName(debt.mesPago)})</span>
                        ) : (
                          <span className="text-on-surface-variant">Vence: {formatMonthName(debt.mesPago)}</span>
                        )}
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold text-on-surface tabular-nums">
                        {formatValue(debt.monto)}
                      </span>
                      <span className="block text-xs font-semibold text-error tabular-nums">
                        Saldo: {formatValue(debt.saldo)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          ) : (
            <li className="py-8 px-4 flex flex-col items-center gap-2 text-center text-sm text-on-surface-variant">
              <PartyPopper className="h-6 w-6" aria-hidden="true" />
              No hay cobros urgentes ni vencidos en la agenda.
            </li>
          )}
        </ul>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-on-surface-variant">
        <Lightbulb className="h-4 w-4 shrink-0" aria-hidden="true" />
        Prioriza el contacto con clientes cuyos cobros estén señalados en rojo o amarillo.
      </p>
    </section>
  );
}
