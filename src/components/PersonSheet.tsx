import { useState } from 'react';
import { Check, Copy, FileText, MessageCircle, Phone, Plus, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { getDueStatus } from '../lib/dueStatus';
import { formatUsd, formatVes } from '../lib/format';
import { whatsappUrl } from '../lib/phone';
import { PersonSummary, PUNCTUALITY_LABEL } from '../lib/people';
import { formatDateLabel, formatMonthName } from '../utils/storage';
import { Avatar, DueChip, ProgressBar, PunctualityChip, TagChip } from './ui';

interface PersonSheetProps {
  person: PersonSummary;
  limit: number;
  phone?: string;
  onClose: () => void;
  onOpenDebt: (id: string) => void;
  onNewDebt: (name: string) => void;
  onStatement: () => void;
  onNotify: (message: string) => void;
}

// "Ficha por persona": everything about one debtor in one place.
export default function PersonSheet({ person: p, limit, phone = '', onClose, onOpenDebt, onNewDebt, onStatement, onNotify }: PersonSheetProps) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  const [copied, setCopied] = useState(false);
  const loans = [...p.deudas].sort((a, b) => (a.estado === b.estado ? b.fecha.localeCompare(a.fecha) : a.estado === 'pendiente' ? -1 : 1));
  const payments = [...p.pagos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const debtById = new Map(p.deudas.map(d => [d.id, d]));

  const detail = p.onTimeRate === null
    ? 'Todavía no hay préstamos vencidos ni saldados.'
    : `${Math.round(p.onTimeRate * 100)}% a tiempo${p.avgDaysLate ? ` · atraso promedio ${p.avgDaysLate} días` : ''}`;

  const copyReminder = async () => {
    const pending = loans.filter(d => d.estado === 'pendiente');
    const lines = pending.map(d => `• ${d.descripcion || 'Préstamo'} (${formatMonthName(d.mesPago)}): ${formatUsd(d.saldo)}`).join('\n');
    const text = `Hola ${p.name}, te escribo para recordarte el saldo pendiente de ${formatUsd(p.porCobrar)}:\n${lines}\n¡Gracias!`;
    const wa = whatsappUrl(phone, text);
    if (wa) { window.open(wa, '_blank', 'noopener'); return; }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onNotify('Recordatorio copiado. Pégalo en WhatsApp.');
    } catch {
      onNotify('No se pudo copiar el recordatorio.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-scrim/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92dvh] flex flex-col bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] m3-elevation-3 animate-sheet-in"
      >
        <div className="sm:hidden mx-auto mt-3 h-1 w-8 rounded-full bg-outline shrink-0" aria-hidden="true" />
        <header className="flex items-start gap-3 px-6 pt-4 pb-3">
          <Avatar name={p.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 id="person-title" className="text-2xl font-semibold leading-tight truncate">{p.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PunctualityChip value={p.punctuality} label={PUNCTUALITY_LABEL[p.punctuality]} />
            </div>
            <p className="mt-1 text-xs text-on-surface-variant">{detail}</p>
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="m3-state mt-1 -ml-2 h-9 px-2 rounded-full inline-flex items-center gap-1 text-sm text-primary font-semibold">
                <Phone className="h-3.5 w-3.5" /> {phone}
              </a>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="m3-state h-12 w-12 -mr-3 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[['Te debe', formatUsd(p.porCobrar)], ['Prestado', formatUsd(p.prestado)], ['Abonado', formatUsd(p.abonado)], ['Préstamos', `${p.activos} / ${p.deudas.length}`]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-surface-container p-3">
                <dt className="text-xs text-on-surface-variant">{k}</dt>
                <dd className="text-lg font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {limit > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Límite de crédito {formatUsd(limit)}</span>
                <span className={`font-semibold tabular-nums ${p.porCobrar > limit ? 'text-error' : ''}`}>
                  {p.porCobrar > limit ? `Excedido por ${formatUsd(p.porCobrar - limit)}` : `Disponible ${formatUsd(limit - p.porCobrar)}`}
                </span>
              </div>
              <ProgressBar value={(p.porCobrar / limit) * 100} label="Uso del límite de crédito" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onStatement} className="m3-state h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
              <FileText className="h-4 w-4" /> Estado de cuenta
            </button>
            <button type="button" onClick={() => onNewDebt(p.name)} className="m3-state h-10 px-4 rounded-full border border-outline text-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
              <Plus className="h-4 w-4" /> Nuevo préstamo
            </button>
            {p.porCobrar > 0 && (
              <button type="button" onClick={copyReminder} className="m3-state h-10 px-4 rounded-full text-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
                {copied ? <Check className="h-4 w-4" /> : phone ? <MessageCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {phone ? 'Recordar por WhatsApp' : 'Copiar recordatorio'}
              </button>
            )}
          </div>

          <section>
            <h3 className="text-sm font-semibold text-on-surface-variant mb-2">Préstamos</h3>
            <ul className="rounded-2xl border border-outline-variant divide-y divide-outline-variant/60 overflow-hidden">
              {loans.map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => onOpenDebt(d.id)} className="m3-state w-full px-4 py-3 flex items-start gap-3 text-left cursor-pointer">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{d.descripcion || 'Préstamo'}</span>
                      <span className="block text-xs text-on-surface-variant">{formatDateLabel(d.fecha)} · {d.cuenta}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5"><DueChip status={getDueStatus(d)} /><TagChip tag={d.tipo} /></span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-base font-bold tabular-nums">{formatUsd(d.saldo)}</span>
                      <span className="block text-xs text-on-surface-variant tabular-nums">de {formatUsd(d.monto)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-on-surface-variant mb-2">Abonos</h3>
            {payments.length ? (
              <ol className="space-y-2">
                {payments.map(pg => (
                  <li key={pg.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-success shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium">{formatDateLabel(pg.fecha)} · {debtById.get(pg.deudaId)?.descripcion || 'Préstamo'}</span>
                      {pg.nota && <span className="block text-xs text-on-surface-variant truncate">{pg.nota}</span>}
                    </span>
                    <span className="text-right shrink-0 tabular-nums">
                      <span className="block font-semibold text-success">+{formatUsd(pg.monto)}</span>
                      {pg.moneda === 'VES' && pg.montoBs ? <span className="block text-xs text-on-surface-variant">{formatVes(pg.montoBs)} · tasa {pg.tasaCambio}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-on-surface-variant">Todavía no hay abonos.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
