import React, { useMemo, useState } from 'react';
import { motion, PanInfo } from 'motion/react';
import { Check, ChevronDown, Copy, Download, HandCoins, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Debt } from '../types';
import { formatMonthName } from '../utils/storage';
import { getDueStatus } from '../lib/dueStatus';
import { formatUsd, formatVes } from '../lib/format';
import { normalizeTag, tagColorVar, tagLabel, tagOptions } from '../lib/tags';
import { AccountChip, Avatar, DueChip, ProgressBar, TagChip } from './ui';

interface DebtsListProps {
  deudas: Debt[];
  accountView: 'Ambos' | 'Nina' | 'Nando';
  onOpenDetails: (id: string) => void;
  onOpenAbono: (id: string) => void;
  onOpenNewDebt: () => void;
  onDeleteDebt: (id: string) => void;
  onNotify?: (message: string) => void;
}

type Status = 'pendiente' | 'saldado' | 'todos';
type SortKey = 'vence' | 'fecha' | 'saldo' | 'monto';

const SORT_LABEL: Record<SortKey, string> = {
  vence: 'Vence primero',
  fecha: 'Más recientes',
  saldo: 'Mayor saldo',
  monto: 'Mayor monto'
};

const STATUS_CHIPS: [Status, string][] = [['pendiente', 'Pendientes'], ['saldado', 'Saldados'], ['todos', 'Todos']];

function FilterChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`m3-state h-8 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
        selected
          ? 'bg-secondary-container text-on-secondary-container border-transparent'
          : 'border-outline-variant text-on-surface-variant'
      }`}
    >
      {selected && <Check className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="absolute left-3 top-1.5 text-[11px] font-medium text-on-surface-variant">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-full h-14 pt-4 pl-3 pr-9 rounded-xl border border-outline-variant bg-surface-lowest text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
    </label>
  );
}

