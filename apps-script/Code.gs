/* ====================================================================
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
  var denied = authError_(p.token);
  if (denied) return json_(denied);

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
  var denied = authError_(body.token);
  if (denied) return json_(denied);

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

// null = autorizado. keyHint (últimos 4 caracteres) ayuda a detectar si la
// app y el script tienen claves distintas sin revelar la clave.
function authError_(token) {
  var key = String(API_TOKEN || "").trim();
  if (!key || key.indexOf("__DEUDAFLOW") === 0) return { ok: false, error: "no-key" };
  if (typeof token === "string" && token.trim() === key) return null;
  return { ok: false, error: "unauthorized", keyHint: key.slice(-4) };
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
