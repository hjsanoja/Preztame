import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Debt, Payment } from './types';
import {
  getStoredSource,
  getStoredSheetUrl,
  getStoredToken,
  saveToken
} from './utils/storage';
import { useLedger } from './hooks/useLedger';
import { usePwa } from './hooks/usePwa';
import InstallBanner from './components/InstallBanner';
import { parseAutoConfigLink } from './lib/autoConfig';
import { accountsOf, clientsOf, DebtChanges, LedgerOp, limitOf, minApiFor, newId, phoneOf, sameName } from './lib/ledger';
import { formatUsd, formatVes, localDay } from './lib/format';
import { personKey, summarizePeople } from './lib/people';
import { formatMonthName } from './utils/storage';
import { tagLabel } from './lib/tags';
import { roundMoney, subMoney } from './lib/money';
import { normalizeLedger } from './lib/sheetsApi';

// Modals (small, used on every tab)
import DebtDetailsModal from './components/DebtDetailsModal';
import DebtFormModal from './components/DebtFormModal';
import AbonoFormModal from './components/AbonoFormModal';
import QuickSearchModal from './components/QuickSearchModal';

// Icons
import {
  Check,
  CheckCircle2,
  CircleAlert,
  CloudCheck,
  CloudOff,
  HardDrive,
  Info,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert
} from 'lucide-react';
import { DESTINATIONS, NavigationBar, NavigationRail, TabId } from './components/Navigation';
import { useTheme } from './hooks/useTheme';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useDueNotifications } from './hooks/useDueNotifications';
import { AccountsProvider, accountTone } from './components/ui';
import PersonSheet from './components/PersonSheet';
import UsersSettings from './components/settings/UsersSettings';
import RemindersSettings from './components/settings/RemindersSettings';
import BackupSettings from './components/settings/BackupSettings';
import SecuritySettings from './components/settings/SecuritySettings';
import ClientsSettings, { ClientEdit } from './components/settings/ClientsSettings';
import DataExportCard from './components/settings/DataExportCard';
import LockScreen from './components/LockScreen';
import { useAppLock } from './hooks/useAppLock';

// Tabs are loaded on demand so the first paint does not wait for charts.
const loadDashboard = () => import('./components/Dashboard');
const loadDebtsList = () => import('./components/DebtsList');
const loadHistory = () => import('./components/TransactionsHistory');
const loadSettings = () => import('./components/settings/SettingsScreen');
const Dashboard = lazy(loadDashboard);
const DebtsList = lazy(loadDebtsList);
const TransactionsHistory = lazy(loadHistory);
const SettingsScreen = lazy(loadSettings);
const loadPeople = () => import('./components/PeopleList');
const PeopleList = lazy(loadPeople);
const ChangeLogView = lazy(() => import('./components/ChangeLogView'));
const StatementSheet = lazy(() => import('./components/StatementSheet'));

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  action?: { label: string; onClick: () => void };
}

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface InitialConfig {
  source: 'sheets' | 'local';
  url: string;
  token: string;
  user: string;
  autoConfigured: boolean;
  // Home-screen shortcut (manifest "shortcuts"): ?accion=nuevo|abono|prestamos
  accion: string | null;
}

// Reads saved settings plus the partner auto-config link (?scriptUrl=&token=&user=).
function readInitialConfig(): InitialConfig {
  const params = new URLSearchParams(window.location.search);
  const paramUrl = params.get('scriptUrl');
  const paramToken = params.get('token');
  const paramUser = params.get('user');
  const accion = params.get('accion');

  let source = getStoredSource();
  let url = getStoredSheetUrl();
  let token = getStoredToken();
  let user: string = localStorage.getItem('df_active_user') || '';

  if (paramUrl) {
    url = paramUrl;
    source = 'sheets';
    localStorage.setItem('df_sheet_url', url);
    localStorage.setItem('df_datasource', 'sheets');
  }
  if (paramToken) {
    token = paramToken;
    saveToken(token);
  }
  if (paramUser && paramUser.trim()) {
    user = paramUser.trim();
    localStorage.setItem('df_active_user', paramUser);
  }
  if (paramUrl || paramToken || paramUser || accion) {
    // Remove the token from the address bar and browser history.
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  return { source, url, token, user, autoConfigured: !!paramUrl, accion };
}

const formatUsd0 = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(n);

function TabFallback() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-surface-high/70" />)}
      </div>
      <div className="h-64 rounded-2xl bg-surface-high/60" />
    </div>
  );
}

