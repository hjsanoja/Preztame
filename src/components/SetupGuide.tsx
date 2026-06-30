import React, { useState, useMemo } from 'react';
import { 
  Copy, Check, ExternalLink, HelpCircle, FileText, ChevronDown, ChevronUp,
  AlertTriangle, Download, Upload, Sliders, ShieldAlert, User, Plus, Trash2 
} from 'lucide-react';
import { Debt, Payment } from '../types';
import { formatMonthName } from '../utils/storage';

interface SetupGuideProps {
  sheetUrl: string;
  onSaveUrl: (url: string) => void;
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
  onSaveUrl,
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
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showFaq, setShowFaq] = useState<{ [key: string]: boolean }>({});

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

  const appsScriptCode = `/* ====================================================================
* CÓDIGO DE GOOGLE APPS SCRIPT - DEUDAFLOW OPTIMIZADO (V3)
* ====================================================================
* 1. Crea una Google Sheet de Google Drive en blanco.
* 2. Ve a "Extensiones" > "Apps Script".
* 3. Borra todo lo que esté en el editor y pega este código completo.
* 4. Haz click en "Guardar" (icono de disquete).
* 5. Haz click en "Implementar" > "Nueva implementación".
*    - Tipo de implementación: Aplicación Web
*    - Ejecutar como: "Tú" (tu cuenta de Google)
*    - Quién tiene acceso: "Cualquiera" (Anyone) - REQUERIDO para la applet
* 6. Copia la URL de Aplicación Web final generada (debe terminar en /exec).
* 7. pégala en la configuración de DeudaFlow.
* ==================================================================== */

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  crearHojasSiNoExisten(sheet);
  
  var deudas = getSheetData(sheet.getSheetByName("Deudas"));
  var pagos = getSheetData(sheet.getSheetByName("Pagos"));
  
  var result = {
    deudas: deudas,
    pagos: pagos
  };
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  crearHojasSiNoExisten(sheet);
  
  var params = JSON.parse(e.postData.contents);
  var action = params.action;
  
  if (action === "addDebt") {
    var s = sheet.getSheetByName("Deudas");
    s.appendRow([
      params.id,
      params.cuenta,
      params.contacto,
      params.tipo,
      params.descripcion,
      params.fecha,
      parseFloat(params.monto),
      parseFloat(params.saldo),
      params.estado,
      params.creadoPor,
      params.mesPago,
      parseFloat(params.tasaCambio)
    ]);
  } else if (action === "addPayment") {
    var sPagos = sheet.getSheetByName("Pagos");
    sPagos.appendRow([
      params.id,
      params.fecha,
      params.deudaId,
      parseFloat(params.monto),
      params.nota,
      params.registradoPor
    ]);
    
    // Actualizar saldo de la deuda asociada
    var sDeudas = sheet.getSheetByName("Deudas");
    var data = sDeudas.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.deudaId) {
        var nuevoSaldo = parseFloat(data[i][7]) - parseFloat(params.monto);
        sDeudas.getRange(i + 1, 8).setValue(nuevoSaldo);
        if (nuevoSaldo <= 0) {
          sDeudas.getRange(i + 1, 9).setValue("saldado");
        }
        break;
      }
    }
  } else if (action === "deleteDebt") {
    var sDeudas = sheet.getSheetByName("Deudas");
    var data = sDeudas.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == params.id) {
        sDeudas.deleteRow(i + 1);
        break;
      }
    }
    // Borrar pagos asociados
    var sPagos = sheet.getSheetByName("Pagos");
    var pData = sPagos.getDataRange().getValues();
    for (var j = pData.length - 1; j >= 1; j--) {
      if (pData[j][2] == params.id) {
        sPagos.deleteRow(j + 1);
      }
    }
  } else if (action === "deletePayment") {
    var sPagos = sheet.getSheetByName("Pagos");
    var pData = sPagos.getDataRange().getValues();
    var deudaId = "";
    var montoDevolver = 0;
    
    for (var i = 1; i < pData.length; i++) {
      if (pData[i][0] == params.id) {
        deudaId = pData[i][2];
        montoDevolver = parseFloat(pData[i][3]);
        sPagos.deleteRow(i + 1);
        break;
      }
    }
    
    if (deudaId) {
      var sDeudas = sheet.getSheetByName("Deudas");
      var dData = sDeudas.getDataRange().getValues();
      for (var i = 1; i < dData.length; i++) {
        if (dData[i][0] == deudaId) {
          var nuevoSaldo = parseFloat(dData[i][7]) + montoDevolver;
          sDeudas.getRange(i + 1, 8).setValue(nuevoSaldo);
          if (nuevoSaldo > 0) {
            sDeudas.getRange(i + 1, 9).setValue("pendiente");
          }
          break;
        }
      }
    }
  }
  
  var deudasActualizadas = getSheetData(sheet.getSheetByName("Deudas"));
  var pagosActualizados = getSheetData(sheet.getSheetByName("Pagos"));
  
  var responsePayload = {
    status: "success",
    deudas: deudasActualizadas,
    pagos: pagosActualizados
  };
  
  return ContentService.createTextOutput(JSON.stringify(responsePayload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    list.push(obj);
  }
  return list;
}

function crearHojasSiNoExisten(sheet) {
  var deudas = sheet.getSheetByName("Deudas");
  if (!deudas) {
    deudas = sheet.insertSheet("Deudas");
    deudas.appendRow(["id", "cuenta", "contacto", "tipo", "descripcion", "fecha", "monto", "saldo", "estado", "creadoPor", "mesPago", "tasaCambio"]);
  } else {
    var range = deudas.getRange(1, 1, 1, deudas.getLastColumn());
    var headers = range.getValues()[0];
    var expectedHeaders = ["id", "cuenta", "contacto", "tipo", "descripcion", "fecha", "monto", "saldo", "estado", "creadoPor", "mesPago", "tasaCambio"];
    
    for (var i = 0; i < expectedHeaders.length; i++) {
      if (headers.indexOf(expectedHeaders[i]) === -1) {
        var nextCol = deudas.getLastColumn() + 1;
        deudas.getRange(1, nextCol).setValue(expectedHeaders[i]);
        headers.push(expectedHeaders[i]);
      }
    }
  }
  
  var pagos = sheet.getSheetByName("Pagos");
  if (!pagos) {
    pagos = sheet.insertSheet("Pagos");
    pagos.appendRow(["id", "fecha", "deudaId", "monto", "nota", "registradoPor"]);
  } else {
    var rangeP = pagos.getRange(1, 1, 1, pagos.getLastColumn());
    var headersP = rangeP.getValues()[0];
    var expectedHeadersP = ["id", "fecha", "deudaId", "monto", "nota", "registradoPor"];
    
    for (var j = 0; j < expectedHeadersP.length; j++) {
      if (headersP.indexOf(expectedHeadersP[j]) === -1) {
        var nextColP = pagos.getLastColumn() + 1;
        pagos.getRange(1, nextColP).setValue(expectedHeadersP[j]);
        headersP.push(expectedHeadersP[j]);
      }
    }
  }
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPartnerLink = () => {
    if (!sheetUrl) return;
    const currentBase = window.location.origin + window.location.pathname;
    const encodedUrl = encodeURIComponent(sheetUrl);
    // Suggest the opposite user
    const targetUser = activeUser === 'Nina' ? 'Nando' : 'Nina';
    const link = `${currentBase}?scriptUrl=${encodedUrl}&user=${targetUser}`;
    
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const toggleFaq = (key: string) => {
    setShowFaq(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveUrl(urlInput.trim());
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
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] transition font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  className="w-full bg-[#040d53] hover:opacity-90 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 cursor-pointer"
                >
                  Guardar y Probar Conexión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUrlInput('');
                    onClearSettings();
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 cursor-pointer"
                >
                  Desconectar / Resetear URL
                </button>
              </div>
            </form>

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
                  Limpia todo el código existente y pega este bloque inteligente. Se encargará de crear las hojas "Deudas" y "Pagos" automáticamente en tu libro al guardar el primer registro.
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
                  Haz click en el icono de disquete para guardar. Luego presiona <strong>Implementar &gt; Nueva implementación</strong>.<br />
                  - Tipo de implementación: Selecciona <strong>Aplicación Web</strong>.<br />
                  - Ejecutar como: <strong>Tú</strong> (tu correo).<br />
                  - Quién tiene acceso: Selecciona <strong>Cualquiera</strong> para que Nina o Nando sincronicen a la vez.<br />
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
                  ¡Completamente seguro! El código se ejecuta directamente en los servidores de tu Google Drive. Los datos nunca pasan por terceros: van directamente de tu navegador a tus servidores de Google de forma transparente. El código fuente es transparente e inspeccionable.
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
