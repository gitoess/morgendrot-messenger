# Boss-Backend fuer Heartbeat-Demo starten.
# Vorher: npm run streams-mock und npm run demo:heartbeat laufen (Bridge + Heartbeats).
# Dieses Skript setzt die Env und startet das Backend. Bei Aufforderung Wallet-Passwort eingeben.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)

# Anchor-ID aus letzter Demo-Ausgabe – ggf. anpassen oder von run-heartbeat-demo.ts uebernehmen
$anchorId = "aaaab1bf-90ce-47a8-80b2-49a34dc7dfa7"
$bridgeUrl = "http://127.0.0.1:9343"
$workerAddr = "0x0000000000000000000000000000000000000000000000000000000000000001"
$stateFile = Join-Path $root "tmp\heartbeat-demo-state.json"

$env:STREAMS_BRIDGE_URL = $bridgeUrl
$env:STREAMS_ANCHOR_ID = $anchorId
$env:MONITOR_DEVICES = $workerAddr
$env:ENABLE_MONITOR = "true"
$env:MONITOR_STATE_FILE = $stateFile

Write-Host "Starte Boss-Backend (Monitor) mit:"
Write-Host "  STREAMS_BRIDGE_URL=$bridgeUrl"
Write-Host "  STREAMS_ANCHOR_ID=$anchorId"
Write-Host "  MONITOR_DEVICES=$workerAddr"
Write-Host "  MONITOR_STATE_FILE=$stateFile"
Write-Host ""

Set-Location $root
npm run start:secrets
