# Messenger-Stapel exportieren – Felder & Optionen

Kontext: Boss-Lite-UI (**http://127.0.0.1:3342/**) → Abschnitt **„Messenger exportieren“** → ruft **`POST /api/messenger-export-batch`** auf. Ausgabe: **`exports/messenger-shipments/<Run>/u001…`**, **`boss-only/manifest.json`**.

Siehe auch: **`exports/README.md`**, **`README.md`** (Messenger-Bundles), **`docs/BOSS-MODUS.md`** (Remote-Signer).

---

## Warum maximal so viele Einheiten pro Lauf?

Die API begrenzt **`count`** pro Anfrage (technische Obergrenze im Server), weil:

- jede Einheit **Dateien** und ggf. **Chain-TXs** (z. B. Credits-Mint in Chunks) erzeugt;
- sehr große Stapel **RPC-Timeouts**, Speicher und Wartezeit in der UI riskieren;
- bei Problemen ist ein **zweiter Lauf** mit neuer **Run-ID** oft einfacher als ein riesiger Abbruch.

**Praxis:** Große Mengen in **mehreren Läufen** (z. B. 500 + 500 + …) oder die Obergrenze nutzen und danach **`assemble-messenger-units`** pro Run ausführen.

**Aktueller Code:** maximal **2500** Einheiten pro **`POST /api/messenger-export-batch`** (Server-Clamp in `api-server.ts`; UI-Eingabe ebenfalls bis 2500).

---

## Edition

| Wert | Bedeutung |
|------|-----------|
| **sales** | Kunden-Edition; optional **Messenger-Credits** pro Einheit minten (Boss zahlt Gas, viele TX). |
| **standalone** | Ohne NFT-Mint über diesen Stapel; Kunde konfiguriert mehr selbst. |

---

## PACKAGE_ID – Quelle (Boss / Eigene / Verlauf)

| Option | Bedeutung |
|--------|-----------|
| **Boss-.env (aktuell)** | Nutzt **`PACKAGE_ID`** aus der laufenden Boss-**`.env`**. |
| **Eigene ID** | Manuell **0x + 64 Hex** eintragen (z. B. anderes deploytes Paket). |
| **Verlauf (lokal)** | Liest **`readPackageIdHistory()`** – Datei **` .morgendrot-package-id-history`** (lokal gespeicherte frühere IDs). **„0 = jüngste“** = neuester Eintrag in der Historie, **1** = einer davor, usw. (siehe `resolveMessengerExportPackageId` in **`src/config.ts`**). |

---

## SIGNER (in der exportierten Kunden-.env)

| Wert | Bedeutung |
|------|-----------|
| **sdk** | Kunde entsperrt Wallet in der UI (Mnemonic/Passwort je nach Setup) – typisch für **Endnutzer-PC**. |
| **cli** | Signatur über **IOTA-CLI** auf dem Zielrechner (`SIGNER=cli`). |
| **remote** | Zielgerät hat **kein** volles Wallet; Transaktionen werden vom **Boss-Signer** signiert → **`REMOTE_SIGNER_URL`**, **`docs/BOSS-MODUS.md`**, **`npm run boss-signer`**. |

---

## Weitere Felder (Kurz)

| Feld | Zweck |
|------|--------|
| **Anzahl** | Wie viele Messenger-Einheiten (`.env` + ggf. Keys) in diesem Lauf. |
| **Namens-Prefix** | **`DEVICE_NAME`**-Präfix für Anzeige/Organisation. |
| **Run-ID** | Ordnername unter **`messenger-shipments`**; leer = Zeitstempel. |
| **Adressen in DEVICE_ROLES** | Boss-**.env** um neue **`messenger`**-Adressen ergänzen. |
| **Nur 1 Stück ins Bundle** | Schreibt **eine** Einheit direkt in **`exports/Morgendrot-Messenger-*`**. |
| **DEFAULT_TTL_DAYS im Export** | Optional in jede exportierte `.env` schreiben. |
| **MAILBOX_STORE_PLAINTEXT** | Optional `true` exportieren (braucht passendes Move-Paket). |
| **Credits-Felder (sales)** | Nur wenn **Mint** aktiv; Boss-Wallet für Mint-TXs. |

Nach dem Lauf (falls ZIP-Bundle gewünscht): **`npx tsx scripts/assemble-messenger-units.ts <Run> sales|standalone`** (siehe **`exports/README.md`**).
