import React, { useState, useMemo } from 'react';
import { Debt } from '../types';
import { formatMonthName, formatDateLabel } from '../utils/storage';
import { Search, Filter, Share2, ClipboardList, Eye, Trash2, CheckCircle, Clock } from 'lucide-react';

interface DebtsListProps {
  deudas: Debt[];
  accountView: 'Ambos' | 'Nina' | 'Nando';
  onOpenDetails: (id: string) => void;
  onOpenNewDebt: () => void;
  onDeleteDebt: (id: string) => void;
}

export default function DebtsList({ 
  deudas, 
  accountView, 
  onOpenDetails, 
  onOpenNewDebt, 
  onDeleteDebt 
}: DebtsListProps) {

  // Local filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'saldado'>('todos');
  const [contactoFilter, setContactoFilter] = useState('todos');
  const [mesFilter, setMesFilter] = useState('todos');
  const [sortBy, setSortBy] = useState<'fecha' | 'monto' | 'saldo'>('fecha');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Format currencies helpers
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

  // 1. Initial filter by account owner view (Nina / Nando o Ambos)
  const viewDeudas = useMemo(() => {
    return accountView === 'Ambos' ? deudas : deudas.filter(d => d.cuenta === accountView);
  }, [deudas, accountView]);

  // Derived filter options based on viewDeudas
  const uniqueContactos = useMemo(() => {
    const list = [...new Set(viewDeudas.map(d => d.contacto))].sort();
    return list;
  }, [viewDeudas]);

  const uniqueMeses = useMemo(() => {
    const list = [...new Set(viewDeudas.map(d => d.mesPago))].filter(Boolean).sort();
    return list;
  }, [viewDeudas]);

  // Apply all search & filters together
  const filteredDeudas = useMemo(() => {
    let result = [...viewDeudas];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d => 
        d.contacto.toLowerCase().includes(q) || 
        d.descripcion.toLowerCase().includes(q) ||
        d.creadoPor.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'todos') {
      result = result.filter(d => d.estado === statusFilter);
    }

    if (contactoFilter !== 'todos') {
      result = result.filter(d => d.contacto === contactoFilter);
    }

    if (mesFilter !== 'todos') {
      result = result.filter(d => d.mesPago === mesFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'fecha') {
        comparison = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
      } else if (sortBy === 'monto') {
        comparison = a.monto - b.monto;
      } else if (sortBy === 'saldo') {
        comparison = a.saldo - b.saldo;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [viewDeudas, search, statusFilter, contactoFilter, mesFilter, sortBy, sortOrder]);

  // Aggregate totals for the currently matching filtered subset
  const totals = useMemo(() => {
    let original = 0;
    let pendiente = 0;
    filteredDeudas.forEach(d => {
      original += d.monto;
      pendiente += d.saldo;
    });
    return {
      original,
      pendiente,
      cobrado: original - pendiente
    };
  }, [filteredDeudas]);

  // Handles export of current rows as a clean CSV table
  const handleExportCSV = () => {
    if (filteredDeudas.length === 0) return;

    const headers = ["ID", "Cuenta", "Contacto", "Tipo", "Concepto", "Fecha Registro", "Mes Pago", "Tasa de Cambio", "Monto Original", "Saldo Restante", "Estado", "Registrado Por"];
    const rows = filteredDeudas.map(d => [
      d.id,
      d.cuenta,
      `"${d.contacto.replace(/"/g, '""')}"`,
      d.tipo,
      `"${d.descripcion.replace(/"/g, '""')}"`,
      d.fecha,
      d.mesPago,
      d.tasaCambio,
      d.monto,
      d.saldo,
      d.estado,
      d.creadoPor
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `deudaflow_prestamos_${accountView.toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSort = (field: 'fecha' | 'monto' | 'saldo') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Filtering Header Toolbar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm space-y-4">
        
        {/* Row 1: Search & Base filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Fuzzy Search Bar */}
          <div className="relative w-full lg:max-w-md flex-grow">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-5 w-5 stroke-[1.8]" />
            </span>
            <input 
              type="text" 
              placeholder="Buscar por cliente, concepto o creador..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] transition"
            />
          </div>

          {/* Filtering Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2.5 w-full lg:w-auto">
            
            {/* Status Selector */}
            <select 
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto py-2.5 px-3 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] bg-white font-medium text-slate-700 cursor-pointer"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendiente">Solo Pendientes</option>
              <option value="saldado">Solo Saldados</option>
            </select>

            {/* Client Selector */}
            <select 
              value={contactoFilter}
              onChange={(e) => setContactoFilter(e.target.value)}
              className="w-full md:w-auto md:max-w-[180px] py-2.5 px-3 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] bg-white font-medium text-slate-700 cursor-pointer"
            >
              <option value="todos">Todos los Clientes</option>
              {uniqueContactos.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {/* Target Month Selector */}
            <select 
              value={mesFilter}
              onChange={(e) => setMesFilter(e.target.value)}
              className="w-full md:w-auto py-2.5 px-3 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] bg-white font-medium text-slate-700 cursor-pointer"
            >
              <option value="todos">Todos los Meses</option>
              {uniqueMeses.map(mes => (
                <option key={mes} value={mes}>{formatMonthName(mes)}</option>
              ))}
            </select>

            {/* Actions */}
            <button 
              onClick={handleExportCSV}
              disabled={filteredDeudas.length === 0}
              className="w-full md:w-auto justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-250 py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center space-x-2 cursor-pointer"
              title="Descargar listado actual filtrado en formato CSV compatible con Excel"
            >
              <Share2 className="h-4 w-4" />
              <span>Exportar Excel</span>
            </button>

            <button 
              onClick={onOpenNewDebt}
              className="w-full md:w-auto justify-center bg-[#2a6c00] hover:opacity-90 tracking-tight text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition flex items-center space-x-2 cursor-pointer shadow-sm shadow-emerald-100 active:scale-95 duration-100"
            >
              <ClipboardList className="h-4 w-4" />
              <span>Registrar Préstamo</span>
            </button>
          </div>
        </div>

        {/* Row 2: Sub-metrics banner */}
        <div id="sub-metrics-banner" className="bg-[#f3f3f6] border border-[#eeeef0] text-slate-700 px-4 py-3 rounded-xl text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-medium">
          <div className="flex flex-wrap items-center gap-2">
            <span>Filtros aplicados:</span>
            <span className="font-extrabold text-[#040d53]">
              {statusFilter !== 'todos' ? `Estado: ${statusFilter === 'pendiente' ? 'Pendiente' : 'Saldado'}` : 'Todos'} 
              {contactoFilter !== 'todos' && ` | Cliente: ${contactoFilter}`}
              {mesFilter !== 'todos' && ` | Vence: ${formatMonthName(mesFilter)}`}
              {search.trim() && ` | Búsqueda: "${search}"`}
            </span>
            {(statusFilter !== 'todos' || contactoFilter !== 'todos' || mesFilter !== 'todos' || search.trim() !== '') && (
              <button 
                onClick={() => {
                  setSearch('');
                  setStatusFilter('todos');
                  setContactoFilter('todos');
                  setMesFilter('todos');
                }}
                className="text-[10px] text-[#040d53] hover:underline font-extrabold uppercase tracking-wider ml-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded cursor-pointer"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Préstamos Totales: <strong className="text-[#040d53] text-[13px] font-extrabold">{formatValue(totals.original)}</strong></span>
            <span>Monto Cobrado: <strong className="text-[#2a6c00] text-[13px] font-extrabold">{formatValue(totals.cobrado)}</strong></span>
            <span>Saldo Exigible: <strong className="text-[#ba1a1a] text-[13px] font-extrabold">{formatValue(totals.pendiente)}</strong></span>
          </div>
        </div>
      </div>

      {/* MOBILE LIST VIEW (visible on small screens) */}
      <div className="block md:hidden space-y-4">
        {filteredDeudas.length > 0 ? (
          filteredDeudas.map(d => {
            const displayTasa = d.tasaCambio || 1;
            const isConverted = displayTasa !== 1;
            const cobradoPercent = d.monto > 0 ? Math.round(((d.monto - d.saldo) / d.monto) * 100) : 0;
            const isPending = d.estado === 'pendiente';

            // Generate WhatsApp share text
            const shareText = `Hola ${d.contacto}, te saludo de parte de DeudaFlow. Te recordamos que tienes un saldo pendiente de ${formatValue(d.saldo)} (${formatMonthName(d.mesPago)}) sobre tu préstamo original de ${formatValue(d.monto)}. ¡Que tengas un excelente día!`;
            
            const handleShare = () => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(shareText);
                alert("✓ Recordatorio de cobro copiado al portapapeles. ¡Ya puedes pegarlo y enviarlo por WhatsApp!");
              } else {
                alert(shareText);
              }
            };

            return (
              <div 
                key={d.id}
                id={`mobile-card-${d.id}`}
                className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm relative overflow-hidden transition hover:border-[#040d53]/30"
              >
                {/* Visual Accent Bar */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${isPending ? 'bg-[#ba1a1a]' : 'bg-[#70C145]'}`} />
                
                {/* Header info */}
                <div className="pl-2 flex items-start justify-between mb-2">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center space-x-1">
                      <span>{d.contacto}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">#{d.id.slice(0, 5)}</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">
                      {d.descripcion || <span className="italic text-slate-300">Sin nota descriptiva</span>}
                    </p>
                  </div>

                  <div className="flex flex-col items-end space-y-1">
                    {d.cuenta === 'Nina' ? (
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-[#dfe0ff] text-[#071155] border border-indigo-100 font-mono">
                        Nina
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-[#a3f875]/25 text-[#1e5200] border border-[#a3f875]/40 font-mono">
                        Nando
                      </span>
                    )}

                    {isPending ? (
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#ba1a1a] bg-rose-50 px-1.5 py-0.5 rounded-sm border border-rose-100 animate-pulse-subtle">
                        Pendiente
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#2c7100] bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-[#a0f572]/40">
                        Saldado
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount grid */}
                <div className="pl-2 grid grid-cols-2 gap-3 my-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Original</span>
                    <p className="text-xs font-bold text-slate-700 font-mono mt-0.5">{formatValue(d.monto)}</p>
                    {isConverted && (
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5 leading-none">
                        {formatVES(d.monto * displayTasa)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Exigible</span>
                    <p className={`text-xs font-black font-mono mt-0.5 ${isPending ? 'text-[#ba1a1a]' : 'text-slate-500'}`}>
                      {formatValue(d.saldo)}
                    </p>
                    {isConverted && d.saldo > 0 && (
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5 leading-none">
                        {formatVES(d.saldo * displayTasa)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress bar if partially paid */}
                {isPending && cobradoPercent > 0 && (
                  <div className="pl-2 mb-3">
                    <div className="flex justify-between items-center text-[10px] text-slate-450 font-semibold mb-1">
                      <span>Capital Abonado</span>
                      <span className="text-[#2a6c00] font-bold">{cobradoPercent}% cobrado</span>
                    </div>
                    <div className="w-full bg-slate-150 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#70C145] h-full" style={{ width: `${cobradoPercent}%` }} />
                    </div>
                  </div>
                )}

                {/* Dates & Rates metadata */}
                <div className="pl-2 flex items-center justify-between text-[10px] text-slate-500 font-medium my-2.5">
                  <div className="flex items-center space-x-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Pago: <strong className="text-[#040d53] font-bold">{formatMonthName(d.mesPago)}</strong></span>
                  </div>
                  <div className="text-slate-400 font-mono">
                    Tasa: {displayTasa.toFixed(2)} | Reg: {formatDateLabel(d.fecha)}
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="pl-2 pt-2.5 border-t border-slate-100 flex items-center gap-2">
                  <button 
                    onClick={() => onOpenDetails(d.id)}
                    className="flex-1 py-2 px-3 bg-[#040d53] hover:bg-[#1d2667] text-white font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 transition shadow-xs active:scale-95 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Abonar / Detalles</span>
                  </button>

                  <button 
                    onClick={handleShare}
                    className="p-2 text-slate-500 hover:text-[#2a6c00] hover:bg-emerald-50 border border-slate-150 rounded-lg transition active:scale-95 cursor-pointer"
                    title="Copiar recordatorio para enviar a WhatsApp"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>

                  <button 
                    onClick={() => onDeleteDebt(d.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-150 rounded-lg transition active:scale-95 cursor-pointer"
                    title="Eliminar préstamo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center text-slate-450 text-xs font-semibold">
            No se encontraron préstamos que coincidan con los filtros aplicados.
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (hidden on mobile, visible on medium and larger screens) */}
      <div className="hidden md:block bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="bg-[#f3f3f6] border-b border-[#e2e8f0] text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Cuenta</th>
                <th className="py-4 px-6">Beneficiario/Cliente</th>
                <th 
                  className="py-4 px-6 cursor-pointer hover:bg-slate-200/55 select-none transition"
                  onClick={() => toggleSort('fecha')}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Fecha Registro</span>
                    <span className="text-[10px] text-slate-400">
                      {sortBy === 'fecha' ? (sortOrder === 'desc' ? '▼' : '▲') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-4 px-6">Mes de Pago</th>
                <th className="py-4 px-6">Detalles / Nota</th>
                <th className="py-4 px-6">Tasa Cambio</th>
                <th 
                  className="py-4 px-6 cursor-pointer hover:bg-slate-200/55 select-none transition"
                  onClick={() => toggleSort('monto')}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Monto Original</span>
                    <span className="text-[10px] text-slate-400">
                      {sortBy === 'monto' ? (sortOrder === 'desc' ? '▼' : '▲') : '⇅'}
                    </span>
                  </div>
                </th>
                <th 
                  className="py-4 px-6 cursor-pointer hover:bg-slate-200/55 select-none transition"
                  onClick={() => toggleSort('saldo')}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Saldo Pendiente</span>
                    <span className="text-[10px] text-slate-400">
                      {sortBy === 'saldo' ? (sortOrder === 'desc' ? '▼' : '▲') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-4 px-6 text-center">Estado</th>
                <th className="py-4 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {filteredDeudas.length > 0 ? (
                filteredDeudas.map(d => {
                  const displayTasa = d.tasaCambio || 1;
                  const isConverted = displayTasa !== 1;
                  return (
                    <tr 
                      key={d.id} 
                      className="hover:bg-slate-50/80 transition-colors duration-150 group"
                    >
                      <td className="py-4 px-6">
                        {d.cuenta === 'Nina' ? (
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[#dfe0ff] text-[#071155] border border-indigo-100">
                            Nina
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                            Nando
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div 
                          className="font-bold text-slate-900 group-hover:text-[#040d53] cursor-pointer flex items-center space-x-1 transition"
                          onClick={() => onOpenDetails(d.id)}
                        >
                          <span className="truncate max-w-[140px]">{d.contacto}</span>
                          <Eye className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-mono">
                        {formatDateLabel(d.fecha)}
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-semibold font-sans">
                        {formatMonthName(d.mesPago)}
                      </td>
                      <td 
                        className="py-4 px-6 text-slate-500 max-w-[180px] truncate" 
                        title={d.descripcion}
                      >
                        {d.descripcion || <span className="italic text-slate-300">Sin detalles</span>}
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-mono text-center">
                        {displayTasa.toFixed(4)}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-700">
                          {formatValue(d.monto)}
                        </div>
                        {isConverted && (
                          <div className="text-[10px] text-slate-450 font-mono font-medium mt-0.5" title="Monto convertido en bolívares (VES)">
                            Conv: {formatVES(d.monto * displayTasa)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className={`font-extrabold ${d.saldo > 0 ? 'text-[#ba1a1a]' : 'text-slate-500'}`}>
                          {formatValue(d.saldo)}
                        </div>
                        {isConverted && d.saldo > 0 && (
                          <div className="text-[10px] text-slate-450 font-mono font-medium mt-0.5" title="Saldo convertido en bolívares (VES)">
                            Conv: {formatVES(d.saldo * displayTasa)}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {d.estado === 'saldado' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#a0f572]/20 text-[#2c7100] border border-[#a0f572] uppercase">
                            Saldado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-[#ba1a1a] border border-rose-100 uppercase animate-pulse">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            onClick={() => onOpenDetails(d.id)}
                            className="text-slate-400 hover:text-[#040d53] p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-indigo-50 hover:border-indigo-200 transition cursor-pointer"
                            title="Ver detalles e historial de abonos"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => onDeleteDebt(d.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg border border-[#e2e8f0] hover:bg-rose-50 hover:border-rose-100 transition cursor-pointer"
                            title="Eliminar este préstamo por completo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-450 text-sm font-semibold">
                    No se encontraron préstamos que coincidan con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
