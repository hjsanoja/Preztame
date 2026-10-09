import React, { useMemo } from 'react';
import { Debt } from '../types';
import { User, Users, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

interface NinaVsNandoComparisonProps {
  deudas: Debt[];
}

export default function NinaVsNandoComparison({ deudas }: NinaVsNandoComparisonProps) {
  const accountStats = useMemo(() => {
    let ninaPrestado = 0;
    let ninaPendiente = 0;
    let ninaCount = 0;
    let ninaSaldadas = 0;

    let nandoPrestado = 0;
    let nandoPendiente = 0;
    let nandoCount = 0;
    let nandoSaldadas = 0;

    deudas.forEach(d => {
      if (d.cuenta === 'Nina') {
        ninaPrestado += d.monto;
        ninaPendiente += d.saldo;
        if (d.estado === 'pendiente') ninaCount++;
        else ninaSaldadas++;
      } else if (d.cuenta === 'Nando') {
        nandoPrestado += d.monto;
        nandoPendiente += d.saldo;
        if (d.estado === 'pendiente') nandoCount++;
        else nandoSaldadas++;
      }
    });

    const ninaCobrado = ninaPrestado - ninaPendiente;
    const nandoCobrado = nandoPrestado - nandoPendiente;

    const ninaRecovery = ninaPrestado > 0 ? (ninaCobrado / ninaPrestado) * 100 : 0;
    const nandoRecovery = nandoPrestado > 0 ? (nandoCobrado / nandoPrestado) * 100 : 0;

    const ninaAvg = ninaCount > 0 ? ninaPendiente / ninaCount : 0;
    const nandoAvg = nandoCount > 0 ? nandoPendiente / nandoCount : 0;

    return {
      nina: {
        prestado: ninaPrestado,
        pendiente: ninaPendiente,
        cobrado: ninaCobrado,
        count: ninaCount,
        saldadas: ninaSaldadas,
        recovery: ninaRecovery,
        avg: ninaAvg
      },
      nando: {
        prestado: nandoPrestado,
        pendiente: nandoPendiente,
        cobrado: nandoCobrado,
        count: nandoCount,
        saldadas: nandoSaldadas,
        recovery: nandoRecovery,
        avg: nandoAvg
      }
    };
  }, [deudas]);

  const formatValue = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  const accounts = [
    { name: 'Nina' as const, stats: accountStats.nina, cls: 'bg-nina-container text-on-nina-container', bar: 'bg-nina' },
    { name: 'Nando' as const, stats: accountStats.nando, cls: 'bg-nando-container text-on-nando-container', bar: 'bg-nando' }
  ];

  return (
    <section id="nina-vs-nando-comparison" className="m3-card rounded-3xl p-4 sm:p-6 flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold leading-tight">Nina y Nando</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Cómo va cada cuenta</p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {accounts.map(({ name, stats, cls, bar }) => (
          <div key={name} className={`rounded-2xl p-4 flex flex-col gap-3 ${cls}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold">{name}</span>
              <span className="text-xs opacity-80">{stats.count} activo{stats.count === 1 ? '' : 's'}</span>
            </div>
            <div>
              <p className="text-xs opacity-80">Por cobrar</p>
              <p className="text-2xl font-bold tabular-nums">{formatValue(stats.pendiente)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div><dt className="opacity-80">Prestado</dt><dd className="font-semibold tabular-nums">{formatValue(stats.prestado)}</dd></div>
              <div><dt className="opacity-80">Cobrado</dt><dd className="font-semibold tabular-nums">{formatValue(stats.cobrado)}</dd></div>
            </dl>
            <div>
              <div className="flex justify-between text-xs mb-1"><span className="opacity-80">Recuperado</span><span className="font-semibold tabular-nums">{Math.round(stats.recovery)}%</span></div>
              <div className="h-1.5 rounded-full bg-surface-lowest/60 overflow-hidden" role="progressbar" aria-valuenow={Math.round(stats.recovery)} aria-valuemin={0} aria-valuemax={100} aria-label={`Recuperado ${name}`}>
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, stats.recovery)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
