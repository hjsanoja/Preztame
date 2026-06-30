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
  const handleSetClientLimit = (contacto: string, limit: number) => {
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
    <div className="bg-[#f9f9fc] text-[#1a1c1e] min-h-screen flex flex-col font-sans selection:bg-[#040d53]/15 selection:text-[#040d53] pb-12 antialiased">
      
      {/* Toast notifications drawer block */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-none">
        {toasts.map(t => {
          let styleClass = "bg-slate-900 text-white border-slate-800";
          if (t.type === 'success') styleClass = "bg-[#2a6c00]/95 border-emerald-500/20 text-white";
          if (t.type === 'error') styleClass = "bg-[#ba1a1a]/95 border-red-500/20 text-white";
          if (t.type === 'warning') styleClass = "bg-amber-500/95 border-amber-600/20 text-slate-950";
          if (t.type === 'info') styleClass = "bg-[#040d53]/95 border-indigo-500/20 text-white";

          return (
            <div 
              key={t.id}
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-lg border shadow-md text-[11px] font-bold leading-normal transition-all duration-300 pointer-events-auto shrink-0 animate-fade-in ${styleClass}`}
            >
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row justify-between sm:h-16 items-start sm:items-center py-3.5 sm:py-0 gap-3">
            
            {/* Logo and metadata branding */}
            <div className="flex items-center space-x-3">
              <div className="bg-[#040d53] text-white p-2.5 rounded-xl shadow-md transform hover:scale-105 transition duration-200 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center">
                  DeudaFlow
                  <span className="text-[#040d53] font-bold text-[9px] sm:text-[10px] bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-md ml-2 border border-indigo-100 font-mono">Nina & Nando</span>
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-450 font-bold tracking-tight">Finanzas compartidas transparentes</p>
              </div>
            </div>

            {/* Config & Active operator block */}
            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
              
              {/* Active logging user toggle */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-[#eeeef0]">
                <button 
                  onClick={() => handleUserToggle('Nina')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 active:scale-95 ${
                    activeUser === 'Nina' 
                      ? 'bg-[#040d53] text-white shadow-xs font-extrabold' 
                      : 'text-slate-600 hover:text-[#1a1c1e] hover:bg-white/50'
                  }`}
                >
                  Nina
                </button>
                <button 
                  onClick={() => handleUserToggle('Nando')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 active:scale-95 ${
                    activeUser === 'Nando' 
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' 
                      : 'text-slate-600 hover:text-[#1a1c1e] hover:bg-white/50'
                  }`}
                >
                  Nando
                </button>
              </div>

              {/* Central sync cloud beacon indicator */}
              <div 
                onClick={() => {
                  if (syncStatus === 'error') {
                    setCurrentTab('config');
                    showToast("Abriendo guía de configuración paso a paso.", "info");
                  }
                }}
                className={`flex items-center space-x-1.5 border px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold select-none ${
                  syncStatus === 'synced' ? 'bg-emerald-50 border-emerald-250 text-[#2c7100]' :
                  syncStatus === 'pending' ? 'bg-indigo-50 border-indigo-150 text-[#040d53]' :
                  syncStatus === 'error' ? 'bg-rose-50 border-rose-250 text-[#ba1a1a] cursor-pointer hover:bg-rose-100' :
                  'bg-[#f3f3f6] border-[#eeeef0] text-slate-700'
                }`}
                title={syncTooltipMsg()}
              >
                <span className={`h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full ${
                  syncStatus === 'synced' ? 'bg-[#70C145]' :
                  syncStatus === 'pending' ? 'bg-indigo-500 animate-pulse' :
                  syncStatus === 'error' ? 'bg-[#ba1a1a] animate-ping' :
                  'bg-slate-400'
                }`} />
                <span className="font-sans font-bold">
                  {syncStatus === 'synced' ? 'Sincronizado' :
                   syncStatus === 'pending' ? 'Guardando...' :
                   syncStatus === 'error' ? 'Error ⚠️' :
                   'Pruebas'}
                </span>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 w-full mt-6 flex-grow">
        
        {/* Global Account Select View */}
        <div id="account-view-filter-bar" className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-4.5 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Panel selector de vistas</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-700">Filtrar métricas, listas e historial consolidado de:</span>
          </div>
          
          <div className="flex bg-[#f3f3f6] p-1 rounded-xl self-start sm:self-center border border-[#eeeef0] w-full sm:w-auto">
            <button 
              onClick={() => handleAccountViewToggle('Ambos')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-150 active:scale-95 ${
                accountView === 'Ambos' 
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="hidden xs:inline">Ambas Cuentas</span>
              <span className="inline xs:hidden">Ambas</span>
            </button>
            <button 
              onClick={() => handleAccountViewToggle('Nina')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-150 active:scale-95 ${
                accountView === 'Nina' 
                  ? 'bg-[#040d53] text-white shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              <span className="hidden xs:inline">Préstamos Nina</span>
              <span className="inline xs:hidden">Nina</span>
            </button>
            <button 
              onClick={() => handleAccountViewToggle('Nando')}
              className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-150 active:scale-95 ${
                accountView === 'Nando' 
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              <span className="hidden xs:inline">Préstamos Nando</span>
              <span className="inline xs:hidden">Nando</span>
            </button>
          </div>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex space-x-0.5 sm:space-x-1 bg-slate-200/50 p-1 rounded-xl mb-6 max-w-lg border border-[#e2e8f0]">
          <button 
            onClick={() => setCurrentTab('resumen')}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 text-[11px] xs:text-xs sm:text-sm font-semibold rounded-lg transition active:scale-95 cursor-pointer ${
              currentTab === 'resumen' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setCurrentTab('deudas')}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 text-[11px] xs:text-xs sm:text-sm font-semibold rounded-lg transition active:scale-95 cursor-pointer ${
              currentTab === 'deudas' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Préstamos
          </button>
          <button 
            onClick={() => setCurrentTab('movimientos')}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 text-[11px] xs:text-xs sm:text-sm font-semibold rounded-lg transition active:scale-95 cursor-pointer ${
              currentTab === 'movimientos' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Historial
          </button>
          <button 
            onClick={() => setCurrentTab('config')}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-3 text-[11px] xs:text-xs sm:text-sm font-semibold rounded-lg transition active:scale-95 cursor-pointer ${
              currentTab === 'config' 
                ? 'bg-white text-slate-900 shadow-xs font-bold' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span className="hidden xs:inline">Google Sheets</span>
            <span className="inline xs:hidden">Sheets</span>
          </button>
        </div>

        {/* Hotkey Shortcuts overlay hint */}
        <div className="hidden md:flex justify-between items-center text-[11px] text-slate-400 bg-[#f3f3f6] border border-[#eeeef0] px-4 py-2 rounded-xl mb-6 font-medium">
          <span className="flex items-center">
            <Keyboard className="h-3.5 w-3.5 mr-1 text-[#040d53]" />
            ⚡ Atajos de teclado rápidos activos:
          </span>
          <div className="flex space-x-4">
            <span><kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded shadow-xs text-slate-600 font-bold font-mono">N</kbd> Registrar Préstamo</span>
            <span><kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded shadow-xs text-slate-600 font-bold font-mono">1 - 4</kbd> Intercambiar pestaña</span>
            <span><kbd className="bg-white border border-slate-300 px-1.5 py-0.5 rounded shadow-xs text-slate-600 font-bold font-mono">Esc</kbd> Cerrar todo</span>
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
