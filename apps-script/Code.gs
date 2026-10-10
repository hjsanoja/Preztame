/* ====================================================================
 * PREZTAME · GOOGLE APPS SCRIPT v9
 * ====================================================================
 * 1. Abre tu Google Sheet > Extensiones > Apps Script.
 * 2. Borra todo el código del editor y pega este archivo completo.
 * 3. Guarda (icono de disquete).
 * 4. Implementar > Administrar implementaciones > ✏️ Editar >
 *    Versión: "Nueva versión" > Implementar.
 *    (Si es tu primera vez: Implementar > Nueva implementación >
 *     Aplicación web · Ejecutar como: Tú · Acceso: Cualquiera).
 *    Editar la implementación existente conserva la misma URL /exec.
 * 5. Acepta los permisos: servicios externos (tasa BCV), enviar correo,
 *    ejecutar en segundo plano (recordatorios y resumen mensual) y Google
 *    Drive (copias de respaldo de esta hoja).
 *
 * v7: editar préstamos, usuarios configurables, abonos en bolívares,
 * historial de cambios (hoja "Historial") y recordatorios por correo.
 * v8: lista de clientes (hoja "Clientes"), respaldo automático en Drive y
 * resumen mensual por correo.
 * v9: teléfono de cada cliente, renombrar, unificar y borrar clientes.
 *
 * La clave de abajo la genera Preztame. Sin ella nadie puede leer ni
 * modificar tus datos aunque conozca la URL.
 * ==================================================================== */

var API_TOKEN = "__DEUDAFLOW_TOKEN__";

var SCHEMA = {
  Deudas: ["id", "cuenta", "contacto", "tipo", "descripcion", "fecha", "monto", "saldo", "estado", "creadoPor", "mesPago", "tasaCambio"],
  Pagos: ["id", "fecha", "deudaId", "monto", "nota", "registradoPor", "moneda", "tasaCambio", "montoBs"],
  Limites: ["contacto", "limite"],
  Usuarios: ["nombre"],
  Clientes: ["nombre", "telefono", "creado"],
  Historial: ["fecha", "usuario", "accion", "refId", "detalle"]
};

var API_VERSION = 9;
var SCHEMA_FLAG = "df_schema_v9";
var VERSION_KEY = "df_version";
var CACHE_TTL_SECONDS = 1800;
var CACHE_CHUNK_CHARS = 40000;

// ============================ ENTRADAS HTTP ============================

function doGet(e) {
  var p = (e && e.parameter) || {};
  var denied = authError_(p.token);
  if (denied) return json_(denied);

  if (p.action === "bcv") return json_(getBcvRate_());
  if (p.action === "log") return json_({ ok: true, apiVersion: API_VERSION, log: readLog_(parseInt(p.limit, 10) || 200) });

  var version = getVersion_();
  if (p.v && p.v === version && p.fresh !== "1") {
    return json_({ ok: true, notModified: true, version: version, apiVersion: API_VERSION });
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

    var reminder = handleReminderAction_(ss, body);
    if (reminder) return json_(reminder);

    var ops = body.action === "batch" ? (body.ops || []) : [body];
    var versionBefore = getVersion_();
    var changed = false;
    var results = [];

    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      try {
        if (applyOp_(ss, op)) {
          changed = true;
          logOp_(ss, op);
        }
        results.push({ opId: op.opId || null, ok: true });
      } catch (err) {
        results.push({ opId: op.opId || null, ok: false, error: String(err && err.message || err) });
      }
    }

    if (changed) SpreadsheetApp.flush();
    var version = changed ? bumpVersion_() : versionBefore;
    return json_({ ok: true, apiVersion: API_VERSION, results: results, versionBefore: versionBefore, version: version });
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
    case "updateDebt": return updateDebt_(ss, op.id, op.changes || {});
    case "setUsers": return setUsers_(ss, op.usuarios || []);
    case "renameUser": return renameUser_(ss, op.from, op.to);
    case "setClient": return setClient_(ss, op.nombre, op.telefono);
    case "renameClient": return renameClient_(ss, op.from, op.to);
    case "deleteClient": return deleteClient_(ss, op.nombre);
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
  ensureClient_(ss, d.contacto);
  return true;
}

