# Nach dem Publish: Package-ID setzen

Nach `iota client publish` aus `move-test/` musst du die **neue Package-ID** im Backend verwenden (nicht die Sender-Adresse).

## Erledigt in dieser Session

1. **Package deployt** – Publish war erfolgreich.
2. **Neue Package-ID:** `0xd0911511a1d4dbf0e375dd8eb861243beb10df8f6ae1629a874f331e6e208b7e`
3. **Datei** `.morgendrot-package-id` im Projektroot enthält diese ID (wird beim Start gelesen, wenn `PACKAGE_ID` in der .env fehlt).

## Damit Chain-Tests (z. B. Tiles) grün laufen

1. **Alle Backend-Instanzen beenden** (nur eine Instanz soll laufen, sonst kann die falsche Config aktiv sein).
2. **In der .env des Backends:**
   - Entweder **PACKAGE_ID** auf die neue ID setzen:
     ```env
     PACKAGE_ID=0xd0911511a1d4dbf0e375dd8eb861243beb10df8f6ae1629a874f331e6e208b7e
     ```
   - Oder die Zeile **PACKAGE_ID=** entfernen/auskommentieren – dann liest das Backend die ID aus `.morgendrot-package-id`.
3. **Backend neu starten** (z. B. `npm run start:secrets`).
4. **Wallet entsperren** (falls nötig).
5. **Test ausführen:**
   ```bash
   TILES_QUICK=1 npm run test:tiles-combinations
   ```
   Oder: `npx tsx scripts/set-package-id-then-tiles.ts` (setzt PACKAGE_ID per API und startet den Tiles-Test – sinnvoll, wenn das Backend schon mit der richtigen ID aus .env/.morgendrot-package-id gestartet wurde).

## Hinweis

Die Fehlermeldung „Dependent package not found: 0x671b…“ bezieht sich auf die **Package-ID**, die das Backend beim Bauen der Transaktion verwendet. `0x671b…` ist deine **Sender-Adresse** (MY_ADDRESS), keine gültige Package-ID. Sobald das Backend mit der echten Package-ID `0xd091…` startet (oder sie per API setzt und nur eine Instanz läuft), sollten die Chain-Tests durchlaufen.

---

## Tiles-Test: Zutritt / Tickets / Streams / Device

- **Streams:** Ohne `STREAMS_BRIDGE_URL` werden Streams-Aktionen im Tiles-Test **übersprungen** (nicht als Fehler gezählt). Für volle Streams-Tests: `npm run streams-mock` in einem zweiten Terminal, dann `STREAMS_BRIDGE_URL=http://127.0.0.1:9343` in der .env oder per API setzen.
- **Zutritt/Tickets:** Der Test nutzt die Boss-Adresse als Lock und Empfänger. `LOCK_ID` in der .env ist optional (Fallback: MY_ADDRESS). Viele create-key/create-ticket hintereinander können an **Gas** scheitern – ausreichend Gas-Coins oder längere Delays (`TILES_ONCHAIN_DELAY_MS`, `TILES_ONCHAIN_SETTLE_MS`) helfen.
- **Device:** Rollen-Befehle und boss-command laufen mit `ROLE=boss` (ROLE_ID 14). Verbleibende Fehler können an fehlenden Worker-Adressen oder Monitor-Konfiguration liegen; „nicht konfiguriert“-Meldungen zählen im Tiles-Skript als **skipped**, nicht als failed.
