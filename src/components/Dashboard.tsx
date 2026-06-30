import React, { useState, useMemo } from 'react';
import { Debt, Payment, ChartDataPoint, ContactDataPoint } from '../types';
import { formatMonthName } from '../utils/storage';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { DollarSign, FileText, CheckCircle2, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface DashboardProps {
  deudas: Debt[];
  pagos: Payment[];
  accountView: 'Ambos' | 'Nina' | 'Nando';
  onOpenNewDebt: () => void;
}

export default function Dashboard({ deudas, pagos, accountView, onOpenNewDebt }: DashboardProps) {
  
  // Format currency helpers - No decimals as requested
  const formatValue = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
  };

  const formatVES = (num: number) => {
    const formattedVal = new Intl.NumberFormat('es-VE', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(num);
    return `Bs. ${formattedVal}`;
  };

  // Filtered lists based on primary filter
  const viewDeudas = useMemo(() => {
    return accountView === 'Ambos' ? deudas : deudas.filter(d => d.cuenta === accountView);
  }, [deudas, accountView]);

  const viewPagos = useMemo(() => {
    if (accountView === 'Ambos') return pagos;
    return pagos.filter(p => {
      const parent = deudas.find(d => d.id === p.deudaId);
      return parent && parent.cuenta === accountView;
    });
  }, [pagos, deudas, accountView]);

  // Unique target payment months from viewDeudas for dropdown selection
  const uniqueMonthsOfView = useMemo(() => {
    const list = [...new Set(viewDeudas.map(d => d.mesPago ? d.mesPago.slice(0, 7) : ''))].filter(Boolean).sort();
    return list;
  }, [viewDeudas]);

  // Setup selectedMonth state, defaulting to first available month or current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const todayStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const pendingList = viewDeudas.filter(d => d.estado === 'pendiente' && d.mesPago).map(d => d.mesPago.slice(0, 7));
    if (pendingList.length > 0) {
      // Find matching current month or oldest outstanding month
      const sortedPending = [...new Set(pendingList)].sort();
      if (sortedPending.includes(todayStr)) {
        return todayStr;
      }
      return sortedPending[0]; // first month with active debt
    }
    return todayStr;
  });

  // Calculate pending collection metrics for selectedMonth
  const monthlyMetrics = useMemo(() => {
    let mesPrestadoVal = 0;
    let mesPendienteVal = 0;
    let mesPendienteConvertidoVal = 0;
    let mesCountActivas = 0;

    viewDeudas.forEach(d => {
      const dMonth = d.mesPago ? d.mesPago.slice(0, 7) : '';
      if (dMonth === selectedMonth) {
        mesPrestadoVal += d.monto;
        mesPendienteVal += d.saldo;
        mesPendienteConvertidoVal += (d.saldo * d.tasaCambio);
        if (d.estado === 'pendiente') {
          mesCountActivas++;
        }
      }
    });

    return {
      prestado: mesPrestadoVal,
      pendiente: mesPendienteVal,
      pendienteConvertido: mesPendienteConvertidoVal,
      count: mesCountActivas
    };
  }, [viewDeudas, selectedMonth]);

  // Compute Core metrics
  const stats = useMemo(() => {
    let totalPrestadoVal = 0;
    let totalPendienteVal = 0;
    let prestadoConvertidoVal = 0;
    let pendienteConvertidoVal = 0;
    let countActivas = 0;
    let countSaldadas = 0;

    viewDeudas.forEach(d => {
      totalPrestadoVal += d.monto;
      totalPendienteVal += d.saldo;
      prestadoConvertidoVal += (d.monto * d.tasaCambio);
      pendienteConvertidoVal += (d.saldo * d.tasaCambio);

      if (d.estado === 'pendiente') {
        countActivas++;
      } else {
        countSaldadas++;
      }
    });

    const totalCobradoVal = totalPrestadoVal - totalPendienteVal;
    const cobradoConvertidoVal = prestadoConvertidoVal - pendienteConvertidoVal;
    const recoveryRate = totalPrestadoVal > 0 ? (totalCobradoVal / totalPrestadoVal) * 100 : 0;

    return {
      totalPrestado: totalPrestadoVal,
      totalPendiente: totalPendienteVal,
      totalCobrado: totalCobradoVal,
      prestadoConvertido: prestadoConvertidoVal,
      pendienteConvertido: pendienteConvertidoVal,
      cobradoConvertido: cobradoConvertidoVal,
      recoveryRate,
      countActivas,
      countSaldadas,
      totalRegistros: viewDeudas.length
    };
  }, [viewDeudas]);

  // Generate historical monthly trend chart data
  const monthlyData = useMemo(() => {
    const dataMap: { [key: string]: { prestado: number; saldo: number } } = {};
    
    viewDeudas.forEach(d => {
      // Ensure the key is exactly "YYYY-MM" (first 7 characters)
      const rawMonth = d.mesPago || d.fecha || '';
      const key = rawMonth.slice(0, 7) || 'Otros';
      if (!dataMap[key]) {
        dataMap[key] = { prestado: 0, saldo: 0 };
      }
      dataMap[key].prestado += d.monto;
      dataMap[key].saldo += d.saldo;
    });

    const sortedKeys = Object.keys(dataMap).filter(k => k !== 'Otros').sort();
    if (dataMap['Otros']) {
      sortedKeys.push('Otros');
    }

    return sortedKeys.map(key => {
      const recovered = dataMap[key].prestado - dataMap[key].saldo;
      return {
        mes: key === 'Otros' ? 'Otros' : formatMonthName(key),
        sortKey: key,
        montoTotal: Number(dataMap[key].prestado.toFixed(2)),
        saldoPendiente: Number(dataMap[key].saldo.toFixed(2)),
        recuperado: Number(recovered.toFixed(2))
      };
    });
  }, [viewDeudas]);

  // Generate top debtor data
  const topDebtors = useMemo(() => {
    const map: { [name: string]: { name: string; original: number; pendiente: number } } = {};
    
    viewDeudas.forEach(d => {
      if (d.estado === 'pendiente') {
        if (!map[d.contacto]) {
          map[d.contacto] = { name: d.contacto, original: 0, pendiente: 0 };
        }
        map[d.contacto].original += d.monto;
        map[d.contacto].pendiente += d.saldo;
      }
    });

    return Object.values(map)
      .map(entry => ({
        ...entry,
        cobrado: Number((entry.original - entry.pendiente).toFixed(2))
      }))
      .sort((a, b) => b.pendiente - a.pendiente)
      .slice(0, 6);
  }, [viewDeudas]);

  // Pie chart configuration for favor vs negocio
  const businessDistribution = useMemo(() => {
    let favorCount = 0;
    let negocioCount = 0;

    viewDeudas.forEach(d => {
      if (d.tipo === 'negocio') {
        negocioCount++;
      } else {
        favorCount++;
      }
    });

    return [
      { name: 'Personales / Favores', value: favorCount },
      { name: 'Negocios / Comerciales', value: negocioCount }
    ].filter(v => v.value > 0);
  }, [viewDeudas]);

  // Overdue debts calculator (payment month is in the past and debt is pending)
  const overdueStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    let overdueCount = 0;
    let overdueAmount = 0;
    let overdueAmountConvertido = 0;
    viewDeudas.forEach(d => {
      const dMonth = d.mesPago ? d.mesPago.slice(0, 7) : '';
      if (d.estado === 'pendiente' && dMonth && dMonth < todayStr) {
        overdueCount++;
        overdueAmount += d.saldo;
        overdueAmountConvertido += (d.saldo * d.tasaCambio);
      }
    });
    return { count: overdueCount, amount: overdueAmount, amountConvertido: overdueAmountConvertido };
  }, [viewDeudas]);

  // Portfolio distribution by account (active balance)
  const portfolioDistribution = useMemo(() => {
    let ninaPendiente = 0;
    let nandoPendiente = 0;
    viewDeudas.forEach(d => {
      if (d.estado === 'pendiente') {
        if (d.cuenta === 'Nina') ninaPendiente += d.saldo;
        if (d.cuenta === 'Nando') nandoPendiente += d.saldo;
      }
    });
    const total = ninaPendiente + nandoPendiente;
    return {
      nina: ninaPendiente,
      nando: nandoPendiente,
      ninaPercent: total > 0 ? (ninaPendiente / total) * 100 : 0,
      nandoPercent: total > 0 ? (nandoPendiente / total) * 100 : 0,
      total
    };
  }, [viewDeudas]);

  // Balance distribution by type (active balance favor vs negocio)
  const balanceDistributionByType = useMemo(() => {
    let favorMonto = 0;
    let negocioMonto = 0;
    viewDeudas.forEach(d => {
      if (d.estado === 'pendiente') {
        if (d.tipo === 'negocio') {
          negocioMonto += d.saldo;
        } else {
          favorMonto += d.saldo;
        }
      }
    });
    const total = favorMonto + negocioMonto;
    return {
      favor: favorMonto,
      negocio: negocioMonto,
      favorPercent: total > 0 ? (favorMonto / total) * 100 : 0,
      negocioPercent: total > 0 ? (negocioMonto / total) * 100 : 0,
      total
    };
  }, [viewDeudas]);

  const PIE_COLORS = ['#50599c', '#70C145'];

  return (
    <div className="space-y-6">
      
      {/* Dashboard Top Header & Action Row */}
      <div id="dashboard-header-banner" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Estadísticas Consolidadas</h2>
          <p className="text-xs text-slate-500 mt-1">
            Resumen del capital prestado, recuperaciones y balances activos de {accountView === 'Ambos' ? 'ambas cuentas' : `la cuenta de ${accountView}`}.
          </p>
        </div>
        <button
          onClick={onOpenNewDebt}
          className="bg-[#2a6c00] hover:bg-[#2a6c00]/95 text-white font-extrabold text-xs sm:text-sm px-4.5 py-3 rounded-xl transition flex items-center space-x-2 cursor-pointer shadow-sm shadow-emerald-100 shrink-0 active:scale-95 duration-150"
        >
          <span className="text-xs font-black leading-none">+</span>
          <span>Registrar Préstamo</span>
        </button>
      </div>

      {/* Alert banner for overdue debts */}
      {overdueStats.count > 0 && (
        <div id="overdue-debts-alert" className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start space-x-3 text-rose-800 shadow-xs animate-pulse-subtle">
          <AlertTriangle className="h-5 w-5 text-[#ba1a1a] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold">Alerta de Cobros Vencidos: </span>
            Hay <span className="font-bold">{overdueStats.count} deudas pendientes</span> estimadas para meses anteriores que acumulan un total de <span className="font-bold">{formatValue(overdueStats.amount)}</span>
            {overdueStats.amountConvertido !== overdueStats.amount && (
              <span> (equivale a {formatVES(overdueStats.amountConvertido)})</span>
            )}
            . Se aconseja iniciar contacto preventivo para agilizar el retorno del capital.
          </div>
        </div>
      )}

      {/* Metrics Row - 4 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI 1 - Saldo por Cobrar */}
        <div id="kpi-saldo-pendiente" className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[160px] transition-transform duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100 shrink-0">
              <AlertTriangle className="h-5 w-5 text-[#ba1a1a]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-[#ba1a1a] border border-rose-100 font-mono">
              Activo
            </span>
          </div>
          <div className="min-w-0 mt-3 flex-1 flex flex-col justify-end">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Saldo por Cobrar</p>
            <h3 className="text-xl sm:text-2xl font-black text-[#ba1a1a] tracking-tight mt-1 whitespace-nowrap overflow-x-auto pb-0.5 leading-none">
              {formatValue(stats.totalPendiente)}
            </h3>
            {stats.pendienteConvertido !== stats.totalPendiente ? (
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate font-medium">
                Conv: {formatVES(stats.pendienteConvertido)}
              </p>
            ) : (
              <div className="h-[15px]" />
            )}
            <p className="text-xs text-slate-450 mt-1.5 font-medium">{stats.countActivas} préstamos activos</p>
          </div>
        </div>

        {/* KPI 2 - Cobros por Mes de Pago (Interactive Card) */}
        <div id="kpi-cobros-mes-pago" className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[160px] transition-transform duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl border border-amber-100 shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            {/* Embedded Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-[11px] font-bold font-mono text-[#040d53] bg-slate-100 hover:bg-slate-200 py-0.5 px-2 border border-slate-200 rounded-lg focus:outline-none cursor-pointer max-w-[120px]"
              title="Filtrar cobros estimados por mes de pago"
            >
              {uniqueMonthsOfView.length > 0 ? (
                uniqueMonthsOfView.map(m => (
                  <option key={m} value={m}>{formatMonthName(m)}</option>
                ))
              ) : (
                <option value={selectedMonth}>{formatMonthName(selectedMonth)}</option>
              )}
            </select>
          </div>
          <div className="min-w-0 mt-3 flex-1 flex flex-col justify-end">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">A cobrar en {formatMonthName(selectedMonth)}</p>
            <h3 className="text-xl sm:text-2xl font-black text-[#040d53] tracking-tight mt-1 whitespace-nowrap overflow-x-auto pb-0.5 leading-none">
              {formatValue(monthlyMetrics.pendiente)}
            </h3>
            {monthlyMetrics.pendienteConvertido !== monthlyMetrics.pendiente ? (
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate font-medium">
                Conv: {formatVES(monthlyMetrics.pendienteConvertido)}
              </p>
            ) : (
              <div className="h-[15px]" />
            )}
            <p className="text-xs text-slate-450 mt-1.5 font-medium">{monthlyMetrics.count} deudas para este mes</p>
          </div>
        </div>

        {/* KPI 3 - Total Prestado */}
        <div id="kpi-total-prestado" className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[160px] transition-transform duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="bg-indigo-50 text-[#040d53] p-2.5 rounded-xl border border-indigo-100 shrink-0">
              <TrendingUp className="h-5 w-5 text-[#040d53]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-[#040d53] border border-indigo-100 font-mono">
              Historial
            </span>
          </div>
          <div className="min-w-0 mt-3 flex-1 flex flex-col justify-end">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Histórico Prestado</p>
            <h3 className="text-xl sm:text-2xl font-black text-[#040d53] tracking-tight mt-1 whitespace-nowrap overflow-x-auto pb-0.5 leading-none">
              {formatValue(stats.totalPrestado)}
            </h3>
            {stats.prestadoConvertido !== stats.totalPrestado ? (
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono mt-1 truncate font-medium">
                Conv: {formatVES(stats.prestadoConvertido)}
              </p>
            ) : (
              <div className="h-[15px]" />
            )}
            <p className="text-xs text-slate-450 mt-1.5 font-medium">{stats.totalRegistros} préstamos totales</p>
          </div>
        </div>

        {/* KPI 4 - Total Recuperado */}
        <div id="kpi-total-recuperado" className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between min-h-[160px] transition-transform duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="bg-emerald-50 text-[#2a6c00] p-2.5 rounded-xl border border-[#a0f572]/40 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-[#2a6c00]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-[#2a6c00] border border-[#a0f572]/30 font-mono">
              {Math.round(stats.recoveryRate)}% Cobrado
            </span>
          </div>
          <div className="min-w-0 mt-3 flex-1 flex flex-col justify-end">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Capital Recuperado</p>
            <h3 className="text-xl sm:text-2xl font-black text-[#2a6c00] tracking-tight mt-1 whitespace-nowrap overflow-x-auto pb-0.5 leading-none">
              {formatValue(stats.totalCobrado)}
            </h3>
            
            {/* Visual Progress Track */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div 
                className="bg-[#2a6c00] h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, stats.recoveryRate)}%` }}
              />
            </div>
            <p className="text-xs text-slate-450 mt-1.5 font-medium flex justify-between">
              <span>Saldados: {stats.countSaldadas}</span>
              <span className="text-slate-400 font-normal">Totales: {stats.totalRegistros}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Cols: Historical Area Graph */}
        <div id="graph-evolution" className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h4 className="font-bold text-[#040d53] text-lg">Evolución e Historial de Préstamos</h4>
            <p className="text-xs text-slate-500">Monto total original otorgado vs capital cobrado agrupado por mes de vencimiento objetivo</p>
          </div>

          <div className="h-72 w-full">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyData}
                  margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#040d53" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#040d53" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRecuperado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2a6c00" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2a6c00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fill: '#64748b', fontSize: 11 }} 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#1e293b' }}
                    formatter={(value: any) => [formatValue(Number(value)), '']}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Area 
                    name="Capital Prestado (USD)" 
                    type="monotone" 
                    dataKey="montoTotal" 
                    stroke="#040d53" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                  <Area 
                    name="Capital Cobrado (USD)" 
                    type="monotone" 
                    dataKey="recuperado" 
                    stroke="#2a6c00" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRecuperado)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Sin datos suficientes para proyectar evolución mensual.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3 flex flex-col sm:flex-row justify-between gap-1.5 text-[11px] text-slate-400 font-medium">
            <span><strong>Eje Horizontal (X):</strong> Mes de vencimiento acordado para el cobro del préstamo.</span>
            <span><strong>Eje Vertical (Y):</strong> Capital representado en dólares (USD).</span>
          </div>
        </div>

        {/* Right 1 Col: Top Debtors Horizontal Stacked Bar Chart */}
        <div id="chart-top-debtors" className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h4 className="font-bold text-[#040d53] text-lg">Deudores Activos (Apilado)</h4>
            <p className="text-xs text-slate-500">Capital original otorgado indicando saldo pendiente vs abonos realizados</p>
          </div>

          <div className="h-64 mt-2 w-full">
            {topDebtors.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDebtors}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: -22, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fill: '#1a1c1e', fontSize: 11, fontWeight: 'medium' }} 
                    axisLine={false}
                    tickLine={false}
                    width={85}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                    formatter={(value: any, name: any) => [formatValue(Number(value)), name]}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
                  />
                  <Bar dataKey="cobrado" name="Capital Abonado" stackId="a" fill="#70C145" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pendiente" name="Saldo Pendiente" stackId="a" fill="#ba1a1a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-405 text-sm text-center">
                ¡Nadie debe nada! 🎉<br />Todo el capital ha sido recuperado.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3 text-[11px] text-slate-400 font-medium leading-relaxed">
            💡 <span className="text-emerald-700 font-bold">Verde</span> representa abonos cobrados y <span className="text-[#ba1a1a] font-bold">Rojo</span> es el saldo que falta cobrar. La suma total es el préstamo original.
          </div>
        </div>

      </div>

      {/* Strategic Portfolio Distribution Row */}
      <div className="w-full">
        
        {/* Widget 1: Balance por Cuentas */}
        <div id="portfolio-account-distribution" className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-[#040d53] text-base">Distribución de Carteras Activas</h4>
            <p className="text-xs text-slate-500">Balance del capital actualmente en la calle entre Nina y Nando</p>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#040d53] mr-1.5" />Cartera Nina</span>
              <span className="font-mono">{formatValue(portfolioDistribution.nina)} ({Math.round(portfolioDistribution.ninaPercent)}%)</span>
            </div>
            
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#70C145] mr-1.5" />Cartera Nando</span>
              <span className="font-mono">{formatValue(portfolioDistribution.nando)} ({Math.round(portfolioDistribution.nandoPercent)}%)</span>
            </div>

            {/* Split Bar */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
              {portfolioDistribution.total > 0 ? (
                <>
                  <div 
                    style={{ width: `${portfolioDistribution.ninaPercent}%` }} 
                    className="bg-[#040d53] h-full transition-all duration-300"
                    title={`Nina: ${Math.round(portfolioDistribution.ninaPercent)}%`}
                  />
                  <div 
                    style={{ width: `${portfolioDistribution.nandoPercent}%` }} 
                    className="bg-[#70C145] h-full transition-all duration-300"
                    title={`Nando: ${Math.round(portfolioDistribution.nandoPercent)}%`}
                  />
                </>
              ) : (
                <div className="w-full bg-slate-100 h-full" />
              )}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
            {accountView !== 'Ambos' ? (
              <span className="text-indigo-600 font-semibold">💡 Estás visualizando la cuenta de {accountView}. Cambia a "Ambos" arriba para comparar de forma equitativa.</span>
            ) : (
              <span>💡 Permite supervisar el balance de riesgo y los montos prestados por cada administrador.</span>
            )}
          </p>
        </div>

      </div>

    </div>
  );
}
