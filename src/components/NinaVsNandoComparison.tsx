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

  return (
    <div id="nina-vs-nando-comparison" className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-black text-slate-900 text-base">Comparativa Lado a Lado</h4>
            <p className="text-xs text-slate-500 font-medium">Balance operativo entre las cuentas de Nina y Nando</p>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            2 Cuentas Activas
          </span>
        </div>

        {/* Side by Side Grid */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* Nina Column */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="font-black text-sm tracking-tight">Cuenta Nina</span>
              </div>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {accountStats.nina.count} activos
              </span>
            </div>

            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Saldo Exigible</span>
              <p className="text-xl font-black text-rose-400 font-mono mt-0.5">
                {formatValue(accountStats.nina.pendiente)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
              <div>
                <span className="text-slate-400 block font-medium">Otorgado</span>
                <span className="font-bold text-white font-mono">{formatValue(accountStats.nina.prestado)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Cobrado</span>
                <span className="font-bold text-emerald-400 font-mono">{formatValue(accountStats.nina.cobrado)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-1">
                <span>Tasa Cobro</span>
                <span className="text-emerald-400 font-mono">{Math.round(accountStats.nina.recovery)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full" style={{ width: `${Math.min(100, accountStats.nina.recovery)}%` }} />
              </div>
            </div>
          </div>

          {/* Nando Column */}
          <div className="bg-amber-500 text-white rounded-2xl p-4 shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-amber-600/80 pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-200" />
                <span className="font-black text-sm tracking-tight">Cuenta Nando</span>
              </div>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-600/60 text-white font-mono">
                {accountStats.nando.count} activos
              </span>
            </div>

            <div>
              <span className="text-[9px] font-bold text-amber-100 uppercase tracking-widest block">Saldo Exigible</span>
              <p className="text-xl font-black text-white font-mono mt-0.5">
                {formatValue(accountStats.nando.pendiente)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
              <div>
                <span className="text-amber-100 block font-medium">Otorgado</span>
                <span className="font-bold text-white font-mono">{formatValue(accountStats.nando.prestado)}</span>
              </div>
              <div>
                <span className="text-amber-100 block font-medium">Cobrado</span>
                <span className="font-bold text-white font-mono">{formatValue(accountStats.nando.cobrado)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-600/80">
              <div className="flex justify-between items-center text-[10px] text-amber-100 font-bold mb-1">
                <span>Tasa Cobro</span>
                <span className="text-white font-mono">{Math.round(accountStats.nando.recovery)}%</span>
              </div>
              <div className="w-full bg-amber-600/60 h-1.5 rounded-full overflow-hidden">
                <div className="bg-white h-full" style={{ width: `${Math.min(100, accountStats.nando.recovery)}%` }} />
              </div>
            </div>
          </div>

        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100 font-medium">
        💡 Visualiza el rendimiento y recuperación de capital de forma transparente e independiente.
      </p>
    </div>
  );
}
