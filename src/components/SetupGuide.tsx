import React, { useState } from 'react';
import { Copy, Check, ExternalLink, HelpCircle, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface SetupGuideProps {
  sheetUrl: string;
  onSaveUrl: (url: string) => void;
  onClearSettings: () => void;
  isLocalMode: boolean;
  onToggleLocal: (local: boolean) => void;
  activeUser: string;
}

export default function SetupGuide({
  sheetUrl,
  onSaveUrl,
  onClearSettings,
  isLocalMode,
  onToggleLocal,
  activeUser
}: SetupGuideProps) {

  const [urlInput, setUrlInput] = useState(sheetUrl);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showFaq, setShowFaq] = useState<{ [key: string]: boolean }>({});

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

      </div>

    </div>
  );
}
