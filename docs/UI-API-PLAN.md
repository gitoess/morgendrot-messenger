# Morgendrot UI-API – Implementierungsplan

Plan für die Verbindung der Offline-UI mit dem Wallet-Backend. Die UI soll Befehle ausführen und Chat-Nachrichten anzeigen, statt nur Befehle zu kopieren.

---

## 1. Architektur-Übersicht

```
┌─────────────────┐         HTTP/WebSocket          ┌─────────────────────┐
│   Browser UI    │ ◄─────────────────────────────► │  Morgendrot Backend  │
│  (ui/index.html)│    127.0.0.1:3341 (UI)         │  (wallet-bridge.ts)  │
│                 │    127.0.0.1:3342 (API)         │  + API-Server        │
└─────────────────┘                                 └─────────────────────┘
                                                              │
                                                              ▼
                                                    ┌─────────────────────┐
                                                    │  IOTA Chain / CLI   │
                                                    │  Vault, Signer      │
                                                    └─────────────────────┘
```

- **UI-Port (3341)**: Statische Dateien (HTML, CSS, JS)
- **API-Port (3342)**: REST + WebSocket für Befehle und Chat
- **Sicherheit**: Beide nur auf `127.0.0.1` – kein Zugriff von außen

---

## 2. Phasen

### Phase 1: API-Grundgerüst (MVP)

**Ziel:** Backend exponiert einen HTTP-Server mit Status-Endpoint.

| Schritt | Beschreibung |
|--------|--------------|
| 1.1 | Neues Modul `src/api-server.ts` – Express oder Node `http` |
| 1.2 | Endpoint `GET /api/status` → `{ connected: boolean, myAddress?: string, partnerAddress?: string }` |
| 1.3 | API startet nur wenn `ENABLE_UI=true` und Messenger-Modus (nicht Lock/Monitor) |
| 1.4 | Config: `API_PORT=3342` (Standard) |

**Abhängigkeit:** Kein geteilter State nötig – Status kann aus `CFG` gelesen werden.

---

### Phase 2: Shared State & Connect-Flow

**Ziel:** UI kann prüfen, ob das Backend bereit ist, und „Connect“-Status anzeigen.

| Schritt | Beschreibung |
|--------|--------------|
| 2.1 | **Shared State** – Objekt `sessionState` in `wallet-bridge.ts`: `{ myKeys, peerMap, useVault, vaultPath, MY_ADDR, connected }` |
| 2.2 | `GET /api/status` erweitern: `connected`, `myAddress`, `partnerCount`, `hasKeys` |
| 2.3 | UI: Grüner Button = „Connect“ – zeigt Status, klicken öffnet Hinweis „Backend muss laufen (npm run dev)“ |
| 2.4 | Optional: `GET /api/config` (maskierte Werte aus `getConfigDisplay()`) |

**Herausforderung:** Passwort und Keys werden erst nach Start eingegeben. Status „nicht verbunden“ = Backend läuft, aber noch nicht im Chat.

---

### Phase 3: Befehle per API

**Ziel:** UI-Buttons rufen Backend-Befehle auf statt nur zu kopieren.

| Schritt | Beschreibung |
|--------|--------------|
| 3.1 | **Command Dispatcher** – Funktion `executeCommand(cmd, args)` die die bestehende Logik aus der readline-Schleife nutzt |
| 3.2 | Refaktor: Terminal-Befehle in wiederverwendbare Funktionen auslagern (z.B. `handleVaultSave()`, `handlePurgeHandshake()`) |
| 3.3 | `POST /api/command` mit Body `{ cmd: string, args: string[] }` |
| 3.4 | Response: `{ ok: boolean, message?: string, error?: string }` |
| 3.5 | UI: Klick auf Befehlskarte → API-Call statt Copy |

**Befehle für Phase 3 (nur nach /connect):**

- `/vault-save`, `/vault-onchain`
- `/purge-handshake`, `/purge-msg`, `/emergency-purge`
- `/create-key`, `/create-keys`, `/emergency-purge-key`, `/purge-key`
- `/fetch` (mit Parameter n)

**Befehle vor /connect:**

- `/set-package-id` (aus CFG)
- `/handshake`, `/connect` (spezielle Behandlung, s. Phase 4)

---

### Phase 4: Connect & Handshake per API

**Ziel:** Verbindung und Handshake über die UI starten.

| Schritt | Beschreibung |
|--------|--------------|
| 4.1 | `POST /api/handshake` mit `{ address: string }` → ruft `sendHandshake()` auf |
| 4.2 | `POST /api/connect` mit `{ address?: string }` → startet Connect-Loop (wartet auf Handshake) |
| 4.3 | Connect ist asynchron (kann Sekunden dauern) → **WebSocket** oder **Long Polling** für Fortschritt |
| 4.4 | `GET /api/connect-status` oder WebSocket-Event: `{ status: 'waiting'|'connected'|'error', message?: string }` |

