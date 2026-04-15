# Backend vs. „direkt zu IOTA“ — was genau gemeint ist

**Ziel:** Zwei verschiedene Fragen nicht vermischen: (1) **Geht die Transaktion über euren Hetzner?** (2) **Wo werden TX gebaut und signiert — und braucht es einen Morgendrot-Node?**

**Stand:** **2026-04-28** — **Primär-Produktentscheid** aktualisiert (**§ 6**). Die Fassung von **2026-03-28** steht als **§ 7 (historisch)**. Vollständiger Umsetzungsplan: **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, Fahrplan **`docs/ROADMAP-FAHRPLAN.md`** **§ H.15**.

---

## 1. Kurzantwort (Zielbild vs. Übergang im Code)

| Frage | **Zielbild (ab 2026-04-28, Produkt)** | **Übergang / Repo-Ist (bis Umsetzung)** |
|--------|----------------------------------------|----------------------------------------|
| Muss ein **Morgendrot-Zentralserver** (z. B. Hetzner) dazwischen? | **Nein** für die **Chain** — weder zentral noch **Pflicht**; Client spricht mit **`RPC_URL`** (öffentlich oder eigen). Optionale **Relay-/Sponsor-API** nur wenn der Nutzer sie nutzt. | Wie Zielbild für **Netzweg zur Chain**; viele Flows noch über **lokalen** `/api`-Node. |
| Braucht es einen **Morgendrot-Node** (`src/`, Port **3342**)? | **Nein als Pflicht.** **Optional** für Relay, Sponsored Gas, Archiv, Boss-Werkstatt, komplexe Provisioning-Pfade. | **Ja (heute im Code):** UI ruft **`/api/*`** auf → Node baut/signiert typisch noch mit. |
| Ist das „direkt zu IOTA“? | **Ja:** Gerät **signiert** und sendet **PTB/TX** an **IOTA-RPC** — **ohne** zwingenden Morgendrot-HTTP-Node. („Direkt“ = nicht über Morgendrot-Relay; **RPC-Node** bleibt technischer Gegenpart.) | **Teilweise:** Chain-Zugriff geht über Node-Prozess; Browser ist dünn. |

**Wichtig:** „Nicht direkt“ in **alter** Lesart bezog sich auf **Browser vs. Node auf demselben Rechner** — **nicht** darauf, dass IOTA nur über einen **fremden Morgendrot-Host** erreichbar wäre.

---

## 2. Was der „Morgendrot-Node“ (Legacy-Pfad) konkret ist

- **`npm run start:secrets`** (und ähnliche Startskripte) starten den **Morgendrot-Node**: HTTP-API (typisch Port **3342**), Logik in **`src/`** (`api-server`, `chain-access`, `wallet-bridge`, Messenger-Handler, …).
- Das **Backend** (Relay-/Komfort-Pfad):
  - nimmt Anfragen von **Lite-UI (`ui/`)** und **Next (`frontend/`)** entgegen;
  - lädt **Wallet/Signer** (z. B. aus `.env`, Vault, verschlüsselter Env);
  - kann **bauen und signieren** sowie an **`RPC_URL`** senden — **so lange** der Client diesen Pfad wählt.

Die **Web-Oberfläche** bleibt vorerst oft **dünn** und spricht **`/api/*`** — **`docs/DEV-START.md`**. Mit **Handy-first**-Umsetzung übernimmt der **Client** schrittweise Bau/Signatur; der Node wird zum **optionalen** Dienst.

---

## 3. Zielbild: Client vs. optionaler Node

| Aspekt | **Ziel (Handy-first)** | **Optionaler Morgendrot-Node / Relay** |
|--------|-------------------------|----------------------------------------|
| **TX bauen & signieren** | **Primär** auf dem **Gerät** (Browser oder native Schicht), über **`@morgendrot/core`** (geplant) | Relay: Server signiert **mit** hinterlegtem Material nur wenn Nutzer **Relay-Modus** wählt |
| **Secrets** | Gerät-Custody (Vault-UX, Härtung **§ H.14**) | Server-seitige Secrets nur für **opt-in**-Relay/Sponsor |
| **Streams-Bridge, HMAC-Gateway, komplexe Pfade** | Im Client **oder** über **opt-in** Relay — **kein** Pflicht-Split mehr „nur Node“ | Weiterhin sinnvoll für **Boss-Werkstatt**, Bulk, Gas-Station |

