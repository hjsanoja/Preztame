import { useMemo } from 'react';
import { Debt } from '../types';
import { formatUsd } from '../lib/format';
import { fromCents, toCents } from '../lib/money';
import { accountTone, useAccounts } from './ui';

// Side-by-side numbers for each person who uses the app.
export default function AccountsComparison({ deudas }: { deudas: Debt[] }) {
  const accounts = useAccounts();
  const stats = useMemo(() => accounts.map(name => {
    const own = deudas.filter(d => d.cuenta === name);
    const prestado = own.reduce((s, d) => s + toCents(d.monto), 0);
    const pendiente = own.reduce((s, d) => s + toCents(d.saldo), 0);
    return {
      name,
      activos: own.filter(d => d.estado === 'pendiente').length,
      prestado: fromCents(prestado),
      pendiente: fromCents(pendiente),
      cobrado: fromCents(prestado - pendiente),
      recovery: prestado > 0 ? ((prestado - pendiente) / prestado) * 100 : 0
    };
  }), [accounts, deudas]);

  return (
    <section className="m3-card rounded-3xl p-4 sm:p-6 flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold leading-tight">Por cuenta</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Cómo va cada persona que presta</p>
      </header>
      <div className={`grid gap-3 ${stats.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {stats.map(a => {
          const tone = accountTone(a.name, accounts);
          return (
            <div key={a.name} className={`rounded-2xl p-4 flex flex-col gap-3 ${tone.container}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold truncate">{a.name}</span>
                <span className="text-xs opacity-80 shrink-0">{a.activos} activo{a.activos === 1 ? '' : 's'}</span>
              </div>
              <div>
                <p className="text-xs opacity-80">Por cobrar</p>
                <p className="text-2xl font-bold tabular-nums">{formatUsd(a.pendiente)}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div><dt className="opacity-80">Prestado</dt><dd className="font-semibold tabular-nums">{formatUsd(a.prestado)}</dd></div>
                <div><dt className="opacity-80">Cobrado</dt><dd className="font-semibold tabular-nums">{formatUsd(a.cobrado)}</dd></div>
              </dl>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="opacity-80">Recuperado</span><span className="font-semibold tabular-nums">{Math.round(a.recovery)}%</span></div>
                <div className="h-1.5 rounded-full bg-surface-lowest/60 overflow-hidden" role="progressbar" aria-valuenow={Math.round(a.recovery)} aria-valuemin={0} aria-valuemax={100} aria-label={`Recuperado ${a.name}`}>
                  <div className={`h-full rounded-full ${tone.dot}`} style={{ width: `${Math.min(100, a.recovery)}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
