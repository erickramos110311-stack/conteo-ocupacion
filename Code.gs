/**
 * Receptor de la app "Conteo de Ocupación Vehicular".
 * - Hoja "Registros": un renglón por auto (dato crudo).
 * - Hoja "Resumen": tablas por Ubicación / Carril / Fecha en periodos de 15 min,
 *   con el mismo formato del estudio (1, 2, 3+ ocupantes y %).
 * Volver a subir la misma sesión NO duplica: reemplaza sus renglones.
 */
const HOJA_REG = 'Registros';
const HOJA_RES = 'Resumen';
const ENCABEZADOS = ['Sesion', 'Ubicacion', 'Observador', 'Carril', 'Fecha', 'Hora', 'Periodo', 'Ocupantes', 'Timestamp'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // varios teléfonos pueden subir al mismo tiempo
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = obtenerHoja(ss, HOJA_REG);
    if (reg.getLastRow() === 0) {
      reg.appendRow(ENCABEZADOS);
      reg.setFrozenRows(1);
      reg.getRange(1, 1, 1, ENCABEZADOS.length).setFontWeight('bold');
    }

    // Quitar renglones previos de esta sesión (re-subida)
    const last = reg.getLastRow();
    if (last > 1) {
      const datos = reg.getRange(2, 1, last - 1, ENCABEZADOS.length).getValues();
      const resto = datos.filter(r => String(r[0]) !== d.sessionId);
      if (resto.length !== datos.length) {
        reg.getRange(2, 1, last - 1, ENCABEZADOS.length).clearContent();
        if (resto.length) reg.getRange(2, 1, resto.length, ENCABEZADOS.length).setValues(resto);
      }
    }

    const filas = d.registros.map(r => [d.sessionId, d.ubicacion, d.observador, r.carril,
      r.fecha, r.hora, r.periodo, r.ocupantes, new Date(r.ts)]);
    if (filas.length) {
      const inicio = Math.max(reg.getLastRow(), 1) + 1;
      // Fecha, Hora, Periodo y Ocupantes como texto para que Sheets no los convierta
      reg.getRange(inicio, 5, filas.length, 4).setNumberFormat('@');
      reg.getRange(inicio, 1, filas.length, ENCABEZADOS.length).setValues(filas);
    }

    construirResumen(ss);
    return json({ ok: true, filas: filas.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, mensaje: 'Receptor de conteo de ocupación activo' });
}

/** Recalcula la hoja Resumen completa a partir de Registros. También se puede correr a mano. */
function construirResumen(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  const reg = obtenerHoja(ss, HOJA_REG);
  const res = obtenerHoja(ss, HOJA_RES);
  res.clear();
  const last = reg.getLastRow();
  if (last < 2) return;

  // grupos[ubicacion|carril|fecha][periodo] = [1, 2, 3+]
  const grupos = {};
  reg.getRange(2, 1, last - 1, ENCABEZADOS.length).getDisplayValues().forEach(r => {
    const [, ubic, , carril, fecha, , periodo, occ] = r;
    if (!periodo) return;
    const g = [ubic, carril, fecha].join('|');
    grupos[g] = grupos[g] || {};
    const c = grupos[g][periodo] = grupos[g][periodo] || [0, 0, 0];
    c[occ === '1' ? 0 : occ === '2' ? 1 : 2]++;
  });

  const salida = [];
  const formatos = []; // [fila, tipo]
  Object.keys(grupos).sort().forEach(g => {
    const [ubic, carril, fecha] = g.split('|');
    formatos.push([salida.length + 1, 'titulo']);
    salida.push([ubic.toUpperCase(), 'CARRIL ' + carril.toUpperCase(), fecha, '', '', '', '', '']);
    formatos.push([salida.length + 1, 'enc']);
    salida.push(['PERIODO', '', '1 OCUPANTE', '2 OCUPANTES', '3 O MAS OCUPANTES', '1 OCUPANTE (%)', '2 OCUPANTES (%)', '3 O MAS OCUPANTES (%)']);
    const t = [0, 0, 0];
    Object.keys(grupos[g]).sort().forEach(p => {
      const c = grupos[g][p], tot = c[0] + c[1] + c[2];
      t[0] += c[0]; t[1] += c[1]; t[2] += c[2];
      const [a, b] = p.split(' - ');
      salida.push([a, b, c[0], c[1], c[2], c[0] / tot, c[1] / tot, c[2] / tot]);
    });
    const tt = t[0] + t[1] + t[2];
    formatos.push([salida.length + 1, 'total']);
    salida.push(['TOTAL', '', t[0], t[1], t[2], t[0] / tt, t[1] / tt, t[2] / tt]);
    salida.push(['', '', '', '', '', '', '', '']);
  });

  res.getRange(1, 1, salida.length, 8).setValues(salida);
  res.getRange(1, 6, salida.length, 3).setNumberFormat('0.0 %');
  res.getRange(1, 1, salida.length, 2).setNumberFormat('@');
  formatos.forEach(([f, tipo]) => {
    const rg = res.getRange(f, 1, 1, 8);
    if (tipo === 'titulo') rg.setFontWeight('bold').setFontSize(12).setBackground('#1f2937').setFontColor('#ffffff');
    if (tipo === 'enc') rg.setFontWeight('bold').setBackground('#f5c518').setWrap(true).setHorizontalAlignment('center');
    if (tipo === 'total') rg.setFontWeight('bold').setBorder(true, null, null, null, null, null);
  });
  res.setColumnWidths(1, 2, 70);
  res.setColumnWidths(3, 6, 110);
}

function obtenerHoja(ss, nombre) {
  return ss.getSheetByName(nombre) || ss.insertSheet(nombre);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
