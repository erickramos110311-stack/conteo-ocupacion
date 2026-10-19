/**
 * Receptor de la app "Conteo de Ocupación Vehicular" (versión 3).
 *
 * Pestañas que maneja:
 * - "Puntos":     los puntos de aforo. Cada punto tiene dos avenidas y cada avenida sus carriles.
 *                 Aquí se decide qué carriles son Express y cuáles Normal. La editas tú.
 * - "Registros":  un renglón por auto (dato crudo). No editar a mano.
 * - "Por carril": cada carril por separado, en periodos de 15 min, separado en mañana y tarde.
 * - "Resumen":    carriles del mismo tipo sumados (Express, Normal) con porcentajes, como en el estudio.
 *
 * Volver a subir la misma sesión NO duplica: reemplaza sus renglones.
 */
const VERSION_SCRIPT = 3;
const HOJA_PUNTOS = 'Puntos';
const HOJA_REG = 'Registros';
const HOJA_CARRIL = 'Por carril';
const HOJA_RES = 'Resumen';
const ENCABEZADOS = ['Sesion', 'Punto', 'Avenida', 'Lugar', 'Observador', 'Tipo', 'Carril', 'Fecha', 'Hora', 'Periodo', 'Ocupantes', 'Timestamp'];
const ENC_PUNTOS = ['Punto', 'Avenida', 'Lugar', 'Carriles Express', 'Carriles Normales'];
const ENCABEZADOS_V2 = ['Sesion', 'Ubicacion', 'Observador', 'Tipo', 'Carril', 'Fecha', 'Hora', 'Periodo', 'Ocupantes', 'Timestamp'];
const PUNTOS_INICIALES = [
  [1, 'AV. CONSTITUCIÓN', 'Puente vehicular Corregidora', '1,2,3', '4,5,6'],
  [1, 'AV. MORONES PRIETO', 'Puente vehicular Corregidora', '1,2,3', '4,5,6'],
  [2, 'AV. CONSTITUCIÓN', 'Puente verde', '1,2,3', '4,5,6'],
  [2, 'AV. MORONES PRIETO', 'Puente peatonal frente a Parque España', '1,2,3', '4,5,6'],
  [3, 'AV. CONSTITUCIÓN', 'Puente peatonal a la altura de calle Morelos', '1,2,3', '4,5,6'],
  [3, 'AV. MORONES PRIETO', 'Puente peatonal adelante de Pedro Martínez', '1,2,3', '4,5,6'],
  [4, 'AV. CONSTITUCIÓN', 'Puente peatonal del Papa', '1,2,3', '4,5,6'],
  [4, 'AV. MORONES PRIETO', 'Puente peatonal del Papa', '1,2,3', '4,5,6'],
  [5, 'AV. CONSTITUCIÓN', 'Puente peatonal a la altura de calle Degollado', '1,2,3', '4,5,6'],
  [5, 'AV. MORONES PRIETO', 'Puente peatonal a la altura de calle Loma Larga', '1,2,3', '4,5,6'],
];
// Lista de la versión 2 (la creaba el script solo); si sigue sin cambios se quita
const CARRILES_V2 = [['AV MORONES PRIETO', 'Express', '1'], ['AV MORONES PRIETO', 'Express', '2'], ['AV MORONES PRIETO', 'Normal', '4'], ['AV MORONES PRIETO', 'Normal', '5']];

// ---------- La app pide la lista de puntos ----------
function doGet(e) {
  const accion = e && e.parameter && e.parameter.accion;
  if (accion === 'config') {
    return json({ ok: true, version: VERSION_SCRIPT, puntos: leerPuntos(SpreadsheetApp.getActiveSpreadsheet()) });
  }
  return json({ ok: true, version: VERSION_SCRIPT, mensaje: 'Receptor de conteo de ocupación activo' });
}

