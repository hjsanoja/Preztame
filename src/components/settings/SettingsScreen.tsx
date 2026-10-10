import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ThemePreference } from '../../hooks/useTheme';
import { getOrCreateDraftToken } from '../../utils/storage';
import { useAccounts } from '../ui';
import AppearanceCard from './AppearanceCard';
import ConnectionCard from './ConnectionCard';
import InstallCard from './InstallCard';
import ScriptSetupCard, { SCRIPT_VERSION } from './ScriptSetupCard';
import ShortcutsCard from './ShortcutsCard';

interface SettingsScreenProps {
  sheetUrl: string;
  sheetToken: string;
  apiVersion: number | null;
  isLocalMode: boolean;
  activeUser: string;
  themePreference: ThemePreference;
  pwa: { isStandalone: boolean; isIos: boolean; canInstall: boolean; onInstall: () => void };
  onThemeChange: (t: ThemePreference) => void;
  onSaveConnection: (url: string, token: string) => void;
  onApplyAutoConfigLink: (link: string) => boolean;
  onClearSettings: () => void;
  onToggleLocal: (local: boolean) => void;
  // Cards that need the app's state, built by App.
  cards: { clients: ReactNode; security: ReactNode; users: ReactNode; reminders: ReactNode; backup: ReactNode; data: ReactNode };
}

const SECTIONS = [
  ['ajustes-clientes', 'Clientes'],
  ['ajustes-seguridad', 'Seguridad y personas'],
  ['ajustes-avisos', 'Avisos y respaldos'],
  ['ajustes-app', 'App'],
  ['ajustes-sheets', 'Google Sheets']
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="space-y-3 scroll-mt-24">
      <h2 id={`${id}-h`} className="text-lg font-semibold px-1">{title}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">{children}</div>
    </section>
  );
}

// "Ajustes": layout only. Each card lives in its own file in this folder.
export default function SettingsScreen(props: SettingsScreenProps) {
  const { sheetUrl, sheetToken, apiVersion, isLocalMode, activeUser, cards } = props;
  const accounts = useAccounts();
  // The key being typed: the script shown in the guide embeds it.
  const [tokenInput, setTokenInput] = useState(() => sheetToken || getOrCreateDraftToken());
  const outdated = !isLocalMode && apiVersion !== null && apiVersion < SCRIPT_VERSION;

  const partnerLink = () => {
    if (!sheetUrl || !sheetToken) return null;
    // Suggest the next person in the list (the other device's user).
    const i = accounts.indexOf(activeUser);
    const target = accounts.length > 1 ? accounts[(i + 1) % accounts.length] : activeUser;
    return `${window.location.origin}${window.location.pathname}?scriptUrl=${encodeURIComponent(sheetUrl)}&token=${encodeURIComponent(sheetToken)}&user=${encodeURIComponent(target)}`;
  };

  return (
    <div className="space-y-8">
      {outdated && (
        <div role="status" className="rounded-3xl bg-warning-container text-on-warning-container p-5 space-y-2">
          <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Actualiza tu Apps Script a v{SCRIPT_VERSION}</p>
          <p className="text-sm">
            Tu hoja usa la v{apiVersion}. Copia el código en <a href="#ajustes-sheets" className="underline font-semibold">Google Sheets → paso 3</a> (ya trae tu clave), pégalo en Apps Script y publica una <strong>nueva versión</strong>. Tus datos no cambian.
            Con la v{SCRIPT_VERSION} tienes teléfonos, renombrar y unificar clientes, respaldos en Drive y resumen mensual.
          </p>
        </div>
      )}

      <nav aria-label="Secciones de ajustes" className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [scrollbar-width:none]">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="m3-state h-8 px-3 rounded-lg border border-outline-variant text-sm font-medium text-on-surface-variant inline-flex items-center whitespace-nowrap">
            {label}
          </a>
        ))}
      </nav>

      <section id="ajustes-clientes" aria-labelledby="ajustes-clientes-h" className="space-y-3 scroll-mt-24">
        <h2 id="ajustes-clientes-h" className="text-lg font-semibold px-1">Clientes</h2>
        {cards.clients}
      </section>

      <Section id="ajustes-seguridad" title="Seguridad y personas">
        {cards.security}
        {cards.users}
      </Section>

      <Section id="ajustes-avisos" title="Avisos y respaldos">
        {cards.reminders}
        {cards.backup}
        {cards.data}
      </Section>

      <Section id="ajustes-app" title="App">
        <AppearanceCard themePreference={props.themePreference} onThemeChange={props.onThemeChange} />
        <InstallCard pwa={props.pwa} onApplyAutoConfigLink={props.onApplyAutoConfigLink} />
        <ShortcutsCard />
      </Section>

      <Section id="ajustes-sheets" title="Google Sheets">
        <ConnectionCard
          sheetUrl={sheetUrl}
          sheetToken={sheetToken}
          tokenInput={tokenInput}
          onTokenInput={setTokenInput}
          onSaveConnection={props.onSaveConnection}
          onClearSettings={props.onClearSettings}
          isLocalMode={isLocalMode}
          onToggleLocal={props.onToggleLocal}
          partnerLink={partnerLink}
        />
        <ScriptSetupCard token={tokenInput} />
      </Section>
    </div>
  );
}
