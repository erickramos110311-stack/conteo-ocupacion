# Conteo de Ocupación Vehicular

App para iPhone y Android: 3 botones (1 · 2 · 3+ ocupantes) por carril. Funciona sin internet y sube los datos a Google Sheets con un botón.

**App publicada:** https://erickramos110311-stack.github.io/conteo-ocupacion/

## Estructura
- `app/`: la app. Cada push a `main` que cambie esta carpeta la publica sola en GitHub Pages.
- `Code.gs`: script que recibe los datos en Google Sheets
- `.github/workflows/pages.yml`: publicación automática

## 1. Preparar Google Sheets (una sola vez)
1. Crea una hoja nueva en Google Sheets → **Extensiones → Apps Script**.
2. Borra lo que haya y pega todo el contenido de `Code.gs`. Guarda.
3. **Implementar → Nueva implementación** → tipo **Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Autoriza los permisos y copia la **URL que termina en `/exec`**.
5. Esa URL va fija dentro de la app, en la constante `SHEETS_URL` de `app/index.html`. Los encuestadores no la ven ni la pueden cambiar. Si algún día usas otra hoja, cambia esa línea y publica una versión nueva (ver abajo).

Si cambias `Code.gs` después: Implementar → Administrar implementaciones → editar (lápiz) → Versión: **Nueva versión**. Así la URL no cambia y no hay que tocar la app. No uses "Nueva implementación", porque esa crea otra URL.

## 2. Publicación
Ya está publicada en GitHub Pages (ver URL arriba).

Para actualizar la app: edita los archivos de `app/`, **sube el número de `VERSION` en `app/sw.js`** (ej. de `ocv-v2` a `ocv-v3`) y haz push a `main`. Los teléfonos reciben la versión nueva sola la siguiente vez que abran la app con internet. Nunca se recarga a media cuenta: si hay un conteo en curso, la versión nueva entra al terminarlo y volver a abrir la app. Si no subes `VERSION`, los teléfonos se quedan con la versión guardada.

## 3. Instalar en cada teléfono (con internet, una vez)
- **iPhone (Safari)**: abre https://erickramos110311-stack.github.io/conteo-ocupacion/ → Compartir → **Agregar a pantalla de inicio**.
- **Android (Chrome)**: abre la URL → menú ⋮ → **Instalar app** / Agregar a pantalla principal.

Ábrela una vez con internet. A partir de ahí abre y cuenta sin señal.

## Uso en campo
1. Escribe la ubicación (ej. `AV MORONES PRIETO`) y tu nombre, elige el carril (Express / Normal / otro) → **Empezar**.
2. Toca **1**, **2** o **3+** cada vez que pasa un auto. El botón responde al tocarlo, sin esperar a soltar el dedo, y acepta toques con dos dedos a la vez.
3. **Deshacer** borra el último toque.
4. La pantalla se mantiene encendida. Si la app se cierra o se acaba la batería, al abrirla regresa al conteo con todo lo guardado.
5. **Terminar** → ves el resumen por periodos de 15 min → **Subir a Google Sheets** cuando tengas señal.
   - Subir dos veces la misma sesión **no duplica** los datos.
   - **Exportar CSV** sirve de respaldo (WhatsApp, correo, Drive).

## Qué aparece en Google Sheets
- **Registros**: un renglón por auto (sesión, ubicación, observador, carril, fecha, hora, periodo, ocupantes).
- **Resumen**: tablas por ubicación / carril / fecha con periodos de 15 min, 1 / 2 / 3+ ocupantes, porcentajes y TOTAL, con el mismo formato que el estudio. Se recalcula con cada subida y junta los datos de todos los teléfonos.

## Recomendaciones
- Una persona por carril (o por grupo de carriles) y un teléfono cada quien.
- Sincroniza la hora de los teléfonos (automática) para que los periodos coincidan.
- Los datos viven en el teléfono hasta que se suben. No borres datos de Safari/Chrome sin subir antes.
