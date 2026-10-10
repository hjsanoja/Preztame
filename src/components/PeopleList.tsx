import { useMemo, useState } from 'react';
import { ChevronRight, Search, UsersRound } from 'lucide-react';
import { Debt, Payment } from '../types';
import { formatUsd } from '../lib/format';
import { PUNCTUALITY_LABEL, summarizePeople } from '../lib/people';
import { Avatar, PunctualityChip } from './ui';

interface PeopleListProps {
  deudas: Debt[];
  pagos: Payment[];
  accountView: string;
  onOpenPerson: (key: string) => void;
}

type Filter = 'deben' | 'vencidos' | 'todos';

// "Personas": everyone you have lent to, with what they owe and how they pay.
export default function PeopleList({ deudas, pagos, accountView, onOpenPerson }: PeopleListProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('deben');

  const people = useMemo(() => {
    const view = accountView === 'Ambos' ? deudas : deudas.filter(d => d.cuenta === accountView);
    return summarizePeople(view, pagos);
  }, [deudas, pagos, accountView]);

  const shown = people.filter(p =>
    (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())) &&
    (filter === 'todos' || (filter === 'deben' ? p.porCobrar > 0 : p.vencidos > 0))
  );

  return (
    <div className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Buscar persona</span>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar persona"
          className="w-full h-14 pl-12 pr-4 rounded-full bg-surface-high text-on-surface placeholder:text-on-surface-variant text-base focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {([['deben', 'Te deben'], ['vencidos', 'Con vencidos'], ['todos', 'Todas']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`m3-state h-8 px-3 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer border ${
              filter === value ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline-variant text-on-surface-variant'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <ul className="m3-card rounded-3xl divide-y divide-outline-variant/60 overflow-hidden">
          {shown.map(p => (
            <li key={p.key}>
              <button type="button" onClick={() => onOpenPerson(p.key)} className="m3-state w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer">
                <Avatar name={p.name} />
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-semibold truncate">{p.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
                    <PunctualityChip value={p.punctuality} label={PUNCTUALITY_LABEL[p.punctuality]} />
                    <span>{p.activos} activo{p.activos === 1 ? '' : 's'}{p.vencidos ? ` · ${p.vencidos} vencido${p.vencidos === 1 ? '' : 's'}` : ''}</span>
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-lg font-bold tabular-nums">{formatUsd(p.porCobrar)}</span>
                  <span className="block text-xs text-on-surface-variant">te debe</span>
                </span>
                <ChevronRight className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-outline-variant p-10 text-center space-y-2">
          <UsersRound className="h-10 w-10 mx-auto text-outline" aria-hidden="true" />
          <p className="text-base font-semibold">{people.length ? 'Nadie coincide' : 'Aún no hay personas'}</p>
          <p className="text-sm text-on-surface-variant">{people.length ? 'Prueba con otro filtro o nombre.' : 'Aparecerán aquí cuando registres préstamos.'}</p>
        </div>
      )}
    </div>
  );
}
