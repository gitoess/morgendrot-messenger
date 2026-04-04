# Erzeugt schlanke Deploy-Ordner (ohne frontend/, ohne node_modules).
# Standard-Ziel: Windows-Desktop. Anpassen mit: -OutputRoot "D:\out"
param(
    [string]$OutputRoot = [Environment]::GetFolderPath('Desktop')
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Write-BundleReadme {
    param([string]$DestPath, [string]$Variant)
    $p = Join-Path $DestPath 'INSTALL.md'
    $folder = Split-Path -Leaf $DestPath
    @(
        "# Morgendrot - $Variant",
        '',
        '## Inhalt',
        'Siehe README-DEPLOY-BUNDLES.md in diesem Ordner.',
        '',
        '## Auf dem Raspi',
        "  cd $folder",
        '  npm ci --omit=dev',
        '  # oder: npm install --omit=dev',
        '  cp .env.example .env   # anpassen',
        '',
        '## Start headless',
        '  npm run start:headless',
        '',
        '## Start mit Lite-UI (nur Paket *lite-ui*)',
        '  In .env: ENABLE_UI=true',
        '  npm run start:secrets',
        '  Browser: http://<raspi-ip>:3342/  (API_PORT in .env pruefen)',
        '',
        'node_modules auf dem Raspi installieren (nicht von Windows kopieren).'
    ) | Set-Content -Path $p -Encoding UTF8
}

function Copy-HeadlessCore {
    param([string]$Dest)
    if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
    foreach ($f in @('package.json', 'package-lock.json', 'tsconfig.json')) {
        Copy-Item (Join-Path $RepoRoot $f) (Join-Path $Dest $f) -Force
    }
    Copy-Item (Join-Path $RepoRoot 'src') (Join-Path $Dest 'src') -Recurse -Force
    $envEx = Join-Path $RepoRoot '.env.example'
    if (Test-Path $envEx) { Copy-Item $envEx (Join-Path $Dest '.env.example') -Force }
    Copy-Item (Join-Path $RepoRoot 'deploy\README-DEPLOY-BUNDLES.md') (Join-Path $Dest 'README-DEPLOY-BUNDLES.md') -Force
}

$headless = Join-Path $OutputRoot 'Morgendrot-Raspi-headless'
$liteUi = Join-Path $OutputRoot 'Morgendrot-Raspi-lite-ui'
$esp32 = Join-Path $OutputRoot 'Morgendrot-ESP32-Tiny'

Write-Host "Repo: $RepoRoot"
Write-Host "Ziel: $OutputRoot"

Copy-HeadlessCore $headless
Write-BundleReadme $headless 'Raspi headless'

Copy-HeadlessCore $liteUi
Copy-Item (Join-Path $RepoRoot 'ui') (Join-Path $liteUi 'ui') -Recurse -Force
Copy-Item (Join-Path $RepoRoot 'profiles') (Join-Path $liteUi 'profiles') -Recurse -Force
Write-BundleReadme $liteUi 'Raspi + Lite-UI (ui/ + profiles/)'

if (Test-Path $esp32) { Remove-Item $esp32 -Recurse -Force }
New-Item -ItemType Directory -Path $esp32 -Force | Out-Null
Copy-Item (Join-Path $RepoRoot 'deploy\esp32-tiny-README.md') (Join-Path $esp32 'README.md') -Force
Copy-Item (Join-Path $RepoRoot 'deploy\README-DEPLOY-BUNDLES.md') (Join-Path $esp32 'README-DEPLOY-BUNDLES-Auszug.md') -Force
@(
    '# ESP32 / Tiny - kein Node-Repo auf dem Chip',
    '',
    'Nur Erklaerungen - siehe README.md.',
    'Morgendrot-Node: Paket Morgendrot-Raspi-headless oder -lite-ui auf dem Raspi.',
    'Firmware und C-Header: Boss-Wizard Provisioning Schritt 3.'
) | Set-Content (Join-Path $esp32 'WICHTIG.txt') -Encoding UTF8

Write-Host ""
Write-Host "Fertig:"
Write-Host "  $headless"
Write-Host "  $liteUi"
Write-Host "  $esp32"
