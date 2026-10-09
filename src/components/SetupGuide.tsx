import React, { useState, useMemo } from 'react';
import { 
  Copy, Check, ExternalLink, HelpCircle, FileText, ChevronDown, ChevronUp,
  AlertTriangle, Download, Upload, Sliders, ShieldAlert, User, Plus, Trash2 
} from 'lucide-react';
import { Debt, Payment } from '../types';
import { formatMonthName, getOrCreateDraftToken, saveDraftToken } from '../utils/storage';
import { fetchSnapshot, SheetsError, describeSheetsError } from '../lib/sheetsApi';
import appsScriptSource from '../../apps-script/Code.gs?raw';

interface SetupGuideProps {
  sheetUrl: string;
  sheetToken: string;
  onSaveConnection: (url: string, token: string) => void;
  onClearSettings: () => void;
  isLocalMode: boolean;
  onToggleLocal: (local: boolean) => void;
  activeUser: string;
  // New additions
  deudas: Debt[];
  pagos: Payment[];
  clientLimits: Record<string, number>;
  onSetClientLimit: (contacto: string, limit: number) => void;
  onImportBackup: (importedDeudas: Debt[], importedPagos: Payment[], importedLimits: Record<string, number>) => void;
}

export default function SetupGuide({
  sheetUrl,
  sheetToken,
  onSaveConnection,
  onClearSettings,
  isLocalMode,
  onToggleLocal,
  activeUser,
  // Destructure new props
  deudas,
  pagos,
  clientLimits,
  onSetClientLimit,
  onImportBackup
}: SetupGuideProps) {

  const [urlInput, setUrlInput] = useState(sheetUrl);
  const [tokenInput, setTokenInput] = useState(() => sheetToken || getOrCreateDraftToken());
  const [copiedToken, setCopiedToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showFaq, setShowFaq] = useState<{ [key: string]: boolean }>({});

  // Diagnostic state for connection testing
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error-cors' | 'error-url' | 'error-server';
    message?: string;
  }>({ status: 'idle' });

  const runDiagnosticTest = async (urlToTest: string) => {
    const trimmed = urlToTest.trim();
    if (!trimmed) {
      setTestResult({ status: 'error-url', message: 'Por favor ingresa una URL.' });
      return;
    }

    if (trimmed.includes('/edit')) {
      setTestResult({
        status: 'error-url',
        message: 'La URL contiene "/edit". Copiaste el enlace de edición de tu hoja. Debes usar la URL de la Aplicación Web publicada que termina en /exec.'
      });
      return;
    }

    if (!trimmed.includes('/exec')) {
      setTestResult({
        status: 'error-url',
        message: 'La URL no contiene "/exec". Asegúrate de crear una "Nueva implementación" tipo Aplicación Web en Apps Script.'
      });
      return;
    }

    if (!tokenInput.trim()) {
      setTestResult({ status: 'error-url', message: 'Falta la clave de acceso.' });
      return;
    }

    setTestResult({ status: 'testing', message: 'Enviando petición de prueba a Google Apps Script...' });

    try {
      const started = performance.now();
      const snap = await fetchSnapshot({ url: trimmed, token: tokenInput.trim() }, null, { fresh: true });
      const ms = Math.round(performance.now() - started);
      if (snap.kind === 'data' && !snap.version) {
        setTestResult({
          status: 'error-server',
          message: 'La hoja respondió, pero con el código antiguo (v5) que no verifica la clave. Copia el código v6 de abajo y vuelve a implementar.'
        });
        return;
      }
      const count = snap.kind === 'data' ? `${snap.data.deudas.length} préstamos y ${snap.data.pagos.length} abonos` : 'datos';
      setTestResult({
        status: 'success',
        message: `¡Conexión exitosa! Se leyeron ${count} en ${ms} ms.`
      });
    } catch (err: any) {
      console.warn("Diagnostic test failed:", err);
      if (err instanceof SheetsError && err.code === 'unauthorized') {
        const appEnd = tokenInput.trim().slice(-4);
        setTestResult({
          status: 'error-server',
          message: err.keyHint
            ? `La clave no coincide: el Apps Script publicado tiene una clave que termina en "…${err.keyHint}" y la app usa una que termina en "…${appEnd}". Copia el código de nuevo (ya trae la clave de la app), pégalo en Apps Script y publica una NUEVA VERSIÓN.`
            : `La clave no coincide con la del Apps Script publicado (la de la app termina en "…${appEnd}"). Copia el código de nuevo, pégalo en Apps Script y publica una NUEVA VERSIÓN.`
        });
        return;
      }
      if (err instanceof SheetsError && err.code !== 'network' && err.code !== 'timeout') {
        setTestResult({ status: 'error-server', message: describeSheetsError(err.code) });
        return;
      }
      setTestResult({
        status: 'error-cors',
        message: 'Error de conexión / CORS ("Failed to fetch"). Google Apps Script requiere configuración de acceso o autorización previa.'
      });
    }
  };

  // NEW STUFF: Client Limits & Backup
  const [tempLimits, setTempLimits] = useState<Record<string, string>>({});
  const [newContactName, setNewContactName] = useState('');
  const [newContactLimit, setNewContactLimit] = useState('');

  const clientOutstandingBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    deudas.forEach(d => {
      if (d.contacto) {
        const name = d.contacto.trim();
        if (d.estado === 'pendiente') {
          balances[name] = (balances[name] || 0) + d.saldo;
        } else if (balances[name] === undefined) {
          balances[name] = 0;
        }
      }
    });
    return balances;
  }, [deudas]);

  const allContactsWithLimitData = useMemo(() => {
    const contactsSet = new Set<string>();
    deudas.forEach(d => {
      if (d.contacto) contactsSet.add(d.contacto.trim());
    });
    Object.keys(clientLimits).forEach(c => contactsSet.add(c.trim()));
    
    return Array.from(contactsSet).map(name => {
      const activeBalance = clientOutstandingBalances[name] || 0;
      const limit = clientLimits[name] || 0;
      return {
        name,
        activeBalance,
        limit,
        isExceeded: limit > 0 && activeBalance > limit,
        percent: limit > 0 ? (activeBalance / limit) * 100 : 0
      };
    }).sort((a, b) => b.activeBalance - a.activeBalance || a.name.localeCompare(b.name));
  }, [deudas, clientLimits, clientOutstandingBalances]);

  const handleTempLimitChange = (name: string, value: string) => {
    setTempLimits(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveLimit = (name: string) => {
    const val = tempLimits[name];
    if (val === undefined) return;
    const limitNum = parseFloat(val);
    if (isNaN(limitNum) || limitNum < 0) {
      onSetClientLimit(name, 0); // remove/reset
    } else {
      onSetClientLimit(name, limitNum);
    }
  };

  const handleAddCustomLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;
    const limitNum = parseFloat(newContactLimit) || 0;
    onSetClientLimit(newContactName.trim(), limitNum);
    setNewContactName('');
    setNewContactLimit('');
  };

  // Backup handlers
  const handleExportBackup = () => {
    const backupData = {
      version: "deudaflow-v3",
      timestamp: new Date().toISOString(),
      deudas,
      pagos,
      clientLimits
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deudaflow-respaldo-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        
        if (!parsed.deudas || !Array.isArray(parsed.deudas)) {
          alert("El archivo de respaldo no es válido. Debe contener un listado de deudas.");
          return;
        }

        if (window.confirm("¿Estás seguro de que deseas importar este respaldo? Esto reemplazará temporalmente los datos locales actuales de este navegador.")) {
          onImportBackup(
            parsed.deudas,
            parsed.pagos || [],
            parsed.clientLimits || {}
          );
        }
      } catch (err) {
        alert("Error al parsear el archivo JSON de respaldo.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // The script ships with a placeholder; the user's key is embedded on copy.
  const appsScriptCode = appsScriptSource.replace('__DEUDAFLOW_TOKEN__', tokenInput.trim() || '__DEUDAFLOW_TOKEN__');

  const handleCopyToken = () => {
    navigator.clipboard.writeText(tokenInput.trim());
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPartnerLink = () => {
    if (!sheetUrl || !sheetToken) return;
    const currentBase = window.location.origin + window.location.pathname;
    const encodedUrl = encodeURIComponent(sheetUrl);
    const encodedToken = encodeURIComponent(sheetToken);
    // Suggest the opposite user
    const targetUser = activeUser === 'Nina' ? 'Nando' : 'Nina';
    const link = `${currentBase}?scriptUrl=${encodedUrl}&token=${encodedToken}&user=${targetUser}`;
    
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const toggleFaq = (key: string) => {
    setShowFaq(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConnection(urlInput.trim(), tokenInput.trim());
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* Col 1: Connection form */}
      <div className="xl:col-span-1 space-y-6">
        
        {/* Toggle Mode */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-[#040d53] text-[15px] flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#70C145] mr-2"></span>
            Modo de datos actual
          </h4>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToggleLocal(true)}
              className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition active:scale-95 cursor-pointer ${
                isLocalMode 
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-extrabold'
                  : 'border-[#e2e8f0] text-slate-500 hover:bg-slate-50'
              }`}
            >
              Prueba Local
            </button>
            <button
              onClick={() => onToggleLocal(false)}
              className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition active:scale-95 cursor-pointer ${
                !isLocalMode 
                  ? 'border-[#040d53] bg-[#040d53] text-white font-extrabold'
                  : 'border-[#e2e8f0] text-slate-500 hover:bg-slate-50'
              }`}
            >
              Google Sheets
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {isLocalMode 
              ? 'El "Modo Local" almacena los datos en la memoria de este navegador. Ideal para pruebas rápidas sin configurar nada.'
              : 'El "Modo Google Sheets" almacena toda transacción en tu hoja de Drive segura de forma automática para respaldo permanente.'
            }
          </p>
        </div>

        {/* Configuration input */}
        {!isLocalMode && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-[#040d53] text-[15px]">Fijar Endpoint en la Nube</h4>
            
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  URL de Aplicación Web (Apps Script)
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setTestResult({ status: 'idle' });
                  }}
                  className="w-full px-3.5 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] transition font-mono"
                  required
                />
              </div>

              <div>
                <label htmlFor="df-token" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Clave de acceso (va dentro del Apps Script)
                </label>
                <div className="flex gap-2">
                  <input
                    id="df-token"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={tokenInput}
                    onChange={(e) => {
                      setTokenInput(e.target.value);
                      saveDraftToken(e.target.value.trim());
                      setTestResult({ status: 'idle' });
                    }}
                    className="min-w-0 flex-1 px-3.5 py-2.5 border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] transition font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="shrink-0 px-3 rounded-xl border border-[#e2e8f0] text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    title="Copiar clave"
                    aria-label="Copiar clave"
                  >
                    {copiedToken ? <Check className="h-4 w-4 text-[#2a6c00]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {sheetToken
                    ? 'Si cambias la clave, copia el código de nuevo y vuelve a implementar el script.'
                    : 'Clave generada para ti. El código del paso 3 ya la incluye: cópialo, pégalo y vuelve a implementar.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  className="w-full bg-[#040d53] hover:opacity-90 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                >
                  Guardar conexión
                </button>

                <button
                  type="button"
                  onClick={() => runDiagnosticTest(urlInput)}
                  className="w-full bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 font-bold text-xs py-2 px-4 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Diagnosticar Conexión</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('');
                    onClearSettings();
                    setTestResult({ status: 'idle' });
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition active:scale-95 cursor-pointer"
                >
                  Desconectar / Resetear URL
                </button>
              </div>
            </form>

            {/* Diagnostic Result Banner */}
            {testResult.status !== 'idle' && (
              <div className="p-4 rounded-2xl text-xs space-y-2 border animate-fade-in transition-all">
                {testResult.status === 'testing' && (
                  <div className="text-blue-800 font-bold flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                    <span>{testResult.message}</span>
                  </div>
                )}

                {testResult.status === 'success' && (
                  <div className="bg-emerald-50 text-emerald-900 border-emerald-200 p-3 rounded-xl space-y-1">
                    <div className="font-extrabold flex items-center space-x-1.5 text-emerald-800">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{testResult.message}</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">Tus datos se sincronizarán en tiempo real con Google Sheets.</p>
                  </div>
                )}

                {testResult.status === 'error-cors' && (
                  <div className="bg-rose-50 border-rose-200 text-rose-950 p-3.5 rounded-xl space-y-2.5">
                    <div className="font-extrabold text-rose-900 text-xs flex items-center space-x-1.5">
                      <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>Solución a "Failed to Fetch" (Error CORS / Sin Permisos)</span>
                    </div>
                    
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Google bloqueó la conexión automática por una de estas 2 razones:
                    </p>

                    <ol className="list-decimal pl-4 space-y-2 text-[11px] font-medium text-slate-800">
                      <li>
                        <strong>Acceso "Cualquiera":</strong> En Apps Script, ve a <strong>Implementar &gt; Administrar implementaciones</strong> y confirma que <strong>"Quién tiene acceso"</strong> esté fijado en <strong>"Cualquiera"</strong> (Anyone).
                      </li>
                      <li>
                        <strong>Autorización de Cuenta:</strong> Abre el enlace directamente en tu navegador para autorizar a Google:
                      </li>
                    </ol>

                    {urlInput && (
                      <a
                        href={urlInput}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center space-x-1.5 w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Abrir URL para Autorizar en Google</span>
                      </a>
                    )}
                  </div>
                )}

                {(testResult.status === 'error-url' || testResult.status === 'error-server') && (
                  <div className="bg-amber-50 border-amber-200 text-amber-900 p-3 rounded-xl space-y-1">
                    <div className="font-extrabold flex items-center space-x-1 text-amber-900">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Error de Configuración</span>
                    </div>
                    <p className="text-[11px] text-amber-800">{testResult.message}</p>
                  </div>
                )}
              </div>
            )}

            {sheetUrl && (
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Cargar en pareja (Nina / Nando)</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Genera una URL directa de autoconfiguración para tu pareja. Al abrirla, se configurará este mismo Google Sheet automáticamente con la otra cuenta activa seleccionada.
                </p>
                <button
                  onClick={handleCopyPartnerLink}
                  className="w-full bg-slate-50 hover:bg-slate-100 border border-[#e2e8f0] py-2.5 px-3 rounded-xl font-bold text-xs text-[#040d53] transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-4 w-4 text-[#2a6c00]" />
                      <span className="text-[#2a6c00]">¡Enlace copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar link de autoconfiguración</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Backup Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-[#040d53] text-[15px] flex items-center">
            <Download className="h-4 w-4 mr-2 text-[#70C145]" />
            Respaldos Offline (JSON)
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Descarga una copia completa de tus registros en tu computadora. Ideal para proteger tu capital si limpias el navegador o para migrar de dispositivo.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleExportBackup}
              className="w-full bg-[#040d53] hover:opacity-95 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar Copia (.json)</span>
            </button>
            <label className="w-full bg-slate-50 hover:bg-slate-100 border border-[#e2e8f0] font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer text-slate-700">
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>Importar Respaldo</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Diagnostic Section */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-3">
          <h4 className="font-bold text-[#ba1a1a] text-xs uppercase tracking-wider">Guía Diagnóstica de Errores</h4>
          
          <div className="space-y-3 text-xs leading-relaxed text-slate-600">
            <div className="border-l-2 border-[#ba1a1a] pl-2.5">
              <strong className="block text-slate-800 text-[11px]">Error: "Failed to Fetch" (Cors)</strong>
              <span>
                Suele suceder la primera vez si Google no te conoce. Abre la URL del script directamente en una pestaña de incógnito o nueva ventana y haz click en "Autorizar" si te lo solicita.
              </span>
            </div>
            
            <div className="border-l-2 border-slate-300 pl-2.5">
              <strong className="block text-slate-800 text-[11px]">Cuidado con la URL copiada</strong>
              <span>
                La URL correcta debe contener <code className="font-mono bg-slate-50 px-1 text-rose-600">/macros/s/.../exec</code>. Si contiene <code className="font-mono bg-slate-50 px-1 text-slate-500">/edit</code> u otras palabras, la consulta fallará.
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Col 2 & 3: Detailed setup flow */}
      <div className="xl:col-span-2 space-y-6">
        
        {/* Step-by-Step checklist */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-[#040d53] text-[18px]">Guía de Integración con Google Drive</h3>
            <p className="text-xs text-slate-500 mt-1">
              Sigue los sencillos pasos a continuación para conectar tu base de datos de manera gratuita y segura.
            </p>
          </div>

          <div className="space-y-4">
            
            {/* Step 1 */}
            <div className="flex items-start space-x-3.5">
              <span className="bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100">
                1
              </span>
              <div className="text-sm">
                <p className="font-extrabold text-slate-800">Crea tu Libro de Google Sheets</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Abre tu <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-[#040d53] underline inline-flex items-center">Google Sheets <ExternalLink className="h-3 w-3 ml-0.5" /></a> y crea un libro en blanco.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-3.5">
              <span className="bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100">
                2
              </span>
              <div className="text-sm">
                <p className="font-extrabold text-slate-800">Abre el Motor Apps Script</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  En el menú de arriba, entra en <strong>Extensiones</strong> y haz click en <strong>Apps Script</strong>.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-3.5">
              <span className="bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100">
                3
              </span>
              <div className="text-sm w-full space-y-2">
                <p className="font-extrabold text-slate-800 text-[#040d53]">Reemplaza el código por este bloque mejorado</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Limpia todo el código existente y pega este bloque (v6). Ya incluye tu clave de acceso, crea las hojas "Deudas", "Pagos" y "Limites" si no existen, y guarda una caché para que la app cargue mucho más rápido.
                </p>
                
                {/* Apps Script Code editor display box */}
                <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs font-mono max-h-60 overflow-y-auto">
                  <button
                    onClick={handleCopyCode}
                    className="absolute top-2 right-2 bg-slate-800 hover:bg-[#040d53] text-white border border-slate-700 text-[10px] font-bold px-2 py-1 rounded transition flex items-center space-x-1 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-[#70C145]" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copiar código</span>
                      </>
                    )}
                  </button>
                  <pre className="text-[10px] text-slate-300">
                    <code>{appsScriptCode}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start space-x-3.5">
              <span className="bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100">
                4
              </span>
              <div className="text-sm">
                <p className="font-extrabold text-slate-800 font-sans">Guarda, Publica y Copia la URL</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  Haz click en el icono de disquete para guardar.<br />
                  <strong>Si ya tenías el script publicado:</strong> ve a <strong>Implementar &gt; Administrar implementaciones</strong>, pulsa ✏️ <strong>Editar</strong>, elige <strong>Versión: Nueva versión</strong> e implementa. Así conservas la misma URL.<br />
                  <strong>Si es la primera vez:</strong> presiona <strong>Implementar &gt; Nueva implementación</strong>.<br />
                  - Tipo de implementación: Selecciona <strong>Aplicación Web</strong>.<br />
                  - Ejecutar como: <strong>Tú</strong> (tu correo).<br />
                  - Quién tiene acceso: Selecciona <strong>Cualquiera</strong>. Tus datos quedan protegidos por la clave de acceso: sin ella el script no responde.<br />
                  Haz click en Implementar, dale los permisos necesarios de tu cuenta (esta acción es completamente segura) y copia la URL final para guardarla en el formulario de la izquierda.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* FAQ Accordion info block */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-[#040d53] text-md">Preguntas Frecuentes (FAQ)</h4>
          
          <div className="space-y-2 text-xs">
            
            {/* FAQ 1 */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button 
                onClick={() => toggleFaq('faq1')}
                className="w-full bg-[#f3f3f6] hover:bg-slate-200/50 p-3 font-semibold text-slate-800 text-left flex items-center justify-between"
              >
                <span>¿Es seguro conectar mis finanzas usando este código en Apps Script?</span>
                {showFaq['faq1'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showFaq['faq1'] && (
                <div className="p-3 text-slate-500 leading-relaxed border-t border-slate-100 bg-white">
                  Sí. El código se ejecuta en tu propia cuenta de Google y los datos van directo de tu navegador a tu hoja, sin pasar por terceros. Aunque el acceso esté en "Cualquiera", el script solo responde a quien tenga tu clave de acceso: sin ella no se puede leer ni modificar nada. Comparte la clave (o el link de autoconfiguración) solo con quien deba usar la app, y si sospechas que se filtró, genera una nueva, copia el código y vuelve a implementar.
                </div>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button 
                onClick={() => toggleFaq('faq2')}
                className="w-full bg-[#f3f3f6] hover:bg-slate-200/50 p-3 font-semibold text-slate-800 text-left flex items-center justify-between"
              >
                <span>¿Puedo añadir columnas adicionales en mi hoja de Excel/Sheets?</span>
                {showFaq['faq2'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showFaq['faq2'] && (
                <div className="p-3 text-slate-500 leading-relaxed border-t border-slate-100 bg-white">
                  Sí, puedes añadir columnas a los lados. Las funciones del script identifican las columnas por su nombre específico en la primera fila. Mientras dejes intactos los encabezados obligatorios (<code className="font-mono text-rose-600">id</code>, <code className="font-mono">contacto</code>, <code className="font-mono">monto</code>, etc.) en la fila 1, la aplicación funcionará perfectamente.
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Client Credit Limits Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-[#040d53] text-[18px] flex items-center">
              <Sliders className="h-5 w-5 mr-2 text-[#70C145]" />
              Límites de Crédito por Cliente
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Asigna un límite máximo de deuda activa por cliente. Si intentas registrar un préstamo que supere este límite, la aplicación te mostrará alertas de advertencia.
            </p>
          </div>

          {/* Form to add a new/custom contact limit */}
          <form onSubmit={handleAddCustomLimit} className="bg-slate-50 border border-[#eeeef0] p-4 rounded-xl flex flex-col sm:flex-row items-end gap-3">
            <div className="w-full sm:flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">Nombre de Cliente</label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#040d53] bg-white font-medium"
                required
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">Límite ($)</label>
              <input
                type="number"
                placeholder="Ej. 500"
                value={newContactLimit}
                onChange={(e) => setNewContactLimit(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#040d53] bg-white font-mono font-bold"
                required
                min="1"
              />
            </div>
            <button
              type="submit"
              className="bg-[#040d53] hover:opacity-95 text-white font-bold text-xs py-2 px-4 rounded-lg h-9 transition active:scale-95 flex items-center justify-center space-x-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Fijar Límite</span>
            </button>
          </form>

          {/* List of Contacts & Limits */}
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
            {allContactsWithLimitData.length > 0 ? (
              allContactsWithLimitData.map(item => (
                <div key={item.name} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 py-3.5 last:border-0 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-800 text-sm">{item.name}</span>
                      {item.isExceeded && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          Excede Límite
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>Deuda activa: <strong className={item.activeBalance > 0 ? "text-[#040d53] font-bold" : "text-slate-400"}>${item.activeBalance.toFixed(0)}</strong></span>
                      <span>Límite actual: <strong className="text-slate-700 font-bold">{item.limit > 0 ? `$${item.limit}` : 'Sin límite'}</strong></span>
                    </div>

                    {/* Limit progress bar if limit is set */}
                    {item.limit > 0 && (
                      <div className="w-48 bg-slate-100 h-1 rounded-full overflow-hidden mt-1">
                        <div 
                          style={{ width: `${Math.min(100, item.percent)}%` }} 
                          className={`h-full transition-all duration-300 ${item.isExceeded ? 'bg-rose-650' : 'bg-[#70C145]'}`}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <div className="relative w-24">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 font-bold text-xs">$</span>
                      <input
                        type="number"
                        placeholder="Sin Límite"
                        value={tempLimits[item.name] !== undefined ? tempLimits[item.name] : (item.limit || '')}
                        onChange={(e) => handleTempLimitChange(item.name, e.target.value)}
                        className="w-full pl-5 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#040d53] font-mono"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveLimit(item.name)}
                      className="bg-slate-100 hover:bg-indigo-900 hover:text-white text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg h-[30px] transition"
                    >
                      Fijar
                    </button>
                    {item.limit > 0 && (
                      <button
                        onClick={() => onSetClientLimit(item.name, 0)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-50 transition"
                        title="Eliminar límite de crédito"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-450 text-xs">
                No hay clientes registrados en el sistema de préstamos todavía.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
