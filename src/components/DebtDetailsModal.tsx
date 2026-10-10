import { useFocusTrap } from '../hooks/useFocusTrap';
import { Avatar, AccountChip, DueChip, TagChip } from './ui';
import { getDueStatus } from '../lib/dueStatus';
import { useMemo } from 'react';
import { Debt, Payment } from '../types';
import { formatDateLabel, formatMonthName } from '../utils/storage';
import { X, ArrowDownLeft, CircleCheck, FileText, Trash2, Pencil, UserRound } from 'lucide-react';
import { formatUsd, formatVes } from '../lib/format';

interface DebtDetailsModalProps {
  isOpen: boolean;
  deudaId: string | null;
  deudas: Debt[];
  pagos: Payment[];
  onClose: () => void;
  onOpenAbono: (deudaId: string) => void;
  onDeletePayment: (id: string) => void;
  activeUser: string;
  onEdit?: (deudaId: string) => void;
  onOpenPerson?: (contacto: string) => void;
  /** One-tap "paid in full": the parent registers an abono for the full balance (with undo). */
  onMarkPaid?: (id: string) => void;
}

export default function DebtDetailsModal({
  isOpen,
  deudaId,
  deudas,
  pagos,
  onClose,
  onOpenAbono,
  onDeletePayment,
  activeUser,
  onEdit,
  onOpenPerson,
  onMarkPaid
}: DebtDetailsModalProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Retrieve selected debt
  const debt = useMemo(() => {
    return deudas.find(d => d.id === deudaId);
  }, [deudas, deudaId]);

  // Associated payments
  const assocPayments = useMemo(() => {
    if (!deudaId) return [];
    const list = pagos.filter(p => p.deudaId === deudaId);
    list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return list;
  }, [pagos, deudaId]);

  if (!isOpen || !debt) return null;

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

  const displayTasa = debt.tasaCambio || 1;
  const isConverted = displayTasa !== 1;

  const isPending = debt.estado === 'pendiente';
  const canMarkPaid = isPending && debt.saldo > 0 && !!onMarkPaid;

  return (
    <div className="fixed inset-0 bg-scrim/40 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        className="bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] max-w-2xl w-full m3-elevation-3 flex flex-col max-h-[92dvh] animate-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto mt-3 h-1 w-8 rounded-full bg-outline shrink-0" aria-hidden="true" />
        <header className="flex items-start gap-3 px-6 pt-4 pb-3 shrink-0">
          <Avatar name={debt.contacto} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 id="detail-title" className="text-2xl font-semibold leading-tight truncate">{debt.contacto}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AccountChip cuenta={debt.cuenta} />
              <DueChip status={getDueStatus(debt)} />
              <TagChip tag={debt.tipo} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="m3-state h-12 w-12 -mr-3 flex items-center justify-center text-on-surface-variant rounded-full cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-6 pb-5 flex-grow space-y-5 scrollbar-thin">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-2xl bg-surface-container p-3">
              <dt className="text-xs text-on-surface-variant">Monto original</dt>
              <dd className="text-lg font-bold tabular-nums">{formatValue(debt.monto)}</dd>
            </div>
            <div className="rounded-2xl bg-surface-container p-3">
              <dt className="text-xs text-on-surface-variant">Saldo exigible</dt>
              <dd className={`text-lg font-bold tabular-nums ${debt.saldo > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{formatValue(debt.saldo)}</dd>
            </div>
            <div className="rounded-2xl bg-surface-container p-3">
              <dt className="text-xs text-on-surface-variant">Mes de pago</dt>
              <dd className="text-base font-semibold">{formatMonthName(debt.mesPago)}</dd>
            </div>
            <div className="rounded-2xl bg-surface-container p-3">
              <dt className="text-xs text-on-surface-variant">Tasa de cambio</dt>
              <dd className="text-base font-semibold tabular-nums">{displayTasa.toFixed(2)}</dd>
            </div>
          </dl>

          {isConverted && (
            <div className="rounded-2xl bg-success-container text-on-success-container p-4 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="block font-semibold tabular-nums">Conversiones con tasa {displayTasa.toFixed(2)}</span>
                <span className="text-xs">Valor convertido a moneda secundaria (VES / Bolívares):</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>Original: <strong className="font-bold tabular-nums">{formatVES(debt.monto * displayTasa)}</strong></span>
                <span>Pendiente: <strong className="font-bold tabular-nums">{formatVES(debt.saldo * displayTasa)}</strong></span>
              </div>
            </div>
          )}

          <section>
            <h4 className="text-base font-semibold mb-2">Concepto de la operación</h4>
            <div className="rounded-2xl border border-outline-variant p-4 flex items-start gap-3">
              <FileText className="h-5 w-5 text-on-surface-variant mt-0.5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm text-on-surface">{debt.descripcion || "Sin descripción / anotado como préstamo directo."}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-on-surface-variant">
                  <span>Fecha registro: {formatDateLabel(debt.fecha)}</span>
                  <span>Registrado por: {debt.creadoPor}</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-base font-semibold mb-2">Abonos recibidos{assocPayments.length ? ` (${assocPayments.length})` : ''}</h4>
            {assocPayments.length > 0 ? (
              <ul className="rounded-2xl border border-outline-variant divide-y divide-outline-variant/60">
                {assocPayments.map(p => (
                  <li key={p.id} className="flex items-center gap-3 pl-4 pr-1 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-success tabular-nums">
                        +{formatUsd(p.monto)}
                        {p.moneda === 'VES' && p.montoBs ? <span className="ml-2 text-xs font-normal text-on-surface-variant">{formatVes(p.montoBs)} · tasa {p.tasaCambio}</span> : null}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {formatDateLabel(p.fecha)}{p.registradoPor ? ` · recibió ${p.registradoPor}` : ''}{p.nota ? ` · ${p.nota}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeletePayment(p.id)}
                      className="m3-state h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:text-error cursor-pointer"
                      title="Anular este abono"
                      aria-label="Anular este abono"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-outline-variant py-5 text-center text-sm text-on-surface-variant">Todavía no hay abonos para este préstamo.</p>
            )}
          </section>
        </div>

        <div className="px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-outline-variant flex items-center gap-2 shrink-0">
          {isPending && (
            <button
              type="button"
              onClick={() => onOpenAbono(debt.id)}
              className="m3-state h-11 px-5 rounded-full bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
              Abonar
            </button>
          )}
          {isPending && canMarkPaid && (
            <button
              type="button"
              onClick={() => onMarkPaid!(debt.id)}
              className="m3-state h-11 px-4 rounded-full bg-secondary-container text-on-secondary-container text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
              Pagado
            </button>
          )}
          <span className="flex-1" />
          {onEdit && (
            <button type="button" onClick={() => onEdit(debt.id)} title="Editar préstamo" aria-label="Editar préstamo"
              className="m3-state h-11 w-11 rounded-full text-on-surface-variant inline-flex items-center justify-center cursor-pointer">
              <Pencil className="h-5 w-5" />
            </button>
          )}
          {onOpenPerson && (
            <button type="button" onClick={() => onOpenPerson(debt.contacto)} title={`Ficha de ${debt.contacto}`} aria-label={`Ficha de ${debt.contacto}`}
              className="m3-state h-11 w-11 rounded-full text-on-surface-variant inline-flex items-center justify-center cursor-pointer">
              <UserRound className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
