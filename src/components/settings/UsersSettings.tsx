import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { Debt } from '../../types';
import { accountTone } from '../ui';

interface UsersSettingsProps {
  accounts: string[];
  deudas: Debt[];
  activeUser: string;
  onSetUsers: (usuarios: string[]) => void;
  onRenameUser: (from: string, to: string) => void;
}

// "Personas que usan la app": the accounts loans are assigned to.
export default function UsersSettings({ accounts, deudas, activeUser, onSetUsers, onRenameUser }: UsersSettingsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loansOf = (name: string) => deudas.filter(d => d.cuenta === name).length;
  const exists = (name: string, except?: string) =>
    accounts.some(a => a !== except && a.toLowerCase() === name.trim().toLowerCase());

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (exists(name)) return setError(`"${name}" ya está en la lista.`);
    onSetUsers([...accounts, name]);
    setNewName('');
    setError(null);
  };

  const saveRename = (from: string) => {
    const to = draft.trim();
    if (!to || to === from) return setEditing(null);
    if (exists(to, from)) return setError(`"${to}" ya está en la lista.`);
    onRenameUser(from, to);
    setEditing(null);
    setError(null);
  };

  const remove = (name: string) => {
    if (accounts.length <= 1) return setError('Debe quedar al menos una persona.');
    if (loansOf(name) > 0) return setError(`${name} tiene préstamos asignados. Renómbrala en lugar de quitarla.`);
    onSetUsers(accounts.filter(a => a !== name));
    setError(null);
  };

  return (
    <div className="m3-card rounded-3xl p-4 sm:p-6 space-y-4">
      <div>
        <h4 className="font-semibold text-on-surface text-base flex items-center">
          <Users className="h-5 w-5 mr-2 text-primary" />
          Personas que usan la app
        </h4>
        <p className="text-xs text-on-surface-variant mt-1">Cada préstamo se asigna a una de estas cuentas. Al renombrar, se actualizan todos sus préstamos y abonos.</p>
      </div>

      <ul className="space-y-1">
        {accounts.map(name => {
          const tone = accountTone(name, accounts);
          const count = loansOf(name);
          return (
            <li key={name} className="flex items-center gap-3 min-h-12">
              <span className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${tone.container}`} aria-hidden="true">
                {name.slice(0, 2)}
              </span>
              {editing === name ? (
                <form className="flex-1 flex items-center gap-1" onSubmit={e => { e.preventDefault(); saveRename(name); }}>
                  <input
                    autoFocus
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    maxLength={24}
                    aria-label={`Nuevo nombre para ${name}`}
                    className="min-w-0 flex-1 h-10 px-3 rounded-lg border border-primary bg-surface-lowest text-sm focus:outline-none"
                  />
                  <button type="submit" aria-label="Guardar nombre" className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-primary cursor-pointer"><Check className="h-5 w-5" /></button>
                  <button type="button" onClick={() => setEditing(null)} aria-label="Cancelar" className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer"><X className="h-5 w-5" /></button>
                </form>
              ) : (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{name}{name === activeUser && <span className="ml-2 text-xs font-medium text-on-surface-variant">(este dispositivo)</span>}</span>
                    <span className="block text-xs text-on-surface-variant">{count} préstamo{count === 1 ? '' : 's'}</span>
                  </span>
                  <button type="button" onClick={() => { setEditing(name); setDraft(name); setError(null); }} aria-label={`Renombrar ${name}`} className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant cursor-pointer">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(name)} aria-label={`Quitar ${name}`} className="m3-state h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(); }}>
        <input
          value={newName}
          onChange={e => { setNewName(e.target.value); setError(null); }}
          placeholder="Agregar persona"
          maxLength={24}
          aria-label="Nombre de la nueva persona"
          className="min-w-0 flex-1 h-10 px-3 rounded-lg border border-outline-variant bg-surface-lowest text-sm focus:outline-none focus:border-primary"
        />
        <button type="submit" disabled={!newName.trim()} className="m3-state h-10 px-4 rounded-full bg-secondary-container text-on-secondary-container text-sm font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40">
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </form>
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
    </div>
  );
}