export default function App() {
  const [initial] = useState(readInitialConfig);

  // Navigation Tabs: 'resumen' | 'deudas' | 'movimientos' | 'config'
  const [currentTab, setCurrentTab] = useState<TabId>('resumen');
  const theme = useTheme();
  const appLock = useAppLock();

  const [activeUser, setActiveUser] = useState<string>(initial.user);
  const [accountView, setAccountView] = useState<string>(() => {
    const saved = localStorage.getItem("df_account_view");
    return saved || 'Ambos';
  });

  // Configuration Settings
  const [isLocalMode, setIsLocalMode] = useState<boolean>(initial.source === 'local');
  const [sheetUrl, setSheetUrl] = useState<string>(initial.url);
  const [sheetToken, setSheetToken] = useState<string>(initial.token);

  // UI Modals triggers states
  const [selectedDetailsId, setSelectedDetailsId] = useState<string | null>(null);
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [isAbonoFormOpen, setIsAbonoFormOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [abonoDebtId, setAbonoDebtId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [newDebtContact, setNewDebtContact] = useState<string | undefined>(undefined);
  const [openPersonKey, setOpenPersonKey] = useState<string | null>(null);
  const [statementKey, setStatementKey] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<'movimientos' | 'cambios'>('movimientos');

  // Custom UI elements (Toast and Confirm boxes)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Display toast alerts
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', action?: Toast['action']) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, action ? 7000 : type === 'error' || type === 'warning' ? 5000 : 3000);
  }, []);
  const dismissToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Display confirmation modal
  const askConfirmation = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirm({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, []);

  // Data + Google Sheets sync engine (instant cache, offline queue, batched writes)
  const ledger = useLedger({
    mode: isLocalMode ? 'local' : 'sheets',
    url: sheetUrl,
    token: sheetToken,
    onSyncError: (message, code) => {
      const pending = code === 'network' || code === 'timeout' || code === 'busy' || code === 'http' || code === 'server';
      showToast(pending ? `${message} Tus cambios quedan guardados y se enviarán al reconectar.` : message, pending ? 'warning' : 'error');
    },
    onOpsRejected: (count, firstError) => {
      showToast(`Google Sheets rechazó ${count} cambio(s): ${firstError}`, 'error');
    }
  });
  const { deudas, pagos, clientLimits } = ledger.data;
  const accounts = accountsOf(ledger.data);
  // The person registering on this device (falls back to the first account).
  const currentUser = accounts.includes(activeUser) ? activeUser : accounts[0];
  const currentView = accountView === 'Ambos' || accounts.includes(accountView) ? accountView : 'Ambos';
  const people = React.useMemo(() => summarizePeople(deudas, pagos), [deudas, pagos]);
  const openPerson = openPersonKey ? people.find(p => p.key === openPersonKey) ?? null : null;
  const statementPerson = statementKey ? people.find(p => p.key === statementKey) ?? null : null;
  const notifications = useDueNotifications(deudas, ledger.hasLoaded);

  // Every change goes through here: stamped with who made it and a readable
  // description for the change log.
  const act = (op: LedgerOp, desc: string): boolean => {
    const ok = ledger.dispatch(op, { by: currentUser, desc });
    if (!ok) showToast('Esta función necesita actualizar el Apps Script. Cópialo desde Ajustes y publica una nueva versión.', 'warning');
    return ok;
  };
  const syncStatus = ledger.status;

  const confirmRef = useFocusTrap<HTMLDivElement>(confirm.isOpen);

  const pwa = usePwa({
    onOfflineReady: () => showToast("Preztame ya funciona sin conexión en este dispositivo.", "success")
  });

  useEffect(() => {
    if (initial.autoConfigured) showToast("¡Configuración de Google Sheets autodetectada y cargada!", "success");
    if (initial.accion === 'nuevo') setIsDebtFormOpen(true);
    if (initial.accion === 'prestamos') setCurrentTab('deudas');
    if (initial.accion === 'abono') {
      setIsQuickSearchOpen(true);
      showToast("Busca el préstamo y ábrelo para registrar el abono.", "info");
    }
  }, [initial, showToast]);

  // Warm up the other tabs once the browser is idle.
  useEffect(() => {
    const prefetch = () => { loadDashboard(); loadDebtsList(); loadHistory(); loadSettings(); loadPeople(); };
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetch, 2000);
    return () => clearTimeout(t);
  }, []);

  const lockedRef = React.useRef(appLock.locked);
  lockedRef.current = appLock.locked;
  const layersRef = React.useRef({ confirm: false, statement: false, abono: false, debtForm: false, details: false, person: false });
  layersRef.current = {
    confirm: confirm.isOpen,
    statement: statementKey !== null,
    abono: isAbonoFormOpen,
    debtForm: isDebtFormOpen || editingDebtId !== null,
    details: selectedDetailsId !== null,
    person: openPersonKey !== null
  };

  // Global Keyboard shortcuts handling
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // While locked, the keyboard belongs to the lock screen.
      if (lockedRef.current) return;
      // Cmd+K or Ctrl+K anytime (even when editing)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(prev => !prev);
        return;
      }

      // Modal universal close (also while typing inside a form)
      // Escape closes only the topmost layer.
      if (e.key === "Escape") {
        const l = layersRef.current;
        if (l.confirm) setConfirm(prev => ({ ...prev, isOpen: false }));
        else if (l.statement) setStatementKey(null);
        else if (l.abono) setIsAbonoFormOpen(false);
        else if (l.debtForm) { setIsDebtFormOpen(false); setEditingDebtId(null); setNewDebtContact(undefined); }
        else if (l.details) setSelectedDetailsId(null);
        else if (l.person) setOpenPersonKey(null);
        else setIsQuickSearchOpen(false);
        return;
      }

      const isEditing = document.activeElement?.tagName === 'INPUT' ||
                        document.activeElement?.tagName === 'TEXTAREA' ||
                        document.activeElement?.tagName === 'SELECT';

      if (isEditing || e.metaKey || e.ctrlKey || e.altKey) return;

      // Quick tab swaps 1-4
      const tab = DESTINATIONS[Number(e.key) - 1];
      if (tab) { e.preventDefault(); setCurrentTab(tab.id); }

      // "N" for registering new debt
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsDebtFormOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  // Update Operating User toggles
  const handleUserToggle = (user: string) => {
    setActiveUser(user);
    localStorage.setItem("df_active_user", user);
  };

  // Change primary account filtration views
  const handleAccountViewToggle = (view: string) => {
    setAccountView(view);
    localStorage.setItem("df_account_view", view);
  };

  // Save new Sheet integration endpoint + access key
  const handleSaveConnection = (url: string, token: string) => {
    if (url.includes("/edit")) {
      showToast("Has copiado la URL de edición del navegador. Copia la URL de Aplicación Web publicada que termina en /exec", "warning");
      return;
    }
    if (!token) {
      showToast("Falta la clave de acceso. Genérala en Ajustes y pégala también en tu Apps Script.", "warning");
      return;
    }

    localStorage.setItem("df_sheet_url", url);
    localStorage.setItem("df_datasource", "sheets");
    saveToken(token);
    setSheetUrl(url);
    setSheetToken(token);
    setIsLocalMode(false);
    showToast("Conexión guardada. Sincronizando con Google Sheets...", "info");
  };

  // For installed apps (iPhone keeps their storage apart from Safari): paste the partner link.
  const handleApplyAutoConfigLink = (link: string): boolean => {
    const parsed = parseAutoConfigLink(link);
    if (!parsed) {
      showToast("Ese enlace no es válido. Debe ser el link de autoconfiguración copiado desde Preztame.", "warning");
      return false;
    }
    if (parsed.user) handleUserToggle(parsed.user);
    handleSaveConnection(parsed.url, parsed.token);
    return true;
  };

  const handleClearUrlSettings = () => {
    setSheetUrl('');
    localStorage.removeItem("df_sheet_url");
    setIsLocalMode(true);
    localStorage.setItem("df_datasource", "local");
    showToast("Conexión de Google Sheets removida. Volviendo a prueba local.", "info");
  };

  const handleToggleLocalMode = (local: boolean) => {
    setIsLocalMode(local);
    localStorage.setItem("df_datasource", local ? "local" : "sheets");
    showToast(local ? "Prueba sin conexión local activada." : "Entrando a modo sincronización permanente Sheets.", "info");
  };

  // Restore imported backup data (local mode only: Sheets is the source of truth)
  const handleImportBackup = (importedDeudas: Debt[], importedPagos: Payment[], importedLimits: Record<string, number>) => {
    const ok = ledger.replaceLocalData(normalizeLedger({ deudas: importedDeudas, pagos: importedPagos, clientLimits: importedLimits, usuarios: ledger.data.usuarios }));
    if (ok) {
      showToast("¡Copia de seguridad importada con éxito!", "success");
    } else {
      showToast("Para no sobrescribir tu Google Sheet, importar respaldos solo está disponible en modo Prueba Local.", "warning");
    }
  };

  // ================= ACTIONS (applied instantly, synced in background) =================

  // 1. ADD NEW LOAN
  const handleAddDebt = (debtPayload: Omit<Debt, 'id' | 'saldo' | 'estado' | 'creadoPor'>) => {
    const monto = roundMoney(debtPayload.monto);
    const newDebt: Debt = {
      ...debtPayload,
      id: newId('d'),
      monto,
      saldo: monto,
      estado: 'pendiente',
      creadoPor: currentUser
    };
    act({ action: 'addDebt', debt: newDebt }, `Préstamo a ${newDebt.contacto} por ${formatUsd(monto)} · ${newDebt.cuenta}`);
    showToast("Préstamo registrado.", "success");
  };

  // 2. ADD PAYMENT REPAYMENT ABONO
  const handleAddPayment = (payPayload: Omit<Payment, 'id' | 'registradoPor'>) => {
    const target = deudas.find(d => d.id === payPayload.deudaId);
    const newPayment: Payment = {
      ...payPayload,
      id: newId('p'),
      monto: roundMoney(payPayload.monto),
      registradoPor: currentUser
    };
    const inBs = newPayment.moneda === 'VES' && newPayment.montoBs ? ` (${formatVes(newPayment.montoBs)} a ${newPayment.tasaCambio})` : '';
    act({ action: 'addPayment', payment: newPayment }, `Abono de ${formatUsd(newPayment.monto)}${inBs} de ${target?.contacto ?? 'un cliente'}`);

    if (target && subMoney(target.saldo, newPayment.monto) <= 0) {
      import('canvas-confetti')
        .then(({ default: confetti }) => confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } }))
        .catch(e => console.error("Confetti launch failed", e));
      showToast(`🎉 ¡DEUDA SALDADA! ${target.contacto} ha pagado su préstamo por completo.`, "success");
    } else {
      showToast("Abono registrado.", "success");
    }
  };

  // 3. DELETE DEBT
  const handleDeleteDebt = (id: string) => {
    const target = deudas.find(d => d.id === id);
    if (!target) return;

    askConfirmation(
      "¿Eliminar Préstamo Completo?",
      `Estás a punto de borrar el préstamo registrado a "${target.contacto}" por ${formatUsd0(target.monto)}. Esta acción también anula todos sus abonos asociados. ¿Deseas continuar?`,
      () => {
        act({ action: 'deleteDebt', id }, `Eliminó el préstamo de ${target.contacto} por ${formatUsd(target.monto)}`);
        setSelectedDetailsId(prev => (prev === id ? null : prev));
        showToast("Préstamo eliminado.", "info");
      }
    );
  };

  // 4. ANULAR PAGO / UNDO ABONO
  const handleDeletePayment = (id: string) => {
    const target = pagos.find(p => p.id === id);
    if (!target) return;

    askConfirmation(
      "¿Anular este Abono?",
      `Estás por deshacer el abono por valor de ${formatUsd0(target.monto)}. El saldo pendiente de la deuda se incrementará de nuevo.`,
      () => {
        const debtName = deudas.find(d => d.id === target.deudaId)?.contacto ?? 'un cliente';
        act({ action: 'deletePayment', id }, `Anuló un abono de ${formatUsd(target.monto)} de ${debtName}`);
        showToast("Abono anulado.", "info");
      }
    );
  };

  // 5. EDIT LOAN
  const FIELD_LABEL: Record<string, (v: any) => string> = {
    monto: v => `monto ${formatUsd(v)}`,
    contacto: v => `cliente ${v}`,
    cuenta: v => `cuenta ${v}`,
    tipo: v => `etiqueta ${tagLabel(v)}`,
    descripcion: v => `concepto "${v}"`,
    fecha: v => `fecha ${v}`,
    mesPago: v => `mes de pago ${formatMonthName(v)}`,
    tasaCambio: v => `tasa ${v}`
  };
  const handleUpdateDebt = (id: string, changes: DebtChanges) => {
    const target = deudas.find(d => d.id === id);
    if (!target) return;
    const summary = Object.entries(changes).map(([k, v]) => FIELD_LABEL[k]?.(v) ?? k).join(', ');
    if (act({ action: 'updateDebt', id, changes }, `Editó el préstamo de ${target.contacto}: ${summary}`)) {
      showToast('Préstamo actualizado.', 'success');
    }
  };

  // 6. PEOPLE WHO USE THE APP
  const handleSetUsers = (usuarios: string[]) => {
    const added = usuarios.filter(u => !accounts.includes(u));
    const removed = accounts.filter(u => !usuarios.includes(u));
    const desc = [added.length ? `agregó a ${added.join(', ')}` : '', removed.length ? `quitó a ${removed.join(', ')}` : ''].filter(Boolean).join(' y ');
    act({ action: 'setUsers', usuarios }, `Personas de la app: ${desc || 'reordenó la lista'}`);
  };
  const handleRenameUser = (from: string, to: string) => {
    // Make sure the list exists in the sheet before renaming inside it.
    if (!ledger.data.usuarios.length && !act({ action: 'setUsers', usuarios: accounts }, `Personas de la app: ${accounts.join(', ')}`)) return;
    if (act({ action: 'renameUser', from, to }, `Renombró a ${from} como ${to}`)) {
      if (activeUser === from) handleUserToggle(to);
      if (accountView === from) handleAccountViewToggle(to);
      showToast(`${from} ahora se llama ${to}.`, 'success');
    }
  };

  // 7. PAID IN FULL (one tap, with undo)
  const handleMarkPaid = (id: string) => {
    const target = deudas.find(d => d.id === id);
    if (!target || target.estado !== 'pendiente' || target.saldo <= 0) return;
    const payment: Payment = {
      id: newId('p'),
      fecha: localDay(),
      deudaId: id,
      monto: target.saldo,
      nota: 'Pago completo',
      registradoPor: currentUser
    };
    if (!act({ action: 'addPayment', payment }, `Marcó como pagado el préstamo de ${target.contacto} (${formatUsd(target.saldo)})`)) return;
    showToast(`${target.contacto}: préstamo pagado (${formatUsd(target.saldo)}).`, 'success', {
      label: 'Deshacer',
      onClick: () => act({ action: 'deletePayment', id: payment.id }, `Deshizo el pago completo de ${target.contacto}`)
    });
  };

  // 8. CLIENTS
  const clientes = clientsOf(ledger.data);
  const clientPhone = (name: string) => phoneOf(ledger.data, name);
  const handleSaveClient = (original: string, edit: ClientEdit) => {
    const renamed = edit.nombre !== original;
    if (renamed && !act({ action: 'renameClient', from: original, to: edit.nombre }, `Renombró al cliente ${original} como ${edit.nombre}`)) return;
    if (edit.telefono !== clientPhone(original)) {
      if (!act({ action: 'setClient', nombre: edit.nombre, telefono: edit.telefono }, edit.telefono ? `Teléfono de ${edit.nombre}: ${edit.telefono}` : `Quitó el teléfono de ${edit.nombre}`)) return;
    }
    if (edit.limite !== limitOf(ledger.data, original)) {
      act({ action: 'setClientLimit', contacto: edit.nombre, limite: edit.limite }, edit.limite > 0 ? `Límite de crédito de ${edit.nombre}: ${formatUsd(edit.limite)}` : `Quitó el límite de crédito de ${edit.nombre}`);
    }
    showToast(renamed ? `${original} ahora se llama ${edit.nombre}.` : `Cliente ${edit.nombre} guardado.`, 'success');
  };
  const handleMergeClient = (from: string, to: string) => {
    const loans = deudas.filter(d => sameName(d.contacto, from)).length;
    if (act({ action: 'renameClient', from, to }, `Unificó al cliente ${from} en ${to} (${loans} préstamo${loans === 1 ? '' : 's'})`)) {
      showToast(`${from} quedó unificado en ${to}.`, 'success');
    }
  };
  const handleDeleteClient = (name: string) => {
    if (act({ action: 'deleteClient', nombre: name }, `Quitó al cliente ${name}`)) showToast(`${name} ya no está en la lista de clientes.`, 'info');
  };

  const handleOpenPersonByName = (name: string) => {
    setSelectedDetailsId(null);
    setOpenPersonKey(personKey(name));
  };

  const handleOpenAbonoDirect = (id: string) => {
    setAbonoDebtId(id);
    setIsAbonoFormOpen(true);
  };

  const pendingLabel = ledger.pendingCount > 0 ? ` · ${ledger.pendingCount} pendiente${ledger.pendingCount === 1 ? '' : 's'}` : '';

  const syncTooltipMsg = () => {
    if (syncStatus === 'local') return 'Modo Local (Pruebas sin Drive)';
    if (syncStatus === 'synced') {
      const when = ledger.lastSyncedAt ? new Date(ledger.lastSyncedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '';
      return `Sincronizado con Google Sheets${when ? ` a las ${when}` : ''}. Toca para actualizar.`;
    }
    if (syncStatus === 'pending') return 'Sincronizando...';
    return `${ledger.errorMessage || 'Error de conexión.'} Toca para revisar la configuración.`;
  };

  const handleSyncBadgeClick = () => {
    if (syncStatus === 'error' && (ledger.errorCode === 'unauthorized' || ledger.errorCode === 'no-key' || ledger.errorCode === 'outdated-script' || ledger.errorCode === 'not-configured')) {
      setCurrentTab('config');
      return;
    }
    if (syncStatus !== 'local' && syncStatus !== 'pending') {
      void ledger.sync({ fresh: syncStatus === 'synced' });
    }
  };

  const currentTitle = DESTINATIONS.find(d => d.id === currentTab)?.label ?? '';
  const SyncIcon = syncStatus === 'synced' ? CloudCheck
    : syncStatus === 'pending' ? RefreshCw
    : syncStatus === 'error' ? (ledger.errorCode === 'network' || ledger.errorCode === 'timeout' || ledger.pendingCount > 0 ? CloudOff : CircleAlert)
    : HardDrive;
  const syncLabel = syncStatus === 'synced' ? 'Sincronizado'
    : syncStatus === 'pending' ? `Sincronizando${pendingLabel}`
    : syncStatus === 'error' ? (ledger.pendingCount > 0 || ledger.errorCode === 'network' || ledger.errorCode === 'timeout' ? `Sin conexión${pendingLabel}` : 'Revisar conexión')
    : 'Modo local';

  return (
    <AccountsProvider value={accounts}>
    {appLock.locked && (
      <LockScreen
        hasBiometric={!!appLock.settings.credentialId}
        pinLength={appLock.settings.pinLength}
        onPin={appLock.unlockWithPin}
        onBiometric={appLock.unlockWithBiometric}
        onRecover={!isLocalMode && sheetToken ? (key) => {
          if (key !== sheetToken.trim()) return false;
          appLock.disable();
          showToast('Bloqueo quitado. Crea un PIN nuevo en Ajustes → Seguridad.', 'info');
          return true;
        } : undefined}
      />
    )}
    <div className="bg-surface text-on-surface min-h-dvh font-sans antialiased selection:bg-primary/20 md:pl-24">

      <NavigationRail
        current={currentTab}
        onNavigate={setCurrentTab}
        onNewDebt={() => setIsDebtFormOpen(true)}
        theme={theme.preference}
        onThemeChange={theme.setPreference}
      />

      {/* Top app bar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/50 pt-[env(safe-area-inset-top)]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <img src="./icon.svg" alt="" className="h-9 w-9 rounded-xl md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant leading-none">Preztame</p>
            <h1 className="text-[22px] font-bold tracking-tight leading-tight truncate">{currentTitle}</h1>
          </div>

          {/* Search */}
          <button
            type="button"
            onClick={() => setIsQuickSearchOpen(true)}
            title="Buscar (Ctrl/⌘ K)"
            aria-label="Buscar"
            className="m3-state h-12 w-12 sm:w-auto sm:px-4 rounded-full flex items-center justify-center gap-2 text-on-surface-variant sm:bg-surface-container cursor-pointer"
          >
            <Search className="h-5 w-5" />
            <span className="hidden sm:inline text-sm font-medium">Buscar</span>
            <kbd className="hidden lg:inline text-[11px] font-semibold border border-outline-variant rounded-md px-1.5 py-0.5">⌘K</kbd>
          </button>

          {/* Who is registering on this device */}
          {accounts.length <= 3 ? (
            <div role="radiogroup" aria-label="Registrando como" className="hidden sm:flex items-center h-10 rounded-full border border-outline-variant overflow-hidden">
              {accounts.map(u => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={currentUser === u}
                  onClick={() => handleUserToggle(u)}
                  className={`m3-state h-full px-4 flex items-center gap-1.5 text-sm font-semibold cursor-pointer ${
                    currentUser === u ? accountTone(u, accounts).container : 'text-on-surface-variant'
                  }`}
                >
                  {currentUser === u && <Check className="h-4 w-4" aria-hidden="true" />}
                  {u}
                </button>
              ))}
            </div>
          ) : (
            <label className="hidden sm:block">
              <span className="sr-only">Registrando como</span>
              <select
                value={currentUser}
                onChange={e => handleUserToggle(e.target.value)}
                className={`h-10 px-4 rounded-full text-sm font-semibold border-0 cursor-pointer ${accountTone(currentUser, accounts).container}`}
              >
                {accounts.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => {
              const next = accounts[(accounts.indexOf(currentUser) + 1) % accounts.length];
              if (next === currentUser) return;
              handleUserToggle(next);
              showToast(`Ahora registras como ${next}.`, 'info');
            }}
            aria-label={`Registrando como ${currentUser}. Cambiar de persona`}
            className={`sm:hidden h-10 w-10 rounded-full text-sm font-bold flex items-center justify-center cursor-pointer ${accountTone(currentUser, accounts).container}`}
          >
            {currentUser.slice(0, 2)}
          </button>

          {/* Sync status */}
          <button
            type="button"
            onClick={handleSyncBadgeClick}
            aria-live="polite"
            aria-label={syncLabel}
            title={syncTooltipMsg()}
            className={`m3-state relative h-10 min-w-10 px-2.5 lg:px-3.5 rounded-full flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer ${
              syncStatus === 'synced' ? 'bg-success-container text-on-success-container' :
              syncStatus === 'pending' ? 'bg-primary-container text-on-primary-container' :
              syncStatus === 'error' ? 'bg-error-container text-on-error-container' :
              'bg-surface-container text-on-surface-variant'
            }`}
          >
            <SyncIcon className={`h-5 w-5 ${syncStatus === 'pending' ? 'animate-spin [animation-duration:1.6s]' : ''}`} aria-hidden="true" />
            <span className="hidden lg:inline">{syncLabel}</span>
            {ledger.pendingCount > 0 && (
              <span className="lg:hidden absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-error text-on-error text-[11px] font-bold flex items-center justify-center">
                {ledger.pendingCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 w-full pt-5 pb-[calc(10rem+env(safe-area-inset-bottom))] md:pb-12">

        <InstallBanner
          canInstall={pwa.canInstall}
          isIos={pwa.isIos}
          isStandalone={pwa.isStandalone}
          onInstall={() => { void pwa.promptInstall(); }}
        />

        {/* Account filter (M3 segmented button) */}
        {currentTab !== 'config' && (
          <div className="mb-5 flex items-center gap-3">
            <span className="hidden sm:inline text-sm font-medium text-on-surface-variant">Cuenta</span>
            <div role="radiogroup" aria-label="Filtrar por cuenta" className="flex h-10 w-full sm:w-auto rounded-full border border-outline overflow-x-auto [scrollbar-width:none]">
              {[['Ambos', 'Todas'], ...accounts.map(a => [a, a])].map(([value, label], i) => {
                const selected = currentView === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleAccountViewToggle(value)}
                    className={`m3-state flex-1 sm:flex-initial sm:min-w-28 px-4 flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer ${
                      i > 0 ? 'border-l border-outline' : ''
                    } ${selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'}`}
                  >
                    {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="min-h-56">
          <Suspense fallback={<TabFallback />}>
          {!ledger.hasLoaded && currentTab !== 'config' ? <TabFallback /> : <>
          {currentTab === 'resumen' && (
            <Dashboard 
              theme={theme.resolved}
              deudas={deudas}
              pagos={pagos}
              accountView={currentView}
              onOpenNewDebt={() => setIsDebtFormOpen(true)}
              onOpenDetails={(id) => setSelectedDetailsId(id)}
              onOpenPerson={handleOpenPersonByName}
            />
          )}

          {currentTab === 'deudas' && (
            <DebtsList 
              deudas={deudas}
              accountView={currentView}
              onOpenDetails={(id) => setSelectedDetailsId(id)}
              onOpenAbono={handleOpenAbonoDirect}
              onOpenNewDebt={() => setIsDebtFormOpen(true)}
              onDeleteDebt={handleDeleteDebt}
              onEditDebt={(id) => setEditingDebtId(id)}
              onMarkPaid={handleMarkPaid}
              phoneOf={clientPhone}
              onNotify={(m) => showToast(m, 'success')}
            />
          )}

          {currentTab === 'personas' && (
            <PeopleList deudas={deudas} pagos={pagos} accountView={currentView} onOpenPerson={setOpenPersonKey} />
          )}

          {currentTab === 'movimientos' && (
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Tipo de historial" className="flex h-10 w-full sm:w-80 rounded-full border border-outline overflow-hidden">
                {([['movimientos', 'Movimientos'], ['cambios', 'Cambios']] as const).map(([value, label], i) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={historyView === value}
                    onClick={() => setHistoryView(value)}
                    className={`m3-state flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold cursor-pointer ${i > 0 ? 'border-l border-outline' : ''} ${
                      historyView === value ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'
                    }`}
                  >
                    {historyView === value && <Check className="h-4 w-4" aria-hidden="true" />}
                    {label}
                  </button>
                ))}
              </div>
              {historyView === 'movimientos' ? (
                <TransactionsHistory
                  deudas={deudas}
                  pagos={pagos}
                  accountView={currentView}
                  onDeleteDebt={handleDeleteDebt}
                  onDeletePayment={handleDeletePayment}
                  onOpenDebt={(id) => setSelectedDetailsId(id)}
                />
              ) : (
                <ChangeLogView
                  mode={isLocalMode ? 'local' : 'sheets'}
                  url={sheetUrl}
                  token={sheetToken}
                  apiVersion={ledger.apiVersion}
                  pendingOps={ledger.pendingOps}
                  refreshKey={ledger.lastSyncedAt ?? 0}
                />
              )}
            </div>
          )}

          </>}
          {currentTab === 'config' && (
            <SettingsScreen
              key={`${sheetUrl}|${sheetToken}`}
              sheetUrl={sheetUrl}
              sheetToken={sheetToken}
              apiVersion={ledger.apiVersion}
              isLocalMode={isLocalMode}
              activeUser={currentUser}
              themePreference={theme.preference}
              onThemeChange={theme.setPreference}
              pwa={{
                isStandalone: pwa.isStandalone,
                isIos: pwa.isIos,
                canInstall: pwa.canInstall,
                onInstall: () => { void pwa.promptInstall(); }
              }}
              onSaveConnection={handleSaveConnection}
              onApplyAutoConfigLink={handleApplyAutoConfigLink}
              onClearSettings={handleClearUrlSettings}
              onToggleLocal={handleToggleLocalMode}
              cards={{
                clients: (
                  <ClientsSettings
                    clients={clientes}
                    deudas={deudas}
                    pagos={pagos}
                    phoneOf={clientPhone}
                    limitOf={(name) => limitOf(ledger.data, name)}
                    canEdit={isLocalMode || ledger.apiVersion === null || ledger.apiVersion >= minApiFor('renameClient')}
                    onSave={handleSaveClient}
                    onMerge={handleMergeClient}
                    onDelete={handleDeleteClient}
                  />
                ),
                security: (
                  <SecuritySettings
                    settings={appLock.settings}
                    userName={currentUser}
                    setPin={appLock.setPin}
                    disable={appLock.disable}
                    enableBiometric={appLock.enableBiometric}
                    disableBiometric={appLock.disableBiometric}
                    setTimeoutMin={appLock.setTimeoutMin}
                    lockNow={appLock.lockNow}
                    onNotify={showToast}
                  />
                ),
                users: <UsersSettings accounts={accounts} deudas={deudas} activeUser={currentUser} onSetUsers={handleSetUsers} onRenameUser={handleRenameUser} />,
                reminders: (
                  <RemindersSettings
                    mode={isLocalMode ? 'local' : 'sheets'}
                    url={sheetUrl}
                    token={sheetToken}
                    apiVersion={ledger.apiVersion}
                    isIos={pwa.isIos}
                    isStandalone={pwa.isStandalone}
                    notify={notifications}
                    onNotify={showToast}
                  />
                ),
                backup: <BackupSettings mode={isLocalMode ? 'local' : 'sheets'} url={sheetUrl} token={sheetToken} apiVersion={ledger.apiVersion} onNotify={showToast} />,
                data: <DataExportCard deudas={deudas} pagos={pagos} clientLimits={clientLimits} onImportBackup={handleImportBackup} onNotify={showToast} />
              }}
            />
          )}
          </Suspense>
        </div>
      </main>

      <NavigationBar current={currentTab} onNavigate={setCurrentTab} />

      {/* ================= COMPLEMENTARY POPUPS AND MODALS ================= */}

      {/* Debt file details card with associated payments ledger */}
      <DebtDetailsModal 
        isOpen={selectedDetailsId !== null}
        deudaId={selectedDetailsId}
        deudas={deudas}
        pagos={pagos}
        onClose={() => setSelectedDetailsId(null)}
        onOpenAbono={handleOpenAbonoDirect}
        onDeletePayment={handleDeletePayment}
        activeUser={currentUser}
        onEdit={(id) => { setEditingDebtId(id); }}
        onOpenPerson={handleOpenPersonByName}
        onMarkPaid={handleMarkPaid}
      />

      {/* Form modal to register new debt */}
      <DebtFormModal 
        isOpen={isDebtFormOpen || editingDebtId !== null}
        onClose={() => { setIsDebtFormOpen(false); setEditingDebtId(null); setNewDebtContact(undefined); }}
        onSubmit={handleAddDebt}
        activeUser={currentUser}
        deudas={deudas}
        clientLimits={clientLimits}
        editing={editingDebtId ? deudas.find(d => d.id === editingDebtId) ?? null : null}
        onUpdate={handleUpdateDebt}
        initialContacto={newDebtContact}
        clients={clientsOf(ledger.data)}
      />

      {/* Person profile and account statement */}
      {openPerson && (
        <PersonSheet
          person={openPerson}
          limit={Object.entries(clientLimits).find(([k]) => personKey(k) === openPerson.key)?.[1] ?? 0}
          phone={clientPhone(openPerson.name)}
          onClose={() => setOpenPersonKey(null)}
          onOpenDebt={(id) => setSelectedDetailsId(id)}
          onNewDebt={(name) => { setNewDebtContact(name); setIsDebtFormOpen(true); }}
          onStatement={() => setStatementKey(openPerson.key)}
          onNotify={(m) => showToast(m, 'success')}
        />
      )}
      {statementPerson && (
        <Suspense fallback={null}>
          <StatementSheet person={statementPerson} preparedBy={currentUser} onClose={() => setStatementKey(null)} onNotify={(m) => showToast(m, 'info')} />
        </Suspense>
      )}

      {/* Form modal to register a repayment/abono */}
      <AbonoFormModal 
        isOpen={isAbonoFormOpen}
        deudaId={abonoDebtId}
        deudas={deudas}
        onClose={() => {
          setIsAbonoFormOpen(false);
          setAbonoDebtId(null);
        }}
        onSubmit={handleAddPayment}
        activeUser={currentUser}
      />

      {/* Quick Search Modal (Cmd+K / Ctrl+K) */}
      <QuickSearchModal 
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        deudas={deudas}
        pagos={pagos}
        onOpenDetails={(id) => {
          setSelectedDetailsId(id);
          setIsQuickSearchOpen(false);
        }}
        onOpenNewDebt={() => {
          setIsDebtFormOpen(true);
          setIsQuickSearchOpen(false);
        }}
        onNavigateTab={(tab) => setCurrentTab(tab)}
        onToggleAccountView={handleAccountViewToggle}
      />

      {/* FAB (phones): new loan */}
      <button
        type="button"
        onClick={() => setIsDebtFormOpen(true)}
        aria-label="Nuevo préstamo"
        className="md:hidden fixed z-40 right-4 bottom-[calc(5rem+1rem+env(safe-area-inset-bottom))] h-14 w-14 rounded-2xl bg-primary-container text-on-primary-container m3-elevation-3 m3-state flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>

      {/* Snackbars */}
      <div
        role="status"
        aria-live="polite"
        className="fixed z-50 left-4 right-4 md:left-auto md:right-6 md:w-[380px] bottom-[calc(5rem+5.5rem+env(safe-area-inset-bottom))] md:bottom-6 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(t => {
          const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? CircleAlert : t.type === 'warning' ? TriangleAlert : Info;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-xl bg-inverse-surface text-inverse-on-surface px-4 py-3 m3-elevation-3 text-sm leading-snug animate-sheet-in"
            >
              <Icon className={`h-5 w-5 shrink-0 mt-px ${t.type === 'error' || t.type === 'warning' ? 'text-warning-container' : 'text-inverse-primary'}`} aria-hidden="true" />
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button type="button" onClick={() => { t.action!.onClick(); dismissToast(t.id); }}
                  className="m3-state -my-2 -mr-2 h-10 px-3 rounded-full text-sm font-semibold text-inverse-primary shrink-0 cursor-pointer">
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* New version available (service worker update) */}
      {pwa.needRefresh && (
        <div
          role="status"
          className="fixed z-50 left-4 right-4 md:left-auto md:right-6 md:w-[380px] bottom-[calc(5rem+5.5rem+env(safe-area-inset-bottom))] md:bottom-24 bg-inverse-surface text-inverse-on-surface rounded-xl m3-elevation-3 px-4 py-2 flex items-center gap-2 animate-sheet-in"
        >
          <span className="text-sm flex-1 py-1">Hay una versión nueva de Preztame.</span>
          <button
            type="button"
            onClick={pwa.dismissUpdate}
            className="m3-state h-10 px-3 rounded-full text-sm font-semibold text-inverse-on-surface/80 cursor-pointer"
          >
            Luego
          </button>
          <button
            type="button"
            onClick={pwa.updateApp}
            className="m3-state h-10 px-3 rounded-full text-sm font-bold text-inverse-primary cursor-pointer"
          >
            Actualizar
          </button>
        </div>
      )}

      {/* Confirmation dialog (M3 basic dialog) */}
      {confirm.isOpen && (
        <div className="fixed inset-0 bg-scrim/40 flex items-center justify-center z-50 p-6 animate-fade-in" onClick={() => setConfirm(prev => ({ ...prev, isOpen: false }))}>
          <div
            ref={confirmRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-high text-on-surface rounded-[28px] max-w-sm w-full p-6 m3-elevation-3"
          >
            <h3 id="confirm-title" className="text-2xl font-semibold leading-tight">{confirm.title}</h3>
            <p id="confirm-message" className="mt-4 text-sm text-on-surface-variant leading-relaxed">{confirm.message}</p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConfirm(prev => ({ ...prev, isOpen: false }))}
                className="m3-state h-10 px-4 rounded-full text-sm font-semibold text-primary cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm.onConfirm}
                className="m3-state h-10 px-5 rounded-full text-sm font-semibold bg-error text-on-error cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </AccountsProvider>
  );
}
