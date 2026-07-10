# Security — Morgendrot Messenger

**Stand:** 2026-07-10

Dieses Dokument beschreibt **Annahmen, Schutzmaßnahmen und verbleibende Risiken** des experimentellen Hobby-Messengers. Für verantwortliche Meldung von Schwachstellen siehe unten § Meldung.

---

## Annahmen (Threat Model, Kurz)

| Annahme | Bedeutung |
|---------|-----------|
| **Hobby / kein Produkt** | Keine Audit-Zertifizierung, kein SLA, keine Garantie auf Signal-Niveau-E2EE. |
| **Boss-LAN** | Typischer Einsatz: Boss-PC bindet API auf WLAN (`API_BIND_HOST=0.0.0.0`), Handy/APK greift per LAN-IP zu. |
| **Vertrauenswürdiges WLAN** | Angreifer im gleichen WLAN ohne Token gelten als realistisches Risiko — nicht als „unmöglich“. |
| **Secrets auf Geräten** | Seed, Vault-Passwort, Handoff-ZIP, `API_AUTH_TOKEN` liegen beim Operator — Verlust = Kompromittierung. |
| **IOTA / Dritte** | RPC, Explorer, Telegram, Stripe sind außerhalb des Projekt-Scopes. |

---

## Schutzmaßnahmen (Ist-Stand 2026-07)

### LAN-API (`API_AUTH_TOKEN`)

Wenn die API **nicht nur auf Loopback** bindet (`API_BIND_HOST=0.0.0.0`, feste LAN-IP, …):

- **POST / PUT / PATCH / DELETE** erfordern **Loopback** oder gültiges **`API_AUTH_TOKEN`** (Header `Authorization: Bearer …` oder `X-Morgendrot-Api-Token`).
- **GET** bleibt ohne Token erreichbar (Status, Config-Lesen, …) — Inhalte können trotzdem sensibel sein; LAN-Zugriff einschränken.
- **Ausnahmen:** Drittanbieter-Webhooks (`/api/integrations/telegram/webhook`, `/api/shop/webhook/stripe`) — eigene Secrets.
- **Startup-Warnung**, wenn LAN-Bind ohne gesetztes Token.
- **Handoff** exportiert `API_AUTH_TOKEN` optional; Client speichert es in `localStorage` und sendet es bei Mutationen (`fetchApiText`, `fetchWithApiAuth`).

Nur **localhost** (`API_BIND_HOST=127.0.0.1`): Mutationen ohne Token von anderen LAN-Hosts nicht erreichbar (Verbindung scheitert).

### Sendepfad & Klartext

- Verschlüsselter Send (`/send`, E2EE): **kein** Klartext-Spiegel on-chain (auch bei `ENABLE_PLAINTEXT_CHANNEL=true`) — siehe `docs/KLARTEXT-P1-PLAINTEXT-POLICY.md`.
- Offline-Queue `encrypted_send`: nur Ciphertext-Wire v1; Legacy-Klartext wird verworfen.
- **`plain_send` in der Offline-Queue** und **`/send-plain`**: bewusst Klartext (localStorage bzw. Chain) — nur mit Flag/Modus nutzen.

### Boss-Signer (Remote)

- Bearer-Token, Bind-Host, Adress-Allowlist, Rate-Limit.
- **PTB-Policy `worker-messenger`:** nur erlaubte `messaging::*`-Funktionen auf `PACKAGE_ID` — kein Blind-Signing von Keys/Mint/Transfer.
- Policy `off` nur mit `BOSS_SIGNER_ALLOW_INSECURE=1` (Entwicklung).

### Vault & Commands

- Vault-Secret- und Debug-Befehle (`/vault-ecdh-jwk`, `/vault-debug-chain`, …): zusätzlich geschützt (Token/Loopback), auch wenn nur localhost — konsistente Fehlermeldung.
- Hierarchie-Rollen: Boss/Kommandant/Arbeiter-Gates für Schlüssel ausstellen, Purge, Sponsoring.

### CORS

- `API_STRICT_CORS=true`: Cross-Origin von anderer LAN-IP blockiert (evil.html → Boss-API).

---

## Verbleibende Risiken (offen / bewusst)

| Risiko | Schwere | Hinweis |
|--------|---------|---------|
| **GET ohne Token auf LAN** | Mittel | Status, Inbox-ähnliche Endpunkte lesbar im WLAN |
| **PTB-Allowlist zu breit** | Mittel | `purge_*`, `use_ticket`, Klartext-Store im `worker-messenger`-Set |
| **`plain_send` Queue** | Mittel | Klartext in `localStorage` bis Drain |
| **`ENABLE_PLAINTEXT_CHANNEL`** | Mittel | Bewusster Klartext-Kanal; Handoff-Messenger-Export setzt teils noch `true` |
| **Kein E2E-Test-Suite** | Niedrig (Qualität) | SOS, Handoff, Offline-Drain nicht automatisiert in CI |
| **On-Chain Pass 4** | Variabel | Purge/AccessKey/Emergency/Sponsored-Limits in Move + `chain-access` |
| **Komplexität** | Betrieb | Viele Env-Flags, Hybrid-Pfade, Signer-Modi — Fehlkonfiguration wahrscheinlich |

---

## Konfigurations-Checkliste (Feldtest / Boss)

```env
API_BIND_HOST=0.0.0.0
API_AUTH_TOKEN=<mindestens-16-Zeichen-zufällig>
API_STRICT_CORS=true

BOSS_SIGNER_TOKEN=<gleich-wert-wie-REMOTE_SIGNER_TOKEN>
BOSS_SIGNER_BIND_HOST=0.0.0.0
BOSS_SIGNER_ALLOWED_ADDRESSES=0x<gerät1>,0x<gerät2>
BOSS_SIGNER_PTB_POLICY=worker-messenger

REMOTE_SIGNER_URL=http://<boss-ip>:3340/sign
REMOTE_SIGNER_TOKEN=<wie-oben>

ENABLE_PLAINTEXT_CHANNEL=false
```

Handoff erneut exportieren, damit Helfer-Geräte das Token erhalten.

---

## Meldung von Schwachstellen

### Scope

Backend, Next/Capacitor-Client, gemeinsame Krypto-/Transport-Schicht dieses Repositories.

### Supported versions

Nur **letzter Tag** auf dem Default-Branch und neuestes **experimentelles** GitHub-Release (`v*-experimental`) — best effort.

### Reporting

1. **Bevorzugt:** [GitHub Security Advisories](https://github.com/gitoess/morgendrot-messenger/security/advisories/new) (privat).
2. **Alternativ:** Issue mit Label **security**, wenn nicht produktionsrelevant exploitbar (Doku, Hardening-Ideen).

Bitte angeben: betroffene Komponente, Reproduktion, Impact (Vertraulichkeit / Integrität / Verfügbarkeit).

### What to expect

- Hobby-Projekt — kein Bug Bounty, kein SLA.
- Best-effort-Antwort innerhalb von **14 Tagen**, wenn möglich.
- Fixes zuerst auf `main`; Releases manuell.

### Out of scope

- Verlorene Seeds / Handoff-ZIPs auf Nutzergeräten
- Fehlkonfiguration von `.env`, RPC, Boss-Exports
- Drittanbieter (IOTA-Netzwerk, Meshtastic, Telegram API)

### Safe harbor

Good-faith-Forschung ohne Datenschutzverletzung und ohne Service-Störung ist willkommen. Nicht gegen Dritte ohne Erlaubnis testen.
