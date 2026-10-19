/**
 * Receptor de la app "Conteo de Ocupación Vehicular" (versión 2).
 *
 * Pestañas que maneja:
 * - "Carriles":   la lista que ven los observadores (Ubicación, Tipo, Carril). La editas tú.
 * - "Registros":  un renglón por auto (dato crudo). No editar a mano.
 * - "Por carril": cada carril por separado, en periodos de 15 min, separado en mañana y tarde.
 * - "Resumen":    carriles del mismo tipo sumados (Express, Normal) con porcentajes, como en el estudio.
 *
 * Volver a subir la misma sesión NO duplica: reemplaza sus renglones.
 */
const VERSION_SCRIPT = 2;
const HOJA_CFG = 'Carriles';
const HOJA_REG = 'Registros';
const HOJA_CARRIL = 'Por carril';
const HOJA_RES = 'Resumen';
const ENCABEZADOS = ['Sesion', 'Ubicacion', 'Observador', 'Tipo', 'Carril', 'Fecha', 'Hora', 'Periodo', 'Ocupantes', 'Timestamp'];
const CARRILES_INICIALES = [
  ['AV MORONES PRIETO', 'Express', 1],
  ['AV MORONES PRIETO', 'Express', 2],
  ['AV MORONES PRIETO', 'Normal', 4],
  ['AV MORONES PRIETO', 'Normal', 5],
];

// ---------- La app pide la lista de carriles ----------
function doGet(e) {
  const accion = e && e.parameter && e.parameter.accion;
  if (accion === 'config') {
    return json({ ok: true, version: VERSION_SCRIPT, ubicaciones: leerCarriles() });
  }
  return json({ ok: true, version: VERSION_SCRIPT, mensaje: 'Receptor de conteo de ocupación activo' });
}

function leerCarriles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_CFG);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_CFG, 0);
    hoja.getRange(1, 1, 1, 3).setValues([['Ubicacion', 'Tipo', 'Carril']]).setFontWeight('bold').setBackground('#f5c518');
    hoja.getRange(2, 1, CARRILES_INICIALES.length, 3).setValues(CARRILES_INICIALES);
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(1, 220);
  }
  const ubicaciones = [];
  const porNombre = {};
  const n = hoja.getLastRow();
  if (n < 2) return ubicaciones;
  hoja.getRange(2, 1, n - 1, 3).getDisplayValues().forEach(r => {
    const nombre = r[0].trim().toUpperCase(), tipo = normalizarTipo(r[1]), num = r[2].trim();
    if (!nombre || !tipo || !num) return;
    if (!porNombre[nombre]) { porNombre[nombre] = { nombre: nombre, carriles: [] }; ubicaciones.push(porNombre[nombre]); }
    if (!porNombre[nombre].carriles.some(c => c.tipo === tipo && c.num === num)) porNombre[nombre].carriles.push({ tipo: tipo, num: num });
  });
  return ubicaciones;
}

