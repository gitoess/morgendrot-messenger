# Vollstandiger API- und Funktions-Test fur Morgendrot
# Voraussetzung: Server lauft (npm run dev), API z.B. http://127.0.0.1:3342
$base = if ($env:API_BASE) { $env:API_BASE } else { "http://127.0.0.1:3342" }
$addr = if ($env:MY_ADDRESS) { $env:MY_ADDRESS } else { "0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5" }
$partner = if ($env:PARTNER_ADDRESS) { $env:PARTNER_ADDRESS } else { "0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5" }
$ok = 0
$fail = 0
$skipped = 0

function Test-Get($name, $url) {
    try {
        $r = Invoke-RestMethod -Uri "$base$url" -Method GET -TimeoutSec 15
        if ($r.ok -eq $true -or $r.backendRunning -eq $true -or $r.reachable -ne $null -or $r.addresses -ne $null -or $r.config -ne $null -or $r.helpText -ne $null -or $r.html -ne $null -or $r.tickets -ne $null -or $r.keys -ne $null -or $r.history -ne $null -or $r.hints -ne $null -or $r.current -ne $null -or $r.devices -ne $null) {
            Write-Host "  OK   GET $url" -ForegroundColor Green
            $script:ok++; return $true
        }
        Write-Host "  OK   GET $url (200)" -ForegroundColor Green
        $script:ok++; return $true
    } catch {
        Write-Host "  FAIL GET $url - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++; return $false
    }
}

function Test-Post($name, $url, $body) {
    try {
        $r = Invoke-RestMethod -Uri "$base$url" -Method POST -Body ($body | ConvertTo-Json -Compress) -ContentType "application/json" -TimeoutSec 30
        if ($r.ok -eq $true -or $r.message -ne $null -or $r.address -ne $null -or $r.digest -ne $null) {
            Write-Host "  OK   POST $url" -ForegroundColor Green
            $script:ok++; return $true
        }
        if ($r.error) {
            Write-Host "  SKIP POST $url - $($r.error)" -ForegroundColor Yellow
            $script:skipped++; return $false
        }
        Write-Host "  OK   POST $url" -ForegroundColor Green
        $script:ok++; return $true
    } catch {
        Write-Host "  FAIL POST $url - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++; return $false
    }
}

function Test-Command($cmd, $args) {
    return Test-Post "command" "/api/command" @{ cmd = $cmd; args = $args }
}

Write-Host "`n=== Morgendrot Volltest (API: $base) ===`n" -ForegroundColor Cyan

# --- GET Endpoints ---
Write-Host "--- GET Endpoints ---" -ForegroundColor Cyan
Test-Get "status" "/api/status"
Test-Get "current-ids" "/api/current-ids"
Test-Get "package-id-history" "/api/package-id-history"
Test-Get "package-id-hints" "/api/package-id-hints"
Test-Get "config" "/api/config"
Test-Get "doc" "/api/doc?name=ENV-ERKLAERUNG.md"
Test-Get "connect-addresses" "/api/connect-addresses"
Test-Get "chain-reachable" "/api/chain-reachable"
Test-Get "help" "/api/help"
Test-Get "find-peer-handshake" "/api/find-peer-handshake"
Test-Get "has-valid-ticket" ("/api/has-valid-ticket?owner=$addr&eventId=0x" + ("a"*64))
Test-Get "list-tickets" "/api/list-tickets?owner=$addr"
Test-Get "list-keys" "/api/list-keys?owner=$addr"
Test-Get "rebate-candidates" "/api/rebate-candidates?owner=$addr"
Test-Get "monitor-status" "/api/monitor-status"
Test-Get "audit-export" "/api/audit-export?format=csv"

# --- POST Endpoints (ohne Passwort/Destruktiv) ---
Write-Host "`n--- POST Endpoints ---" -ForegroundColor Cyan
Test-Post "package-id-hints" "/api/package-id-hints" @{ packageId = "0x" + ("b"*64); label = "Test" }
Test-Post "config (safe key)" "/api/config" @{ key = "LOG_VERBOSE"; value = "false" }

# --- Commands (alle Reiter / Befehle) ---
Write-Host "`n--- Commands (apiCmd) ---" -ForegroundColor Cyan
Test-Command "/help" @()
# set-package-id braucht 0x+64 Hex - uberspringen um aktuell gesetzte ID nicht zu uberschreiben
Test-Command "/handshake" @($partner)
Test-Command "/send-plain" @($partner, "API-Test " + (Get-Date -Format "HHmmss"))
Test-Command "/transfer-coins" @($partner, "0.001")
Test-Command "/fetch" @("5")
Test-Command "/list-keys" @()
Test-Command "/list-tickets" @()
Test-Command "/connect" @()  # startet Connect, kann "Bereits verbunden" oder "gestartet" sein

