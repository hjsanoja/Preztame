import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { formatUsd, formatVes } from '../lib/format';
import { addMoney } from '../lib/money';
import { PersonSummary } from '../lib/people';
import { tagLabel } from '../lib/tags';
import { fetchBCVExchangeRate } from '../utils/bcv';
import { downloadBlob, formatDateLabel, formatMonthName } from '../utils/storage';

interface StatementSheetProps {
  person: PersonSummary;
  preparedBy: string;
  onClose: () => void;
  onNotify: (message: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

// Account statement for one person: printable (PDF) and shareable (PNG).
// The document always uses light colors so it looks the same when shared.
export default function StatementSheet({ person: p, preparedBy, onClose, onNotify }: StatementSheetProps) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  const docRef = useRef<HTMLDivElement>(null);
  const [includeSettled, setIncludeSettled] = useState(false);
  const [rate, setRate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchBCVExchangeRate().then(r => { if (alive) setRate(r); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const loans = useMemo(
    () => [...p.deudas].filter(d => includeSettled || d.estado === 'pendiente').sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [p.deudas, includeSettled]
  );
  const loanIds = new Set(loans.map(d => d.id));
  const payments = [...p.pagos].filter(pg => loanIds.has(pg.deudaId)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const paidByLoan = (id: string) => payments.filter(pg => pg.deudaId === id).reduce((s, pg) => addMoney(s, pg.monto), 0);
  const totals = loans.reduce((t, d) => ({ monto: addMoney(t.monto, d.monto), saldo: addMoney(t.saldo, d.saldo) }), { monto: 0, saldo: 0 });
  const descOf = (id: string) => loans.find(d => d.id === id)?.descripcion || 'Préstamo';
  const slug = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fileBase = `estado-de-cuenta-${slug || 'cliente'}-${today()}`;

  const printPdf = () => {
    const previous = document.title;
    document.title = fileBase; // suggested file name when saving as PDF
    window.print();
    document.title = previous;
  };

  const shareImage = async () => {
    if (!docRef.current) return;
    setBusy(true);
    try {
      const { toBlob } = await import('html-to-image');
      const opts = { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true };
      const blob = await toBlob(docRef.current, opts).catch(() => toBlob(docRef.current!, { ...opts, skipFonts: true }));
      if (!blob) throw new Error('empty image');
      const file = new File([blob], `${fileBase}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Estado de cuenta · ${p.name}` });
      } else {
        downloadBlob(blob, file.name);
        onNotify('Imagen descargada.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') onNotify('No se pudo crear la imagen. Prueba con "Guardar PDF".');
    } finally {
      setBusy(false);
    }
  };

  const cell = 'py-2 px-2 align-top';
  return (
    <div className="df-print-container fixed inset-0 z-[60] bg-scrim/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="statement-title"
        onClick={e => e.stopPropagation()}
        className="df-print-container w-full sm:max-w-3xl max-h-[94dvh] flex flex-col bg-surface-low text-on-surface rounded-t-[28px] sm:rounded-[28px] m3-elevation-3 animate-sheet-in"
      >
        <div className="df-no-print sm:hidden mx-auto mt-3 h-1 w-8 rounded-full bg-outline shrink-0" aria-hidden="true" />
        <header className="df-no-print px-6 pt-4 pb-3 shrink-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 id="statement-title" className="text-2xl font-semibold leading-tight">Estado de cuenta</h2>
              <p className="mt-1 text-sm text-on-surface-variant truncate">{p.name}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="m3-state h-12 w-12 -mr-3 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={printPdf} className="m3-state h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
              <FileDown className="h-4 w-4" /> Guardar PDF
            </button>
            <button type="button" onClick={shareImage} disabled={busy} className="m3-state h-10 px-4 rounded-full border border-outline text-primary text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-default">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Compartir imagen
            </button>
            <span className="flex-1" />
            <label className="m3-state h-10 px-3 rounded-full inline-flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
              <input type="checkbox" checked={includeSettled} onChange={e => setIncludeSettled(e.target.checked)} className="h-4 w-4 accent-[var(--md-primary)]" />
              Incluir saldados
            </label>
          </div>
        </header>

        <div className="df-print-container overflow-auto mx-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:mx-4 sm:mb-4 p-3 sm:p-4 rounded-[20px] bg-surface-container">
          {/* The document itself (fixed light palette) */}
          <div ref={docRef} className="df-print-area mx-auto w-[720px] max-w-none bg-white text-[#1b1c1f] p-8 rounded-xl text-[13px] leading-snug" style={{ fontFamily: 'Inter, Roboto, system-ui, sans-serif' }}>
            <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-[#0b57d0]">
              <div className="flex items-center gap-3">
                <img src="./icon.svg" alt="" className="h-10 w-10 rounded-lg" crossOrigin="anonymous" />
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-[#44474e] uppercase">Preztame</p>
                  <p className="text-xl font-bold">Estado de cuenta</p>
                </div>
              </div>
              <div className="text-right text-[12px] text-[#44474e]">
                <p>Emitido el {formatDateLabel(today())}</p>
                {preparedBy && <p>Preparado por {preparedBy}</p>}
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[12px] text-[#44474e]">Cliente</p>
                <p className="text-2xl font-bold">{p.name}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[#44474e]">Saldo pendiente</p>
                <p className="text-3xl font-bold tabular-nums text-[#0b57d0]">{formatUsd(totals.saldo)}</p>
                {rate && totals.saldo > 0 && <p className="text-[12px] text-[#44474e] tabular-nums">≈ {formatVes(totals.saldo * rate)} · tasa BCV {rate.toFixed(2)}</p>}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {[['Total prestado', formatUsd(totals.monto)], ['Total abonado', formatUsd(addMoney(totals.monto, -totals.saldo))], ['Préstamos', String(loans.length)]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-[#f3f6fb] px-3 py-2">
                  <p className="text-[11px] text-[#44474e]">{k}</p>
                  <p className="text-base font-bold tabular-nums">{v}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-6 mb-1 text-[13px] font-semibold text-[#44474e]">Préstamos</h3>
            <table className="w-full border-collapse tabular-nums">
              <thead>
                <tr className="text-left text-[11px] text-[#44474e] border-b border-[#c4c7cf]">
                  <th className={cell}>Fecha</th><th className={cell}>Concepto</th><th className={cell}>Pagar en</th>
                  <th className={`${cell} text-right`}>Monto</th><th className={`${cell} text-right`}>Abonado</th><th className={`${cell} text-right`}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {loans.map(d => (
                  <tr key={d.id} className="border-b border-[#e1e5eb]">
                    <td className={cell}>{formatDateLabel(d.fecha)}</td>
                    <td className={cell}>{d.descripcion || 'Préstamo'}<span className="block text-[11px] text-[#6c6f77]">{tagLabel(d.tipo)}{d.estado === 'saldado' ? ' · Saldado' : ''}</span></td>
                    <td className={cell}>{formatMonthName(d.mesPago)}</td>
                    <td className={`${cell} text-right`}>{formatUsd(d.monto)}</td>
                    <td className={`${cell} text-right`}>{formatUsd(paidByLoan(d.id))}</td>
                    <td className={`${cell} text-right font-semibold`}>{formatUsd(d.saldo)}</td>
                  </tr>
                ))}
                {loans.length === 0 && <tr><td className={cell} colSpan={6}>No hay préstamos pendientes.</td></tr>}
              </tbody>
            </table>

            {payments.length > 0 && (
              <>
                <h3 className="mt-6 mb-1 text-[13px] font-semibold text-[#44474e]">Abonos recibidos</h3>
                <table className="w-full border-collapse tabular-nums">
                  <thead>
                    <tr className="text-left text-[11px] text-[#44474e] border-b border-[#c4c7cf]">
                      <th className={cell}>Fecha</th><th className={cell}>Préstamo</th><th className={cell}>Nota</th><th className={`${cell} text-right`}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(pg => (
                      <tr key={pg.id} className="border-b border-[#e1e5eb]">
                        <td className={cell}>{formatDateLabel(pg.fecha)}</td>
                        <td className={cell}>{descOf(pg.deudaId)}</td>
                        <td className={cell}>{pg.nota}</td>
                        <td className={`${cell} text-right`}>
                          {formatUsd(pg.monto)}
                          {pg.moneda === 'VES' && pg.montoBs ? <span className="block text-[11px] text-[#6c6f77]">{formatVes(pg.montoBs)} · tasa {pg.tasaCambio}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <p className="mt-6 pt-3 border-t border-[#e1e5eb] text-[11px] text-[#6c6f77]">
              Montos en dólares estadounidenses. Documento informativo generado con Preztame.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
