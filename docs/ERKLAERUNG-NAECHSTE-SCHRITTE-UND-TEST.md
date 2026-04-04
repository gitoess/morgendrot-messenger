# Erklärung: Nächste Schritte & Real-World-Test

## Was war mit „Steuerung anbinden“ und „Timeline-Filter“ gemeint?

### Steuerung anbinden

- **Gemeint:** Die Links „Steuerung“, „+ Gerät hinzufügen“, „Wizard“, „Befehle & Rolle“ zeigten auf **/steuerung.html** und **/lite/index.html**. Diese Dateien gibt es im Repo **nicht** – die Steuerung (Boss-View) lebt in **index.html** als Ansicht `view === 'boss'`.
- **Umgesetzt:** Links zeigen jetzt **in die App**:
  - **#boss** öffnet die Steuerung (Geräte, Rollen, Provisioning) in derselben Seite.
  - Beim Laden wird `location.hash` ausgewertet (`#boss`, `#steuerung`, `#chat`, …), sodass z. B. `index.html#boss` direkt die Boss-Ansicht öffnet.
  - „Lite“ führt zur Startseite `/`, da eine separate Lite-UI hier nicht vorhanden ist.

### Timeline-Filter

- **Gemeint:** In der rechten Spalte „Verlauf“ werden aktuell **alle** Audit-Ereignistypen (Alarm, Heartbeat, Purge, Sensor, Offline, Escalation) gemischt angezeigt.
- **Mögliche Ergänzung:** Filter (z. B. Tabs oder Dropdown): „Alle | Alarm | Heartbeat | Purge | Sensor“, damit man nur relevante Einträge sieht. Noch **nicht** umgesetzt; kann bei Bedarf ergänzt werden.

---

## Kompletter Real-World-Test auf einem PC

**Ja, das geht an einem PC.** Du brauchst:

1. **Eine laufende Morgendrot-Instanz** (ein Backend mit Wallet, z. B. `npm run dev` oder `npm run start:secrets`).
2. **Browser** für die UI (ein Tab reicht; Rollen wechselst du per „Boss / Kommandant / Arbeiter“).
3. **Optional:** Zweite Instanz auf anderem Port (z. B. 3345), um echte Zwei-Wallet-Szenarien (Nachrichten zwischen A und B, Handshake, etc.) zu testen.

Auf **einem** PC mit **einer** Instanz kannst du u. a. testen:

- **Arbeiter „erstellen“:** Rolle Boss → Gerät hinzufügen (Adresse eintragen, WORKER_ADDRESSES wird gesetzt) oder Wizard durchspielen.
- **Aktion auslösen:** Befehle senden (`/boss-command`), Heartbeat, Keys/Tickets erstellen, Nachrichten senden (z. B. an eigene Adresse oder Testadresse).
- **Nachrichten:** Handshake, Connect, Senden (Klartext/Verschlüsselt), Posteingang.
- **Heartbeat:** Als Arbeiter Heartbeat senden, als Boss Geräte-Status/Monitor prüfen.
- **IOTA Streams:** Kanal erstellen/abonnieren, Publish/Fetch (wenn Streams-Bridge konfiguriert ist).
- **Rebate:** Keys/Tickets/Handshakes/Messages anzeigen, Purge (einzeln oder abgelaufen).

Die **Test-Skripte** im Repo decken genau diese Flows ab; sie rufen die API direkt auf (ohne Browser). Für einen „kompletten“ Durchlauf siehe unten.

---

## Test-Übersicht (alle erdenklichen Tests)

| Kategorie | Was wird getestet | NPM-Skript / Hinweis |
|----------|-------------------|----------------------|
| **Ein Wallet (Boss-Szenario)** | Rolle, Keys, Rebate, Heartbeat, Boss-Command, Kommandant/Pinnwand, Arbeiter-Inbox, Transfer, Handshake, Tickets, Vault, Purge, Chain-Reachable | `npm run test:boss-scenario` |
| **Alle 9 Kacheln (2 Wallets)** | Chat, Tickets & Schlüssel, Schloss, Sensor-Alarm, Überwachung, Zahlung, Pinnwand, Tresor, Boss | `npm run test:all-tiles` oder `npm run test:kacheln` |
| **Nachrichten/Chat** | Handshake, Connect, Senden, Empfangen | `npm run test:messages` |
| **Tickets & Keys (Real-World)** | Erstellen, Einlösen, Rebate | `npm run test:realworld` oder `npm run test:tickets-keys` |
| **Szenarien (2 Wallets)** | Verschiedene User-Stories | `npm run test:scenarios` |
| **Lite-UI** | Lite-spezifische Flows | `npm run test:lite-ui` |
| **Stress / Sicherheit** | Last, Sicherheits-Checks | `npm run test:stress`, `npm run test:security` |

**Ein Durchlauf „alles auf einem PC“** kann so aussehen:

1. Backend starten: `npm run start:secrets` (oder `npm run dev`).
2. Wallet entsperren (im Browser oder per API).
3. **Ein-Wallet-Test:** `npm run test:boss-scenario` (deckt Boss, Arbeiter, Rebate, Heartbeat, Nachrichten, Streams-Anbindung, Vault, etc.).
4. **Optional mit zweiter Instanz:** Zwei Backends (z. B. 3342 + 3345), dann `npm run test:all-tiles` oder `npm run test:kacheln`.
5. **UI manuell:** Im Browser Rollen wechseln, Gerät hinzufügen (#boss), Nachrichten senden, Heartbeat, Streams, Rebate-Tabelle prüfen.

Ein **Master-Skript**, das die wichtigsten Tests nacheinander ausführt, liegt unter `scripts/run-full-realworld-suite.ts` (siehe nächster Abschnitt).

---

## Master-Test-Suite (ein Befehl)

Das Skript **scripts/run-full-realworld-suite.ts** führt nacheinander aus:

1. **Server-Check** (API erreichbar?)
2. **test:boss-scenario** (logisch eingebaut: gleiche Schritte wie im Boss-Szenario)
3. Optional: **test:messages** oder **test:realworld**, wenn zweite API-URL gesetzt ist

Aufruf (ein PC, eine Instanz):

```bash
npm run start:secrets
# In anderem Terminal (nach Entsperren):
npm run test:full-realworld
```

Mit zwei Instanzen (z. B. 3342 + 3345):

```bash
API_BASE_A=http://127.0.0.1:3342 API_BASE_B=http://127.0.0.1:3345 npm run test:all-tiles
```

Wenn du willst, können wir als Nächstes den **Timeline-Filter** (nur Alarm/Heartbeat) ergänzen oder einzelne Test-Schritte gezielt durchgehen.
