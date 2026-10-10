import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// Shared frame for every card in Ajustes.
export function SettingsCard({ icon: Icon, title, description, children, className = '', tone = 'text-primary' }: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  tone?: string;
}) {
  return (
    <div className={`m3-card rounded-3xl p-6 space-y-4 ${className}`}>
      <div>
        <h4 className="font-semibold text-on-surface text-base flex items-center">
          <Icon className={`h-5 w-5 mr-2 shrink-0 ${tone}`} aria-hidden="true" />
          {title}
        </h4>
        {description && <p className="text-xs text-on-surface-variant mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Button styles used across Ajustes.
export const btn = {
  filled: 'm3-state h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40',
  tonal: 'm3-state h-10 px-4 rounded-full bg-secondary-container text-on-secondary-container text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40',
  outlined: 'm3-state h-10 px-4 rounded-full border border-outline text-primary text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40',
  text: 'm3-state h-10 px-3 rounded-full text-primary text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40',
  danger: 'm3-state h-10 px-4 rounded-full text-error text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40'
};

export const field = 'w-full h-12 px-4 rounded-xl border border-outline-variant bg-surface-lowest text-base text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
export const fieldLabel = 'block text-sm font-medium text-on-surface-variant mb-1';

// Collapsible question/answer row.
export function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl bg-surface-container">
      <summary className="m3-state rounded-2xl list-none cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        {q}
        <span className="text-on-surface-variant transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
      </summary>
      <div className="px-4 pb-4 text-sm text-on-surface-variant leading-relaxed space-y-2">{children}</div>
    </details>
  );
}