**Fazit:** Der **Netzweg zur Chain** bleibt **RPC → IOTA**. Die **Produktentscheid** verschiebt **Pflicht-Custody und Signatur** vom **Morgendrot-Node** auf das **Handy**; der Node wird **Komfort- und Einsatz-Option**.

---

## 4. Korrektur zu pauschalen Formulierungen

- **„Nicht voll dezentral / Basis nicht unabhängig“** — zu ungenau: Es geht um **Wahl des RPC**, **Custody am Gerät**, und **ob** Morgendrot-HTTP dazwischen **muss** (**nein** im Zielbild).
- **„Direkt zu IOTA = keine Server“** — irreführend: **RPC-Endpoints** sind Server; sie sind nur **nicht** der Morgendrot-Node, sofern der **Direct**-Pfad aktiv ist.

---

## 5. Verwandte Doku

- **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** — Umsetzungsstufen, Schalter, Core-Paket.  
- **`docs/DEV-START.md`** — Ports, Rewrites während Übergang.  
- **`docs/CONFIG-REFERENCE.md`** / **`RPC_URL`**.  
- **`docs/DEPLOY-SERVER-MESSENGER-ABGRENZUNG.md`**.  
- **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**, **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`**.  
- **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**).  
- **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`**.

---

## 6. Produktentscheid (gültig ab 2026-04-28) — Handy-first, optionaler Node

**Festgelegt:**

1. **Primärpfad** = **Client-seitige Signierung** + **direkter Upload** zum **IOTA-Netzwerk** über konfigurierbare **RPC** — **ohne** zwingenden separaten **Morgendrot-Node**.
2. **Local-first:** Nachrichten **lokal speichern, signieren und puffern**; Auslieferung/Settlement gemäß **§ H.12** und Delayed-Upload-Specs.
3. **Morgendrot-Node / `/api`** ist **optional**: z. B. **Sponsored Gas**, **Archivierung**, **Komfort**, **Boss-Werkstatt** (`ui/`), schwere **Provisioning**-Flows.
4. In der **App**: Schalter **„Direkt ins IOTA senden“** (**Standard = an**) vs. **„Morgendrot Relay benutzen“** (**opt-in**).

**Umsetzung:** **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** (Stufen 0–4), **`docs/ROADMAP-FAHRPLAN.md`** **§ H.15** — schrittweise; **kein** paralleler Big-Bang zu unkoordiniertem Mesh-Kern (**§ C.0b**).

---

## 7. Historisch — frühere § 6-Fassung (2026-03-28, nicht mehr Primärleitlinie)

**Diskutiert:** optionaler **Hybrid-Modus** (Backend vs. Signatur **direkt** im Browser / Wallet-Extension) und minimaler „Backup“-Pfad nur für **Coin-Transfer** oder kurze Nachrichten.

**Ehemals festgelegt:** Es blieb bei der **Architektur** — **ein** primärer Pfad: **laufender Morgendrot-Node** baut und signiert, **UI** spricht **`/api/*`**. **Kein** paralleler Produkt-Pfad für Browser-/Extension-Signatur **als Primärziel** geplant.

**Optional operativ (nur Doku, kein Pflicht-Feature):** Wenn das **Backend** ausfällt, kann ein **eigenständiges IOTA-Wallet** (beliebige App) für einen **vereinbarten MIST-Transfer** an eine **Bekannten-Adresse** genutzt werden — als **organisatorischer** Notfall-Beacon, **ohne** Integration in Morgendrot.

**Ehemals „Nicht Ziel“:** nachträglicher „Umzug“ der gesamten Messenger-Logik **in die PWA** als Abschlussschritt — zu wartungsintensiv.

*Dieser Abschnitt bleibt zur **Nachvollziehbarkeit** erhalten; für Planung und KI-Kontext gilt ausschließlich **§ 6** oben.*

---

*Stand: 2026-04-28 — § 6 ersetzt durch Handy-first-Leitlinie; § 7 = Archiv der März-2026-Fassung.*