// Adds a name to "Clientes" unless it is already there (any casing).
function ensureClient_(ss, name) {
  name = String(name || "").trim();
  if (!name) return false;
  var sheet = getSheet_(ss, "Clientes");
  var last = sheet.getLastRow();
  var col = headerMap_(sheet).nombre + 1;
  if (last > 1) {
    var names = sheet.getRange(2, col, last - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (String(names[i][0]).trim().toLowerCase() === name.toLowerCase()) return false;
    }
  }
  appendObject_(sheet, { nombre: name, creado: new Date() });
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
    registradoPor: p.registradoPor,
    moneda: p.moneda === "VES" ? "VES" : "USD",
    tasaCambio: p.moneda === "VES" ? (parseFloat(p.tasaCambio) || "") : "",
    montoBs: p.moneda === "VES" ? round2_(p.montoBs) : ""
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

var EDITABLE_DEBT_FIELDS = ["cuenta", "contacto", "tipo", "descripcion", "fecha", "mesPago", "tasaCambio", "monto"];

function updateDebt_(ss, id, changes) {
  var sheet = getSheet_(ss, "Deudas");
  var row = findRow_(sheet, "id", id);
  if (row < 0) throw new Error("El préstamo " + id + " no existe");

  var values = {};
  EDITABLE_DEBT_FIELDS.forEach(function (k) {
    if (changes[k] === undefined || changes[k] === null) return;
    var v = changes[k];
    if (k === "monto") v = round2_(v);
    else if (k === "tasaCambio") v = parseFloat(v) || 1;
    else if (k === "mesPago") v = v ? "'" + v : "";
    else v = String(v).trim();
    values[k] = v;
  });
  if (values.monto !== undefined) {
    // El saldo sigue al nuevo monto menos lo ya abonado.
    var paid = 0;
    var sPagos = getSheet_(ss, "Pagos");
    findRows_(sPagos, "deudaId", id).forEach(function (r) { paid += round2_(getCell_(sPagos, r, "monto")); });
    var saldo = Math.max(0, round2_(values.monto - paid));
    values.saldo = saldo;
    values.estado = saldo <= 0 ? "saldado" : "pendiente";
  }
  if (!Object.keys(values).length) return false;
  setCells_(sheet, row, values);
  if (values.contacto) ensureClient_(ss, values.contacto);
  return true;
}

function setUsers_(ss, usuarios) {
  var sheet = getSheet_(ss, "Usuarios");
  var seen = {};
  var list = [];
  usuarios.forEach(function (u) {
    var name = String(u || "").trim();
    if (name && !seen[name]) { seen[name] = true; list.push([name]); }
  });
  var last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  if (list.length) sheet.getRange(2, 1, list.length, 1).setValues(list);
  return true;
}

function renameUser_(ss, from, to) {
  from = String(from || "").trim();
  to = String(to || "").trim();
  if (!from || !to || from === to) return false;
  var count = 0;
  [["Deudas", "cuenta"], ["Deudas", "creadoPor"], ["Pagos", "registradoPor"], ["Usuarios", "nombre"]].forEach(function (pair) {
    var sheet = getSheet_(ss, pair[0]);
    var last = sheet.getLastRow();
    var col = headerMap_(sheet)[pair[1]];
    if (last < 2 || col === undefined) return;
    count += sheet.getRange(2, col + 1, last - 1, 1)
      .createTextFinder(from).matchEntireCell(true).matchCase(true)
      .replaceAllWith(to);
  });
  return count > 0;
}

// ============================ CLIENTES ============================

var sameName_ = function (a, b) { return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase(); };

// Rows (1-based) of a sheet whose column matches a name, any casing.
function nameRows_(sheet, header, name) {
  var last = sheet.getLastRow();
  var col = headerMap_(sheet)[header];
  if (last < 2 || col === undefined) return [];
  var rows = [];
  sheet.getRange(2, col + 1, last - 1, 1).getValues().forEach(function (r, i) {
    if (sameName_(r[0], name)) rows.push(i + 2);
  });
  return rows;
}

function deleteRowsDesc_(sheet, rows) {
  rows.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sheet.deleteRow(r); });
}

// Adds the client if missing and saves its phone ("" clears it).
function setClient_(ss, nombre, telefono) {
  nombre = String(nombre || "").trim();
  if (!nombre) throw new Error("Cliente sin nombre");
  var sheet = getSheet_(ss, "Clientes");
  var tel = String(telefono || "").trim();
  var rows = nameRows_(sheet, "nombre", nombre);
  if (!rows.length) {
    // Prefijo ' para que Sheets no quite el 0 inicial ni lo trate como número.
    appendObject_(sheet, { nombre: nombre, telefono: tel ? "'" + tel : "", creado: new Date() });
    return true;
  }
  if (String(getCell_(sheet, rows[0], "telefono")) === tel) return false;
  setCells_(sheet, rows[0], { telefono: tel ? "'" + tel : "" });
  return true;
}

