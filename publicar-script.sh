#!/bin/bash
# Publica Code.gs en el Apps Script de la hoja del estudio, en la MISMA URL que usa la app.
# Requisito (una sola vez en esta computadora): npx @google/clasp login  (cuenta encuestasmpu@gmail.com)
# Uso: ./publicar-script.sh "descripción del cambio"
set -euo pipefail

SCRIPT_ID="1Pz00EOoj3LD0VatYqxL0QhP7HPGY9BtDQQkICl3Dyy-fs2hBU_8NiP37"
DEPLOY_ID="AKfycbw3dCka9E4nWu-3ihOS40vWtV2flRqso8GTqflzbo8gcYTyn_yn7xzbf1KQzWvTfmEG-A"
DESC="${1:-actualización}"
REPO="$(cd "$(dirname "$0")" && pwd)"
CLASP="npx -y @google/clasp@3.4.1"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
$CLASP clone "$SCRIPT_ID" >/dev/null
cp "Código.js" "$REPO/.respaldo-script-anterior.js"   # copia de lo que estaba publicado
cp "$REPO/Code.gs" "Código.js"
$CLASP push --force
VER="$($CLASP create-version "$DESC" | grep -oE '[0-9]+$')"
$CLASP update-deployment "$DEPLOY_ID" -V "$VER" -d "conteo"
echo "Publicada la versión $VER. Prueba:"
curl -sL "https://script.google.com/macros/s/$DEPLOY_ID/exec"; echo
