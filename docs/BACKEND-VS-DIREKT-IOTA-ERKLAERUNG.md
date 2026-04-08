# Backend vs. „direkt zu IOTA“ — was genau gemeint ist

**Ziel:** Zwei verschiedene Fragen nicht vermischen: (1) **Geht die Transaktion über euren Hetzner?** (2) **Wo im Gerät werden TX gebaut und signiert?**

---

## 1. Kurzantwort

| Frage | Typische Antwort bei Morgendrot (Stand Repo) |
|--------|-----------------------------------------------|
| Muss ein **Morgendrot-Zentralserver** (z. B. Hetzner) dazwischen? | **Nein** für die **Chain**: `RPC_URL` zeigt auf **öffentliche oder eigene IOTA-Rebuilt-Nodes** — die signierte TX geht **dorthin**, nicht „über euren Shop“. |
| Braucht es **trotzdem einen laufenden Prozess**? | **Ja (heute):** die **Node-/API-App** (`npm start` / `npm run start:secrets` …) auf **demselben Rechner/CM4** wie üblich. |
| Ist das „direkt zu IOTA“? | **Am Netzwerk:** Nach dem Signieren spricht der Prozess **direkt** mit der Chain über **RPC** — das **ist** der normale Weg zu IOTA. **In der Architektur:** Die **Browser-UI** (Next) baut **nicht** selbst die TX; sie ruft **`/api/*`** auf → **Backend** baut und signiert. |

**Wichtig:** „Nicht direkt“ bezieht sich hier auf **Client vs. Backend auf dem Gerät** — **nicht** darauf, dass IOTA nur über einen **fremden Morgendrot-Host** erreichbar wäre.

---

## 2. Was der „lokale Backend“ konkret ist

- **`npm run start:secrets`** (und ähnliche Startskripte) starten den **Morgendrot-Node**: HTTP-API (typisch Port **3342**), dazu Logik in **`src/`** (`api-server`, `chain-access`, `wallet-bridge`, Messenger-Handler, …).
- Das **Backend**:
  - nimmt Anfragen von **Lite-UI (`ui/`)** und **Next (`frontend/`)** entgegen;
  - lädt **Wallet/Signer** (z. B. aus `.env`, Vault, verschlüsselter Env);
  - **baut und signiert** Transaktionen;
  - sendet sie an **`RPC_URL`** (und ggf. weitere RPCs über Rotation).

Die **Web-Oberfläche** ist bewusst **dünn**: eine **gemeinsame API** (`/api/*`), siehe **`docs/DEV-START.md`**.

---

## 3. Unterschied zu „alles in der App ohne Backend“

| Aspekt | Aktuell (Backend + UI) | Rein „im Browser / nur App“ (Zielbild) |
|--------|-------------------------|----------------------------------------|
| **TX bauen & signieren** | Node-Prozess (`src/`) | Müsste im **Browser** (WASM, Wallet-Extension, …) oder auf einem **anderen** dedizierten Signer laufen |
| **Secrets** | typisch im **Backend-Prozess** (geschützter Kontext) | anderes Threat-Model; mehr UX-/Sicherheitsaufwand |
| **Streams-Bridge, HMAC-Gateway, komplexe Pfade** | einfacher am **einen** Node | verteilt oder anders modularisieren |

**Fazit:** Der aktuelle Weg ist **kein** „Umweg über IOTA“, sondern ein **üblicher Split**: **UI = Steuerung**, **Node = Signatur + Chain-Zugriff**. Der **Netzweg zur Chain** bleibt **RPC → IOTA**.

---

## 4. Korrektur zu pauschalen Formulierungen

- **„Nicht voll dezentral / Basis nicht unabhängig“** — zu ungenau: Die Basis hängt **nicht** zwingend von **eurem** VPS ab, sondern von **eigener** Node-Instanz, **RPC-Erreichbarkeit**, **Gas/Credits/MIST** und der **Move-Konfiguration** (`PACKAGE_ID`, …). **Dezentral** im Sinne „kein zentraler Betreiber“ kann trotzdem stimmen, wenn alle **eigenen** Nodes + öffentliche RPC nutzen.
- **„Direkt zu IOTA = keine Server“** — irreführend: **Jede** Light-Client-Lösung spricht mit **einem RPC-Node**; der ist auch ein „Server“, nur **nicht eurer**.

---

## 5. Verwandte Doku

- **`docs/DEV-START.md`** — Ports, wer `/api` nutzt.  
- **`docs/CONFIG-REFERENCE.md`** / **`RPC_URL`** — Chain-Endpunkt.  
- **`docs/DEPLOY-SERVER-MESSENGER-ABGRENZUNG.md`** — gleiche `src/`-App, kein separater „Messenger-Server-Ordner“.  
- Credits/Shop: oft **Hybrid** (Chain-Objekt + ggf. **eure** HTTP-API für Kauf/Provisioning) — siehe **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** u. a.

---

*Stand: 2026-03-28 — präzisiert die Alltagsformulierung „läuft über Backend, nicht direkt zu IOTA“.*