**Alternative:** Connect weiter im Terminal, UI nur für Befehle nach dem Connect. Reduziert Komplexität.

---

### Phase 5: Chat in der UI

**Ziel:** Nachrichten senden und empfangen über die UI.

| Schritt | Beschreibung |
|--------|--------------|
| 5.1 | **WebSocket** `/ws` – Verbindung zum Backend |
| 5.2 | Backend: Listener (`listenForMessages`) pusht neue Nachrichten an WebSocket-Clients |
| 5.3 | UI sendet: `{ type: 'send', text: string }` → Backend ruft `sendEncryptedMessage()` auf |
| 5.4 | UI empfängt: `{ type: 'message', sender, text, timestamp }` |
| 5.5 | Chat-Bereich in der UI (wie im Beispiel) mit Nachrichtenliste und Eingabefeld |

**Refaktor:** `listenForMessages` erhält optionalen Callback für neue Nachrichten, zusätzlich zu `console.log`.

---

### Phase 6: Passwort & Session

**Ziel:** Sichere Session-Verwaltung.

| Schritt | Beschreibung |
|--------|--------------|
| 6.1 | Passwort wird weiter nur im Terminal eingegeben (nicht in der UI) |
| 6.2 | API prüft: Wenn `sessionState` keine Keys hat → `401 Unauthorized` für Befehle |
| 6.3 | Optional: Einfaches **Session-Token** (z.B. UUID), das beim Start generiert und in der UI-URL als Query-Parameter übergeben wird – verhindert Zugriff von anderen Tabs |
| 6.4 | CORS: Nur `Origin: http://127.0.0.1:3341` erlauben |

---

## 3. Technische Details

### API-Server (ohne Express)

```ts
// src/api-server.ts – Minimal mit Node http
import http from 'node:http';

export function startApiServer(getState: () => SessionState): http.Server {
  const server = http.createServer((req, res) => {
    // CORS-Header für UI
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3341');
    if (req.method === 'OPTIONS') return res.end();

    if (req.url === '/api/status' && req.method === 'GET') {
      const state = getState();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        connected: !!state.peerMap?.size,
        myAddress: state.MY_ADDR ? state.MY_ADDR.slice(0, 14) + '…' : null,
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(3342, '127.0.0.1');
  return server;
}
```

### WebSocket (Phase 5)

```ts
import { WebSocketServer } from 'ws'; // oder 'ws' package

const wss = new WebSocketServer({ port: 3343, host: '127.0.0.1' });
wss.on('connection', (ws) => {
  // Neue Nachricht vom Listener → an alle Clients senden
  onNewMessage((msg) => ws.send(JSON.stringify({ type: 'message', ...msg })));
});
```

### UI-Anpassung (Connect-Button)

```html
<!-- Grüner Button wird funktional -->
<button id="connect-btn" class="icon-btn connect-status">
  <span id="connect-label">Verbinden</span>
</button>

<script>
  async function checkStatus() {
    const res = await fetch('http://127.0.0.1:3342/api/status');
    const data = await res.json();
    document.getElementById('connect-label').textContent =
      data.connected ? 'Verbunden' : 'Nicht verbunden';
  }
  setInterval(checkStatus, 5000);
</script>
```

---

## 4. Abhängigkeiten

| Phase | Neue npm-Pakete | Geschätzte Zeit |
|-------|-----------------|-----------------|
| 1 | keine | 1–2 h |
| 2 | keine | 1 h |
| 3 | keine | 2–3 h |
| 4 | keine | 2–3 h |
| 5 | `ws` (WebSocket) | 3–4 h |
| 6 | keine | 1 h |

**Gesamt:** ca. 10–14 h

---

## 5. Empfohlene Reihenfolge

1. **Phase 1** – API-Grundgerüst, Status-Endpoint
2. **Phase 2** – Shared State, UI zeigt Connect-Status
3. **Phase 3** – Befehle per API (ohne Connect/Handshake)
4. **Phase 5** – Chat (WebSocket) – größter Nutzen
5. **Phase 4** – Connect/Handshake per API (optional)
6. **Phase 6** – Session-Sicherheit

---

## 6. Risiken & Einschränkungen

- **Passwort:** Bleibt Terminal-only – keine Übertragung in die UI
- **SIGNER=cli:** IOTA-CLI muss lokal laufen; Remote-Signer (Boss) funktioniert unverändert
- **Lock/Monitor:** API nur für Messenger-Modus; Lock hat eigene Logik
- **Offline:** UI funktioniert offline als Referenz; API braucht laufendes Backend