/** [{num, avenidas: [{avenida, lugar, carriles: [{num, tipo}]}]}] ordenado por punto */
function leerPuntos(ss) {
  let hoja = ss.getSheetByName(HOJA_PUNTOS);
  if (!hoja) {
    try { hoja = ss.insertSheet(HOJA_PUNTOS, 0); }
    catch (_) { hoja = ss.getSheetByName(HOJA_PUNTOS); } // otro teléfono la creó al mismo tiempo
  }
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, ENC_PUNTOS.length).setValues([ENC_PUNTOS]).setFontWeight('bold').setBackground('#f5c518');
    hoja.getRange(2, 1, PUNTOS_INICIALES.length, 1).setNumberFormat('0');
    hoja.getRange(2, 4, PUNTOS_INICIALES.length, 2).setNumberFormat('@'); // "1,2,3" como texto
    hoja.getRange(2, 1, PUNTOS_INICIALES.length, ENC_PUNTOS.length).setValues(PUNTOS_INICIALES);
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(2, 170);
    hoja.setColumnWidth(3, 330);
    hoja.setColumnWidths(4, 2, 130);
    try { quitarCarrilesV2(ss); } catch (_) {} // después de crear Puntos: la hoja nunca se queda sin pestañas
  }
  const puntos = [], porNum = {};
  const n = hoja.getLastRow();
  if (n < 2) return puntos;
  hoja.getRange(2, 1, n - 1, ENC_PUNTOS.length).getDisplayValues().forEach(r => {
    const num = String(r[0]).trim(), avenida = String(r[1]).trim().toUpperCase(), lugar = String(r[2]).trim();
    if (!num || !avenida) return;
    const carriles = [];
    [[r[3], 'Express'], [r[4], 'Normal']].forEach(([lista, tipo]) => {
      String(lista).split(/[^0-9]+/).filter(Boolean).forEach(c => {
        if (!carriles.some(x => x.num === c)) carriles.push({ num: c, tipo: tipo });
      });
    });
    if (!carriles.length) return;
    carriles.sort((a, b) => Number(a.num) - Number(b.num));
    if (!porNum[num]) { porNum[num] = { num: num, avenidas: [] }; puntos.push(porNum[num]); }
    porNum[num].avenidas.push({ avenida: avenida, lugar: lugar, carriles: carriles });
  });
  puntos.sort((a, b) => (Number(a.num) - Number(b.num)) || (a.num < b.num ? -1 : 1));
  return puntos;
}

/** Tipo de cada carril según la pestaña Puntos: { 'punto|AVENIDA|carril': 'Express' } */
function mapaTipos(ss) {
  const m = {};
  leerPuntos(ss).forEach(p => p.avenidas.forEach(a => a.carriles.forEach(c => { m[[p.num, a.avenida, c.num].join('|')] = c.tipo; })));
  return m;
}

