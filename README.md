# Conteo de Ocupación Vehicular

App para iPhone y Android para estudios de ocupación vehicular. **Cada observador cuenta un solo carril** con 3 botones (1 · 2 · 3+ ocupantes). Funciona sin internet y sube los datos a Google Sheets con un botón.

**App publicada:** https://erickramos110311-stack.github.io/conteo-ocupacion/

## Estructura
- `app/`: la app. Cada push a `main` que cambie esta carpeta la publica sola en GitHub Pages.
- `Code.gs`: script que recibe los datos en Google Sheets
- `.github/workflows/pages.yml`: publicación automática de la app
- `publicar-script.sh`: publica `Code.gs` en Google Apps Script con un comando

## 1. Preparar Google Sheets (una sola vez)
1. Crea una hoja nueva en Google Sheets → **Extensiones → Apps Script**.
2. Borra lo que haya y pega todo el contenido de `Code.gs`. Guarda.
3. **Implementar → Nueva implementación** → tipo **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Autoriza los permisos y copia la **URL que termina en `/exec`**.
5. Esa URL va fija dentro de la app, en la constante `SHEETS_URL` de `app/index.html`. Los encuestadores no la ven ni la pueden cambiar. Si algún día usas otra hoja, cambia esa línea y publica una versión nueva (ver abajo).

### La lista de carriles (pestaña "Carriles")
La pestaña **Carriles** de la hoja es la lista que ven los observadores en la app. Se crea sola la primera vez con AV MORONES PRIETO (Express 1 y 2, Normal 4 y 5). Para agregar otra avenida o carril, escribe un renglón nuevo:

| Ubicacion | Tipo | Carril |
|---|---|---|
| AV CONSTITUCION | Express | 1 |

- **Tipo**: `Express` o `Normal`. Los carriles del mismo tipo se suman en el Resumen.
- Escribe la ubicación siempre igual en todos sus renglones.
- Los teléfonos descargan la lista cada vez que abren la app con internet.

### Si cambias `Code.gs` después
Ya no hay que copiar y pegar nada en Apps Script. Desde esta carpeta:

```bash
./publicar-script.sh "qué cambió"
```

El comando sube `Code.gs` al proyecto de Apps Script de la hoja, crea una versión nueva y la publica en la **misma URL** que usa la app. Antes guarda una copia de lo que estaba publicado en `.respaldo-script-anterior.js`. Solo pide haber conectado la cuenta una vez en esta computadora con `npx @google/clasp login` (cuenta encuestasmpu@gmail.com) y tener activada la API en script.google.com/home/usersettings.

## 2. Publicación
Ya está publicada en GitHub Pages (ver URL arriba).

Para actualizar la app: edita los archivos de `app/`, **sube el número de `VERSION` en `app/sw.js`** (ej. de `ocv-v2` a `ocv-v3`) y haz push a `main`. Los teléfonos reciben la versión nueva sola la siguiente vez que abran la app con internet. Nunca se recarga a media cuenta: si hay un conteo en curso, la versión nueva entra al terminarlo y volver a abrir la app. Si no subes `VERSION`, los teléfonos se quedan con la versión guardada.

## 3. Instalar en cada teléfono (con internet, una vez)
- **iPhone (Safari)**: abre https://erickramos110311-stack.github.io/conteo-ocupacion/ → Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome)**: abre la URL → menú ⋮ → **Instalar app** / Agregar a pantalla principal.

Ábrela una vez con internet. A partir de ahí abre y cuenta sin señal.

## Uso en campo
1. Elige la **ubicación**, **tu carril** (ej. Express · Carril 2) y escribe **tu nombre**. El botón dice exactamente qué vas a contar: **▶ Empezar: Express · Carril 2**.
2. Toca **1**, **2** o **3+** cada vez que pasa un auto. El botón responde al tocarlo, sin esperar a soltar el dedo, y acepta toques con dos dedos a la vez.
3. **Deshacer** borra el último toque.
4. La pantalla se mantiene encendida. Si la app se cierra o se acaba la batería, al abrirla regresa al conteo con todo lo guardado.
5. **Terminar** → ves el resumen por periodos de 15 min → **Subir a Google Sheets** cuando tengas señal.
   - Subir dos veces la misma sesión **no duplica** los datos.
   - **Exportar CSV** sirve de respaldo (WhatsApp, correo, Drive).

## Qué aparece en Google Sheets
- **Carriles**: la lista de ubicaciones y carriles (la editas tú).
- **Registros**: un renglón por auto (sesión, ubicación, observador, tipo, carril, fecha, hora, periodo, ocupantes). No se edita a mano.
- **Por carril**: cada carril por separado, en periodos de 15 min, separado en MAÑANA y TARDE.
- **Resumen**: los carriles del mismo tipo sumados (CARRILES EXPRESS, CARRILES NORMAL) con 1 / 2 / 3+ ocupantes, porcentajes y TOTAL por turno, como en el estudio.

Las pestañas Por carril y Resumen se recalculan con cada subida y juntan los datos de todos los teléfonos.

## Recomendaciones
- Una persona por carril y un teléfono cada quien. Antes de salir a campo, asigna a cada observador su carril.
- Sincroniza la hora de los teléfonos (automática) para que los periodos coincidan.
- Los datos viven en el teléfono hasta que se suben. No borres datos de Safari/Chrome sin subir antes.