export default function DebtsList({ deudas, accountView, onOpenDetails, onOpenAbono, onOpenNewDebt, onDeleteDebt, onNotify }: DebtsListProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('pendiente');
  const [tag, setTag] = useState<string>('todas');
  const [contacto, setContacto] = useState('todos');
  const [mes, setMes] = useState('todos');
  const [sortBy, setSortBy] = useState<SortKey>('vence');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const viewDeudas = useMemo(
    () => (accountView === 'Ambos' ? deudas : deudas.filter(d => d.cuenta === accountView)),
    [deudas, accountView]
  );

  const byStatus = useMemo(
    () => (status === 'todos' ? viewDeudas : viewDeudas.filter(d => d.estado === status)),
    [viewDeudas, status]
  );

  const tagsInUse = useMemo(() => {
    const used = byStatus.map(d => normalizeTag(d.tipo)).filter(Boolean);
    return tagOptions(used).filter(t => used.includes(t));
  }, [byStatus]);
  const contactos = useMemo(() => [...new Set(byStatus.map(d => d.contacto))].sort((a, b) => a.localeCompare(b)), [byStatus]);
  const meses = useMemo(() => [...new Set(byStatus.map(d => d.mesPago))].filter(Boolean).sort(), [byStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = byStatus.filter(d =>
      (!q || d.contacto.toLowerCase().includes(q) || d.descripcion.toLowerCase().includes(q) || d.creadoPor.toLowerCase().includes(q)) &&
      (tag === 'todas' || normalizeTag(d.tipo) === tag) &&
      (contacto === 'todos' || d.contacto === contacto) &&
      (mes === 'todos' || d.mesPago === mes)
    );
    const dueKey = (d: Debt) => (d.estado === 'saldado' ? Number.MAX_SAFE_INTEGER : getDueStatus(d, today).days ?? Number.MAX_SAFE_INTEGER - 1);
    return list.sort((a, b) => {
      if (sortBy === 'vence') return dueKey(a) - dueKey(b) || b.saldo - a.saldo;
      if (sortBy === 'fecha') return b.fecha.localeCompare(a.fecha);
      if (sortBy === 'saldo') return b.saldo - a.saldo;
      return b.monto - a.monto;
    });
  }, [byStatus, search, tag, contacto, mes, sortBy, today]);

  const totals = useMemo(() => {
    const original = filtered.reduce((s, d) => s + d.monto, 0);
    const pendiente = filtered.reduce((s, d) => s + d.saldo, 0);
    return { original, pendiente, cobrado: original - pendiente };
  }, [filtered]);

  const extraFilters = (contacto !== 'todos' ? 1 : 0) + (mes !== 'todos' ? 1 : 0) + (sortBy !== 'vence' ? 1 : 0);
  const anyFilter = !!search.trim() || tag !== 'todas' || extraFilters > 0 || status !== 'pendiente';

  const clearFilters = () => {
    setSearch(''); setTag('todas'); setContacto('todos'); setMes('todos'); setSortBy('vence'); setStatus('pendiente');
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ['ID', 'Cuenta', 'Contacto', 'Etiqueta', 'Concepto', 'Fecha', 'Mes de pago', 'Tasa', 'Monto', 'Saldo', 'Estado', 'Registrado por'];
    const rows = filtered.map(d => [d.id, d.cuenta, esc(d.contacto), esc(tagLabel(d.tipo)), esc(d.descripcion), d.fecha, d.mesPago, d.tasaCambio, d.monto, d.saldo, d.estado, d.creadoPor]);
    const blob = new Blob(['﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deudaflow_prestamos_${accountView.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyReminder = async (d: Debt) => {
    const text = `Hola ${d.contacto}, te escribo para recordarte el saldo pendiente de ${formatUsd(d.saldo)} (pago de ${formatMonthName(d.mesPago)}) del préstamo de ${formatUsd(d.monto)}. ¡Gracias!`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(d.id);
      setTimeout(() => setCopiedId(prev => (prev === d.id ? null : prev)), 2000);
      onNotify?.('Recordatorio copiado. Pégalo en WhatsApp.');
    } catch {
      onNotify?.('No se pudo copiar el recordatorio.');
    }
  };

  return (
    <div className="space-y-4">

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Buscar préstamos</span>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente o concepto"
              className="w-full h-14 pl-12 pr-4 rounded-full bg-surface-high text-on-surface placeholder:text-on-surface-variant text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            aria-expanded={showFilters}
            aria-controls="debts-filters"
            aria-label={`Más filtros${extraFilters ? ` (${extraFilters} activos)` : ''}`}
            className={`m3-state relative h-14 w-14 rounded-full flex items-center justify-center cursor-pointer ${
              showFilters || extraFilters ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-high text-on-surface-variant'
            }`}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {extraFilters > 0 && (
              <span className="absolute top-1.5 right-1.5 h-5 min-w-5 px-1 rounded-full bg-error text-on-error text-[11px] font-bold flex items-center justify-center">{extraFilters}</span>
            )}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [scrollbar-width:none]">
          {STATUS_CHIPS.map(([value, label]) => (
            <FilterChip key={value} selected={status === value} onClick={() => setStatus(value)}>{label}</FilterChip>
          ))}
          {tagsInUse.length > 0 && <span className="w-px shrink-0 bg-outline-variant mx-1" aria-hidden="true" />}
          {tagsInUse.map(t => (
            <FilterChip key={t} selected={tag === t} onClick={() => setTag(tag === t ? 'todas' : t)}>
              {tag !== t && <span className="h-2 w-2 rounded-full" style={{ background: tagColorVar(t) }} aria-hidden="true" />}
              {tagLabel(t)}
            </FilterChip>
          ))}
        </div>

        {showFilters && (
          <div id="debts-filters" className="m3-card rounded-3xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in">
            <SelectField label="Cliente" value={contacto} onChange={setContacto}>
              <option value="todos">Todos</option>
              {contactos.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <SelectField label="Mes de pago" value={mes} onChange={setMes}>
              <option value="todos">Todos</option>
              {meses.map(m => <option key={m} value={m}>{formatMonthName(m)}</option>)}
            </SelectField>
            <SelectField label="Ordenar" value={sortBy} onChange={v => setSortBy(v as SortKey)}>
              {(Object.keys(SORT_LABEL) as SortKey[]).map(k => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
            </SelectField>
            <div className="sm:col-span-3 flex flex-wrap gap-2 justify-end">
              {anyFilter && (
                <button type="button" onClick={clearFilters} className="m3-state h-10 px-4 rounded-full text-sm font-semibold text-primary inline-flex items-center gap-1.5 cursor-pointer">
                  <X className="h-4 w-4" /> Limpiar filtros
                </button>
              )}
              <button type="button" onClick={handleExportCSV} disabled={filtered.length === 0} className="m3-state h-10 px-4 rounded-full border border-outline text-sm font-semibold text-primary inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40">
                <Download className="h-4 w-4" /> Exportar CSV
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Totals for what is shown */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-container p-3 text-center">
        <div>
          <p className="text-xs text-on-surface-variant">Prestado</p>
          <p className="text-base sm:text-lg font-bold tabular-nums">{formatUsd(totals.original)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Cobrado</p>
          <p className="text-base sm:text-lg font-bold tabular-nums text-success">{formatUsd(totals.cobrado)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Por cobrar</p>
          <p className="text-base sm:text-lg font-bold tabular-nums">{formatUsd(totals.pendiente)}</p>
        </div>
      </div>
      <p className="text-sm text-on-surface-variant px-1" aria-live="polite">
        {filtered.length} préstamo{filtered.length === 1 ? '' : 's'}
        {anyFilter && <> · <button type="button" onClick={clearFilters} className="text-primary font-semibold underline-offset-2 hover:underline cursor-pointer">quitar filtros</button></>}
        {filtered.length > 0 && <span className="md:hidden"> · desliza → para abonar, ← para eliminar</span>}
      </p>

      {/* Cards */}
      {filtered.length > 0 ? (
        <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {filtered.map(d => (
            <DebtCard
              key={d.id}
              debt={d}
              today={today}
              copied={copiedId === d.id}
              onOpen={() => onOpenDetails(d.id)}
              onAbono={() => onOpenAbono(d.id)}
              onDelete={() => onDeleteDebt(d.id)}
              onCopy={() => copyReminder(d)}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-outline-variant p-10 text-center space-y-3">
          <HandCoins className="h-10 w-10 mx-auto text-outline" aria-hidden="true" />
          <p className="text-base font-semibold">{viewDeudas.length === 0 ? 'Aún no hay préstamos' : 'Ningún préstamo coincide'}</p>
          <p className="text-sm text-on-surface-variant">
            {viewDeudas.length === 0 ? 'Registra el primero con el botón +.' : 'Prueba con otros filtros o búscalo por nombre.'}
          </p>
          {viewDeudas.length === 0 ? (
            <button type="button" onClick={onOpenNewDebt} className="m3-state h-10 px-5 rounded-full bg-primary text-on-primary text-sm font-semibold cursor-pointer">Registrar préstamo</button>
          ) : (
            <button type="button" onClick={clearFilters} className="m3-state h-10 px-5 rounded-full border border-outline text-primary text-sm font-semibold cursor-pointer">Quitar filtros</button>
          )}
        </div>
      )}
    </div>
  );
}

interface DebtCardProps {
  debt: Debt;
  today: Date;
  copied: boolean;
  onOpen: () => void;
  onAbono: () => void;
  onDelete: () => void;
  onCopy: () => void;
}

function DebtCard({ debt: d, today, copied, onOpen, onAbono, onDelete, onCopy }: DebtCardProps) {
  const due = getDueStatus(d, today);
  const pending = d.estado === 'pendiente';
  const paidPct = d.monto > 0 ? ((d.monto - d.saldo) / d.monto) * 100 : 0;
  const hasRate = (d.tasaCambio || 1) !== 1;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 90 && pending) onAbono();
    else if (info.offset.x < -90) onDelete();
  };

  return (
    <li className="relative rounded-3xl overflow-hidden touch-pan-y">
      {/* Swipe trays (phones) */}
      <div className="md:hidden absolute inset-0 flex justify-between items-center px-5 text-sm font-semibold bg-surface-container" aria-hidden="true">
        <span className={`flex items-center gap-2 ${pending ? 'text-success' : 'opacity-0'}`}><HandCoins className="h-5 w-5" /> Abonar</span>
        <span className="flex items-center gap-2 text-error">Eliminar <Trash2 className="h-5 w-5" /></span>
      </div>

      <motion.article
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        dragSnapToOrigin
        onDragEnd={handleDragEnd}
        className="relative m3-card rounded-3xl p-4 sm:p-5 flex flex-col gap-3 h-full"
      >
        <button
          type="button"
          onClick={onOpen}
          className="text-left flex items-start gap-3 cursor-pointer rounded-2xl -m-1 p-1"
          aria-label={`Ver detalle de ${d.contacto}`}
        >
          <Avatar name={d.contacto} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold truncate">{d.contacto}</h3>
              <AccountChip cuenta={d.cuenta} />
            </div>
            <p className="text-sm text-on-surface-variant truncate">{d.descripcion || 'Sin descripción'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xl font-bold tabular-nums leading-tight ${pending ? 'text-on-surface' : 'text-on-surface-variant'}`}>{formatUsd(d.saldo)}</p>
            <p className="text-xs text-on-surface-variant tabular-nums">de {formatUsd(d.monto)}</p>
            {hasRate && pending && <p className="text-[11px] text-on-surface-variant tabular-nums">{formatVes(d.saldo * d.tasaCambio)}</p>}
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <DueChip status={due} />
          <TagChip tag={d.tipo} />
        </div>

        {pending && (
          <div className="space-y-1">
            <ProgressBar value={paidPct} label={`Cobrado ${Math.round(paidPct)}%`} />
            <p className="text-xs text-on-surface-variant tabular-nums">Cobrado {Math.round(paidPct)}% · {formatUsd(d.monto - d.saldo)}</p>
          </div>
        )}

        <div className="flex items-center gap-1 pt-2 border-t border-outline-variant/60 mt-auto">
          {pending && (
            <button type="button" onClick={onAbono} className="m3-state h-10 px-4 rounded-full bg-secondary-container text-on-secondary-container text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer">
              <HandCoins className="h-4 w-4" /> Abonar
            </button>
          )}
          <button type="button" onClick={onOpen} className="m3-state h-10 px-3 rounded-full text-primary text-sm font-semibold cursor-pointer">
            Detalle
          </button>
          <span className="flex-1" />
          {pending && (
            <button type="button" onClick={onCopy} title="Copiar recordatorio de cobro" aria-label="Copiar recordatorio de cobro" className="m3-state h-12 w-12 rounded-full text-on-surface-variant flex items-center justify-center cursor-pointer">
              {copied ? <Check className="h-5 w-5 text-success" /> : <Copy className="h-5 w-5" />}
            </button>
          )}
          <button type="button" onClick={onDelete} title="Eliminar préstamo" aria-label="Eliminar préstamo" className="m3-state h-12 w-12 rounded-full text-on-surface-variant hover:text-error flex items-center justify-center cursor-pointer">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </motion.article>
    </li>
  );
}
