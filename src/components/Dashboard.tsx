import React, { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { CalendarClock, ChevronRight, CircleAlert, HandCoins, PiggyBank, Plus, TrendingUp, Wallet, X } from 'lucide-react';
import { Debt, Payment } from '../types';
import { activeMonths, agingBuckets, flowByMonth, outstandingByMonth, pendingByTag, summarize, topDebtors } from '../lib/analytics';
import { getDueStatus } from '../lib/dueStatus';
import { formatUsd, formatUsdCompact } from '../lib/format';
import { tagColorVar, tagLabel } from '../lib/tags';
import { formatMonthName } from '../utils/storage';
import { readChartColors, ResolvedTheme } from '../hooks/useTheme';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Avatar, DueChip, ProgressBar } from './ui';
import UpcomingDueWidget from './UpcomingDueWidget';
import NinaVsNandoComparison from './NinaVsNandoComparison';
import ExchangeRateCalculator from './ExchangeRateCalculator';

interface DashboardProps {
  theme: ResolvedTheme;
  deudas: Debt[];
  pagos: Payment[];
  accountView: 'Ambos' | 'Nina' | 'Nando';
  onOpenNewDebt: () => void;
  onOpenDetails: (id: string) => void;
}

const shortMonth = (key: string) => {
  const [y, m] = key.split('-');
  const name = formatMonthName(key).split(' ')[0];
  return m === '01' ? `${name} ${y.slice(2)}` : name;
};