function normalizarTipo(t) {
  t = String(t || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
}

// ---------- La app sube una sesión ----------
function doPost(e) {
  // Varios teléfonos suben al mismo tiempo al terminar el turno: se forman en fila.
  // Cada subida solo agrega sus renglones (rápido); los resúmenes se recalculan al final.
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d.sessionId || !d.tipo || !d.carril || !Array.isArray(d.registros)) {
      throw new Error('Datos incompletos: actualiza la app (ábrela con internet)');
    }
    if (!lock.tryLock(120000)) throw new Error('La hoja está ocupada con otras subidas. Espera 1 minuto y vuelve a intentar');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = hojaRegistros(ss);
    const sid = String(d.sessionId);

    // Re-subida de la misma sesión (se perdió la respuesta, o se tocó "Subir" otra vez)
    const last = reg.getLastRow();
    if (last > 1) {
      const ids = reg.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0]));
      const ya = ids.filter(x => x === sid).length;
      if (ya && ya === d.registros.length) return json({ ok: true, version: VERSION_SCRIPT, filas: ya, repetida: true });
      // Si cambió, se borran solo los renglones de esta sesión (de abajo hacia arriba), nunca toda la hoja
      for (let i = ids.length - 1; i >= 0; i--) {
        if (ids[i] !== sid) continue;
        let j = i;
        while (j > 0 && ids[j - 1] === sid) j--;
        reg.deleteRows(j + 2, i - j + 1);
        i = j;
      }
    }

    const ubic = String(d.ubicacion || '').trim().toUpperCase();
    const tipo = normalizarTipo(d.tipo);
    const filas = d.registros.map(r => [sid, ubic, d.observador || '', tipo, String(d.carril),
      r.fecha, r.hora, r.periodo, r.ocupantes, new Date(r.ts)]);
    if (filas.length) {
      const inicio = reg.getLastRow() + 1;
      // Carril, Fecha, Hora, Periodo y Ocupantes como texto para que Sheets no los convierta
      reg.getRange(inicio, 5, filas.length, 5).setNumberFormat('@');
      reg.getRange(inicio, 1, filas.length, ENCABEZADOS.length).setValues(filas);
      SpreadsheetApp.flush();
    }
    lock.releaseLock();

    // Recalcular resúmenes solo si nadie más está usando la hoja. Si alguien sí, esa subida
    // recalculará al terminar e incluirá estos renglones (o usa el menú Conteo → Recalcular resumen).
    if (lock.tryLock(0)) construirResumen(ss);
    return json({ ok: true, version: VERSION_SCRIPT, filas: filas.length });
  } catch (err) {
    return json({ ok: false, version: VERSION_SCRIPT, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/** Menú en la hoja para recalcular a mano */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Conteo').addItem('Recalcular resumen', 'recalcularResumen').addToUi();
}
function recalcularResumen() {
  const lock = LockService.getScriptLock();
  lock.waitLock(120000);
  try { construirResumen(); } finally { lock.releaseLock(); }
  SpreadsheetApp.getActiveSpreadsheet().toast('Resumen recalculado');
}

/** Hoja Registros con los encabezados de esta versión. Si existe con otro formato, la guarda aparte. */
function hojaRegistros(ss) {
  let reg = ss.getSheetByName(HOJA_REG);
  if (reg && reg.getLastRow() > 0) {
    // Solo se comparan las primeras 10 columnas: notas o fórmulas a la derecha no importan
    const enc = reg.getRange(1, 1, 1, ENCABEZADOS.length).getDisplayValues()[0];
    if (enc.join('|') !== ENCABEZADOS.join('|')) {
      if (reg.getLastRow() > 1) {
        let nombre = HOJA_REG + ' (formato anterior)', i = 2;
        while (ss.getSheetByName(nombre)) nombre = HOJA_REG + ' (formato anterior ' + (i++) + ')';
        reg.setName(nombre);
        reg = null;
      } else {
        reg.clear(); // solo tenía encabezados viejos
      }
    }
  }
  if (!reg) reg = ss.insertSheet(HOJA_REG);
  if (reg.getLastRow() === 0) {
    reg.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]).setFontWeight('bold');
    reg.setFrozenRows(1);
  }
  return reg;
}

// ---------- Resúmenes ----------
/** Recalcula "Por carril" y "Resumen" a partir de Registros. También desde el menú Conteo → Recalcular resumen. */
function construirResumen(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(HOJA_REG);
  const tz = ss.getSpreadsheetTimeZone();
  // Texto tal como lo mandó la app; si alguien pegó datos a mano y Sheets los convirtió, se normalizan
  const txt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v).trim();
  const carril = {}, tipo = {}; // clave -> { titulo, periodos: { 'HH:MM - HH:MM': [1, 2, 3+] } }
  if (reg && reg.getLastRow() > 1) {
    // Columnas B..I: Ubicacion, Observador, Tipo, Carril, Fecha, Hora, Periodo, Ocupantes
    reg.getRange(2, 2, reg.getLastRow() - 1, 8).getValues().forEach(r => {
      const ubic = txt(r[0]), t = txt(r[2]), num = txt(r[3]), fecha = txt(r[4]), periodo = txt(r[6]), occ = txt(r[7]);
      if (!periodo || !t) return;
      const turno = parseInt(periodo, 10) < 12 ? 'MAÑANA' : 'TARDE';
      const i = occ === '1' ? 0 : occ === '2' ? 1 : 2;
      const ordenBase = [ubic, fecha, turno === 'MAÑANA' ? 0 : 1, t];
      sumar(carril, ordenBase.concat([('000' + num).slice(-4)]).join('|'),
        [ubic, fecha, turno, 'CARRIL ' + t.toUpperCase() + ' ' + num].join(' · '), periodo, i);
      sumar(tipo, ordenBase.join('|'),
        [ubic, fecha, turno, 'CARRILES ' + t.toUpperCase()].join(' · '), periodo, i);
    });
  }
  escribirTablas(ss, HOJA_CARRIL, carril);
  escribirTablas(ss, HOJA_RES, tipo);
}