// Renames a client everywhere. If the new name already exists, both are
// unified: every loan (and with it its payments) moves to the new name, the
// credit limit and phone of the new name are kept (or taken from the old one
// when it has none) and the old name leaves the client list.
function renameClient_(ss, from, to) {
  from = String(from || "").trim();
  to = String(to || "").trim();
  if (!from || !to || from === to) return false;
  var changed = false;

  var deudas = getSheet_(ss, "Deudas");
  var col = headerMap_(deudas).contacto;
  var last = deudas.getLastRow();
  if (last > 1 && col !== undefined) {
    var range = deudas.getRange(2, col + 1, last - 1, 1);
    var values = range.getValues();
    var hits = 0;
    values.forEach(function (r) { if (sameName_(r[0], from)) { r[0] = to; hits++; } });
    if (hits) { range.setValues(values); changed = true; }
  }

  var caseOnly = sameName_(from, to);
  [["Limites", "contacto", "limite"], ["Clientes", "nombre", "telefono"]].forEach(function (t) {
    var sheet = getSheet_(ss, t[0]);
    var src = nameRows_(sheet, t[1], from);
    if (!src.length) return;
    var dst = caseOnly ? [] : nameRows_(sheet, t[1], to);
    var keep = dst.length ? dst[0] : src[0];
    var extra = String(getCell_(sheet, keep, t[2]) || "") === "" ? getCell_(sheet, src[0], t[2]) : "";
    var values = {};
    values[t[1]] = to;
    if (extra !== "" && extra !== null) values[t[2]] = t[2] === "telefono" ? "'" + extra : extra;
    setCells_(sheet, keep, values);
    deleteRowsDesc_(sheet, src.filter(function (r) { return r !== keep; }));
    changed = true;
  });
  return changed;
}

// Removes a client from the list (and its credit limit). Its loans stay.
function deleteClient_(ss, nombre) {
  var changed = false;
  [["Clientes", "nombre"], ["Limites", "contacto"]].forEach(function (t) {
    var sheet = getSheet_(ss, t[0]);
    var rows = nameRows_(sheet, t[1], nombre);
    if (rows.length) { deleteRowsDesc_(sheet, rows); changed = true; }
  });
  return changed;
}

// ============================ HISTORIAL DE CAMBIOS ============================

function logOp_(ss, op) {
  try {
    var refId = op.id || (op.debt && op.debt.id) || (op.payment && op.payment.id) || op.contacto || op.from || op.nombre || "";
    appendObject_(getSheet_(ss, "Historial"), {
      fecha: op.queuedAt ? new Date(op.queuedAt) : new Date(),
      usuario: op.by || "",
      accion: op.action,
      refId: String(refId),
      detalle: op.desc || op.action
    });
  } catch (err) {
    // El historial nunca debe impedir guardar el cambio.
  }
}

function readLog_(limit) {
  var sheet = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), "Historial");
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var n = Math.min(Math.max(limit, 1), 1000, last - 1);
  var cols = headerMap_(sheet);
  var rows = sheet.getRange(last - n + 1, 1, n, sheet.getLastColumn()).getValues();
  var out = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    var f = r[cols.fecha];
    out.push({
      fecha: f instanceof Date ? f.toISOString() : String(f),
      usuario: String(r[cols.usuario] || ""),
      accion: String(r[cols.accion] || ""),
      refId: String(r[cols.refId] || ""),
      detalle: String(r[cols.detalle] || "")
    });
  }
  return out;
}

// ============================ RECORDATORIOS POR CORREO ============================

var REMINDER_HANDLER = "enviarRecordatorios";

var MONTHLY_HANDLER = "resumenMensual";
var BACKUP_HANDLER = "respaldoAutomatico";

