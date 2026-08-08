import React, { useState, useMemo } from 'react';
import { Debt, Payment } from '../types';
import { formatMonthName } from '../utils/storage';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  DollarSign, CheckCircle2, TrendingUp, AlertTriangle, Clock, 
  ChevronRight, X, Search, Filter, PieChart as PieChartIcon, 
  BarChart3, Users, ChevronLeft, ArrowUpRight, ShieldAlert, ShieldCheck, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

  // State for chart mode (defaulting to Bar chart as preferred)
  const [chartType, setChartType] = useState<'area' | 'bar'>('bar');

  // State for drill-down modal inspection
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [modalDebts, setModalDebts] = useState<Debt[] | null>(null);
  const [modalSearch, setModalSearch] = useState('');

  // Filtered lists based on primary filter (Cuenta)
  const viewDeudas = useMemo(() => {
    return accountView === 'Ambos' ? deudas : deudas.filter(d => d.cuenta === accountView);
  }, [deudas, accountView]);

  // Unique target payment months from viewDeudas for dropdown selection
  const uniqueMonthsOfView = useMemo(() => {
    const list = [...new Set(viewDeudas.map(d => d.mesPago ? d.mesPago.slice(0, 7) : ''))].filter(Boolean).sort();
    return list;
  }, [viewDeudas]);

  // Setup selectedMonth state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const todayStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const pendingList = viewDeudas.filter(d => d.estado === 'pendiente' && d.mesPago).map(d => d.mesPago.slice(0, 7));
    if (pendingList.length > 0) {
      const sortedPending = [...new Set(pendingList)].sort();
      if (sortedPending.includes(todayStr)) return todayStr;
      return sortedPending[0];
    }
    return todayStr;
  });

  // Calculate pending collection metrics for selectedMonth
  const monthlyMetrics = useMemo(() => {
    let mesPrestadoVal = 0;
    let mesPendienteVal = 0;
    let mesPendienteConvertidoVal = 0;
    let mesCountActivas = 0;
    const debtsInMonth: Debt[] = [];

    viewDeudas.forEach(d => {
      const dMonth = d.mesPago ? d.mesPago.slice(0, 7) : '';
      if (dMonth === selectedMonth) {
        mesPrestadoVal += d.monto;
        mesPendienteVal += d.saldo;
        mesPendienteConvertidoVal += (d.saldo * d.tasaCambio);
        debtsInMonth.push(d);
        if (d.estado === 'pendiente') {
          mesCountActivas++;
        }
      }
    });

    return {
      prestado: mesPrestadoVal,
      pendiente: mesPendienteVal,
      pendienteConvertido: mesPendienteConvertidoVal,
      count: mesCountActivas,
      debts: debtsInMonth
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
    const activeDebtsList: Debt[] = [];
    const settledDebtsList: Debt[] = [];

    viewDeudas.forEach(d => {
      totalPrestadoVal += d.monto;
      totalPendienteVal += d.saldo;
      prestadoConvertidoVal += (d.monto * d.tasaCambio);
      pendienteConvertidoVal += (d.saldo * d.tasaCambio);

      if (d.estado === 'pendiente') {
        countActivas++;
        activeDebtsList.push(d);
      } else {
        countSaldadas++;
        settledDebtsList.push(d);
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
      totalRegistros: viewDeudas.length,
      activeDebtsList,
      settledDebtsList
    };
  }, [viewDeudas]);

  // Overdue debts calculator
  const overdueStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    let overdueCount = 0;
    let overdueAmount = 0;
    let overdueAmountConvertido = 0;
    const overdueList: Debt[] = [];

    viewDeudas.forEach(d => {
      const dMonth = d.mesPago ? d.mesPago.slice(0, 7) : '';
      if (d.estado === 'pendiente' && dMonth && dMonth < todayStr) {
        overdueCount++;
        overdueAmount += d.saldo;
        overdueAmountConvertido += (d.saldo * d.tasaCambio);
        overdueList.push(d);
      }
    });
    return { count: overdueCount, amount: overdueAmount, amountConvertido: overdueAmountConvertido, list: overdueList };
  }, [viewDeudas]);

  // Health Assessment Score
  const healthAssessment = useMemo(() => {
    if (stats.totalPrestado === 0) {
      return { status: 'Sin Datos', color: 'slate', text: 'No hay préstamos registrados aún.' };
    }
    const overdueRatio = overdueStats.amount / Math.max(1, stats.totalPendiente);
    if (overdueRatio > 0.4) {
      return { status: 'Riesgo Alto', color: 'rose', text: 'Más del 40% del saldo pendiente está vencido.' };
    } else if (overdueRatio > 0.15) {
      return { status: 'Atención Requerida', color: 'amber', text: 'Hay cobros atrasados pendientes de gestión.' };
    } else {
      return { status: 'Cartera Saludable', color: 'emerald', text: 'La mayoría de los cobros están al día.' };
    }
  }, [stats, overdueStats]);

  // Historical monthly trend data
  const monthlyData = useMemo(() => {
    const dataMap: { [key: string]: { prestado: number; saldo: number; debts: Debt[] } } = {};
    
    viewDeudas.forEach(d => {
      const rawMonth = d.mesPago || d.fecha || '';
      const key = rawMonth.slice(0, 7) || 'Otros';
      if (!dataMap[key]) {
        dataMap[key] = { prestado: 0, saldo: 0, debts: [] };
      }
      dataMap[key].prestado += d.monto;
      dataMap[key].saldo += d.saldo;
      dataMap[key].debts.push(d);
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
        recuperado: Number(recovered.toFixed(2)),
        debts: dataMap[key].debts
      };
    });
  }, [viewDeudas]);

  // Top debtors data
  const topDebtors = useMemo(() => {
    const map: { [name: string]: { name: string; original: number; pendiente: number; debts: Debt[] } } = {};
    
    viewDeudas.forEach(d => {
      if (d.estado === 'pendiente') {
        if (!map[d.contacto]) {
          map[d.contacto] = { name: d.contacto, original: 0, pendiente: 0, debts: [] };
        }
        map[d.contacto].original += d.monto;
        map[d.contacto].pendiente += d.saldo;
        map[d.contacto].debts.push(d);
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

  // Donut distribution
  const businessDistribution = useMemo(() => {
    let favorCount = 0;
    let negocioCount = 0;
    let favorMonto = 0;
    let negocioMonto = 0;

    viewDeudas.forEach(d => {
      if (d.tipo === 'negocio') {
        negocioCount++;
        if (d.estado === 'pendiente') negocioMonto += d.saldo;
      } else {
        favorCount++;
        if (d.estado === 'pendiente') favorMonto += d.saldo;
      }
    });

    return [
      { name: 'Personales / Favores', value: favorMonto, count: favorCount, color: '#3b82f6' },
      { name: 'Negocios / Comerciales', value: negocioMonto, count: negocioCount, color: '#8b5cf6' }
    ].filter(v => v.value > 0 || v.count > 0);
  }, [viewDeudas]);

  // Portfolio distribution by account
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

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (uniqueMonthsOfView.length === 0) return;
    const currentIndex = uniqueMonthsOfView.indexOf(selectedMonth);
    if (currentIndex > 0) {
      setSelectedMonth(uniqueMonthsOfView[currentIndex - 1]);
    }
  };

  const handleNextMonth = () => {
    if (uniqueMonthsOfView.length === 0) return;
    const currentIndex = uniqueMonthsOfView.indexOf(selectedMonth);
    if (currentIndex >= 0 && currentIndex < uniqueMonthsOfView.length - 1) {
      setSelectedMonth(uniqueMonthsOfView[currentIndex + 1]);
    }
  };

  // Open modal handler
  const openInspectModal = (title: string, debtsList: Debt[]) => {
    setModalTitle(title);
    setModalDebts(debtsList);
    setModalSearch('');
  };

  // Filtered list inside modal
  const modalFilteredDebts = useMemo(() => {
    if (!modalDebts) return [];
    if (!modalSearch.trim()) return modalDebts;
    const q = modalSearch.toLowerCase();
    return modalDebts.filter(d => 
      d.contacto.toLowerCase().includes(q) || 
      d.descripcion.toLowerCase().includes(q) ||
      d.creadoPor.toLowerCase().includes(q)
    );
  }, [modalDebts, modalSearch]);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & Quick Actions */}
      <div id="dashboard-header-banner" className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 gemini-card rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Estadísticas Consolidadas
            </h2>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {accountView === 'Ambos' ? 'Vista Global' : `Cuenta ${accountView}`}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Supervisa capital activo, cobranzas del mes y rotación de deudas en tiempo real.
          </p>
        </div>

        <button
          onClick={onOpenNewDebt}
          className="gemini-gradient-bg hover:opacity-95 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-full transition flex items-center space-x-2 cursor-pointer shadow-md shadow-blue-500/20 shrink-0 active:scale-95 duration-150"
        >
          <span className="text-base font-black leading-none">+</span>
          <span>Registrar Préstamo</span>
        </button>
      </div>

      {/* Financial Health Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Banner Item 1: Health Status */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className={`p-3 rounded-2xl shrink-0 ${
            healthAssessment.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
            healthAssessment.color === 'amber' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
            'bg-rose-50 text-rose-600 border border-rose-100'
          }`}>
            {healthAssessment.color === 'emerald' ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Estado de Cartera</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                healthAssessment.color === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
                healthAssessment.color === 'amber' ? 'bg-amber-100 text-amber-800' :
                'bg-rose-100 text-rose-800'
              }`}>
                {healthAssessment.status}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{healthAssessment.text}</p>
          </div>
        </div>

        {/* Banner Item 2: Average Debt Size */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center space-x-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Promedio por Préstamo</span>
            <p className="text-base font-black text-slate-900 mt-0.5">
              {formatValue(stats.countActivas > 0 ? stats.totalPendiente / stats.countActivas : 0)}
            </p>
            <p className="text-[11px] text-slate-500 font-medium">Calculado sobre {stats.countActivas} clientes activos</p>
          </div>
        </div>

        {/* Banner Item 3: Quick Alert shortcut */}
        <div 
          onClick={() => overdueStats.count > 0 && openInspectModal("Cobros Vencidos de Meses Anteriores", overdueStats.list)}
          className={`border rounded-2xl p-4 shadow-xs flex items-center justify-between transition cursor-pointer ${
            overdueStats.count > 0 
              ? 'bg-rose-50/90 border-rose-200 text-rose-950 hover:bg-rose-100/80' 
              : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${overdueStats.count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Alertas de Vencimiento</span>
              <p className="text-sm font-extrabold mt-0.5">
                {overdueStats.count > 0 ? `${overdueStats.count} cobros retrasados (${formatValue(overdueStats.amount)})` : '¡Al día! Cero cobros vencidos'}
              </p>
            </div>
          </div>
          {overdueStats.count > 0 && <ArrowUpRight className="h-5 w-5 text-rose-700 shrink-0" />}
        </div>
      </div>

      {/* KPI Cards Grid - Clickable for Drill-down */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Saldo Pendiente */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={() => openInspectModal("Deudas Pendientes Activas", stats.activeDebtsList)}
          className="gemini-card rounded-2xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between min-h-[165px] transition-all duration-200 cursor-pointer group border-l-4 border-l-rose-500"
        >
          <div className="flex items-center justify-between">
            <div className="bg-rose-50 text-rose-600 p-2.5 rounded-2xl border border-rose-100 shrink-0">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 font-mono flex items-center gap-1 group-hover:bg-rose-600 group-hover:text-white transition">
              <span>Inspeccionar</span>
              <ChevronRight className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Saldo por Cobrar</p>
            <h3 className="text-2xl font-black text-rose-600 tracking-tight mt-1 leading-none font-sans">
              {formatValue(stats.totalPendiente)}
            </h3>
            {stats.pendienteConvertido !== stats.totalPendiente ? (
              <p className="text-[11px] text-slate-400 font-mono mt-1 truncate font-medium">
                Conv: {formatVES(stats.pendienteConvertido)}
              </p>
            ) : (
              <div className="h-[15px]" />
            )}
            <p className="text-xs text-slate-500 mt-1.5 font-semibold text-rose-700">{stats.countActivas} préstamos activos</p>
          </div>
        </motion.div>

        {/* KPI 2: Cobros por Mes de Pago */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="gemini-card rounded-2xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between min-h-[165px] transition-all duration-200 border-l-4 border-l-amber-500"
        >
          <div className="flex items-center justify-between gap-1">
            <div className="bg-amber-50 text-amber-600 p-2.5 rounded-2xl border border-amber-100 shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>

            {/* Month Navigation Controls */}
            <div className="flex items-center space-x-1">
              <button 
                onClick={handlePrevMonth}
                disabled={uniqueMonthsOfView.indexOf(selectedMonth) <= 0}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-500 disabled:opacity-30 cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-[11px] font-bold font-mono text-blue-900 bg-slate-100 hover:bg-slate-200/80 py-1 px-2.5 border border-slate-200 rounded-full focus:outline-none cursor-pointer max-w-[125px] transition"
              >
                {uniqueMonthsOfView.length > 0 ? (
                  uniqueMonthsOfView.map(m => (
                    <option key={m} value={m}>{formatMonthName(m)}</option>
                  ))
                ) : (
                  <option value={selectedMonth}>{formatMonthName(selectedMonth)}</option>
                )}
              </select>

              <button 
                onClick={handleNextMonth}
                disabled={uniqueMonthsOfView.indexOf(selectedMonth) >= uniqueMonthsOfView.length - 1}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-500 disabled:opacity-30 cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div 
            onClick={() => openInspectModal(`Cobros de ${formatMonthName(selectedMonth)}`, monthlyMetrics.debts)}
            className="mt-3 cursor-pointer group"
          >
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Estimado {formatMonthName(selectedMonth)}</p>
              <span className="text-[10px] text-blue-600 font-bold group-hover:underline flex items-center gap-0.5">
                Ver deudas <ChevronRight className="h-3 w-3" />
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mt-1 leading-none">
              {formatValue(monthlyMetrics.pendiente)}
            </h3>
            {monthlyMetrics.pendienteConvertido !== monthlyMetrics.pendiente ? (
              <p className="text-[11px] text-slate-400 font-mono mt-1 truncate font-medium">
                Conv: {formatVES(monthlyMetrics.pendienteConvertido)}
              </p>
            ) : (
              <div className="h-[15px]" />
            )}
            <p className="text-xs text-slate-500 mt-1.5 font-medium">{monthlyMetrics.count} deudas con vencimiento este mes</p>
          </div>
        </motion.div>

        {/* KPI 3: Total Prestado Histórico */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={() => openInspectModal("Histórico de Todos los Préstamos", viewDeudas)}
          className="gemini-card rounded-2xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between min-h-[165px] transition-all duration-200 cursor-pointer group border-l-4 border-l-blue-500"
        >
          <div className="flex items-center justify-between">
            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl border border-blue-100 shrink-0">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100/80 font-mono group-hover:bg-blue-600 group-hover:text-white transition">
              Ver Todos
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Capital Otorgado</p>
            <h3 className="text-2xl font-black text-blue-950 tracking-tight mt-1 leading-none">
              {formatValue(stats.totalPrestado)}
            </h3>
            {stats.prestadoConvertido !== stats.totalPrestado ? (
              <p className="text-[11px] text-slate-400 font-mono mt-1 truncate font-medium">
                Conv: {formatVES(stats.prestadoConvertido)}
              </p>
            ) : (
              <div className="h-[15px]" />
            )}
            <p className="text-xs text-slate-500 mt-1.5 font-medium">{stats.totalRegistros} préstamos en total</p>
          </div>
        </motion.div>

        {/* KPI 4: Capital Recuperado */}
        <motion.div 
          whileHover={{ y: -3 }}
          onClick={() => openInspectModal("Deudas Completamente Saldadas", stats.settledDebtsList)}
          className="gemini-card rounded-2xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between min-h-[165px] transition-all duration-200 cursor-pointer group border-l-4 border-l-emerald-500"
        >
          <div className="flex items-center justify-between">
            <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl border border-emerald-100 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono group-hover:bg-emerald-600 group-hover:text-white transition">
              {Math.round(stats.recoveryRate)}% Cobrado
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">Capital Recuperado</p>
            <h3 className="text-2xl font-black text-emerald-600 tracking-tight mt-1 leading-none">
              {formatValue(stats.totalCobrado)}
            </h3>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, stats.recoveryRate)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-medium flex justify-between">
              <span>Saldados: {stats.countSaldadas}</span>
              <span className="text-emerald-700 font-bold group-hover:underline">Ver saldados</span>
            </p>
          </div>
        </motion.div>

      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Graph: Historical Evolution & Monthly Flow */}
        <div id="graph-evolution" className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="font-black text-slate-900 text-lg">Evolución Financiera Mensual</h4>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Comportamiento del capital otorgado vs recuperado agrupado por mes de cobro</p>
            </div>

            {/* Area vs Bar Chart Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-full text-xs font-bold shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setChartType('area')}
                className={`px-3 py-1.5 rounded-full transition flex items-center space-x-1 cursor-pointer ${
                  chartType === 'area' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Tendencia</span>
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-full transition flex items-center space-x-1 cursor-pointer ${
                  chartType === 'bar' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Comparativo</span>
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRecuperado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#0f172a', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
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
                      name="Capital Otorgado" 
                      type="monotone" 
                      dataKey="montoTotal" 
                      stroke="#3b82f6" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#colorTotal)" 
                    />
                    <Area 
                      name="Capital Recuperado" 
                      type="monotone" 
                      dataKey="recuperado" 
                      stroke="#10b981" 
                      strokeWidth={2.5}
                      fillOpacity={1} 
                      fill="url(#colorRecuperado)" 
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="mes" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '12px' }} formatter={(value: any) => [formatValue(Number(value)), '']} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar name="Capital Otorgado" dataKey="montoTotal" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    <Bar name="Capital Recuperado" dataKey="recuperado" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                Sin datos suficientes para proyectar la evolución.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 font-medium gap-2">
            <span>💡 Haz clic en cualquier deudor o tarjeta para ver el desglose detallado de sus préstamos.</span>
            <span className="text-blue-600 font-bold">Resumen de {monthlyData.length} períodos</span>
          </div>
        </div>

        {/* Top Debtors Ranking List */}
        <div id="chart-top-debtors" className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-black text-slate-900 text-lg">Deudores Principales</h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{topDebtors.length} activos</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Ranking por volumen de saldo pendiente actual</p>
          </div>

          <div className="mt-4 space-y-3.5 max-h-[290px] overflow-y-auto pr-1">
            {topDebtors.length > 0 ? (
              topDebtors.map((debtor, idx) => {
                const total = debtor.original;
                const paidPercent = total > 0 ? Math.round((debtor.cobrado / total) * 100) : 0;
                return (
                  <motion.div 
                    key={debtor.name}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => openInspectModal(`Deudas de ${debtor.name}`, debtor.debts)}
                    className="p-3 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/60 rounded-xl transition cursor-pointer group"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-black text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-xs text-slate-900 group-hover:text-blue-600 transition truncate max-w-[130px]">
                          {debtor.name}
                        </span>
                      </div>
                      <span className="font-black text-xs text-rose-600 font-mono">
                        {formatValue(debtor.pendiente)}
                      </span>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden flex mt-2">
                      <div 
                        style={{ width: `${paidPercent}%` }}
                        className="bg-emerald-500 h-full" 
                        title={`Abonado: ${paidPercent}%`}
                      />
                      <div 
                        style={{ width: `${100 - paidPercent}%` }}
                        className="bg-rose-500 h-full" 
                        title={`Pendiente: ${100 - paidPercent}%`}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium mt-1">
                      <span>Abonado: <strong className="text-emerald-600">{formatValue(debtor.cobrado)}</strong> ({paidPercent}%)</span>
                      <span className="group-hover:text-blue-600 font-bold flex items-center">
                        Detalle <ChevronRight className="h-2.5 w-2.5 ml-0.5" />
                      </span>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-xs text-center font-medium">
                ¡Nadie debe nada! 🎉<br />Todo el capital ha sido recuperado.
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3 text-[11px] text-slate-400 font-medium">
            💡 Haz clic en un cliente para inspeccionar su expediente completo.
          </div>
        </div>

      </div>

      {/* Strategic Portfolio & Type Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Widget 1: Cuentas Nina vs Nando */}
        <div id="portfolio-account-distribution" className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-black text-slate-900 text-base">Distribución por Cuentas</h4>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Balance de capital pendiente entre Nina y Nando</p>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-900" />Cuenta Nina</span>
              <span className="font-mono">{formatValue(portfolioDistribution.nina)} ({Math.round(portfolioDistribution.ninaPercent)}%)</span>
            </div>
            
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500" />Cuenta Nando</span>
              <span className="font-mono">{formatValue(portfolioDistribution.nando)} ({Math.round(portfolioDistribution.nandoPercent)}%)</span>
            </div>

            {/* Split Bar */}
            <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden flex">
              {portfolioDistribution.total > 0 ? (
                <>
                  <div 
                    style={{ width: `${portfolioDistribution.ninaPercent}%` }} 
                    className="bg-slate-900 h-full transition-all duration-300"
                  />
                  <div 
                    style={{ width: `${portfolioDistribution.nandoPercent}%` }} 
                    className="bg-amber-500 h-full transition-all duration-300"
                  />
                </>
              ) : (
                <div className="w-full bg-slate-100 h-full" />
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100 font-medium">
            💡 Permite equilibrar la liquidez y el riesgo de préstamos otorgados por cada cuenta.
          </p>
        </div>

        {/* Widget 2: Favores vs Negocios Donut Chart */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-black text-slate-900 text-base">Clasificación por Propósito</h4>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Distribución entre préstamos personales y acuerdos comerciales</p>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="h-36 w-36 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={businessDistribution}
                    innerRadius={38}
                    outerRadius={55}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {businessDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <PieChartIcon className="h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div className="flex-1 ml-4 space-y-3 text-xs font-bold">
              {businessDistribution.map(item => (
                <div key={item.name} className="flex flex-col">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-mono text-slate-900">{formatValue(item.value)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal ml-4">
                    {item.count} registros vinculados
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 pt-3 border-t border-slate-100 font-medium">
            💡 Diferencia favores personales de operaciones de negocio.
          </p>
        </div>

      </div>

      {/* Drill-Down Inspector Modal / Drawer */}
      <AnimatePresence>
        {modalTitle && modalDebts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">{modalTitle}</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Mostrando {modalFilteredDebts.length} de {modalDebts.length} registros
                  </p>
                </div>
                <button 
                  onClick={() => { setModalTitle(null); setModalDebts(null); }}
                  className="p-2 hover:bg-slate-200/80 rounded-full text-slate-500 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Search Bar */}
              <div className="p-4 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por cliente, descripción o creador..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200/80 rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Modal Scrollable List */}
              <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50/30">
                {modalFilteredDebts.length > 0 ? (
                  modalFilteredDebts.map(debt => (
                    <div key={debt.id} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-slate-900 text-sm">{debt.contacto}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              debt.cuenta === 'Nina' ? 'bg-slate-900 text-white' : 'bg-amber-500 text-white'
                            }`}>
                              {debt.cuenta}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              debt.estado === 'pendiente' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {debt.estado === 'pendiente' ? 'Pendiente' : 'Saldado'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{debt.descripcion || 'Sin nota de detalle'}</p>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-sm text-slate-900 font-mono block">
                            {formatValue(debt.monto)}
                          </span>
                          {debt.saldo > 0 && debt.saldo !== debt.monto && (
                            <span className="text-xs text-rose-600 font-bold font-mono block">
                              Saldo: {formatValue(debt.saldo)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-between items-center text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                        <span>F. Préstamo: {debt.fecha}</span>
                        <span>Cobro Objetivo: <strong className="text-slate-700">{debt.mesPago ? formatMonthName(debt.mesPago) : 'N/A'}</strong></span>
                        <span>Registrado por: {debt.creadoPor}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium">
                    No hay resultados coincidentes en esta vista.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => { setModalTitle(null); setModalDebts(null); }}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-full font-bold text-xs transition cursor-pointer"
                >
                  Cerrar Visualización
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
