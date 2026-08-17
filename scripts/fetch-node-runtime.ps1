# Télécharge un Node.js portable (win-x64) et le place dans
# electron/vendor/node-win-x64/, embarqué tel quel dans l'installeur
# par electron-builder (voir electron-builder.yml -> extraResources).
#
# Pourquoi un Node séparé plutôt que celui d'Electron : les modules
# natifs (node-llama-cpp, @napi-rs/canvas) sont installés/compilés pour
# un Node "normal" ; les lancer sous ce runtime évite tout rebuild pour
# l'ABI interne d'Electron (electron-rebuild).
#
# Idempotent : ne re-télécharge pas si déjà présent. Relancer avec
# -Force pour forcer une re-récupération après un bump de version.

param(
  [string]$NodeVersion = "22.14.0",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $root "electron\vendor\node-win-x64"
$nodeExe = Join-Path $vendorDir "node.exe"

if ((Test-Path $nodeExe) -and -not $Force) {
  Write-Host "Node portable déjà présent : $nodeExe (utiliser -Force pour re-télécharger)"
  exit 0
}

$archiveName = "node-v$NodeVersion-win-x64"
$zipUrl = "https://nodejs.org/dist/v$NodeVersion/$archiveName.zip"
$tmpZip = Join-Path $env:TEMP "$archiveName.zip"
$tmpExtract = Join-Path $env:TEMP "findit-node-extract"

Write-Host "Téléchargement de $zipUrl ..."
Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip

if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
New-Item -ItemType Directory -Path $tmpExtract | Out-Null

Write-Host "Extraction ..."
Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

if (Test-Path $vendorDir) { Remove-Item $vendorDir -Recurse -Force }
New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null
# Seul node.exe est exécuté (voir electron/main.cjs) : on laisse de côté
# npm/npx/corepack et leur node_modules (~18 Mo) qui ne servent jamais
# au runtime packagé.
Copy-Item -Path (Join-Path $tmpExtract "$archiveName\node.exe") -Destination $vendorDir -Force
Copy-Item -Path (Join-Path $tmpExtract "$archiveName\LICENSE") -Destination $vendorDir -Force

Remove-Item $tmpZip -Force
Remove-Item $tmpExtract -Recurse -Force

Write-Host "Node portable prêt : $nodeExe"