function ChartTooltip({ active, payload, label, labelFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-surface-high text-on-surface m3-elevation-2 px-3 py-2 text-sm min-w-36">
      <p className="text-xs font-semibold text-on-surface-variant mb-1">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 tabular-nums">
          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: p.color || p.payload?.fill }} aria-hidden="true" />
          <span className="text-on-surface-variant">{p.name}</span>
          <span className="ml-auto font-semibold">{formatUsd(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Card({ title, subtitle, action, children, className = '' }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`m3-card rounded-3xl p-4 sm:p-6 ${className}`}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function StatTile({ icon: Icon, label, value, sub, tone, onClick }: {
  icon: typeof Wallet; label: string; value: string; sub: string;
  tone: 'primary' | 'error' | 'warning' | 'success'; onClick?: () => void;
}) {
  const toneCls = {
    primary: 'bg-primary-container text-on-primary-container',
    error: 'bg-error-container text-on-error-container',
    warning: 'bg-warning-container text-on-warning-container',
    success: 'bg-success-container text-on-success-container'
  }[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`m3-card m3-state rounded-3xl p-4 text-left flex flex-col gap-3 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className={`h-10 w-10 rounded-2xl flex items-center justify-center ${toneCls}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm text-on-surface-variant">{label}</span>
        <span className="block text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        <span className="block text-xs text-on-surface-variant mt-0.5">{sub}</span>
      </span>
    </Tag>
  );
}

export default function Dashboard({ theme, deudas, pagos, accountView, onOpenNewDebt, onOpenDetails }: DashboardProps) {
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null);
  const [flowTable, setFlowTable] = useState(false);
  const today = useMemo(() => new Date(), []);
  // Re-read token colors whenever the theme changes.
  const colors = useMemo(() => readChartColors(), [theme]);

  const viewDeudas = useMemo(() => (accountView === 'Ambos' ? deudas : deudas.filter(d => d.cuenta === accountView)), [deudas, accountView]);
  const viewPagos = useMemo(() => {
    const ids = new Set(viewDeudas.map(d => d.id));
    return pagos.filter(p => ids.has(p.deudaId));
  }, [pagos, viewDeudas]);

  const s = useMemo(() => summarize(viewDeudas, viewPagos, today), [viewDeudas, viewPagos, today]);
  const months = useMemo(() => activeMonths(viewDeudas, 12, today), [viewDeudas, today]);
  const outstanding = useMemo(() => outstandingByMonth(viewDeudas, viewPagos, months), [viewDeudas, viewPagos, months]);
  const flow = useMemo(() => flowByMonth(viewDeudas, viewPagos, months.slice(-6)), [viewDeudas, viewPagos, months]);
  const aging = useMemo(() => agingBuckets(viewDeudas, today), [viewDeudas, today]);
  const byTag = useMemo(() => pendingByTag(viewDeudas), [viewDeudas]);
  const top = useMemo(() => topDebtors(viewDeudas, 5), [viewDeudas]);
  const recoveredPct = s.prestado > 0 ? (s.recuperado / s.prestado) * 100 : 0;
  const pendingIds = useMemo(() => viewDeudas.filter(d => d.estado === 'pendiente').map(d => d.id), [viewDeudas]);

  if (viewDeudas.length === 0) {
    return (
      <div className="m3-card rounded-[28px] p-10 text-center space-y-4">
        <PiggyBank className="h-12 w-12 mx-auto text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-semibold">Aún no hay préstamos{accountView !== 'Ambos' ? ` en la cuenta de ${accountView}` : ''}</h2>
        <p className="text-on-surface-variant">Cuando registres uno verás aquí cuánto te deben, qué vence y cómo vas cobrando.</p>
        <button type="button" onClick={onOpenNewDebt} className="m3-state h-12 px-6 rounded-full bg-primary text-on-primary font-semibold inline-flex items-center gap-2 cursor-pointer">
          <Plus className="h-5 w-5" /> Registrar préstamo
        </button>
      </div>
    );
  }

  const axisTick = { fill: colors.muted, fontSize: 12 };
  const maxTag = Math.max(...byTag.map(t => t.saldo), 1);
  const maxTop = Math.max(...top.map(t => t.saldo), 1);

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Hero: how much is owed */}
      <section className="rounded-[28px] bg-primary-container text-on-primary-container p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end gap-5">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-80">Te deben en total</p>
          <p className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums leading-none mt-2">{formatUsd(s.porCobrar)}</p>
          <p className="text-sm mt-3 opacity-80">
            {s.activos} préstamo{s.activos === 1 ? '' : 's'} activo{s.activos === 1 ? '' : 's'} · {s.personas} persona{s.personas === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDrill({ title: 'Préstamos vencidos', ids: s.vencidoIds })} disabled={!s.vencidoIds.length}
            className="m3-state h-10 px-4 rounded-full bg-surface-lowest text-on-surface text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:cursor-default">
            <CircleAlert className="h-4 w-4 text-error" aria-hidden="true" />
            Vencido {formatUsd(s.vencido)}
          </button>
          <button type="button" onClick={() => setDrill({ title: 'Vencen este mes', ids: s.venceMesIds })} disabled={!s.venceMesIds.length}
            className="m3-state h-10 px-4 rounded-full bg-surface-lowest text-on-surface text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:cursor-default">
            <CalendarClock className="h-4 w-4 text-tertiary" aria-hidden="true" />
            Este mes {formatUsd(s.venceMes)}
          </button>
        </div>
      </section>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile icon={Wallet} tone="primary" label="Prestado" value={formatUsd(s.prestado)} sub={`${viewDeudas.length} préstamos en total`} />
        <StatTile icon={TrendingUp} tone="success" label="Recuperado" value={formatUsd(s.recuperado)} sub={`${Math.round(recoveredPct)}% de lo prestado`} />
        <StatTile icon={CircleAlert} tone="error" label="Vencido" value={formatUsd(s.vencido)} sub={`${s.vencidoIds.length} préstamo${s.vencidoIds.length === 1 ? '' : 's'} · ver`}
          onClick={() => setDrill({ title: 'Préstamos vencidos', ids: s.vencidoIds })} />
        <StatTile icon={HandCoins} tone="warning" label="Cobrado este mes" value={formatUsd(s.cobradoMes)} sub={formatMonthName(months[months.length - 1])} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

        {/* Outstanding balance over time (single series: title names it) */}
        <Card className="xl:col-span-2" title="Saldo por cobrar" subtitle="Lo que te deben al cierre de cada mes">
          <div className="h-60 sm:h-72 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={outstanding} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="df-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.series[0]} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={colors.series[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="mes" tickFormatter={shortMonth} tick={axisTick} tickLine={false} axisLine={{ stroke: colors.axis }} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={formatUsdCompact} tick={axisTick} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<ChartTooltip labelFormatter={formatMonthName} />} cursor={{ stroke: colors.axis, strokeWidth: 1 }} />
                <Area type="monotone" dataKey="saldo" name="Por cobrar" stroke={colors.series[0]} strokeWidth={2} fill="url(#df-area)"
                  dot={false} activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top debtors */}
        <Card title="Quién te debe más" subtitle="Saldo pendiente por persona">
          <ol className="space-y-3">
            {top.map(t => (
              <li key={t.name}>
                <button type="button" onClick={() => setDrill({ title: t.name, ids: t.debtIds })} className="m3-state w-full rounded-2xl p-2 -m-2 flex items-center gap-3 text-left cursor-pointer">
                  <Avatar name={t.name} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{t.name}</span>
                      <span className="text-sm font-bold tabular-nums">{formatUsd(t.saldo)}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 rounded-full bg-surface-high overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${(t.saldo / maxTop) * 100}%`, background: colors.series[0] }} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {top.length === 0 && <p className="text-sm text-on-surface-variant">Nadie te debe nada. 🎉</p>}
          </ol>
        </Card>

        {/* Lent vs recovered per month (2 series: legend + table view) */}
        <Card
          className="xl:col-span-2"
          title="Prestado y cobrado"
          subtitle="Últimos 6 meses"
          action={
            <button type="button" onClick={() => setFlowTable(v => !v)} aria-pressed={flowTable}
              className="m3-state h-10 px-3 rounded-full text-sm font-semibold text-primary cursor-pointer shrink-0">
              {flowTable ? 'Ver gráfico' : 'Ver tabla'}
            </button>
          }
        >
          <div className="flex gap-4 text-sm mb-3" aria-hidden={flowTable}>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: colors.series[0] }} />Prestado</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: colors.series[2] }} />Cobrado</span>
          </div>
          {flowTable ? (
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="text-on-surface-variant text-left"><th className="py-2 font-medium">Mes</th><th className="py-2 font-medium text-right">Prestado</th><th className="py-2 font-medium text-right">Cobrado</th></tr></thead>
              <tbody>
                {flow.map(r => (
                  <tr key={r.mes} className="border-t border-outline-variant/60">
                    <td className="py-2">{formatMonthName(r.mes)}</td>
                    <td className="py-2 text-right">{formatUsd(r.prestado)}</td>
                    <td className="py-2 text-right">{formatUsd(r.cobrado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-60 sm:h-72 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis dataKey="mes" tickFormatter={shortMonth} tick={axisTick} tickLine={false} axisLine={{ stroke: colors.axis }} />
                  <YAxis tickFormatter={formatUsdCompact} tick={axisTick} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<ChartTooltip labelFormatter={formatMonthName} />} cursor={{ fill: colors.surfaceHigh, opacity: 0.6 }} />
                  <Bar dataKey="prestado" name="Prestado" fill={colors.series[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="cobrado" name="Cobrado" fill={colors.series[2]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* By tag */}
        <Card title="Por etiqueta" subtitle="Saldo pendiente según el tipo de préstamo">
          <ul className="space-y-3">
            {byTag.map(t => (
              <li key={t.tag}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: tagColorVar(t.tag) }} aria-hidden="true" />
                    {tagLabel(t.tag)}
                    <span className="text-on-surface-variant font-normal">· {t.count}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatUsd(t.saldo)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-surface-high overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(t.saldo / maxTag) * 100}%`, background: tagColorVar(t.tag) }} />
                </div>
              </li>
            ))}
            {byTag.length === 0 && <p className="text-sm text-on-surface-variant">Sin saldos pendientes.</p>}
          </ul>
        </Card>

        {/* Aging (ordinal ramp, direct labels) */}
        <Card className="xl:col-span-2" title="Antigüedad del saldo" subtitle="Cuánto tiempo lleva prestado lo que aún te deben">
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aging} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.axis }} />
                <YAxis tickFormatter={formatUsdCompact} tick={axisTick} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: colors.surfaceHigh, opacity: 0.6 }} />
                <Bar dataKey="saldo" name="Saldo" radius={[4, 4, 0, 0]} maxBarSize={64}>
                  {aging.map((_, i) => <Cell key={i} fill={colors.seq[i]} />)}
                  <LabelList dataKey="saldo" position="top" formatter={(v: any) => (Number(v) > 0 ? formatUsd(Number(v)) : '')} style={{ fill: colors.inkVariant, fontSize: 12, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recovery progress */}
        <Card title="Recuperación" subtitle="Lo cobrado frente a lo prestado">
          <p className="text-4xl font-bold tabular-nums">{Math.round(recoveredPct)}%</p>
          <div className="mt-3"><ProgressBar value={recoveredPct} label={`Recuperado ${Math.round(recoveredPct)}%`} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-on-surface-variant">Recuperado</dt><dd className="font-semibold tabular-nums">{formatUsd(s.recuperado)}</dd></div>
            <div><dt className="text-on-surface-variant">Falta</dt><dd className="font-semibold tabular-nums">{formatUsd(s.porCobrar)}</dd></div>
          </dl>
          <button type="button" onClick={() => setDrill({ title: 'Préstamos activos', ids: pendingIds })}
            className="m3-state mt-4 h-10 px-4 -ml-4 rounded-full text-sm font-semibold text-primary inline-flex items-center gap-1 cursor-pointer">
            Ver préstamos activos <ChevronRight className="h-4 w-4" />
          </button>
        </Card>
      </div>

      {/* Agenda + accounts + exchange rate */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <UpcomingDueWidget deudas={viewDeudas} onOpenDetails={onOpenDetails} />
        <NinaVsNandoComparison deudas={deudas} />
        <ExchangeRateCalculator deudas={viewDeudas} />
      </div>

      {drill && (
        <DrillSheet
          title={drill.title}
          debts={viewDeudas.filter(d => drill.ids.includes(d.id))}
          today={today}
          onClose={() => setDrill(null)}
          onOpen={(id) => { setDrill(null); onOpenDetails(id); }}
        />
      )}
    </div>
  );
}

