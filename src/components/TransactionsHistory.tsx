import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Search, Trash2, Undo2, X } from 'lucide-react';
import { Debt, Payment } from '../types';
import { formatDateLabel, formatMonthName } from '../utils/storage';
import { formatUsd, formatVes } from '../lib/format';
import { addMoney, subMoney } from '../lib/money';
import { AccountChip, FilterChip } from './ui';

interface TransactionsHistoryProps {
  deudas: Debt[];
  pagos: Payment[];
  accountView: string;
  onDeleteDebt: (id: string) => void;
  onDeletePayment: (id: string) => void;
  onOpenDebt?: (id: string) => void;
}

interface Movement {
  type: 'deuda' | 'pago';
  id: string;
  debtId: string;
  fecha: string;
  cuenta: string;
  contacto: string;
  nota: string;
  monto: number;
  montoBs?: number;
  registradoPor: string;
}

type TypeFilter = 'todos' | 'deuda' | 'pago';
const TYPE_CHIPS: [TypeFilter, string][] = [['todos', 'Todos'], ['deuda', 'Préstamos'], ['pago', 'Abonos']];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "Movimientos": every loan handed out and every abono received, newest
// first and grouped by month.
export default function TransactionsHistory({ deudas, pagos, accountView, onDeleteDebt, onDeletePayment, onOpenDebt }: TransactionsHistoryProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');

  const movements = useMemo(() => {
    const byId = new Map(deudas.map(d => [d.id, d]));
    const visible = (cuenta: string) => accountView === 'Ambos' || cuenta === accountView;
    const list: Movement[] = [];
    deudas.forEach(d => {
      if (!visible(d.cuenta)) return;
      list.push({
        type: 'deuda', id: d.id, debtId: d.id, fecha: d.fecha, cuenta: d.cuenta, contacto: d.contacto,
        nota: [d.descripcion, `pago en ${formatMonthName(d.mesPago)}`].filter(Boolean).join(' · '),
        monto: d.monto, registradoPor: d.creadoPor
      });
    });
    pagos.forEach(p => {
      const parent = byId.get(p.deudaId);
      if (!parent || !visible(parent.cuenta)) return;
      list.push({
        type: 'pago', id: p.id, debtId: parent.id, fecha: p.fecha, cuenta: parent.cuenta, contacto: parent.contacto,
        nota: p.nota || parent.descripcion, monto: p.monto, montoBs: p.moneda === 'VES' ? p.montoBs : undefined,
        registradoPor: p.registradoPor
      });
    });
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  }, [deudas, pagos, accountView]);

  const filtered = useMemo(() => {
    const q = fold(search.trim());
    return movements.filter(m =>
      (typeFilter === 'todos' || m.type === typeFilter) &&
      (!q || fold(`${m.contacto} ${m.nota} ${m.registradoPor}`).includes(q))
    );
  }, [movements, search, typeFilter]);

  const totals = useMemo(() => {
    let prestado = 0;
    let cobrado = 0;
    filtered.forEach(m => { if (m.type === 'deuda') prestado = addMoney(prestado, m.monto); else cobrado = addMoney(cobrado, m.monto); });
    return { prestado, cobrado, neto: subMoney(cobrado, prestado) };
  }, [filtered]);

  const groups = useMemo(() => {
    const out: { mes: string; items: Movement[] }[] = [];
    filtered.forEach(m => {
      const mes = m.fecha.slice(0, 7);
      if (out[out.length - 1]?.mes !== mes) out.push({ mes, items: [] });
      out[out.length - 1].items.push(m);
    });
    return out;
  }, [filtered]);

  const anyFilter = search.trim() !== '' || typeFilter !== 'todos';
  const clear = () => { setSearch(''); setTypeFilter('todos'); };

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Buscar movimientos</span>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, nota o quién registró"
          className="w-full h-14 pl-12 pr-4 rounded-full bg-surface-high text-on-surface placeholder:text-on-surface-variant text-base focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [scrollbar-width:none]">
        {TYPE_CHIPS.map(([value, label]) => (
          <FilterChip key={value} selected={typeFilter === value} onClick={() => setTypeFilter(value)}>{label}</FilterChip>
        ))}
        {anyFilter && (
          <button type="button" onClick={clear} className="m3-state h-8 px-3 rounded-lg text-sm font-semibold text-primary inline-flex items-center gap-1 whitespace-nowrap cursor-pointer">
            <X className="h-4 w-4" /> Limpiar
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-container p-3 text-center">
        <div>
          <p className="text-xs text-on-surface-variant">Prestado</p>
          <p className="text-base sm:text-lg font-bold tabular-nums">{formatUsd(totals.prestado)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Cobrado</p>
          <p className="text-base sm:text-lg font-bold tabular-nums text-success">{formatUsd(totals.cobrado)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Balance</p>
          <p className={`text-base sm:text-lg font-bold tabular-nums ${totals.neto < 0 ? 'text-error' : 'text-success'}`}>
            {totals.neto > 0 ? '+' : ''}{formatUsd(totals.neto)}
          </p>
        </div>
      </div>
      <p className="text-sm text-on-surface-variant px-1" aria-live="polite">
        {filtered.length} movimiento{filtered.length === 1 ? '' : 's'}
      </p>

      {groups.length === 0 ? (
        <div className="m3-card rounded-3xl p-8 text-center text-sm text-on-surface-variant">
          {anyFilter ? 'Ningún movimiento coincide con la búsqueda.' : 'Todavía no hay movimientos.'}
        </div>
      ) : groups.map(g => (
        <section key={g.mes} aria-label={formatMonthName(g.mes)} className="space-y-2">
          <h3 className="text-sm font-semibold text-on-surface-variant px-1 capitalize">{formatMonthName(g.mes)}</h3>
          <ul className="m3-card rounded-3xl divide-y divide-outline-variant/60 overflow-hidden">
            {g.items.map(m => {
              const isLoan = m.type === 'deuda';
              return (
                <li key={`${m.type}-${m.id}`} className="flex items-center gap-3 pl-4 pr-2 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenDebt?.(m.debtId)}
                    disabled={!onOpenDebt}
                    className="m3-state flex-1 min-w-0 flex items-center gap-3 text-left rounded-2xl -my-1 -ml-2 p-2 cursor-pointer disabled:cursor-default"
                  >
                    <span className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${isLoan ? 'bg-surface-highest text-on-surface' : 'bg-success-container text-on-success-container'}`} aria-hidden="true">
                      {isLoan ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold truncate">{m.contacto}</span>
                        <AccountChip cuenta={m.cuenta} />
                      </span>
                      <span className="block text-xs text-on-surface-variant truncate">
                        {isLoan ? 'Préstamo' : 'Abono'}{m.nota ? ` · ${m.nota}` : ''}
                      </span>
                      <span className="block text-xs text-on-surface-variant">
                        {formatDateLabel(m.fecha)}{m.registradoPor ? ` · ${m.registradoPor}` : ''}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={`block font-bold tabular-nums ${isLoan ? 'text-on-surface' : 'text-success'}`}>
                        {isLoan ? '−' : '+'}{formatUsd(m.monto)}
                      </span>
                      {m.montoBs ? <span className="block text-xs text-on-surface-variant tabular-nums">{formatVes(m.montoBs)}</span> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (isLoan ? onDeleteDebt(m.id) : onDeletePayment(m.id))}
                    aria-label={isLoan ? `Eliminar el préstamo de ${m.contacto}` : `Anular el abono de ${m.contacto}`}
                    title={isLoan ? 'Eliminar préstamo' : 'Anular abono'}
                    className="m3-state h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error cursor-pointer"
                  >
                    {isLoan ? <Trash2 className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
