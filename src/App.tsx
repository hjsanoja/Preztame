import React, { useState, useEffect, useCallback } from 'react';
import { Debt, Payment } from './types';
import { 
  getStoredSource, 
  getStoredSheetUrl, 
  getLocalFallbackData, 
  saveLocalChanges 
} from './utils/storage';
import Dashboard from './components/Dashboard';
import DebtsList from './components/DebtsList';
import TransactionsHistory from './components/TransactionsHistory';
import SetupGuide from './components/SetupGuide';

// Modals
import DebtDetailsModal from './components/DebtDetailsModal';
import DebtFormModal from './components/DebtFormModal';
import AbonoFormModal from './components/AbonoFormModal';

// Icons
import { 
  DollarSign, 
  Settings, 
  Layers, 
  TrendingUp, 
  CheckCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Wifi,
  WifiOff,
  Keyboard,
  User,
  ArrowRightLeft
} from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function App() {
  // Navigation Tabs: 'resumen' | 'deudas' | 'movimientos' | 'config'
  const [currentTab, setCurrentTab] = useState<'resumen' | 'deudas' | 'movimientos' | 'config'>('resumen');

  // Core Data States
  const [deudas, setDeudas] = useState<Debt[]>([]);
  const [pagos, setPagos] = useState<Payment[]>([]);
  const [activeUser, setActiveUser] = useState<'Nina' | 'Nando'>('Nina');
  const [accountView, setAccountView] = useState<'Ambos' | 'Nina' | 'Nando'>('Ambos');
  
  // Configuration Settings
  const [isLocalMode, setIsLocalMode] = useState<boolean>(true);
  const [sheetUrl, setSheetUrl] = useState<string>('');
  
  // Loader & Sinc Status variables
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'error' | 'pending' | 'local'>('local');

  // UI Modals triggers states
  const [selectedDetailsId, setSelectedDetailsId] = useState<string | null>(null);
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [isAbonoFormOpen, setIsAbonoFormOpen] = useState(false);
  const [abonoDebtId, setAbonoDebtId] = useState<string | null>(null);

  // Client credit limits state
  const [clientLimits, setClientLimits] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("df_client_limits");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Custom UI elements (Toast and Confirm boxes)
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmConfig>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Display toast alerts
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

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

  // Fetch / Load data fully compiled based on sync source
  const loadData = useCallback(async (source: 'local' | 'sheets', currentUrl: string) => {
    if (source === 'local') {
      const fallback = getLocalFallbackData();
      setDeudas(fallback.deudas);
      setPagos(fallback.pagos);
      setSyncStatus('local');
      return;
    }

    if (!currentUrl) {
      // Prompt configuration if spreadsheet is selected but empty URL
      setDeudas([]);
      setPagos([]);
      setSyncStatus('error');
      showToast("Seleccionaste Google Sheets pero no tienes una URL configurada. Abre 'Configuración' para fijarla.", "warning");
      return;
    }

    setIsSyncing(true);
    setSyncStatus('pending');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(currentUrl, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const resJson = await response.json();
      
      const parsedDeudas: Debt[] = (resJson.deudas || []).map((d: any) => ({
        id: String(d.id),
        cuenta: d.cuenta === 'Nando' ? 'Nando' : 'Nina',
        contacto: String(d.contacto || 'Desconocido'),
        tipo: String(d.tipo || 'favor'),
        descripcion: String(d.descripcion || ''),
        fecha: d.fecha ? d.fecha.split('T')[0] : '',
        mesPago: String(d.mesPago || ''),
        tasaCambio: parseFloat(d.tasaCambio) || 1.0,
        monto: parseFloat(d.monto) || 0,
        saldo: parseFloat(d.saldo) || 0,
        estado: d.estado === 'saldado' ? 'saldado' : 'pendiente',
        creadoPor: String(d.creadoPor || 'Nina')
      }));

      const parsedPagos: Payment[] = (resJson.pagos || []).map((p: any) => ({
        id: String(p.id),
        fecha: p.fecha ? p.fecha.split('T')[0] : '',
        deudaId: String(p.deudaId),
        monto: parseFloat(p.monto) || 0,
        nota: String(p.nota || ''),
        registradoPor: String(p.registradoPor || 'Nina')
      }));

      setDeudas(parsedDeudas);
      setPagos(parsedPagos);

      if (resJson.clientLimits) {
        const parsedLimits: Record<string, number> = {};
        Object.entries(resJson.clientLimits).forEach(([k, v]) => {
          parsedLimits[k] = parseFloat(v as any) || 0;
        });
        setClientLimits(parsedLimits);
        localStorage.setItem("df_client_limits", JSON.stringify(parsedLimits));
      }

      setSyncStatus('synced');
      showToast("Respaldo en Google Drive sincronizado con éxito.", "success");
    } catch (err) {
      console.error("Error fetching data from Apps Script", err);
      setSyncStatus('error');
      // Load current local storage backup to cover offline states
      const cached = getLocalFallbackData();
      setDeudas(cached.deudas);
      setPagos(cached.pagos);
      showToast("Hubo un error de conexión al sincronizar de Google Sheets. Cargamos tu copia local temporal.", "error");
    } finally {
      setIsSyncing(false);
    }
  }, [showToast]);

  // Initial loads and param captures
  useEffect(() => {
    // 1. Capture dynamic autoconfig search parameters
    const params = new URLSearchParams(window.location.search);
    const paramUrl = params.get('scriptUrl');
    const paramUser = params.get('user');

    let initialSource: 'sheets' | 'local' = getStoredSource();
    let initialUrl: string = getStoredSheetUrl();
    let initialUser: 'Nina' | 'Nando' = 'Nina';

    if (paramUrl) {
      const decoded = decodeURIComponent(paramUrl);
      localStorage.setItem("df_sheet_url", decoded);
      localStorage.setItem("df_datasource", "sheets");
      initialUrl = decoded;
      initialSource = 'sheets';
      showToast("¡Configuración de Google Sheets autodetectada y cargada!", "success");
      
      // Clean query parameters from URL quietly
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (paramUser && (paramUser === 'Nina' || paramUser === 'Nando')) {
      initialUser = paramUser;
      localStorage.setItem("df_active_user", paramUser);
    } else {
      const savedUser = localStorage.getItem("df_active_user");
      if (savedUser === 'Nando' || savedUser === 'Nina') {
        initialUser = savedUser;
      }
    }

    const savedView = localStorage.getItem("df_account_view");
    if (savedView === 'Ambos' || savedView === 'Nina' || savedView === 'Nando') {
      setAccountView(savedView);
    }

    setIsLocalMode(initialSource === 'local');
    setSheetUrl(initialUrl);
    setActiveUser(initialUser);

    loadData(initialSource, initialUrl);
  }, [loadData, showToast]);

  // Global Keyboard shortcuts handling
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const isEditing = document.activeElement?.tagName === 'INPUT' || 
                        document.activeElement?.tagName === 'TEXTAREA' || 
                        document.activeElement?.tagName === 'SELECT';
      
      if (isEditing) return;

      // Modal universal close
      if (e.key === "Escape") {
        setIsDebtFormOpen(false);
        setIsAbonoFormOpen(false);
        setSelectedDetailsId(null);
        setConfirm(prev => ({ ...prev, isOpen: false }));
      }

      // Quick tab swaps 1-4
      if (e.key === "1") { e.preventDefault(); setCurrentTab('resumen'); }
      if (e.key === "2") { e.preventDefault(); setCurrentTab('deudas'); }
      if (e.key === "3") { e.preventDefault(); setCurrentTab('movimientos'); }
      if (e.key === "4") { e.preventDefault(); setCurrentTab('config'); }

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
  const handleUserToggle = (user: 'Nina' | 'Nando') => {
    setActiveUser(user);
    localStorage.setItem("df_active_user", user);
  };

  // Change primary account filtration views
  const handleAccountViewToggle = (view: 'Ambos' | 'Nina' | 'Nando') => {
    setAccountView(view);
    localStorage.setItem("df_account_view", view);
  };

  // Save new Sheet integration endpoints
  const handleSaveSheetUrl = async (url: string) => {
    if (url.includes("/edit")) {
      showToast("Has copiado la URL de edición del navegador. Copia la URL de Aplicación Web publicada que termina en /exec", "warning");
      return;
    }

    setSheetUrl(url);
    localStorage.setItem("df_sheet_url", url);
    setIsLocalMode(false);
    localStorage.setItem("df_datasource", "sheets");
    
    showToast("URL de Google Sheets guardada. Conectando...", "info");
    await loadData('sheets', url);
  };

  const handleClearUrlSettings = () => {
    setSheetUrl('');
    localStorage.removeItem("df_sheet_url");
    setIsLocalMode(true);
    localStorage.setItem("df_datasource", "local");
    showToast("Conexión de Google Sheets removida. Volviendo a prueba local.", "info");
    loadData('local', '');
  };

  const handleToggleLocalMode = (local: boolean) => {
    setIsLocalMode(local);
    localStorage.setItem("df_datasource", local ? "local" : "sheets");
    showToast(local ? "Prueba sin conexión local activada." : "Entrando a modo sincronización permanente Sheets.", "info");
    loadData(local ? 'local' : 'sheets', sheetUrl);
  };

  // Set client credit limits and save to local storage
  const handleSetClientLimit = async (contacto: string, limit: number) => {
    // OPTIMISTIC UPDATE
    setClientLimits(prev => {
      const updated = { ...prev };
      if (limit <= 0) {
        delete updated[contacto];
      } else {
        updated[contacto] = limit;
      }
      localStorage.setItem("df_client_limits", JSON.stringify(updated));
      return updated;
    });

    if (limit <= 0) {
      showToast(`Límite de crédito removido para ${contacto}.`, "success");
    } else {
      showToast(`Límite de crédito de $${limit} asignado para ${contacto}.`, "success");
    }

    if (!isLocalMode && sheetUrl) {
      try {
        const payload = {
          action: "setClientLimit",
          contacto,
          limite: limit
        };

        const res = await fetch(sheetUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.clientLimits) {
            const parsedLimits: Record<string, number> = {};
            Object.entries(data.clientLimits).forEach(([k, v]) => {
              parsedLimits[k] = parseFloat(v as any) || 0;
            });
            setClientLimits(parsedLimits);
            localStorage.setItem("df_client_limits", JSON.stringify(parsedLimits));
          }
        }
      } catch (err) {
        console.error("Failed to sync limit to Google Sheets", err);
        showToast("No se pudo sincronizar el límite en Google Sheets. Se guardó localmente por ahora.", "warning");
      }
    }
  };

  // Restore imported backup data locally
  const handleImportBackup = (importedDeudas: Debt[], importedPagos: Payment[], importedLimits: Record<string, number>) => {
    setDeudas(importedDeudas);
    setPagos(importedPagos);
    setClientLimits(importedLimits);

    // Save changes using storage manager utilities
    saveLocalChanges(importedDeudas, importedPagos);
    localStorage.setItem("df_client_limits", JSON.stringify(importedLimits));

    showToast("¡Copia de seguridad importada con éxito!", "success");
  };

  // ================= ACTION DISPATCHERS WITH OPTIMISTIC CODES =================

  // 1. ADD NEW LOAN
  const handleAddDebt = async (debtPayload: Omit<Debt, 'id' | 'saldo' | 'estado' | 'creadoPor'>) => {
    const newId = "d-" + Date.now().toString() + Math.random().toString().slice(2,6);
    const newDebt: Debt = {
      id: newId,
      ...debtPayload,
      saldo: debtPayload.monto,
      estado: 'pendiente',
      creadoPor: activeUser
    };

    // OPTIMISTIC LOCAL STATE UPDATE - Screen responds immediately
    const prevDeudas = [...deudas];
    setDeudas(prev => [newDebt, ...prev]);
    showToast("Guardando préstamo...", "info");

    if (isLocalMode) {
      saveLocalChanges([newDebt, ...prevDeudas], pagos);
      showToast("Préstamo registrado en el navegador.", "success");
    } else {
      try {
        const payload = {
          action: "addDebt",
          ...newDebt
        };

        const res = await fetch(sheetUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error();

        const data = await res.json();
        // Server sends back synced sheets state, reload securely
        if (data && data.deudas) {
          setDeudas(data.deudas.map((d: any) => ({ ...d, monto: parseFloat(d.monto), saldo: parseFloat(d.saldo), tasaCambio: parseFloat(d.tasaCambio) })));
          setPagos(data.pagos.map((p: any) => ({ ...p, monto: parseFloat(p.monto) })));
          // Update cache
          saveLocalChanges(data.deudas, data.pagos);
          showToast("¡Préstamo registrado y sincronizado con Google Drive!", "success");
        }
      } catch (err) {
        console.error(err);
        // ROLLBACK state in case of connection exceptions
        setDeudas(prevDeudas);
        showToast("Falla de sincronización. El préstamo no se guardó en Google Sheets. Revisa tu conexión.", "error");
      }
    }
  };

  // 2. ADD PAYMENT REPAYMENT ABONO
  const handleAddPayment = async (payPayload: Omit<Payment, 'id' | 'registradoPor'>) => {
    const newId = "p-" + Date.now().toString() + Math.random().toString().slice(2,6);
    const newPayment: Payment = {
      id: newId,
      ...payPayload,
      registradoPor: activeUser
    };

    // OPTIMISTIC UPGRADES
    const prevDeudas = JSON.parse(JSON.stringify(deudas)) as Debt[];
    const prevPagos = [...pagos];

    // Find parent and slice balance
    const updatedDeudas = deudas.map(d => {
      if (d.id === payPayload.deudaId) {
        const nextSaldo = parseFloat((d.saldo - payPayload.monto).toFixed(2));
        return {
          ...d,
          saldo: nextSaldo,
          estado: (nextSaldo <= 0 ? 'saldado' : 'pendiente') as 'saldado' | 'pendiente'
        };
      }
      return d;
    });

    setDeudas(updatedDeudas);
    setPagos(prev => [newPayment, ...prev]);
    showToast("Registrando abono...", "info");

    if (isLocalMode) {
      saveLocalChanges(updatedDeudas, [newPayment, ...prevPagos]);
      showToast("Abono registrado localmente.", "success");
    } else {
      try {
        const payload = {
          action: "addPayment",
          ...newPayment
        };

        const res = await fetch(sheetUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error();

        const data = await res.json();
        if (data && data.deudas) {
          setDeudas(data.deudas.map((d: any) => ({ ...d, monto: parseFloat(d.monto), saldo: parseFloat(d.saldo), tasaCambio: parseFloat(d.tasaCambio) })));
          setPagos(data.pagos.map((p: any) => ({ ...p, monto: parseFloat(p.monto) })));
          saveLocalChanges(data.deudas, data.pagos);
          showToast("Abono registrado y sincronizado en la nube.", "success");
        }
      } catch (err) {
        console.error(err);
        setDeudas(prevDeudas);
        setPagos(prevPagos);
        showToast("Falla de conexión al procesar abono. Intenta de nuevo.", "error");
      }
    }
  };

  // 3. DELETE DEBT
  const handleDeleteDebt = (id: string) => {
    const target = deudas.find(d => d.id === id);
    if (!target) return;

    askConfirmation(
      "¿Eliminar Préstamo Completo?",
      `Estás a punto de borrar el préstamo registrado a "${target.contacto}" por ${new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits: 0, minimumFractionDigits: 0}).format(target.monto)}. Esta acción también anula todos sus abonos asociados. ¿Deseas continuar?`,
      async () => {
        const prevDeudas = [...deudas];
        const prevPagos = [...pagos];

        const updatedDeudas = deudas.filter(d => d.id !== id);
        const updatedPagos = pagos.filter(p => p.deudaId !== id);

        setDeudas(updatedDeudas);
        setPagos(updatedPagos);

        if (selectedDetailsId === id) setSelectedDetailsId(null);
        showToast("Eliminando de forma permanente...", "info");

        if (isLocalMode) {
          saveLocalChanges(updatedDeudas, updatedPagos);
          showToast("Préstamo eliminado de la base local.", "success");
        } else {
          try {
            const res = await fetch(sheetUrl, {
              method: 'POST',
              mode: 'cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: "deleteDebt", id })
            });

            if (!res.ok) throw new Error();

            const data = await res.json();
            if (data && data.deudas) {
              setDeudas(data.deudas.map((d: any) => ({ ...d, monto: parseFloat(d.monto), saldo: parseFloat(d.saldo), tasaCambio: parseFloat(d.tasaCambio) })));
              setPagos(data.pagos.map((p: any) => ({ ...p, monto: parseFloat(p.monto) })));
              saveLocalChanges(data.deudas, data.pagos);
              showToast("Préstamo y abonos eliminados en la base remota.", "success");
            }
          } catch (err) {
            console.error(err);
            setDeudas(prevDeudas);
            setPagos(prevPagos);
            showToast("Ocurrió un error sincronizando la baja con Google Sheets.", "error");
          }
        }
      }
    );
  };

  // 4. ANULAR PAGO / UNDO ABONO
  const handleDeletePayment = (id: string) => {
    const target = pagos.find(p => p.id === id);
    if (!target) return;

    askConfirmation(
      "¿Anular este Abono?",
      `Estás por deshacer el abono por valor de ${new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits: 0, minimumFractionDigits: 0}).format(target.monto)}. El saldo pendiente de la deuda se incrementará de nuevo.`,
      async () => {
        const prevDeudas = JSON.parse(JSON.stringify(deudas)) as Debt[];
        const prevPagos = [...pagos];

        // Restore balance
        const updatedDeudas = deudas.map(d => {
          if (d.id === target.deudaId) {
            const nextSaldo = parseFloat((d.saldo + target.monto).toFixed(2));
            return {
              ...d,
              saldo: nextSaldo,
              estado: 'pendiente' as 'pendiente'
            };
          }
          return d;
        });

        const updatedPagos = pagos.filter(p => p.id !== id);

        setDeudas(updatedDeudas);
        setPagos(updatedPagos);
        showToast("Anulando transacción...", "info");

        if (isLocalMode) {
          saveLocalChanges(updatedDeudas, updatedPagos);
          showToast("Abono anulado con éxito en el navegador.", "success");
        } else {
          try {
            const res = await fetch(sheetUrl, {
              method: 'POST',
              mode: 'cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: "deletePayment", id })
            });

            if (!res.ok) throw new Error();

            const data = await res.json();
            if (data && data.deudas) {
              setDeudas(data.deudas.map((d: any) => ({ ...d, monto: parseFloat(d.monto), saldo: parseFloat(d.saldo), tasaCambio: parseFloat(d.tasaCambio) })));
              setPagos(data.pagos.map((p: any) => ({ ...p, monto: parseFloat(p.monto) })));
              saveLocalChanges(data.deudas, data.pagos);
              showToast("Abono anulado correctamente en Google Sheets.", "success");
            }
          } catch (err) {
            console.error(err);
            setDeudas(prevDeudas);
            setPagos(prevPagos);
            showToast("No pudimos conectar con los servidores para anular el abono.", "error");
          }
        }
      }
    );
  };

  const handleOpenAbonoDirect = (id: string) => {
    setAbonoDebtId(id);
    setIsAbonoFormOpen(true);
  };

  const syncTooltipMsg = () => {
    if (syncStatus === 'local') return 'Modo Local (Pruebas sin Drive)';
    if (syncStatus === 'synced') return 'Sincronizado con Google Sheets';
    if (syncStatus === 'pending') return 'Sincronizando...';
    return 'Error de Conexión. Haz clic para revisar guía.';
  };

  return (
    <div className="bg-slate-50/80 text-slate-900 min-h-screen flex flex-col font-sans selection:bg-indigo-500/15 selection:text-indigo-600 pb-16 antialiased">
      
      {/* Toast notifications drawer block */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2.5 max-w-xs sm:max-w-sm pointer-events-none">
        {toasts.map(t => {
          let styleClass = "bg-slate-900 text-white border-slate-800 shadow-xl";
          if (t.type === 'success') styleClass = "bg-emerald-900/95 border-emerald-500/30 text-emerald-100 shadow-xl shadow-emerald-950/20";
          if (t.type === 'error') styleClass = "bg-rose-900/95 border-rose-500/30 text-rose-100 shadow-xl shadow-rose-950/20";
          if (t.type === 'warning') styleClass = "bg-amber-950/95 border-amber-500/30 text-amber-200 shadow-xl shadow-amber-950/20";
          if (t.type === 'info') styleClass = "bg-slate-900/95 border-indigo-500/30 text-indigo-100 shadow-xl shadow-slate-950/20";

          return (
            <div 
              key={t.id}
              className={`flex items-center space-x-2.5 px-4 py-3 rounded-2xl border backdrop-blur-md text-xs font-semibold leading-normal transition-all duration-300 pointer-events-auto shrink-0 animate-fade-in ${styleClass}`}
            >
              <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* Main Header with Google Gemini / Stitch Aesthetic */}
      <header className="bg-white/85 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row justify-between sm:h-18 items-start sm:items-center py-3.5 sm:py-0 gap-3">
            
            {/* Logo and branding mark */}
            <div className="flex items-center space-x-3.5">
              <div className="gemini-gradient-bg text-white p-2.5 rounded-2xl shadow-md shadow-indigo-500/20 transform hover:scale-105 transition duration-200 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>DeudaFlow</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100/80 font-mono">
                    <Sparkles className="h-2.5 w-2.5 text-indigo-500" />
                    Nina & Nando
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium tracking-tight">Control de finanzas compartidas y préstamos</p>
              </div>
            </div>

            {/* Config & Active operator user block */}
            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
              
              {/* Operator Badge Switcher */}
              <div className="flex items-center space-x-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 font-mono hidden md:inline">Operando:</span>
                <button 
                  onClick={() => handleUserToggle('Nina')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                    activeUser === 'Nina' 
                      ? 'bg-slate-900 text-white shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  Nina
                </button>
                <button 
                  onClick={() => handleUserToggle('Nando')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                    activeUser === 'Nando' 
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-950" />
                  Nando
                </button>
              </div>

              {/* Drive sync status beacon */}
              <div 
                onClick={() => {
                  if (syncStatus === 'error') {
                    setCurrentTab('config');
                    showToast("Abriendo guía de configuración paso a paso.", "info");
                  }
                }}
                className={`flex items-center space-x-2 border px-3 py-1.5 rounded-full text-xs font-semibold select-none transition ${
                  syncStatus === 'synced' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' :
                  syncStatus === 'pending' ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900' :
                  syncStatus === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800 cursor-pointer hover:bg-rose-100' :
                  'bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title={syncTooltipMsg()}
              >
                <span className={`h-2 w-2 rounded-full ${
                  syncStatus === 'synced' ? 'bg-emerald-500 shadow-xs' :
                  syncStatus === 'pending' ? 'bg-indigo-500 animate-pulse' :
                  syncStatus === 'error' ? 'bg-rose-600 animate-ping' :
                  'bg-slate-400'
                }`} />
                <span className="font-sans font-bold">
                  {syncStatus === 'synced' ? 'Sincronizado' :
                   syncStatus === 'pending' ? 'Sincronizando...' :
                   syncStatus === 'error' ? 'Error Sync ⚠️' :
                   'Pruebas Local'}
                </span>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 w-full mt-6 flex-grow">
        
        {/* Global Account Select View */}
        <div id="account-view-filter-bar" className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block font-mono mb-0.5">Visor Consolidado</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-700">Filtrar registros e historial por cuenta:</span>
          </div>
          
          <div className="flex bg-slate-100/80 p-1 rounded-xl self-start sm:self-center border border-slate-200/60 w-full sm:w-auto">
            <button 
              onClick={() => handleAccountViewToggle('Ambos')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
                accountView === 'Ambos' 
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Ambas Cuentas
            </button>
            <button 
              onClick={() => handleAccountViewToggle('Nina')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
                accountView === 'Nina' 
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Cuenta Nina
            </button>
            <button 
              onClick={() => handleAccountViewToggle('Nando')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
                accountView === 'Nando' 
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Cuenta Nando
            </button>
          </div>
        </div>

        {/* Tab Selection Navigation Bar */}
        <div className="flex space-x-1 bg-slate-200/60 p-1.5 rounded-2xl mb-6 max-w-lg border border-slate-200/80">
          <button 
            onClick={() => setCurrentTab('resumen')}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 active:scale-95 cursor-pointer ${
              currentTab === 'resumen' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setCurrentTab('deudas')}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 active:scale-95 cursor-pointer ${
              currentTab === 'deudas' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Préstamos
          </button>
          <button 
            onClick={() => setCurrentTab('movimientos')}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 active:scale-95 cursor-pointer ${
              currentTab === 'movimientos' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Historial
          </button>
          <button 
            onClick={() => setCurrentTab('config')}
            className={`flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 active:scale-95 cursor-pointer ${
              currentTab === 'config' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Configuración
          </button>
        </div>

        {/* Hotkey Shortcuts overlay hint */}
        <div className="hidden md:flex justify-between items-center text-[11px] text-slate-500 bg-white border border-slate-200/70 px-4 py-2.5 rounded-2xl mb-6 font-medium shadow-2xs">
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <Keyboard className="h-4 w-4 text-indigo-600" />
            Atajos de teclado:
          </span>
          <div className="flex space-x-5">
            <span><kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-md text-slate-800 font-bold font-mono text-[10px]">N</kbd> Nuevo Préstamo</span>
            <span><kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-md text-slate-800 font-bold font-mono text-[10px]">1 - 4</kbd> Cambiar Pestañas</span>
            <span><kbd className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-md text-slate-800 font-bold font-mono text-[10px]">Esc</kbd> Cerrar Ventanas</span>
          </div>
        </div>

        {/* Dynamic Display Panels */}
        <div className="min-h-56">
          {currentTab === 'resumen' && (
            <Dashboard 
              deudas={deudas}
              pagos={pagos}
              accountView={accountView}
              onOpenNewDebt={() => setIsDebtFormOpen(true)}
            />
          )}

          {currentTab === 'deudas' && (
            <DebtsList 
              deudas={deudas}
              accountView={accountView}
              onOpenDetails={(id) => setSelectedDetailsId(id)}
              onOpenNewDebt={() => setIsDebtFormOpen(true)}
              onDeleteDebt={handleDeleteDebt}
            />
          )}

          {currentTab === 'movimientos' && (
            <TransactionsHistory 
              deudas={deudas}
              pagos={pagos}
              accountView={accountView}
              onDeleteDebt={handleDeleteDebt}
              onDeletePayment={handleDeletePayment}
            />
          )}

          {currentTab === 'config' && (
            <SetupGuide 
              sheetUrl={sheetUrl}
              onSaveUrl={handleSaveSheetUrl}
              onClearSettings={handleClearUrlSettings}
              isLocalMode={isLocalMode}
              onToggleLocal={handleToggleLocalMode}
              activeUser={activeUser}
              deudas={deudas}
              pagos={pagos}
              clientLimits={clientLimits}
              onSetClientLimit={handleSetClientLimit}
              onImportBackup={handleImportBackup}
            />
          )}
        </div>

      </main>

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
        activeUser={activeUser}
      />

      {/* Form modal to register new debt */}
      <DebtFormModal 
        isOpen={isDebtFormOpen}
        onClose={() => setIsDebtFormOpen(false)}
        onSubmit={handleAddDebt}
        activeUser={activeUser}
        deudas={deudas}
        clientLimits={clientLimits}
      />

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
        activeUser={activeUser}
      />

      {/* Custom Confirmation Dialog (Replaces native window.confirm) */}
      {confirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">{confirm.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{confirm.message}</p>
            <div className="flex space-x-3 pt-2">
              <button 
                onClick={() => setConfirm(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={confirm.onConfirm}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#ba1a1a] hover:opacity-95 transition active:scale-95 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
