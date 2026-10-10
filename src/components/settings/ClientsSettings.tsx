import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Combine, MessageCircle, Search, Trash2, UserRound } from 'lucide-react';
import { Debt, Payment } from '../../types';
import { formatUsd } from '../../lib/format';
import { sameName } from '../../lib/ledger';
import { whatsappUrl } from '../../lib/phone';
import { Avatar } from '../ui';
import { btn, field, fieldLabel, SettingsCard } from './SettingsCard';

export interface ClientEdit {
  nombre: string;
  telefono: string;
  limite: number;
}

interface ClientsSettingsProps {
  clients: string[];
  deudas: Debt[];
  pagos: Payment[];
  phoneOf: (name: string) => string;
  limitOf: (name: string) => number;
  canEdit: boolean; // Apps Script v9 (phones, rename, merge, delete)
  onSave: (original: string, edit: ClientEdit) => void;
  onMerge: (from: string, to: string) => void;
  onDelete: (name: string) => void;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// "Clientes": phone (for WhatsApp), credit limit, rename, unify duplicates
// and remove names that have no loans.
export default function ClientsSettings({ clients, deudas, pagos, phoneOf, limitOf, canEdit, onSave, onMerge, onDelete }: ClientsSettingsProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const stats = useMemo(() => {
    const out = new Map<string, { loans: number; payments: number; owed: number }>();
    const debtClient = new Map<string, string>();
    deudas.forEach(d => {
      const k = fold(d.contacto);
      debtClient.set(d.id, k);
      const s = out.get(k) ?? { loans: 0, payments: 0, owed: 0 };
      s.loans++;
      if (d.estado === 'pendiente') s.owed += d.saldo;
      out.set(k, s);
    });
    pagos.forEach(p => {
      const k = debtClient.get(p.deudaId);
      const s = k ? out.get(k) : undefined;
      if (s) s.payments++;
    });
    return (name: string) => out.get(fold(name)) ?? { loans: 0, payments: 0, owed: 0 };
  }, [deudas, pagos]);

  const q = fold(query);
  const shown = q ? clients.filter(c => fold(c).includes(q) || phoneOf(c).replace(/\D/g, '').includes(q.replace(/\D/g, '') || '-')) : clients;

  return (
    <SettingsCard
      icon={UserRound}
      title={`Clientes (${clients.length})`}
      description="Guarda el teléfono para enviar recordatorios por WhatsApp, fija un límite de crédito, corrige nombres y unifica clientes repetidos."
    >
      {!canEdit && (
        <p className="rounded-2xl bg-warning-container text-on-warning-container p-4 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          Para guardar teléfonos, renombrar, unificar o borrar clientes, actualiza el Apps Script (abajo, en "Conectar o actualizar Google Sheets"). El límite de crédito ya funciona.
        </p>
      )}

      <label className="relative block">
        <span className="sr-only">Buscar cliente</span>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant" aria-hidden="true" />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente o teléfono"
          className="w-full h-12 pl-12 pr-4 rounded-full bg-surface-high text-on-surface placeholder:text-on-surface-variant text-base focus:outline-none focus:ring-2 focus:ring-primary" />
      </label>

      {shown.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-6">
          {clients.length ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes. Se agregan solos al registrar un préstamo.'}
        </p>
      ) : (
        <ul className="rounded-2xl border border-outline-variant/60 divide-y divide-outline-variant/60 max-h-[32rem] overflow-y-auto">
          {shown.map(name => {
            const s = stats(name);
            const limit = limitOf(name);
            const phone = phoneOf(name);
            const isOpen = open === name;
            return (
              <li key={name}>
                <button type="button" onClick={() => setOpen(isOpen ? null : name)} aria-expanded={isOpen}
                  className="m3-state w-full flex items-center gap-3 px-3 py-3 text-left cursor-pointer">
                  <Avatar name={name} size="sm" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{name}</span>
                    <span className="block text-xs text-on-surface-variant truncate">
                      {s.loans} préstamo{s.loans === 1 ? '' : 's'}
                      {s.owed > 0 && <> · debe {formatUsd(s.owed)}</>}
                      {limit > 0 && <> · límite {formatUsd(limit)}</>}
                      {phone && <> · {phone}</>}
                    </span>
                  </span>
                  {limit > 0 && s.owed > limit && (
                    <span className="shrink-0 h-6 px-2 rounded-lg bg-error-container text-on-error-container text-xs font-semibold inline-flex items-center">Excede</span>
                  )}
                  <ChevronDown className={`h-5 w-5 shrink-0 text-on-surface-variant transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <ClientEditor
                    key={name}
                    name={name}
                    phone={phone}
                    limit={limit}
                    loans={s.loans}
                    payments={s.payments}
                    others={clients.filter(c => c !== name)}
                    canEdit={canEdit}
                    onSave={edit => { onSave(name, edit); setOpen(sameName(edit.nombre, name) ? name : edit.nombre); }}
                    onMerge={to => { onMerge(name, to); setOpen(to); }}
                    onDelete={() => { onDelete(name); setOpen(null); }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SettingsCard>
  );
}

interface EditorProps {
  name: string;
  phone: string;
  limit: number;
  loans: number;
  payments: number;
  others: string[];
  canEdit: boolean;
  onSave: (edit: ClientEdit) => void;
  onMerge: (to: string) => void;
  onDelete: () => void;
}

function ClientEditor({ name, phone, limit, loans, payments, others, canEdit, onSave, onMerge, onDelete }: EditorProps) {
  const [nombre, setNombre] = useState(name);
  const [telefono, setTelefono] = useState(phone);
  const [limite, setLimite] = useState(limit ? String(limit) : '');
  const [mergeTo, setMergeTo] = useState('');
  const [step, setStep] = useState<'edit' | 'merge' | 'delete'>('edit');

  const trimmed = nombre.trim();
  // Renaming to a name already in the list means unifying both.
  const clash = others.find(o => sameName(o, trimmed) && !sameName(name, trimmed));
  const limitNum = Math.max(0, parseFloat(limite.replace(',', '.')) || 0);
  const dirty = trimmed !== name || telefono.trim() !== phone || limitNum !== limit;
  const wa = whatsappUrl(telefono, `Hola ${trimmed || name}`);
  const sample = `${loans} préstamo${loans === 1 ? '' : 's'} y ${payments} abono${payments === 1 ? '' : 's'}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    if (clash) { setMergeTo(clash); setStep('merge'); return; }
    onSave({ nombre: trimmed, telefono: telefono.trim(), limite: limitNum });
  };

  if (step === 'merge') {
    const target = mergeTo;
    return (
      <div className="px-3 pb-4 space-y-3">
        <div className="rounded-2xl bg-warning-container text-on-warning-container p-4 text-sm space-y-2">
          <p className="font-semibold flex items-center gap-2"><Combine className="h-4 w-4" /> Unificar clientes</p>
          {target ? (
            <>
              <p>Los {sample} de <strong>{name}</strong> pasarán a <strong>{target}</strong>, y {name} sale de la lista de clientes.</p>
              <p>{target} conserva su teléfono y su límite; si no tiene, toma los de {name}.</p>
              <p className="text-xs">El historial de cambios no se reescribe: los registros anteriores siguen diciendo "{name}" tal como se hicieron, y se agrega uno nuevo que dice que se unificó. No se puede deshacer con un toque (habría que volver a separar los préstamos a mano).</p>
            </>
          ) : <p>Elige con qué cliente unificar a <strong>{name}</strong>.</p>}
        </div>
        <label className="block">
          <span className={fieldLabel}>Unificar {name} con</span>
          <select value={target} onChange={e => setMergeTo(e.target.value)} className={`${field} cursor-pointer`}>
            <option value="">Elige un cliente…</option>
            {others.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!target} onClick={() => onMerge(target)} className={btn.filled}>Unificar en {target || '…'}</button>
          <button type="button" onClick={() => { setStep('edit'); setMergeTo(''); }} className={btn.text}>Cancelar</button>
        </div>
      </div>
    );
  }

  if (step === 'delete') {
    return (
      <div className="px-3 pb-4 space-y-3">
        <p className="rounded-2xl bg-error-container text-on-error-container p-4 text-sm">
          ¿Quitar a <strong>{name}</strong> de la lista de clientes? También se borra su teléfono y su límite.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onDelete} className={`${btn.filled} bg-error text-on-error`}>Quitar cliente</button>
          <button type="button" onClick={() => setStep('edit')} className={btn.text}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="px-3 pb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className={fieldLabel}>Nombre</span>
          <input value={nombre} onChange={e => setNombre(e.target.value)} disabled={!canEdit} required className={`${field} disabled:opacity-60`} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Teléfono</span>
          <input type="tel" inputMode="tel" value={telefono} onChange={e => setTelefono(e.target.value)} disabled={!canEdit} placeholder="0414 1234567" className={`${field} disabled:opacity-60`} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Límite de crédito ($)</span>
          <input type="number" inputMode="decimal" min="0" step="1" value={limite} onChange={e => setLimite(e.target.value)} placeholder="Sin límite" className={field} />
        </label>
      </div>
      {clash && <p className="text-xs text-on-surface-variant">Ya existe un cliente llamado {clash}: al guardar te propondremos unificarlos.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!dirty || !trimmed} className={btn.filled}>Guardar</button>
        {wa && (
          <a href={wa} target="_blank" rel="noopener" className={btn.outlined}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
        <span className="flex-1" />
        {canEdit && others.length > 0 && (
          <button type="button" onClick={() => setStep('merge')} className={btn.text}>
            <Combine className="h-4 w-4" /> Unificar con…
          </button>
        )}
        {canEdit && (
          loans === 0 ? (
            <button type="button" onClick={() => setStep('delete')} className={btn.danger}>
              <Trash2 className="h-4 w-4" /> Quitar
            </button>
          ) : null
        )}
      </div>
      {canEdit && loans > 0 && <p className="text-xs text-on-surface-variant">Solo se pueden quitar clientes sin préstamos. Si es un nombre repetido, usa "Unificar con…".</p>}
    </form>
  );
}