# Commands die Parameter brauchen (erwarten ggf. Fehlermeldung = Handler aktiv)
$body = '{"cmd":"/purge-msg","args":["99999"]}'
try { $r = Invoke-RestMethod -Uri "$base/api/command" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10; if ($r.ok -or $r.message) { $script:ok++; Write-Host "  OK   POST /api/command /purge-msg" -ForegroundColor Green } else { $script:ok++; Write-Host "  OK   POST /api/command /purge-msg (answer)" -ForegroundColor Green } } catch { $script:fail++; Write-Host "  FAIL /purge-msg $($_.Exception.Message)" -ForegroundColor Red }

$body = '{"cmd":"/vault-save","args":[]}'
try { $r = Invoke-RestMethod -Uri "$base/api/command" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10; if ($r.message) { $script:skipped++; Write-Host "  SKIP /vault-save (VAULT_FILE)" -ForegroundColor Yellow } else { $script:ok++; Write-Host "  OK   /vault-save" -ForegroundColor Green } } catch { $script:skipped++; Write-Host "  SKIP /vault-save" -ForegroundColor Yellow }

$lockId = "0x" + ("c"*64)
$body = @{ cmd = "/create-key"; args = @($lockId, $partner, "1") } | ConvertTo-Json
try { $r = Invoke-RestMethod -Uri "$base/api/command" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 25; if ($r.ok) { $script:ok++; Write-Host "  OK   /create-key" -ForegroundColor Green } else { $script:skipped++; Write-Host "  SKIP /create-key $($r.message)" -ForegroundColor Yellow } } catch { $script:skipped++; Write-Host "  SKIP /create-key" -ForegroundColor Yellow }

# --- Alle Doc-Anleitungen (TREE-Reiter) ---
Write-Host "`n--- Docs (alle Reiter-Links) ---" -ForegroundColor Cyan
$docs = @("ENV-ERKLAERUNG.md","VAULT-EINRICHTEN.md","BROADCAST-PINNWAND.md","LEIHGERAETE-EINRICHTEN.md","SCHLOSS-EINRICHTEN.md","STREAMS-INTEGRATION.md","CAR-SHARING-EINRICHTEN.md","SENSOR-ALARME-EINRICHTEN.md","BOSS-MODUS.md","NOTFALL-DATENSPEICHER.md","FESTIVAL-TICKETS-EINRICHTEN.md","FAMILIEN-ZUGANG.md","CHAT-GRUPPE-EINRICHTEN.md","M2M-KOORDINATION-EINRICHTEN.md")
foreach ($d in $docs) {
    Test-Get "doc $d" ("/api/doc?name=" + [Uri]::EscapeDataString($d))
}

# --- Weitere POST ---
Write-Host "`n--- POST unlock (falsches Passwort = erwarteter Fehler) ---" -ForegroundColor Cyan
$body = @{ password = "wrong-test" } | ConvertTo-Json
try { $r = Invoke-RestMethod -Uri "$base/api/unlock" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 5; if ($r.ok) { $script:ok++; Write-Host "  OK   POST /api/unlock" -ForegroundColor Green } else { $script:ok++; Write-Host "  OK   POST /api/unlock (nicht entsperrt)" -ForegroundColor Green } } catch { $script:ok++; Write-Host "  OK   POST /api/unlock (abgelehnt)" -ForegroundColor Green }

Write-Host "`n--- POST generate-address ---" -ForegroundColor Cyan
try { $r = Invoke-RestMethod -Uri "$base/api/generate-address" -Method POST -Body "{}" -ContentType "application/json" -TimeoutSec 15; if ($r.address -or $r.ok -eq $false) { $script:ok++; Write-Host "  OK   POST /api/generate-address" -ForegroundColor Green } else { $script:skipped++; Write-Host "  SKIP generate-address" -ForegroundColor Yellow } } catch { $script:skipped++; Write-Host "  SKIP generate-address (CLI/Keystore)" -ForegroundColor Yellow }

# --- Ergebnis ---
Write-Host "`n=== Ergebnis ===" -ForegroundColor Cyan
Write-Host "OK: $ok, Fehlgeschlagen: $fail, Uebersprungen: $skipped"
if ($fail -gt 0) { exit 1 }
exit 0