function handleReminderAction_(ss, body) {
  var props = PropertiesService.getScriptProperties();
  switch (body.action) {
    case "getReminders":
      return reminderState_();
    case "setupReminders":
      var emails = (body.emails || []).map(function (e) { return String(e).trim(); })
        .filter(function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
      if (!emails.length) emails = [Session.getEffectiveUser().getEmail()];
      var hour = Math.min(23, Math.max(0, parseInt(body.hour, 10) || 8));
      props.setProperty("df_rem_emails", JSON.stringify(emails));
      props.setProperty("df_rem_hour", String(hour));
      removeTriggers_(REMINDER_HANDLER);
      removeTriggers_(MONTHLY_HANDLER);
      if (body.daily !== false) ScriptApp.newTrigger(REMINDER_HANDLER).timeBased().everyDays(1).atHour(hour).create();
      if (body.monthly) ScriptApp.newTrigger(MONTHLY_HANDLER).timeBased().onMonthDay(1).atHour(hour).create();
      return reminderState_();
    case "disableReminders":
      removeTriggers_(REMINDER_HANDLER);
      removeTriggers_(MONTHLY_HANDLER);
      return reminderState_();
    case "testReminder":
      var state = reminderState_();
      state.sent = sendReminder_(ss, new Date(), true);
      return state;
    case "testMonthly":
      var st = reminderState_();
      st.sent = sendMonthlySummary_(ss, new Date());
      return st;
    case "getBackup":
      return backupState_();
    case "setupBackup":
      var freq = body.frequency === "weekly" ? "weekly" : "daily";
      props.setProperty("df_bk_freq", freq);
      props.setProperty("df_bk_keep", String(Math.min(60, Math.max(1, parseInt(body.keep, 10) || 14))));
      removeTriggers_(BACKUP_HANDLER);
      var t = ScriptApp.newTrigger(BACKUP_HANDLER).timeBased();
      if (freq === "weekly") t.onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
      else t.everyDays(1).atHour(3).create();
      return backupState_();
    case "disableBackup":
      removeTriggers_(BACKUP_HANDLER);
      return backupState_();
    case "backupNow":
      makeBackup_(ss);
      return backupState_();
    default:
      return null;
  }
}

function hasTrigger_(handler) {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === handler; });
}

function removeTriggers_(handler) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  });
}

function reminderState_() {
  var props = PropertiesService.getScriptProperties();
  var emails = JSON.parse(props.getProperty("df_rem_emails") || "[]");
  return {
    ok: true,
    apiVersion: API_VERSION,
    active: hasTrigger_(REMINDER_HANDLER),
    monthly: hasTrigger_(MONTHLY_HANDLER),
    emails: emails,
    hour: parseInt(props.getProperty("df_rem_hour"), 10) || 8
  };
}

// ============================ RESPALDOS EN DRIVE ============================

var BACKUP_FOLDER = "Preztame · respaldos";

function backupFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("df_bk_folder");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) {}
  }
  var found = DriveApp.getFoldersByName(BACKUP_FOLDER);
  var folder = found.hasNext() ? found.next() : DriveApp.createFolder(BACKUP_FOLDER);
  props.setProperty("df_bk_folder", folder.getId());
  return folder;
}

// Copia completa de la hoja en la carpeta de respaldos; conserva las últimas N.
function makeBackup_(ss) {
  var folder = backupFolder_();
  var stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH.mm");
  var copy = DriveApp.getFileById(ss.getId()).makeCopy("Preztame respaldo " + stamp, folder);
  var props = PropertiesService.getScriptProperties();
  props.setProperty("df_bk_last", new Date().toISOString());
  props.setProperty("df_bk_last_url", copy.getUrl());

  var keep = parseInt(props.getProperty("df_bk_keep"), 10) || 14;
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  files.slice(keep).forEach(function (f) { f.setTrashed(true); });
  return copy;
}

function backupState_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty("df_bk_folder");
  var folderUrl = "";
  if (folderId) {
    try { folderUrl = DriveApp.getFolderById(folderId).getUrl(); } catch (err) {}
  }
  return {
    ok: true,
    apiVersion: API_VERSION,
    active: hasTrigger_(BACKUP_HANDLER),
    frequency: props.getProperty("df_bk_freq") || "daily",
    keep: parseInt(props.getProperty("df_bk_keep"), 10) || 14,
    lastBackup: props.getProperty("df_bk_last") || "",
    lastUrl: props.getProperty("df_bk_last_url") || "",
    folderUrl: folderUrl
  };
}

// Activador de respaldos (diario o semanal).
function respaldoAutomatico() {
  makeBackup_(SpreadsheetApp.getActiveSpreadsheet());
}

// ============================ RESUMEN MENSUAL ============================

// Activador del día 1 de cada mes: resumen del mes anterior.
function resumenMensual() {
  sendMonthlySummary_(SpreadsheetApp.getActiveSpreadsheet(), new Date());
}