// Bottom sheet (phones) / dialog (desktop) listing the loans behind a number.
function DrillSheet({ title, debts, today, onClose, onOpen }: {
  title: string; debts: Debt[]; today: Date; onClose: () => void; onOpen: (id: string) => void;
}) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  const sorted = [...debts].sort((a, b) => b.saldo - a.saldo);
  return (
    <div className="fixed inset-0 z-50 bg-scrim/40 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drill-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[80dvh] flex flex-col bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] m3-elevation-3 animate-sheet-in pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sm:hidden mx-auto mt-3 h-1 w-8 rounded-full bg-outline" aria-hidden="true" />
        <header className="flex items-center gap-3 px-6 pt-4 pb-2">
          <h2 id="drill-title" className="text-xl font-semibold flex-1">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="m3-state h-12 w-12 rounded-full flex items-center justify-center cursor-pointer text-on-surface-variant">
            <X className="h-5 w-5" />
          </button>
        </header>
        <ul className="overflow-y-auto px-3 pb-4">
          {sorted.map(d => (
            <li key={d.id}>
              <button type="button" onClick={() => onOpen(d.id)} className="m3-state w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left cursor-pointer">
                <Avatar name={d.contacto} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{d.contacto}</span>
                  <span className="mt-1 block"><DueChip status={getDueStatus(d, today)} /></span>
                </span>
                <span className="text-base font-bold tabular-nums">{formatUsd(d.saldo)}</span>
              </button>
            </li>
          ))}
          {sorted.length === 0 && <li className="px-3 py-6 text-sm text-on-surface-variant text-center">No hay préstamos aquí.</li>}
        </ul>
      </div>
    </div>
  );
}