function quitarCarrilesV2(ss) {
  const vieja = ss.getSheetByName('Carriles');
  if (!vieja) return;
  const datos = vieja.getLastRow() > 1 ? vieja.getRange(2, 1, vieja.getLastRow() - 1, 3).getDisplayValues() : [];
  if (JSON.stringify(datos) === JSON.stringify(CARRILES_V2)) ss.deleteSheet(vieja);  // nadie la editó
  else vieja.setName('Carriles (versión anterior, ya no se usa)');
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
    const avenida = String(d.avenida || d.ubicacion || '').trim().toUpperCase(); // "ubicacion": app versión anterior
    if (!d.sessionId || !avenida || !d.carril || !Array.isArray(d.registros)) {
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

    const punto = String(d.punto || '').trim(), carril = String(d.carril).trim();
    const tipo = normalizarTipo(d.tipo) || mapaTipos(ss)[[punto, avenida, carril].join('|')] || '';
    const filas = d.registros.map(r => [sid, punto, avenida, String(d.lugar || ''), d.observador || '', tipo, carril,
      r.fecha, r.hora, r.periodo, r.ocupantes, new Date(r.ts)]);
    if (filas.length) {
      const inicio = reg.getLastRow() + 1;
      // Punto, Carril, Fecha, Hora, Periodo y Ocupantes como texto para que Sheets no los convierta
      reg.getRange(inicio, 2, filas.length, 1).setNumberFormat('@');
      reg.getRange(inicio, 7, filas.length, 5).setNumberFormat('@');
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

/** Menú en la hoja para recalcular a mano (por ejemplo después de cambiar qué carriles son Express) */
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
    // Solo se comparan las columnas de la app: notas o fórmulas a la derecha no importan
    const enc = reg.getRange(1, 1, 1, ENCABEZADOS.length).getDisplayValues()[0];
    if (enc.join('|') !== ENCABEZADOS.join('|')) {
      if (enc.slice(0, ENCABEZADOS_V2.length).join('|') === ENCABEZADOS_V2.join('|')) {
        // Versión 2 → 3 sin mover nada: se insertan las columnas Punto (B) y Lugar (D); lo ya subido sigue en el Resumen
        reg.insertColumnBefore(2);
        reg.insertColumnAfter(3);
        reg.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]).setFontWeight('bold');
      } else if (reg.getLastRow() > 1) {
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
// Renglón 1 de "Resumen" y "Por carril": selectores "Ver día" (C1) y "Ver punto" (E1). Las tablas empiezan en el renglón 4.
const TODOS_DIAS = 'Todos los días', TODOS_PUNTOS = 'Todos', FILA_TABLAS = 4;

/** Al elegir día o punto en el renglón 1, se redibuja esa pestaña (activador simple: no pide permisos) */
function onEdit(e) {
  if (!e || !e.range) return;
  const hoja = e.range.getSheet(), nombre = hoja.getName();
  if ((nombre !== HOJA_RES && nombre !== HOJA_CARRIL) || e.range.getRow() !== 1) return;
  if (e.range.getColumn() > 5 || e.range.getLastColumn() < 3) return;
  // Si Google corta el redibujo (los activadores simples tienen 30 s), este aviso se queda y dice qué hacer
  hoja.getRange(2, 1).setValue('Actualizando… (si no cambia en un minuto, usa el menú Conteo → Recalcular resumen)').setFontColor('#b45309');
  SpreadsheetApp.flush();
  construirResumen(e.source, nombre);
}

/** Recalcula "Por carril" y "Resumen" a partir de Registros (o solo la pestaña `solo`). También desde el menú Conteo. */
function construirResumen(ss, solo) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(HOJA_REG);
  const tz = ss.getSpreadsheetTimeZone();
  // El tipo (Express/Normal) se toma de la pestaña Puntos al recalcular: si lo corriges ahí, el Resumen se corrige solo
  const config = leerPuntos(ss), tipos = {};
  config.forEach(p => p.avenidas.forEach(a => a.carriles.forEach(c => { tipos[[p.num, a.avenida, c.num].join('|')] = c.tipo; })));
  // Texto tal como lo mandó la app; si alguien pegó datos a mano y Sheets los convirtió, se normalizan
  const txt = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v).trim();
  const pad = s => ('0000' + s).slice(-4);
  const carril = {}, tipo = {}; // clave -> { titulo, fecha, punto, periodos: { 'HH:MM - HH:MM': [1, 2, 3+] } }
  const fechas = {}, puntos = {};
  config.forEach(p => { puntos[p.num] = true; });
  if (reg && reg.getLastRow() > 1) {
    // Columnas B..K: Punto, Avenida, Lugar, Observador, Tipo, Carril, Fecha, Hora, Periodo, Ocupantes
    reg.getRange(2, 2, reg.getLastRow() - 1, 10).getValues().forEach(r => {
      const punto = txt(r[0]), avenida = txt(r[1]).toUpperCase(), lugar = txt(r[2]), num = txt(r[5]),
            fecha = txt(r[6]), periodo = txt(r[8]), occ = txt(r[9]);
      if (!periodo || !num) return;
      fechas[fecha] = true; puntos[punto] = true;
      const t = tipos[[punto, avenida, num].join('|')] || normalizarTipo(r[4]) || 'Sin tipo';
      const turno = parseInt(periodo, 10) < 12 ? 'MAÑANA' : 'TARDE';
      const i = occ === '1' ? 0 : occ === '2' ? 1 : 2;
      const lugarTxt = (punto ? 'PUNTO ' + punto + ' · ' : '') + avenida + (lugar ? ' (' + lugar + ')' : '');
      const base = [pad(punto), avenida, fecha, turno === 'MAÑANA' ? 0 : 1];
      const meta = { fecha: fecha, punto: punto };
      sumar(carril, base.concat([pad(num), t]).join('|'),
        [lugarTxt, fecha, turno, 'CARRIL ' + num + ' (' + t.toUpperCase() + ')'].join(' · '), meta, periodo, i);
      sumar(tipo, base.concat([t]).join('|'),
        [lugarTxt, fecha, turno, 'CARRILES ' + t.toUpperCase()].join(' · '), meta, periodo, i);
    });
  }
  const opciones = {
    dias: [TODOS_DIAS].concat(Object.keys(fechas).sort()),
    puntos: [TODOS_PUNTOS].concat(Object.keys(puntos).sort((a, b) => (Number(a) || 999) - (Number(b) || 999)).map(etiquetaPunto)),
  };
  if (!solo || solo === HOJA_CARRIL) escribirTablas(ss, HOJA_CARRIL, carril, opciones);
  if (!solo || solo === HOJA_RES) escribirTablas(ss, HOJA_RES, tipo, opciones);
}

const etiquetaPunto = p => p ? 'Punto ' + p : 'Sin punto';

function sumar(grupos, clave, titulo, meta, periodo, i) {
  const g = grupos[clave] = grupos[clave] || { titulo: titulo, fecha: meta.fecha, punto: meta.punto, periodos: {} };
  const c = g.periodos[periodo] = g.periodos[periodo] || [0, 0, 0];
  c[i]++;
}

/** Renglón 1 con los selectores; devuelve lo que está elegido */
function selectores(ss, hoja, opciones) {
  const tz = ss.getSpreadsheetTimeZone();
  if (String(hoja.getRange(1, 1).getValue()) !== 'Ver día:') {
    // Pestaña nueva o de la versión anterior (sin selectores): se arma el renglón 1
    hoja.clear();
    hoja.getRange(1, 3).setNumberFormat('@');   // la fecha elegida se queda como texto
    hoja.getRange(1, 5).setNumberFormat('@');
    hoja.getRange(1, 1, 1, 6).setValues([['Ver día:', '', TODOS_DIAS, 'Ver punto:', TODOS_PUNTOS, '← elige y la pestaña se actualiza']]);
    hoja.getRange(1, 1, 1, 6).setFontWeights([['bold', 'normal', 'bold', 'bold', 'bold', 'normal']])
      .setFontColors([['#000000', '#000000', '#174ea6', '#000000', '#174ea6', '#666666']]);
    hoja.getRange(1, 3).setBackground('#e8f0fe');
    hoja.getRange(1, 5).setBackground('#e8f0fe');
    hoja.getRange(1, 4).setHorizontalAlignment('right');
    hoja.setFrozenRows(1);
  }
  const leer = c => { const v = hoja.getRange(1, c).getValue(); return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v).trim(); };
  const dia = leer(3) || TODOS_DIAS, punto = leer(5) || TODOS_PUNTOS;
  // Las listas se actualizan con los días y puntos que hay (lo elegido se respeta)
  hoja.getRange(1, 3).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opciones.dias, true).setAllowInvalid(true).build());
  hoja.getRange(1, 5).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(opciones.puntos, true).setAllowInvalid(true).build());
  return { dia: dia, punto: punto };
}