function sumar(grupos, clave, titulo, periodo, i) {
  const g = grupos[clave] = grupos[clave] || { titulo: titulo, periodos: {} };
  const c = g.periodos[periodo] = g.periodos[periodo] || [0, 0, 0];
  c[i]++;
}

function escribirTablas(ss, nombre, grupos) {
  const hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  hoja.clear();
  const claves = Object.keys(grupos).sort();
  if (!claves.length) return;

  // Valores y formato de toda la pestaña en arreglos: se escriben con pocas llamadas (rápido aunque haya muchas tablas)
  const val = [], tipoFila = [];
  const fila = (t, v) => { tipoFila.push(t); val.push(v); };
  claves.forEach(k => {
    const g = grupos[k];
    fila('titulo', [g.titulo, '', '', '', '', '', '', '']);
    fila('enc', ['PERIODO', '', '1 OCUPANTE', '2 OCUPANTES', '3 O MAS OCUPANTES', '1 OCUPANTE (%)', '2 OCUPANTES (%)', '3 O MAS OCUPANTES (%)']);
    const t = [0, 0, 0];
    Object.keys(g.periodos).sort().forEach(p => {
      const c = g.periodos[p], tot = c[0] + c[1] + c[2];
      t[0] += c[0]; t[1] += c[1]; t[2] += c[2];
      const ab = p.split(' - ');
      fila('datos', [ab[0], ab[1] || '', c[0], c[1], c[2], c[0] / tot, c[1] / tot, c[2] / tot]);
    });
    const tt = t[0] + t[1] + t[2];
    fila('total', ['TOTAL', '', t[0], t[1], t[2], t[0] / tt, t[1] / tt, t[2] / tt]);
    fila('vacia', ['', '', '', '', '', '', '', '']);
  });

  const n = val.length, ocho = f => [f(0), f(1), f(2), f(3), f(4), f(5), f(6), f(7)];
  const num = tipoFila.map(t => (t === 'datos' || t === 'total') ? ocho(c => c < 2 ? '@' : c < 5 ? '0' : '0.0 %') : ocho(() => '@'));
  const fondo = tipoFila.map(t => ocho(() => t === 'titulo' ? '#1f2937' : t === 'enc' ? '#f5c518' : null));
  const color = tipoFila.map(t => ocho(() => t === 'titulo' ? '#ffffff' : '#000000'));
  const peso = tipoFila.map(t => ocho(() => (t === 'titulo' || t === 'enc' || t === 'total') ? 'bold' : 'normal'));
  const tam = tipoFila.map(t => ocho(() => t === 'titulo' ? 12 : 10));
  const ajuste = tipoFila.map(t => ocho(() => t === 'enc'));
  const alin = tipoFila.map(t => ocho(() => t === 'enc' ? 'center' : null));

  const rg = hoja.getRange(1, 1, n, 8);
  rg.setNumberFormats(num); // antes de los valores: así "07:30" se queda como texto y no se convierte en hora
  rg.setValues(val);
  rg.setBackgrounds(fondo).setFontColors(color).setFontWeights(peso).setFontSizes(tam).setWraps(ajuste).setHorizontalAlignments(alin);
  hoja.setColumnWidths(1, 2, 70);
  hoja.setColumnWidths(3, 6, 110);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
