import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock } from 'lucide-react';
import { Debt } from '../types';
import { debtorsForMonth, monthKey } from '../lib/analytics';
import { formatUsd } from '../lib/format';
import { addMoney } from '../lib/money';
import { formatMonthName } from '../utils/storage';
import { Avatar } from './ui';

interface MonthDebtorsProps {
  deudas: Debt[];
  today: Date;
  onOpenPerson?: (name: string) => void;
  onOpenDetails: (id: string) => void;
}

const STATUS = {
  vencido: { label: 'Vencido', cls: 'bg-error-container text-on-error-container', Icon: CircleAlert },
  pendiente: { label: 'Pendiente', cls: 'bg-warning-container text-on-warning-container', Icon: Clock },
  pagado: { label: 'Pagado', cls: 'bg-success-container text-on-success-container', Icon: CheckCircle2 }
} as const;

const shift = (mes: string, delta: number) => {
  const [y, m] = mes.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

// "Deudores del mes": who has to pay in the chosen payment month.
export default function MonthDebtors({ deudas, today, onOpenPerson, onOpenDetails }: MonthDebtorsProps) {
  const [mes, setMes] = useState(() => monthKey(today));
  const [showPaid, setShowPaid] = useState(false);

  const months = useMemo(() => {
    const set = new Set(deudas.map(d => d.mesPago).filter(Boolean));
    set.add(monthKey(today));
    set.add(mes);
    return [...set].sort();
  }, [deudas, today, mes]);

  const all = useMemo(() => debtorsForMonth(deudas, mes, today), [deudas, mes, today]);
  const rows = showPaid ? all : all.filter(r => r.estado !== 'pagado');
  const totals = all.reduce((t, r) => ({ total: addMoney(t.total, r.total), cobrado: addMoney(t.cobrado, r.cobrado), pendiente: addMoney(t.pendiente, r.pendiente) }), { total: 0, cobrado: 0, pendiente: 0 });
  const paidCount = all.filter(r => r.estado === 'pagado').length;

  return (
    <section className="m3-card rounded-3xl p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-48">
          <h2 className="text-lg font-semibold leading-tight">Deudores del mes</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Quién tiene que pagarte según el mes de pago</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMes(m => shift(m, -1))} aria-label="Mes anterior" className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <label>
            <span className="sr-only">Mes de pago</span>
            <select value={mes} onChange={e => setMes(e.target.value)}
              className="h-10 px-3 rounded-full border border-outline-variant bg-surface-lowest text-sm font-semibold cursor-pointer focus:outline-none focus:border-primary">
              {months.map(m => <option key={m} value={m}>{formatMonthName(m)}{m === monthKey(today) ? ' (actual)' : ''}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setMes(m => shift(m, 1))} aria-label="Mes siguiente" className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-container p-3 text-center mb-3">
        <div><dt className="text-xs text-on-surface-variant">Vence</dt><dd className="text-base sm:text-lg font-bold tabular-nums">{formatUsd(totals.total)}</dd></div>
        <div><dt className="text-xs text-on-surface-variant">Cobrado</dt><dd className="text-base sm:text-lg font-bold tabular-nums text-success">{formatUsd(totals.cobrado)}</dd></div>
        <div><dt className="text-xs text-on-surface-variant">Falta</dt><dd className="text-base sm:text-lg font-bold tabular-nums">{formatUsd(totals.pendiente)}</dd></div>
      </dl>

      {rows.length > 0 ? (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm tabular-nums min-w-[520px]">
            <thead>
              <tr className="text-left text-xs text-on-surface-variant">
                <th className="py-2 px-4 sm:px-2 font-medium">Cliente</th>
                <th className="py-2 px-2 font-medium text-right">Monto</th>
                <th className="py-2 px-2 font-medium text-right">Cobrado</th>
                <th className="py-2 px-2 font-medium text-right">Debe</th>
                <th className="py-2 px-4 sm:px-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const st = STATUS[r.estado];
                return (
                  <tr key={r.key} className="border-t border-outline-variant/60">
                    <td className="py-2 px-4 sm:px-2">
                      <button type="button"
                        onClick={() => (onOpenPerson ? onOpenPerson(r.name) : onOpenDetails(r.debtIds[0]))}
                        className="m3-state -m-1 p-1 rounded-xl flex items-center gap-2 text-left cursor-pointer">
                        <Avatar name={r.name} size="sm" />
                        <span>
                          <span className="block font-semibold">{r.name}</span>
                          {r.debtIds.length > 1 && <span className="block text-xs text-on-surface-variant">{r.debtIds.length} préstamos</span>}
                        </span>
                      </button>
                    </td>
                    <td className="py-2 px-2 text-right">{formatUsd(r.total)}</td>
                    <td className="py-2 px-2 text-right text-success">{formatUsd(r.cobrado)}</td>
                    <td className="py-2 px-2 text-right font-bold">{formatUsd(r.pendiente)}</td>
                    <td className="py-2 px-4 sm:px-2">
                      <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold ${st.cls}`}>
                        <st.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-on-surface-variant py-4 text-center">
          {all.length ? 'Todos pagaron este mes. 🎉' : `Nadie tiene pagos para ${formatMonthName(mes)}.`}
        </p>
      )}

      {paidCount > 0 && (
        <button type="button" onClick={() => setShowPaid(v => !v)} className="m3-state mt-3 h-10 px-3 rounded-full text-sm font-semibold text-primary cursor-pointer">
          {showPaid ? 'Ocultar los que ya pagaron' : `Ver también los que ya pagaron (${paidCount})`}
        </button>
      )}
    </section>
  );
}
