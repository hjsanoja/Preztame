import React, { useState, useMemo } from 'react';
import { Debt } from '../types';
import { ArrowRightLeft, DollarSign, TrendingUp, Info, RefreshCw, Calculator, Sparkles } from 'lucide-react';

interface ExchangeRateCalculatorProps {
  deudas: Debt[];
}

export default function ExchangeRateCalculator({ deudas }: ExchangeRateCalculatorProps) {
  // Compute exchange rate stats from registered loans
  const rateStats = useMemo(() => {
    const validRates = deudas.map(d => d.tasaCambio).filter(r => r && r > 1);
    if (validRates.length === 0) {
      return {
        avgRate: 36.5,
        minRate: 36.5,
        maxRate: 36.5,
        latestRate: 36.5,
        totalConvertedVES: deudas.reduce((acc, d) => acc + (d.monto * (d.tasaCambio || 36.5)), 0)
      };
    }

    const sum = validRates.reduce((a, b) => a + b, 0);
    const avg = sum / validRates.length;
    const min = Math.min(...validRates);
    const max = Math.max(...validRates);
    const latest = validRates[0] || avg;

    const totalConvertedVES = deudas.reduce((acc, d) => acc + (d.monto * (d.tasaCambio || latest)), 0);

    return {
      avgRate: avg,
      minRate: min,
      maxRate: max,
      latestRate: latest,
      totalConvertedVES
    };
  }, [deudas]);

  // Calculator local state
  const [usdInput, setUsdInput] = useState<string>('100');
  const [customRate, setCustomRate] = useState<string>(rateStats.latestRate.toFixed(2));
  const [direction, setDirection] = useState<'USD_VES' | 'VES_USD'>('USD_VES');

  // Update custom rate if stats change and custom rate is untouched
  React.useEffect(() => {
    setCustomRate(rateStats.latestRate.toFixed(2));
  }, [rateStats.latestRate]);

  const numAmount = parseFloat(usdInput) || 0;
  const numRate = parseFloat(customRate) || 1;

  const convertedResult = useMemo(() => {
    if (direction === 'USD_VES') {
      return numAmount * numRate;
    } else {
      return numRate > 0 ? numAmount / numRate : 0;
    }
  }, [numAmount, numRate, direction]);

  const formatVES = (val: number) => {
    return `Bs. ${new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(val)}`;
  };

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div id="exchange-rate-calculator" className="bg-surface-lowest border border-outline-variant/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-tertiary-container text-tertiary border border-tertiary/40 rounded-xl shrink-0">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-on-surface text-base">Conversión y Tasas Cambiarias</h4>
              <p className="text-xs text-on-surface-variant font-medium">Historial de tasa USD / VES aplicada en préstamos</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-tertiary-container text-on-tertiary-container tabular-nums">
            Bs. {rateStats.latestRate.toFixed(2)}
          </span>
        </div>

        {/* Rate Metrics summary */}
        <div className="grid grid-cols-3 gap-2 my-4 bg-surface-low/80 p-3 rounded-xl border border-outline-variant text-center">
          <div>
            <span className="text-[11px] font-bold text-outline uppercase tracking-widest block">Tasa Prom.</span>
            <span className="text-xs font-bold text-on-surface tabular-nums">Bs. {rateStats.avgRate.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-outline uppercase tracking-widest block">Min. Tasa</span>
            <span className="text-xs font-bold text-on-success-container tabular-nums">Bs. {rateStats.minRate.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-outline uppercase tracking-widest block">Max. Tasa</span>
            <span className="text-xs font-bold text-on-tertiary-container tabular-nums">Bs. {rateStats.maxRate.toFixed(2)}</span>
          </div>
        </div>

        {/* Interactive Converter Form */}
        <div className="space-y-3 bg-tertiary-container/40 p-3.5 rounded-2xl border border-tertiary/80">
          <div className="flex items-center justify-between text-xs font-bold text-on-surface">
            <span>Calculadora {direction === 'USD_VES' ? 'Dólar ➔ Bolívar' : 'Bolívar ➔ Dólar'}</span>
            <button
              onClick={() => setDirection(prev => prev === 'USD_VES' ? 'VES_USD' : 'USD_VES')}
              className="text-[11px] text-on-tertiary-container hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowRightLeft className="h-3 w-3" />
              <span>Invertir</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-outline uppercase">
                {direction === 'USD_VES' ? 'Monto USD ($)' : 'Monto VES (Bs)'}
              </label>
              <input
                type="number"
                value={usdInput}
                onChange={(e) => setUsdInput(e.target.value)}
                className="w-full mt-0.5 px-3 py-1.5 border border-outline-variant rounded-xl text-xs tabular-nums font-bold bg-surface-lowest focus:outline-none focus:ring-2 focus:ring-tertiary/20"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-outline uppercase">Tasa (Bs/$)</label>
              <input
                type="number"
                step="0.1"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="w-full mt-0.5 px-3 py-1.5 border border-outline-variant rounded-xl text-xs tabular-nums font-bold bg-surface-lowest focus:outline-none focus:ring-2 focus:ring-tertiary/20"
              />
            </div>
          </div>

          {/* Result Box */}
          <div className="bg-surface-lowest p-3 rounded-xl border border-tertiary/80 flex justify-between items-center">
            <span className="text-xs font-bold text-on-surface-variant">Resultado Estimado:</span>
            <span className="text-sm font-bold text-on-tertiary-container tabular-nums">
              {direction === 'USD_VES' ? formatVES(convertedResult) : formatUSD(convertedResult)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-outline mt-3 pt-2 border-t border-outline-variant font-medium">
        💡 Registra la tasa cambiaria del día en cada préstamo para proteger el valor real de tu capital.
      </p>
    </div>
  );
}