function sendMonthlySummary_(ss, today) {
  var tz = ss.getSpreadsheetTimeZone();
  var prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  var mes = Utilities.formatDate(prev, tz, "yyyy-MM");
  var meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var nombreMes = meses[prev.getMonth()] + " " + prev.getFullYear();

  var deudas = readObjects_(getSheet_(ss, "Deudas"), tz);
  var pagos = readObjects_(getSheet_(ss, "Pagos"), tz);
  var money = function (n) { return "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, ""); };
  var sum = function (list, k) { return list.reduce(function (a, x) { return a + (parseFloat(x[k]) || 0); }, 0); };

  var nuevos = deudas.filter(function (d) { return String(d.fecha).slice(0, 7) === mes; });
  var cobros = pagos.filter(function (p) { return String(p.fecha).slice(0, 7) === mes; });
  var vencianMes = deudas.filter(function (d) { return String(d.mesPago).replace(/^'/, "") === mes; });
  var pendientes = deudas.filter(function (d) { return d.estado !== "saldado" && round2_(d.saldo) > 0; });
  var due = dueSummary_(ss, today);

  var porPersona = {};
  pendientes.forEach(function (d) {
    var k = String(d.contacto).trim();
    porPersona[k] = (porPersona[k] || 0) + round2_(d.saldo);
  });
  var top = Object.keys(porPersona).map(function (k) { return [k, porPersona[k]]; })
    .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);

  var row = function (k, v) { return "<tr><td style='padding:4px 16px 4px 0;color:#555'>" + k + "</td><td style='padding:4px 0;font-weight:bold'>" + v + "</td></tr>"; };
  var html = "<div style='font-family:Arial,sans-serif;font-size:14px;color:#1b1c1f'>" +
    "<h2 style='margin:0 0 12px'>Resumen de " + nombreMes + "</h2><table>" +
    row("Prestado en el mes", money(sum(nuevos, "monto")) + " (" + nuevos.length + " préstamo" + (nuevos.length === 1 ? "" : "s") + ")") +
    row("Cobrado en el mes", money(sum(cobros, "monto")) + " (" + cobros.length + " abono" + (cobros.length === 1 ? "" : "s") + ")") +
    row("Vencía en " + meses[prev.getMonth()], money(sum(vencianMes, "monto")) + " · falta " + money(sum(vencianMes, "saldo"))) +
    row("Te deben hoy", money(sum(pendientes, "saldo")) + " (" + pendientes.length + " préstamo" + (pendientes.length === 1 ? "" : "s") + ")") +
    row("Vencido", money(due.vencidos.reduce(function (a, d) { return a + d.saldo; }, 0)) + " (" + due.vencidos.length + ")") +
    "</table>";
  if (top.length) {
    html += "<h3 style='margin:16px 0 4px'>Quién te debe más</h3><table>" +
      top.map(function (t) { return row(t[0], money(t[1])); }).join("") + "</table>";
  }
  html += "<p style='color:#777;margin-top:20px'>Enviado por Preztame desde tu Google Sheet.</p></div>";

  var emails = JSON.parse(PropertiesService.getScriptProperties().getProperty("df_rem_emails") || "[]");
  if (!emails.length) emails = [Session.getEffectiveUser().getEmail()];
  MailApp.sendEmail({ to: emails.join(","), subject: "Preztame: resumen de " + nombreMes, htmlBody: html });
  return true;
}

// Se ejecuta cada día (activador). También puedes ejecutarla desde el editor.
function enviarRecordatorios() {
  sendReminder_(SpreadsheetApp.getActiveSpreadsheet(), new Date(), false);
}

// Préstamos pendientes vencidos o que vencen en los próximos 7 días.
function dueSummary_(ss, today) {
  var tz = ss.getSpreadsheetTimeZone();
  var todayKey = Utilities.formatDate(today, tz, "yyyy-MM-dd").split("-");
  var t0 = Date.UTC(+todayKey[0], +todayKey[1] - 1, +todayKey[2]);
  var vencidos = [], pronto = [];
  readObjects_(getSheet_(ss, "Deudas"), tz).forEach(function (d) {
    var saldo = round2_(d.saldo);
    if (d.estado === "saldado" || saldo <= 0) return;
    var m = /^(\d{4})-(\d{2})$/.exec(String(d.mesPago || "").replace(/^'/, ""));
    if (!m) return;
    var due = Date.UTC(+m[1], +m[2], 0); // último día del mes de pago
    var days = Math.round((due - t0) / 86400000);
    var item = { contacto: d.contacto, saldo: saldo, cuenta: d.cuenta, days: days };
    if (days < 0) vencidos.push(item);
    else if (days <= 7) pronto.push(item);
  });
  vencidos.sort(function (a, b) { return a.days - b.days; });
  pronto.sort(function (a, b) { return a.days - b.days; });
  return { vencidos: vencidos, pronto: pronto };
}

function sendReminder_(ss, today, force) {
  var s = dueSummary_(ss, today);
  if (!force && !s.vencidos.length && !s.pronto.length) return false;
  var emails = JSON.parse(PropertiesService.getScriptProperties().getProperty("df_rem_emails") || "[]");
  if (!emails.length) emails = [Session.getEffectiveUser().getEmail()];

  var money = function (n) { return "$" + n.toFixed(2).replace(/\.00$/, ""); };
  var total = function (list) { return list.reduce(function (a, d) { return a + d.saldo; }, 0); };
  var rows = function (list, label) {
    return list.map(function (d) {
      return "<tr><td style='padding:6px 12px 6px 0'>" + d.contacto + "</td><td style='padding:6px 12px 6px 0'>" + money(d.saldo) +
        "</td><td style='padding:6px 0;color:#555'>" + label(d) + " · " + d.cuenta + "</td></tr>";
    }).join("");
  };
  var parts = [];
  if (s.vencidos.length) parts.push(s.vencidos.length + " vencido" + (s.vencidos.length === 1 ? "" : "s"));
  if (s.pronto.length) parts.push(s.pronto.length + " vence" + (s.pronto.length === 1 ? "" : "n") + " esta semana");
  var subject = "Preztame: " + (parts.length ? parts.join(" · ") : "sin cobros pendientes esta semana");

  var html = "<div style='font-family:Arial,sans-serif;font-size:14px;color:#1b1c1f'>";
  if (s.vencidos.length) {
    html += "<h3 style='color:#b3261e;margin:16px 0 4px'>Vencidos · " + money(total(s.vencidos)) + "</h3><table>" +
      rows(s.vencidos, function (d) { return "hace " + (-d.days) + " día" + (d.days === -1 ? "" : "s"); }) + "</table>";
  }
  if (s.pronto.length) {
    html += "<h3 style='color:#8a5a00;margin:16px 0 4px'>Vencen pronto · " + money(total(s.pronto)) + "</h3><table>" +
      rows(s.pronto, function (d) { return d.days === 0 ? "hoy" : "en " + d.days + " día" + (d.days === 1 ? "" : "s"); }) + "</table>";
  }
  if (!s.vencidos.length && !s.pronto.length) html += "<p>No tienes cobros vencidos ni que venzan esta semana. 🎉</p>";
  html += "<p style='color:#777;margin-top:20px'>Enviado por Preztame desde tu Google Sheet.</p></div>";

  MailApp.sendEmail({ to: emails.join(","), subject: subject, htmlBody: html });
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

  var usuarios = readObjects_(getSheet_(ss, "Usuarios"), tz)
    .map(function (row) { return String(row.nombre || "").trim(); })
    .filter(function (n) { return n; });

  var clientes = [];
  var telefonos = {};
  readObjects_(getSheet_(ss, "Clientes"), tz).forEach(function (row) {
    var name = String(row.nombre || "").trim();
    if (!name) return;
    clientes.push(name);
    var tel = String(row.telefono || "").trim();
    if (tel) telefonos[name] = tel;
  });

  var text = JSON.stringify({
    ok: true,
    apiVersion: API_VERSION,
    version: version,
    usuarios: usuarios,
    clientes: clientes,
    telefonos: telefonos,
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

// La primera vez, la lista de clientes se llena con los nombres de los préstamos.
function seedClients_(ss, clientes) {
  var deudas = ss.getSheetByName("Deudas");
  if (!deudas || deudas.getLastRow() < 2) return;
  var col = deudas.getRange(1, 1, 1, deudas.getLastColumn()).getValues()[0].indexOf("contacto");
  if (col < 0) return;
  var seen = {};
  var rows = [];
  deudas.getRange(2, col + 1, deudas.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var n = String(r[0] || "").trim();
    if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = true; rows.push([n, "", new Date()]); }
  });
  rows.sort(function (a, b) { return a[0].localeCompare(b[0]); });
  if (rows.length) clientes.getRange(2, 1, rows.length, 3).setValues(rows);
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
      if (name === "Clientes") seedClients_(ss, sheet);
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
