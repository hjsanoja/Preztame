import{d as o,j as e}from"./react-DE51rvYg.js";import{h as l,m as pe,g as M,P as ue,T as xe,j as he,e as me,i as fe}from"./index-0rNR73kZ.js";import{S as ge}from"./shield-alert-x_EMbJqn.js";import"./motion-Bax7EJ2A.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ve=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],N=l("check",ve);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],F=l("chevron-down",be);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const je=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],U=l("chevron-up",je);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ne=[["rect",{width:"14",height:"14",x:"8",y:"8",rx:"2",ry:"2",key:"17jyea"}],["path",{d:"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",key:"zix9uf"}]],_=l("copy",Ne);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ye=[["path",{d:"M12 15V3",key:"m9g1x1"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["path",{d:"m7 10 5 5 5-5",key:"brsn70"}]],z=l("download",ye);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const we=[["path",{d:"M15 3h6v6",key:"1q9fwt"}],["path",{d:"M10 14 21 3",key:"gplh6r"}],["path",{d:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",key:"a6xqqp"}]],G=l("external-link",we);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _e=[["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M12 21v-9",key:"17s77i"}],["path",{d:"M12 8V3",key:"13r4qs"}],["path",{d:"M17 16h4",key:"h1uq16"}],["path",{d:"M19 12V3",key:"o1uvq1"}],["path",{d:"M19 21v-5",key:"qua636"}],["path",{d:"M3 14h4",key:"bcjad9"}],["path",{d:"M5 10V3",key:"cb8scm"}],["path",{d:"M5 21v-7",key:"1w1uti"}]],V=l("sliders-vertical",_e);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ce=[["path",{d:"M12 3v12",key:"1x0j5s"}],["path",{d:"m17 8-5-5-5 5",key:"7q97r8"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}]],Se=l("upload",Ce),ke=`/* ====================================================================
 * DEUDAFLOW · GOOGLE APPS SCRIPT v6 (seguro + rápido)
 * ====================================================================
 * 1. Abre tu Google Sheet > Extensiones > Apps Script.
 * 2. Borra todo el código del editor y pega este archivo completo.
 * 3. Guarda (icono de disquete).
 * 4. Implementar > Administrar implementaciones > ✏️ Editar >
 *    Versión: "Nueva versión" > Implementar.
 *    (Si es tu primera vez: Implementar > Nueva implementación >
 *     Aplicación web · Ejecutar como: Tú · Acceso: Cualquiera).
 *    Editar la implementación existente conserva la misma URL /exec.
 * 5. Acepta los permisos (ahora pide acceso a servicios externos para
 *    consultar la tasa BCV).
 *
 * La clave de abajo la genera DeudaFlow. Sin ella nadie puede leer ni
 * modificar tus datos aunque conozca la URL.
 * ==================================================================== */

var API_TOKEN = "__DEUDAFLOW_TOKEN__";

var SCHEMA = {
  Deudas: ["id", "cuenta", "contacto", "tipo", "descripcion", "fecha", "monto", "saldo", "estado", "creadoPor", "mesPago", "tasaCambio"],
  Pagos: ["id", "fecha", "deudaId", "monto", "nota", "registradoPor"],
  Limites: ["contacto", "limite"]
};

var SCHEMA_FLAG = "df_schema_v6";
var VERSION_KEY = "df_version";
var CACHE_TTL_SECONDS = 1800;
var CACHE_CHUNK_CHARS = 40000;

// ============================ ENTRADAS HTTP ============================

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!isAuthorized_(p.token)) return json_({ ok: false, error: "unauthorized" });

  if (p.action === "bcv") return json_(getBcvRate_());

  var version = getVersion_();
  if (p.v && p.v === version && p.fresh !== "1") {
    return json_({ ok: true, notModified: true, version: version });
  }
  return jsonText_(getPayloadText_(version, p.fresh === "1"));
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "bad-request" });
  }
  if (!isAuthorized_(body.token)) return json_({ ok: false, error: "unauthorized" });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: "busy" });

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSchema_(ss, false);

    var ops = body.action === "batch" ? (body.ops || []) : [body];
    var versionBefore = getVersion_();
    var changed = false;
    var results = [];

    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      try {
        if (applyOp_(ss, op)) changed = true;
        results.push({ opId: op.opId || null, ok: true });
      } catch (err) {
        results.push({ opId: op.opId || null, ok: false, error: String(err && err.message || err) });
      }
    }

    if (changed) SpreadsheetApp.flush();
    var version = changed ? bumpVersion_() : versionBefore;
    return json_({ ok: true, results: results, versionBefore: versionBefore, version: version });
  } finally {
    lock.releaseLock();
  }
}

// Ediciones manuales en la hoja invalidan la caché de lectura.
function onEdit() {
  try { bumpVersion_(); } catch (err) {}
}

// ============================ OPERACIONES ============================

// Devuelve true si la hoja cambió. Todas las operaciones son idempotentes:
// reintentar la misma operación no duplica registros ni descuenta dos veces.
function applyOp_(ss, op) {
  switch (op.action) {
    case "addDebt": return addDebt_(ss, op.debt || op);
    case "addPayment": return addPayment_(ss, op.payment || op);
    case "deleteDebt": return deleteDebt_(ss, op.id);
    case "deletePayment": return deletePayment_(ss, op.id);
    case "setClientLimit": return setClientLimit_(ss, op.contacto, op.limite);
    default: throw new Error("Acción desconocida: " + op.action);
  }
}

function addDebt_(ss, d) {
  if (!d || !d.id) throw new Error("Préstamo sin id");
  var sheet = getSheet_(ss, "Deudas");
  if (findRow_(sheet, "id", d.id) > 0) return false;
  appendObject_(sheet, {
    id: d.id,
    cuenta: d.cuenta,
    contacto: d.contacto,
    tipo: d.tipo,
    descripcion: d.descripcion,
    fecha: d.fecha,
    monto: round2_(d.monto),
    saldo: round2_(d.saldo),
    estado: d.estado,
    creadoPor: d.creadoPor,
    // Prefijo ' para que Sheets no convierta "2026-06" en fecha.
    mesPago: d.mesPago ? "'" + d.mesPago : "",
    tasaCambio: parseFloat(d.tasaCambio) || 1
  });
  return true;
}

function addPayment_(ss, p) {
  if (!p || !p.id) throw new Error("Abono sin id");
  var sPagos = getSheet_(ss, "Pagos");
  if (findRow_(sPagos, "id", p.id) > 0) return false;

  var sDeudas = getSheet_(ss, "Deudas");
  var debtRow = findRow_(sDeudas, "id", p.deudaId);
  if (debtRow < 0) throw new Error("El préstamo " + p.deudaId + " no existe");

  appendObject_(sPagos, {
    id: p.id,
    fecha: p.fecha,
    deudaId: p.deudaId,
    monto: round2_(p.monto),
    nota: p.nota,
    registradoPor: p.registradoPor
  });

  var saldo = Math.max(0, round2_(getCell_(sDeudas, debtRow, "saldo") - round2_(p.monto)));
  setCells_(sDeudas, debtRow, { saldo: saldo, estado: saldo <= 0 ? "saldado" : "pendiente" });
  return true;
}

function deleteDebt_(ss, id) {
  var changed = false;
  var sDeudas = getSheet_(ss, "Deudas");
  var row = findRow_(sDeudas, "id", id);
  if (row > 0) {
    sDeudas.deleteRow(row);
    changed = true;
  }
  var sPagos = getSheet_(ss, "Pagos");
  var rows = findRows_(sPagos, "deudaId", id);
  for (var i = rows.length - 1; i >= 0; i--) {
    sPagos.deleteRow(rows[i]);
    changed = true;
  }
  return changed;
}

function deletePayment_(ss, id) {
  var sPagos = getSheet_(ss, "Pagos");
  var row = findRow_(sPagos, "id", id);
  if (row < 0) return false;

  var deudaId = String(getCell_(sPagos, row, "deudaId"));
  var monto = round2_(getCell_(sPagos, row, "monto"));
  sPagos.deleteRow(row);

  var sDeudas = getSheet_(ss, "Deudas");
  var debtRow = findRow_(sDeudas, "id", deudaId);
  if (debtRow > 0) {
    var montoOriginal = round2_(getCell_(sDeudas, debtRow, "monto"));
    var saldo = Math.min(montoOriginal, round2_(getCell_(sDeudas, debtRow, "saldo") + monto));
    setCells_(sDeudas, debtRow, { saldo: saldo, estado: saldo > 0 ? "pendiente" : "saldado" });
  }
  return true;
}

function setClientLimit_(ss, contacto, limite) {
  var sheet = getSheet_(ss, "Limites");
  var name = String(contacto || "").trim();
  if (!name) throw new Error("Contacto vacío");
  var value = round2_(limite);

  var cols = headerMap_(sheet);
  var last = sheet.getLastRow();
  var names = last > 1 ? sheet.getRange(2, cols.contacto + 1, last - 1, 1).getValues() : [];
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim().toLowerCase() === name.toLowerCase()) {
      if (value <= 0) {
        sheet.deleteRow(i + 2);
      } else {
        sheet.getRange(i + 2, cols.limite + 1).setValue(value);
      }
      return true;
    }
  }
  if (value <= 0) return false;
  appendObject_(sheet, { contacto: name, limite: value });
  return true;
}

// ============================ LECTURA + CACHÉ ============================

function getPayloadText_(version, skipCache) {
  var cache = CacheService.getScriptCache();
  var key = "df_payload_" + version;
  if (!skipCache) {
    var cached = cacheGet_(cache, key);
    if (cached) return cached;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSchema_(ss, false);
  var tz = ss.getSpreadsheetTimeZone();

  var clientLimits = {};
  readObjects_(getSheet_(ss, "Limites"), tz).forEach(function (row) {
    var name = String(row.contacto || "").trim();
    if (name) clientLimits[name] = parseFloat(row.limite) || 0;
  });

  var text = JSON.stringify({
    ok: true,
    version: version,
    deudas: readObjects_(getSheet_(ss, "Deudas"), tz),
    pagos: readObjects_(getSheet_(ss, "Pagos"), tz),
    clientLimits: clientLimits
  });
  cachePut_(cache, key, text);
  return text;
}

function readObjects_(sheet, tz) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.join("") === "") continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      if (!h) continue;
      var v = row[j];
      if (v instanceof Date) {
        v = Utilities.formatDate(v, tz, h === "mesPago" ? "yyyy-MM" : "yyyy-MM-dd");
      }
      obj[h] = v;
    }
    list.push(obj);
  }
  return list;
}

// CacheService limita cada valor a 100 KB, así que se guarda en trozos.
function cachePut_(cache, key, text) {
  try {
    var n = Math.ceil(text.length / CACHE_CHUNK_CHARS);
    var map = {};
    map[key + "_n"] = String(n);
    for (var i = 0; i < n; i++) {
      map[key + "_" + i] = text.substr(i * CACHE_CHUNK_CHARS, CACHE_CHUNK_CHARS);
    }
    cache.putAll(map, CACHE_TTL_SECONDS);
  } catch (err) {
    // Si los datos no caben en caché simplemente se leen de la hoja.
  }
}

function cacheGet_(cache, key) {
  var n = parseInt(cache.get(key + "_n"), 10);
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(key + "_" + i);
  var parts = cache.getAll(keys);
  var text = "";
  for (var k = 0; k < keys.length; k++) {
    if (parts[keys[k]] == null) return null;
    text += parts[keys[k]];
  }
  return text;
}

function getVersion_() {
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty(VERSION_KEY);
  if (!v) {
    v = String(Date.now());
    props.setProperty(VERSION_KEY, v);
  }
  return v;
}

function bumpVersion_() {
  var props = PropertiesService.getScriptProperties();
  var prev = parseInt(props.getProperty(VERSION_KEY), 10) || 0;
  var v = String(Math.max(Date.now(), prev + 1));
  props.setProperty(VERSION_KEY, v);
  return v;
}

// ============================ TASA BCV ============================

function getBcvRate_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("df_bcv_rate");
  if (cached) return { ok: true, rate: parseFloat(cached), cached: true };

  var sources = [
    function () {
      var d = fetchJson_("https://ve.dolarapi.com/v1/dolares/oficial");
      return d && (d.promedio || d.venta || d.compra);
    },
    function () {
      var d = fetchJson_("https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv");
      var bcv = d && ((d.monitors && d.monitors.bcv) || d.bcv);
      return (bcv && bcv.price) || (d && d.price);
    }
  ];

  for (var i = 0; i < sources.length; i++) {
    try {
      var rate = parseFloat(sources[i]());
      if (rate > 0) {
        cache.put("df_bcv_rate", String(rate), 3600);
        return { ok: true, rate: rate };
      }
    } catch (err) {}
  }
  return { ok: false, error: "bcv-unavailable" };
}

function fetchJson_(url) {
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Accept: "application/json" } });
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText());
}

// ============================ UTILIDADES ============================

function isAuthorized_(token) {
  if (!API_TOKEN || API_TOKEN.indexOf("__DEUDAFLOW") === 0) return false;
  return typeof token === "string" && token === API_TOKEN;
}

function json_(obj) {
  return jsonText_(JSON.stringify(obj));
}

function jsonText_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function round2_(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function getSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    ensureSchema_(ss, true);
    sheet = ss.getSheetByName(name);
  }
  return sheet;
}

var headerCache_ = {};

function headerMap_(sheet) {
  var name = sheet.getName();
  if (headerCache_[name]) return headerCache_[name];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] !== "" && map[headers[i]] === undefined) map[headers[i]] = i;
  }
  headerCache_[name] = map;
  return map;
}

function findRow_(sheet, header, value) {
  var rows = findRows_(sheet, header, value, true);
  return rows.length ? rows[0] : -1;
}

function findRows_(sheet, header, value, firstOnly) {
  var last = sheet.getLastRow();
  if (last < 2 || value === undefined || value === null || value === "") return [];
  var col = headerMap_(sheet)[header] + 1;
  var finder = sheet.getRange(2, col, last - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .matchCase(true);
  if (firstOnly) {
    var cell = finder.findNext();
    return cell ? [cell.getRow()] : [];
  }
  return finder.findAll().map(function (c) { return c.getRow(); }).sort(function (a, b) { return a - b; });
}

function getCell_(sheet, row, header) {
  return sheet.getRange(row, headerMap_(sheet)[header] + 1).getValue();
}

function setCells_(sheet, row, values) {
  var cols = headerMap_(sheet);
  Object.keys(values).forEach(function (h) {
    sheet.getRange(row, cols[h] + 1).setValue(values[h]);
  });
}

function appendObject_(sheet, obj) {
  var cols = headerMap_(sheet);
  var width = sheet.getLastColumn();
  var row = [];
  for (var i = 0; i < width; i++) row.push("");
  Object.keys(obj).forEach(function (h) {
    if (cols[h] !== undefined) row[cols[h]] = obj[h] === undefined || obj[h] === null ? "" : obj[h];
  });
  sheet.appendRow(row);
}

// Crea hojas/columnas faltantes. Solo corre una vez (o si falta una hoja).
function ensureSchema_(ss, force) {
  var props = PropertiesService.getScriptProperties();
  if (!force && props.getProperty(SCHEMA_FLAG) === "1") return;

  Object.keys(SCHEMA).forEach(function (name) {
    var expected = SCHEMA[name];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(expected);
      return;
    }
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    expected.forEach(function (h) {
      if (headers.indexOf(h) === -1) {
        var next = sheet.getLastColumn() + 1;
        sheet.getRange(1, next).setValue(h);
        headers.push(h);
      }
    });
  });
  headerCache_ = {};
  props.setProperty(SCHEMA_FLAG, "1");
}
`;function Pe({sheetUrl:h,sheetToken:m,onSaveConnection:H,onClearSettings:$,isLocalMode:f,onToggleLocal:C,activeUser:B,deudas:d,pagos:K,clientLimits:g,onSetClientLimit:v,onImportBackup:J}){const[p,S]=o.useState(h),[c,W]=o.useState(()=>m||pe()),[Y,k]=o.useState(!1),[Q,E]=o.useState(!1),[Z,A]=o.useState(!1),[b,X]=o.useState({}),[i,r]=o.useState({status:"idle"}),ee=async t=>{const a=t.trim();if(!a){r({status:"error-url",message:"Por favor ingresa una URL."});return}if(a.includes("/edit")){r({status:"error-url",message:'La URL contiene "/edit". Copiaste el enlace de edición de tu hoja. Debes usar la URL de la Aplicación Web publicada que termina en /exec.'});return}if(!a.includes("/exec")){r({status:"error-url",message:'La URL no contiene "/exec". Asegúrate de crear una "Nueva implementación" tipo Aplicación Web en Apps Script.'});return}if(!c.trim()){r({status:"error-url",message:"Falta la clave de acceso."});return}r({status:"testing",message:"Enviando petición de prueba a Google Apps Script..."});try{const n=performance.now(),s=await he({url:a,token:c.trim()},null,{fresh:!0}),u=Math.round(performance.now()-n);if(s.kind==="data"&&!s.version){r({status:"error-server",message:"La hoja respondió, pero con el código antiguo (v5) que no verifica la clave. Copia el código v6 de abajo y vuelve a implementar."});return}const j=s.kind==="data"?`${s.data.deudas.length} préstamos y ${s.data.pagos.length} abonos`:"datos";r({status:"success",message:`¡Conexión exitosa! Se leyeron ${j} en ${u} ms.`})}catch(n){if(console.warn("Diagnostic test failed:",n),n instanceof me&&n.code!=="network"&&n.code!=="timeout"){r({status:"error-server",message:fe(n.code)});return}r({status:"error-cors",message:'Error de conexión / CORS ("Failed to fetch"). Google Apps Script requiere configuración de acceso o autorización previa.'})}},[y,te]=o.useState({}),[w,R]=o.useState(""),[L,P]=o.useState(""),D=o.useMemo(()=>{const t={};return d.forEach(a=>{if(a.contacto){const n=a.contacto.trim();a.estado==="pendiente"?t[n]=(t[n]||0)+a.saldo:t[n]===void 0&&(t[n]=0)}}),t},[d]),O=o.useMemo(()=>{const t=new Set;return d.forEach(a=>{a.contacto&&t.add(a.contacto.trim())}),Object.keys(g).forEach(a=>t.add(a.trim())),Array.from(t).map(a=>{const n=D[a]||0,s=g[a]||0;return{name:a,activeBalance:n,limit:s,isExceeded:s>0&&n>s,percent:s>0?n/s*100:0}}).sort((a,n)=>n.activeBalance-a.activeBalance||a.name.localeCompare(n.name))},[d,g,D]),ae=(t,a)=>{te(n=>({...n,[t]:a}))},ne=t=>{const a=y[t];if(a===void 0)return;const n=parseFloat(a);isNaN(n)||n<0?v(t,0):v(t,n)},se=t=>{if(t.preventDefault(),!w.trim())return;const a=parseFloat(L)||0;v(w.trim(),a),R(""),P("")},re=()=>{const t={version:"deudaflow-v3",timestamp:new Date().toISOString(),deudas:d,pagos:K,clientLimits:g},a=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),n=URL.createObjectURL(a),s=document.createElement("a");s.href=n,s.download=`deudaflow-respaldo-${new Date().toISOString().split("T")[0]}.json`,document.body.appendChild(s),s.click(),document.body.removeChild(s),URL.revokeObjectURL(n)},oe=t=>{var s;const a=(s=t.target.files)==null?void 0:s[0];if(!a)return;const n=new FileReader;n.onload=u=>{var j;try{const I=(j=u.target)==null?void 0:j.result,x=JSON.parse(I);if(!x.deudas||!Array.isArray(x.deudas)){alert("El archivo de respaldo no es válido. Debe contener un listado de deudas.");return}window.confirm("¿Estás seguro de que deseas importar este respaldo? Esto reemplazará temporalmente los datos locales actuales de este navegador.")&&J(x.deudas,x.pagos||[],x.clientLimits||{})}catch{alert("Error al parsear el archivo JSON de respaldo.")}},n.readAsText(a),t.target.value=""},T=ke.replace("__DEUDAFLOW_TOKEN__",c.trim()||"__DEUDAFLOW_TOKEN__"),ie=()=>{navigator.clipboard.writeText(c.trim()),k(!0),setTimeout(()=>k(!1),2e3)},le=()=>{navigator.clipboard.writeText(T),E(!0),setTimeout(()=>E(!1),2e3)},ce=()=>{if(!h||!m)return;const t=window.location.origin+window.location.pathname,a=encodeURIComponent(h),n=encodeURIComponent(m),u=`${t}?scriptUrl=${a}&token=${n}&user=${B==="Nina"?"Nando":"Nina"}`;navigator.clipboard.writeText(u),A(!0),setTimeout(()=>A(!1),2500)},q=t=>{X(a=>({...a,[t]:!a[t]}))},de=t=>{t.preventDefault(),H(p.trim(),c.trim())};return e.jsxs("div",{className:"grid grid-cols-1 xl:grid-cols-3 gap-6",children:[e.jsxs("div",{className:"xl:col-span-1 space-y-6",children:[e.jsxs("div",{className:"bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4",children:[e.jsxs("h4",{className:"font-bold text-[#040d53] text-[15px] flex items-center",children:[e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-[#70C145] mr-2"}),"Modo de datos actual"]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx("button",{onClick:()=>C(!0),className:`py-2.5 px-3 text-xs font-bold rounded-xl border transition active:scale-95 cursor-pointer ${f?"border-emerald-500 bg-emerald-50 text-emerald-800 font-extrabold":"border-[#e2e8f0] text-slate-500 hover:bg-slate-50"}`,children:"Prueba Local"}),e.jsx("button",{onClick:()=>C(!1),className:`py-2.5 px-3 text-xs font-bold rounded-xl border transition active:scale-95 cursor-pointer ${f?"border-[#e2e8f0] text-slate-500 hover:bg-slate-50":"border-[#040d53] bg-[#040d53] text-white font-extrabold"}`,children:"Google Sheets"})]}),e.jsx("p",{className:"text-[11px] text-slate-400 leading-relaxed",children:f?'El "Modo Local" almacena los datos en la memoria de este navegador. Ideal para pruebas rápidas sin configurar nada.':'El "Modo Google Sheets" almacena toda transacción en tu hoja de Drive segura de forma automática para respaldo permanente.'})]}),!f&&e.jsxs("div",{className:"bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4",children:[e.jsx("h4",{className:"font-bold text-[#040d53] text-[15px]",children:"Fijar Endpoint en la Nube"}),e.jsxs("form",{onSubmit:de,className:"space-y-3",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1",children:"URL de Aplicación Web (Apps Script)"}),e.jsx("input",{type:"url",placeholder:"https://script.google.com/macros/s/.../exec",value:p,onChange:t=>{S(t.target.value),r({status:"idle"})},className:"w-full px-3.5 py-2.5 border border-[#e2e8f0] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] transition font-mono",required:!0})]}),e.jsxs("div",{children:[e.jsx("label",{htmlFor:"df-token",className:"block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1",children:"Clave de acceso (va dentro del Apps Script)"}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{id:"df-token",type:"text",autoComplete:"off",spellCheck:!1,value:c,onChange:t=>{W(t.target.value),r({status:"idle"})},className:"min-w-0 flex-1 px-3.5 py-2.5 border border-[#e2e8f0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#040d53]/10 focus:border-[#040d53] transition font-mono",required:!0}),e.jsx("button",{type:"button",onClick:ie,className:"shrink-0 px-3 rounded-xl border border-[#e2e8f0] text-slate-600 hover:bg-slate-50 transition cursor-pointer",title:"Copiar clave","aria-label":"Copiar clave",children:Y?e.jsx(N,{className:"h-4 w-4 text-[#2a6c00]"}):e.jsx(_,{className:"h-4 w-4"})})]}),e.jsx("p",{className:"text-[10px] text-slate-400 mt-1 leading-relaxed",children:m?"Si cambias la clave, copia el código de nuevo y vuelve a implementar el script.":"Clave generada para ti. El código del paso 3 ya la incluye: cópialo, pégalo y vuelve a implementar."})]}),e.jsxs("div",{className:"flex flex-col gap-2 pt-1",children:[e.jsx("button",{type:"submit",className:"w-full bg-[#040d53] hover:opacity-90 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 cursor-pointer shadow-xs",children:"Guardar conexión"}),e.jsxs("button",{type:"button",onClick:()=>ee(p),className:"w-full bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 font-bold text-xs py-2 px-4 rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5",children:[e.jsx(V,{className:"h-3.5 w-3.5"}),e.jsx("span",{children:"Diagnosticar Conexión"})]}),e.jsx("button",{type:"button",onClick:()=>{S(""),$(),r({status:"idle"})},className:"w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 px-4 rounded-xl transition active:scale-95 cursor-pointer",children:"Desconectar / Resetear URL"})]})]}),i.status!=="idle"&&e.jsxs("div",{className:"p-4 rounded-2xl text-xs space-y-2 border animate-fade-in transition-all",children:[i.status==="testing"&&e.jsxs("div",{className:"text-blue-800 font-bold flex items-center space-x-2",children:[e.jsx("span",{className:"w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"}),e.jsx("span",{children:i.message})]}),i.status==="success"&&e.jsxs("div",{className:"bg-emerald-50 text-emerald-900 border-emerald-200 p-3 rounded-xl space-y-1",children:[e.jsxs("div",{className:"font-extrabold flex items-center space-x-1.5 text-emerald-800",children:[e.jsx(N,{className:"h-4 w-4 text-emerald-600"}),e.jsx("span",{children:i.message})]}),e.jsx("p",{className:"text-[11px] text-emerald-700",children:"Tus datos se sincronizarán en tiempo real con Google Sheets."})]}),i.status==="error-cors"&&e.jsxs("div",{className:"bg-rose-50 border-rose-200 text-rose-950 p-3.5 rounded-xl space-y-2.5",children:[e.jsxs("div",{className:"font-extrabold text-rose-900 text-xs flex items-center space-x-1.5",children:[e.jsx(ge,{className:"h-4 w-4 text-rose-600 shrink-0"}),e.jsx("span",{children:'Solución a "Failed to Fetch" (Error CORS / Sin Permisos)'})]}),e.jsx("p",{className:"text-[11px] text-slate-700 leading-relaxed",children:"Google bloqueó la conexión automática por una de estas 2 razones:"}),e.jsxs("ol",{className:"list-decimal pl-4 space-y-2 text-[11px] font-medium text-slate-800",children:[e.jsxs("li",{children:[e.jsx("strong",{children:'Acceso "Cualquiera":'})," En Apps Script, ve a ",e.jsx("strong",{children:"Implementar > Administrar implementaciones"})," y confirma que ",e.jsx("strong",{children:'"Quién tiene acceso"'})," esté fijado en ",e.jsx("strong",{children:'"Cualquiera"'})," (Anyone)."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Autorización de Cuenta:"})," Abre el enlace directamente en tu navegador para autorizar a Google:"]})]}),p&&e.jsxs("a",{href:p,target:"_blank",rel:"noreferrer",className:"inline-flex items-center justify-center space-x-1.5 w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-xs transition cursor-pointer",children:[e.jsx(G,{className:"h-3.5 w-3.5"}),e.jsx("span",{children:"Abrir URL para Autorizar en Google"})]})]}),(i.status==="error-url"||i.status==="error-server")&&e.jsxs("div",{className:"bg-amber-50 border-amber-200 text-amber-900 p-3 rounded-xl space-y-1",children:[e.jsxs("div",{className:"font-extrabold flex items-center space-x-1 text-amber-900",children:[e.jsx(M,{className:"h-4 w-4 text-amber-600"}),e.jsx("span",{children:"Error de Configuración"})]}),e.jsx("p",{className:"text-[11px] text-amber-800",children:i.message})]})]}),h&&e.jsxs("div",{className:"border-t border-slate-100 pt-4 space-y-3",children:[e.jsx("h5",{className:"font-bold text-slate-700 text-xs uppercase tracking-wider",children:"Cargar en pareja (Nina / Nando)"}),e.jsx("p",{className:"text-[11px] text-slate-400 leading-relaxed",children:"Genera una URL directa de autoconfiguración para tu pareja. Al abrirla, se configurará este mismo Google Sheet automáticamente con la otra cuenta activa seleccionada."}),e.jsx("button",{onClick:ce,className:"w-full bg-slate-50 hover:bg-slate-100 border border-[#e2e8f0] py-2.5 px-3 rounded-xl font-bold text-xs text-[#040d53] transition flex items-center justify-center space-x-2 cursor-pointer",children:Z?e.jsxs(e.Fragment,{children:[e.jsx(N,{className:"h-4 w-4 text-[#2a6c00]"}),e.jsx("span",{className:"text-[#2a6c00]",children:"¡Enlace copiado!"})]}):e.jsxs(e.Fragment,{children:[e.jsx(_,{className:"h-4 w-4"}),e.jsx("span",{children:"Copiar link de autoconfiguración"})]})})]})]}),e.jsxs("div",{className:"bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4",children:[e.jsxs("h4",{className:"font-bold text-[#040d53] text-[15px] flex items-center",children:[e.jsx(z,{className:"h-4 w-4 mr-2 text-[#70C145]"}),"Respaldos Offline (JSON)"]}),e.jsx("p",{className:"text-[11px] text-slate-400 leading-relaxed",children:"Descarga una copia completa de tus registros en tu computadora. Ideal para proteger tu capital si limpias el navegador o para migrar de dispositivo."}),e.jsxs("div",{className:"flex flex-col gap-2 pt-1",children:[e.jsxs("button",{onClick:re,className:"w-full bg-[#040d53] hover:opacity-95 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer shadow-xs",children:[e.jsx(z,{className:"h-3.5 w-3.5"}),e.jsx("span",{children:"Exportar Copia (.json)"})]}),e.jsxs("label",{className:"w-full bg-slate-50 hover:bg-slate-100 border border-[#e2e8f0] font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer text-slate-700",children:[e.jsx(Se,{className:"h-3.5 w-3.5 text-slate-500"}),e.jsx("span",{children:"Importar Respaldo"}),e.jsx("input",{type:"file",accept:".json",onChange:oe,className:"hidden"})]})]})]}),e.jsxs("div",{className:"bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-3",children:[e.jsx("h4",{className:"font-bold text-[#ba1a1a] text-xs uppercase tracking-wider",children:"Guía Diagnóstica de Errores"}),e.jsxs("div",{className:"space-y-3 text-xs leading-relaxed text-slate-600",children:[e.jsxs("div",{className:"border-l-2 border-[#ba1a1a] pl-2.5",children:[e.jsx("strong",{className:"block text-slate-800 text-[11px]",children:'Error: "Failed to Fetch" (Cors)'}),e.jsx("span",{children:'Suele suceder la primera vez si Google no te conoce. Abre la URL del script directamente en una pestaña de incógnito o nueva ventana y haz click en "Autorizar" si te lo solicita.'})]}),e.jsxs("div",{className:"border-l-2 border-slate-300 pl-2.5",children:[e.jsx("strong",{className:"block text-slate-800 text-[11px]",children:"Cuidado con la URL copiada"}),e.jsxs("span",{children:["La URL correcta debe contener ",e.jsx("code",{className:"font-mono bg-slate-50 px-1 text-rose-600",children:"/macros/s/.../exec"}),". Si contiene ",e.jsx("code",{className:"font-mono bg-slate-50 px-1 text-slate-500",children:"/edit"})," u otras palabras, la consulta fallará."]})]})]})]})]}),e.jsxs("div",{className:"xl:col-span-2 space-y-6",children:[e.jsxs("div",{className:"bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-6",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"font-bold text-[#040d53] text-[18px]",children:"Guía de Integración con Google Drive"}),e.jsx("p",{className:"text-xs text-slate-500 mt-1",children:"Sigue los sencillos pasos a continuación para conectar tu base de datos de manera gratuita y segura."})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-start space-x-3.5",children:[e.jsx("span",{className:"bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100",children:"1"}),e.jsxs("div",{className:"text-sm",children:[e.jsx("p",{className:"font-extrabold text-slate-800",children:"Crea tu Libro de Google Sheets"}),e.jsxs("p",{className:"text-xs text-slate-500 mt-0.5",children:["Abre tu ",e.jsxs("a",{href:"https://sheets.google.com",target:"_blank",rel:"noreferrer",className:"text-[#040d53] underline inline-flex items-center",children:["Google Sheets ",e.jsx(G,{className:"h-3 w-3 ml-0.5"})]})," y crea un libro en blanco."]})]})]}),e.jsxs("div",{className:"flex items-start space-x-3.5",children:[e.jsx("span",{className:"bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100",children:"2"}),e.jsxs("div",{className:"text-sm",children:[e.jsx("p",{className:"font-extrabold text-slate-800",children:"Abre el Motor Apps Script"}),e.jsxs("p",{className:"text-xs text-slate-500 mt-0.5",children:["En el menú de arriba, entra en ",e.jsx("strong",{children:"Extensiones"})," y haz click en ",e.jsx("strong",{children:"Apps Script"}),"."]})]})]}),e.jsxs("div",{className:"flex items-start space-x-3.5",children:[e.jsx("span",{className:"bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100",children:"3"}),e.jsxs("div",{className:"text-sm w-full space-y-2",children:[e.jsx("p",{className:"font-extrabold text-slate-800 text-[#040d53]",children:"Reemplaza el código por este bloque mejorado"}),e.jsx("p",{className:"text-xs text-slate-500 leading-relaxed",children:'Limpia todo el código existente y pega este bloque (v6). Ya incluye tu clave de acceso, crea las hojas "Deudas", "Pagos" y "Limites" si no existen, y guarda una caché para que la app cargue mucho más rápido.'}),e.jsxs("div",{className:"relative bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-xs font-mono max-h-60 overflow-y-auto",children:[e.jsx("button",{onClick:le,className:"absolute top-2 right-2 bg-slate-800 hover:bg-[#040d53] text-white border border-slate-700 text-[10px] font-bold px-2 py-1 rounded transition flex items-center space-x-1 cursor-pointer",children:Q?e.jsxs(e.Fragment,{children:[e.jsx(N,{className:"h-3 w-3 text-[#70C145]"}),e.jsx("span",{children:"¡Copiado!"})]}):e.jsxs(e.Fragment,{children:[e.jsx(_,{className:"h-3 w-3"}),e.jsx("span",{children:"Copiar código"})]})}),e.jsx("pre",{className:"text-[10px] text-slate-300",children:e.jsx("code",{children:T})})]})]})]}),e.jsxs("div",{className:"flex items-start space-x-3.5",children:[e.jsx("span",{className:"bg-indigo-50 text-[#040d53] text-xs font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0 border border-indigo-100",children:"4"}),e.jsxs("div",{className:"text-sm",children:[e.jsx("p",{className:"font-extrabold text-slate-800 font-sans",children:"Guarda, Publica y Copia la URL"}),e.jsxs("p",{className:"text-xs text-slate-500 leading-relaxed mt-0.5",children:["Haz click en el icono de disquete para guardar.",e.jsx("br",{}),e.jsx("strong",{children:"Si ya tenías el script publicado:"})," ve a ",e.jsx("strong",{children:"Implementar > Administrar implementaciones"}),", pulsa ✏️ ",e.jsx("strong",{children:"Editar"}),", elige ",e.jsx("strong",{children:"Versión: Nueva versión"})," e implementa. Así conservas la misma URL.",e.jsx("br",{}),e.jsx("strong",{children:"Si es la primera vez:"})," presiona ",e.jsx("strong",{children:"Implementar > Nueva implementación"}),".",e.jsx("br",{}),"- Tipo de implementación: Selecciona ",e.jsx("strong",{children:"Aplicación Web"}),".",e.jsx("br",{}),"- Ejecutar como: ",e.jsx("strong",{children:"Tú"})," (tu correo).",e.jsx("br",{}),"- Quién tiene acceso: Selecciona ",e.jsx("strong",{children:"Cualquiera"}),". Tus datos quedan protegidos por la clave de acceso: sin ella el script no responde.",e.jsx("br",{}),"Haz click en Implementar, dale los permisos necesarios de tu cuenta (esta acción es completamente segura) y copia la URL final para guardarla en el formulario de la izquierda."]})]})]})]})]}),e.jsxs("div",{className:"bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-4",children:[e.jsx("h4",{className:"font-bold text-[#040d53] text-md",children:"Preguntas Frecuentes (FAQ)"}),e.jsxs("div",{className:"space-y-2 text-xs",children:[e.jsxs("div",{className:"border border-slate-100 rounded-xl overflow-hidden",children:[e.jsxs("button",{onClick:()=>q("faq1"),className:"w-full bg-[#f3f3f6] hover:bg-slate-200/50 p-3 font-semibold text-slate-800 text-left flex items-center justify-between",children:[e.jsx("span",{children:"¿Es seguro conectar mis finanzas usando este código en Apps Script?"}),b.faq1?e.jsx(U,{className:"h-4 w-4"}):e.jsx(F,{className:"h-4 w-4"})]}),b.faq1&&e.jsx("div",{className:"p-3 text-slate-500 leading-relaxed border-t border-slate-100 bg-white",children:'Sí. El código se ejecuta en tu propia cuenta de Google y los datos van directo de tu navegador a tu hoja, sin pasar por terceros. Aunque el acceso esté en "Cualquiera", el script solo responde a quien tenga tu clave de acceso: sin ella no se puede leer ni modificar nada. Comparte la clave (o el link de autoconfiguración) solo con quien deba usar la app, y si sospechas que se filtró, genera una nueva, copia el código y vuelve a implementar.'})]}),e.jsxs("div",{className:"border border-slate-100 rounded-xl overflow-hidden",children:[e.jsxs("button",{onClick:()=>q("faq2"),className:"w-full bg-[#f3f3f6] hover:bg-slate-200/50 p-3 font-semibold text-slate-800 text-left flex items-center justify-between",children:[e.jsx("span",{children:"¿Puedo añadir columnas adicionales en mi hoja de Excel/Sheets?"}),b.faq2?e.jsx(U,{className:"h-4 w-4"}):e.jsx(F,{className:"h-4 w-4"})]}),b.faq2&&e.jsxs("div",{className:"p-3 text-slate-500 leading-relaxed border-t border-slate-100 bg-white",children:["Sí, puedes añadir columnas a los lados. Las funciones del script identifican las columnas por su nombre específico en la primera fila. Mientras dejes intactos los encabezados obligatorios (",e.jsx("code",{className:"font-mono text-rose-600",children:"id"}),", ",e.jsx("code",{className:"font-mono",children:"contacto"}),", ",e.jsx("code",{className:"font-mono",children:"monto"}),", etc.) en la fila 1, la aplicación funcionará perfectamente."]})]})]})]}),e.jsxs("div",{className:"bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm space-y-6",children:[e.jsxs("div",{children:[e.jsxs("h3",{className:"font-bold text-[#040d53] text-[18px] flex items-center",children:[e.jsx(V,{className:"h-5 w-5 mr-2 text-[#70C145]"}),"Límites de Crédito por Cliente"]}),e.jsx("p",{className:"text-xs text-slate-500 mt-1",children:"Asigna un límite máximo de deuda activa por cliente. Si intentas registrar un préstamo que supere este límite, la aplicación te mostrará alertas de advertencia."})]}),e.jsxs("form",{onSubmit:se,className:"bg-slate-50 border border-[#eeeef0] p-4 rounded-xl flex flex-col sm:flex-row items-end gap-3",children:[e.jsxs("div",{className:"w-full sm:flex-1",children:[e.jsx("label",{className:"block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono",children:"Nombre de Cliente"}),e.jsx("input",{type:"text",placeholder:"Ej. Juan Pérez",value:w,onChange:t=>R(t.target.value),className:"w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#040d53] bg-white font-medium",required:!0})]}),e.jsxs("div",{className:"w-full sm:w-32",children:[e.jsx("label",{className:"block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono",children:"Límite ($)"}),e.jsx("input",{type:"number",placeholder:"Ej. 500",value:L,onChange:t=>P(t.target.value),className:"w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#040d53] bg-white font-mono font-bold",required:!0,min:"1"})]}),e.jsxs("button",{type:"submit",className:"bg-[#040d53] hover:opacity-95 text-white font-bold text-xs py-2 px-4 rounded-lg h-9 transition active:scale-95 flex items-center justify-center space-x-1 cursor-pointer",children:[e.jsx(ue,{className:"h-3.5 w-3.5"}),e.jsx("span",{children:"Fijar Límite"})]})]}),e.jsx("div",{className:"space-y-1 max-h-96 overflow-y-auto pr-1 scrollbar-thin",children:O.length>0?O.map(t=>e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 py-3.5 last:border-0 gap-3",children:[e.jsxs("div",{className:"space-y-1",children:[e.jsxs("div",{className:"flex items-center space-x-2",children:[e.jsx("span",{className:"font-extrabold text-slate-800 text-sm",children:t.name}),t.isExceeded&&e.jsxs("span",{className:"inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse",children:[e.jsx(M,{className:"h-2.5 w-2.5 mr-1"}),"Excede Límite"]})]}),e.jsxs("div",{className:"flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500",children:[e.jsxs("span",{children:["Deuda activa: ",e.jsxs("strong",{className:t.activeBalance>0?"text-[#040d53] font-bold":"text-slate-400",children:["$",t.activeBalance.toFixed(0)]})]}),e.jsxs("span",{children:["Límite actual: ",e.jsx("strong",{className:"text-slate-700 font-bold",children:t.limit>0?`$${t.limit}`:"Sin límite"})]})]}),t.limit>0&&e.jsx("div",{className:"w-48 bg-slate-100 h-1 rounded-full overflow-hidden mt-1",children:e.jsx("div",{style:{width:`${Math.min(100,t.percent)}%`},className:`h-full transition-all duration-300 ${t.isExceeded?"bg-rose-650":"bg-[#70C145]"}`})})]}),e.jsxs("div",{className:"flex items-center space-x-2 self-end sm:self-center",children:[e.jsxs("div",{className:"relative w-24",children:[e.jsx("span",{className:"absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 font-bold text-xs",children:"$"}),e.jsx("input",{type:"number",placeholder:"Sin Límite",value:y[t.name]!==void 0?y[t.name]:t.limit||"",onChange:a=>ae(t.name,a.target.value),className:"w-full pl-5 pr-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#040d53] font-mono"})]}),e.jsx("button",{onClick:()=>ne(t.name),className:"bg-slate-100 hover:bg-indigo-900 hover:text-white text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg h-[30px] transition",children:"Fijar"}),t.limit>0&&e.jsx("button",{onClick:()=>v(t.name,0),className:"text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-50 transition",title:"Eliminar límite de crédito",children:e.jsx(xe,{className:"h-3.5 w-3.5"})})]})]},t.name)):e.jsx("div",{className:"text-center py-6 text-slate-450 text-xs",children:"No hay clientes registrados en el sistema de préstamos todavía."})})]})]})]})}export{Pe as default};
