import { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, UserPlus } from 'lucide-react';
import { Avatar } from './ui';

interface ClientPickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  clients: string[];
  invalid?: boolean;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Searchable client dropdown fed by the "Clientes" list. Typing a name that
// is not there is allowed: it becomes a new client when the loan is saved.
export default function ClientPicker({ value, onChange, onBlur, clients, invalid }: ClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const q = fold(value);
  const matches = useMemo(() => {
    const list = q ? clients.filter(c => fold(c).includes(q)) : clients;
    // Names that start with the text first.
    return [...list].sort((a, b) => Number(!fold(a).startsWith(q)) - Number(!fold(b).startsWith(q))).slice(0, 50);
  }, [clients, q]);
  const exact = clients.find(c => fold(c) === q);
  const isNew = q.length >= 2 && !exact;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Busca o escribe un cliente"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); setActive(0); }}
          onClick={() => setOpen(true)}
          onBlur={() => { setTimeout(() => setOpen(false), 150); onBlur?.(); }}
          onKeyDown={onKeyDown}
          className={`w-full pl-4 pr-10 py-2.5 border rounded-xl text-sm bg-surface-lowest focus:outline-none focus:ring-2 transition ${
            invalid ? 'border-error focus:ring-error/20' : 'border-outline-variant focus:ring-primary/20'
          }`}
          required
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Ver clientes"
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); inputRef.current?.focus(); }}
          className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-on-surface-variant cursor-pointer"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {open && (matches.length > 0 || isNew) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-surface-high m3-elevation-2 py-1"
        >
          {matches.map((c, i) => (
            <li
              key={c}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(c); }}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${i === active ? 'bg-secondary-container text-on-secondary-container' : ''}`}
            >
              <Avatar name={c} size="sm" />
              <span className="truncate">{c}</span>
            </li>
          ))}
          {isNew && (
            <li role="option" aria-selected={false} onMouseDown={e => { e.preventDefault(); pick(value.trim()); }}
              className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer text-primary border-t border-outline-variant/60">
              <UserPlus className="h-5 w-5 shrink-0" />
              <span className="truncate">Agregar cliente nuevo: <strong>{value.trim()}</strong></span>
            </li>
          )}
        </ul>
      )}

      {isNew && !open && (
        <p className="mt-1 text-xs text-primary flex items-center gap-1">
          <UserPlus className="h-3.5 w-3.5" /> Cliente nuevo: se agregará a tu lista de clientes al guardar.
        </p>
      )}
    </div>
  );
}