function escribirTablas(ss, nombre, grupos, opciones) {
  const hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  const sel = selectores(ss, hoja, opciones);
  // Se borra todo menos los renglones 1 (selectores) y 2 (estado: se escribe al final, cuando las tablas ya están completas)
  hoja.getRange(3, 1, Math.max(1, hoja.getMaxRows() - 2), hoja.getMaxColumns()).clear();
  const claves = Object.keys(grupos).sort().filter(k => {
    const g = grupos[k];
    return (sel.dia === TODOS_DIAS || g.fecha === sel.dia) && (sel.punto === TODOS_PUNTOS || etiquetaPunto(g.punto) === sel.punto);
  });
  const filtro = (sel.dia === TODOS_DIAS ? 'todos los días' : 'día ' + sel.dia) + ' · ' + (sel.punto === TODOS_PUNTOS ? 'todos los puntos' : sel.punto.toLowerCase());
  const estado = t => hoja.getRange(2, 1).setValue(t).setFontColor('#666666').setFontWeight('normal');
  if (!claves.length) { estado('No hay datos para ' + filtro); return; }

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

  const rg = hoja.getRange(FILA_TABLAS, 1, n, 8);
  rg.setNumberFormats(num); // antes de los valores: así "07:30" se queda como texto y no se convierte en hora
  rg.setValues(val);
  rg.setBackgrounds(fondo).setFontColors(color).setFontWeights(peso).setFontSizes(tam).setWraps(ajuste).setHorizontalAlignments(alin);
  hoja.setColumnWidths(1, 2, 70);
  hoja.setColumnWidths(3, 6, 110);
  estado('Mostrando ' + claves.length + (claves.length === 1 ? ' tabla' : ' tablas') + ' · ' + filtro);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
