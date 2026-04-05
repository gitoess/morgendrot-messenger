# Messenger: technische Hürden, Limits, Gas-/Guthaben-Logik

**Status:** Risiko- und Designhinweise für Rebased/Sui-ähnliche Stacks; **Zielbild** — konkrete Zahlen **immer** mit dem aktuellen **Protokoll-Config** / **Node** eures Netzes abgleichen (Limits ändern sich).

---

## 1. PTB: Befehlsanzahl vs. Transaktionsgröße

**Richtung:** Viele kleine Operationen in **einer** Programmable Transaction Block (PTB) sind möglich — aber **zwei** unabhängige Deckel:

| Limit | Typische Bedeutung |
|--------|-------------------|
| **Anzahl der Kommandos** | Obergrenze pro PTB (in Sui-Dokumentation oft im Bereich **vieler hundert** Kommandos — **exakter Wert**: `protocol_config` des jeweiligen Netzes). |
| **Serialisierte TX-Größe** | Häufig **~128 KiB** (Brutto inkl. aller Argumente, Objekt-Refs, BCS) — **das limitiert oft früher** als die reine Kommando-Zahl. |

**Folge:** „3-KB-Nutzlast“ pro Schritt ist **irreführend klein** gerechnet: dazu kommen **BCS-Kodierung**, **Objekt-IDs**, ggf. **Argumente**, **mehrere Objekt-Inputs** — **10–30** sinnvolle Schritte pro PTB können schon **realistisch** sein; **Hunderte** nur bei extrem schlanken Calls und nach **Messung**.

**Empfehlung:** Vor dem Absenden eines PTB **`size_check`** (SDK/RPC) und **Gas-Schätzung**; Batch-Manager mit **Obergrenze in Bytes**, nicht nur „Anzahl Nachrichten“.

---

## 2. Gas-Station / Sponsor als „Honigtopf“

**Risiko:** Jeder offene Endpunkt, der **fremdes Gas** bezahlt, kann durch **Spam**, **Schleifen** oder **bösartige Move-Aufrufe** das **Treasury** leeren — wenn nicht technisch eingeschränkt.

**Gegenmaßnahmen (Kurz):**

- **Rate-Limiting** pro IP / pro Nutzer-Identität / pro Credits-Objekt.
- **Allowlist** erlaubter **Move-Module** und **Entry-Funktionen** (kein beliebiges `moveCall`).
- **Obergrenzen** pro Tag/Stunde; **Anomalie-Erkennung**.
- **Getrennte** Keys: **Sponsor** nur für definierte Pfade; **Minter** nur mit Multisig/Timelock (siehe Architektur-Doku).

---

## 3. PWA / Browser-Speicher für Schlüssel

**Risiko:** `localStorage` / **IndexedDB** können durch **Speicherdruck**, **Browser-Clear**, **Gerätewechsel**, **Private Mode** verloren gehen — **ohne** separates Backup ist der Account **nicht** wiederherstellbar.

**Empfehlung:**

- **Pflicht** oder stark empfohlene **Recovery Phrase** (oder Export) **vor** produktivem Gebrauch.
- **WebAuthn / Passkeys** für Schlüssel, die **das Gerät nicht verlassen** (siehe unten) — **kein** Ersatz für **On-Chain-Recovery**, wenn der Passkey nur **off-chain** mit Credits verknüpft ist (Mapping-Design nötig).

---

## 4. Gesponserte Transaktionen: „Ping-Pong“?

**Richtung:** Es muss geklärt werden, **wer** welche Teile der **TransactionData** signiert — das hängt vom **SDK** und vom **Sponsor-Protokoll** ab.

- **Nicht** immer ist ein langer **hin- und her**-Workflow nötig; es gibt **unterschiedliche** Sponsor-Muster (z. B. Nutzer baut Intent, Sponsor co-signiert, oder gaslose Varianten je nach API).
- **Schlechte Verbindung:** **empfindlich** bei mehrstufigen Protokollen — **Timeouts**, **Idempotenz**, **klare Fehlermeldungen** sind Pflicht.

**Empfehlung:** „Ping-Pong“ nur als **eine** mögliche Implementierung beschreiben; final **an der offiziellen IOTA-Rebased-/SDK-Dokumentation** festmachen.

---

## 5. Passkeys (WebAuthn) und Credits

**Idee:** Schlüssel im **Secure Element**; Backend kennt nur **Public Key**.

**Hürde:** Die **Verbindung** „Passkey ↔ Credits-Objekt auf der Chain“ ist **kein** Automatismus: braucht **Registrierung** (einmalige Verknüpfung), **Challenge-Response** gegen **Missbrauch**, und klare **Recovery**, wenn der Passkey verloren geht.

---

## 6. Coin-Merging, Storage-Rebate

**Coin-Merging / Gas-Coins:** Sui-ähnliche Systeme haben Regeln zu **Gas-Objekten** und **Zusammenführen** — **konkrete** Zahlen („256 Objekte“) **nicht** pauschal übernehmen; im **aktuellen** Protokoll nachlesen.

**Storage-Rebate:** Wenn eure Move-Logik **Objekte löscht** (z. B. alte Mailbox-Einträge), können **Rebates** die Kosten dämpfen — abhängig von **Vertrag** und **Netzwerkregeln**.

---

## 7. UX (Daumenzone, Transparenz)

Sinnvoll und **unabhängig** von der Chain: große Aktionen **erreichbar**, Status **„Offline / kein Guthaben“** klar kommunizieren.

---

## 8. Kontostand: eigene IOTA (MIST) vs. Messenger-Credits

**Kern:** **Credits ≠ IOTA (MIST).** Das sind **zwei Schichten** — verwechseln führt zu falschen Erwartungen („warum brauche ich trotzdem Coins?“ / „warum schwankt mein Tarif nicht?“).

| Begriff | Rolle |
|--------|--------|
| **IOTA / MIST** | **„Echtes“ natives Geld** auf der Chain: **Gas** (Transaktionsgebühr) und **Coin-Transfers**. Liegt auf der **Nutzer-Adresse** und/oder in der **Sponsor-Wallet** des Servers. Kurs **schwankt** am Markt. |
| **Messenger-Credits** | **Euer Produkt-Kontingent** als **Move-Objekt(e)** (z. B. digitale „Stempelkarte“): zählt herunter, **wenn** euer Vertrag/Backend das so abbildet — **kein** Ersatz für native Coins, es sei denn, ihr **mintet** sie absichtlich anders (hier: **nicht** mit MIST verwechseln). |

| Merkmal | MIST (native) | Messenger-Credits |
|--------|----------------|-------------------|
| Zweck | **Netzwerk-Maut** (Technik), optionale Transfers | **Abo/Flatrate** beim Dienst (Produkt), z. B. „Einheiten“ pro Nachricht |
| Preisgefühl für Nutzer | Schwankt mit **Markt/Netz**, wenn er **direkt** MIST zahlt | **Fest** im verkauften Paket (sofern ihr es so bepreist) |
| Typischer Erwerb | Börse, Wallet, **Self-Pay** | Webshop, Voucher, Gutschrift |

**Morgendrot-Szenario (Zielbild):** Der Nutzer kauft **Credits** (verständliches Kontingent). Beim Senden mit aktivem **Sponsoring** zieht ihr **Credits** laut Vertrag ab; die **MIST** für **Gas** kommt aus der **Server-Reserve** — der Nutzer muss dafür **kein** Krypto kaufen, solange sein Tarif reicht. Vermischt man beides gedanklich („Credits = IOTA“), wirkt **Self-Pay** und **Schwankung** verwirrend.

*Technisch:* Credits sind typischerweise **Move-Objekt(e)** mit euren Regeln (oft **nicht** frei wie ein Coin handelbar); MIST ist das **native** Gas-/Transfer-Guthaben auf der Adresse.

### Wer zahlt die Gebühr (Gas)?

**Produktentscheidung** in der App/Backend-Logik, typisch:

1. **Credits > 0 und Sponsor aktiv:** Server sponsort Gas (oder teilweise), Credits werden **gemäß Vertrag** verringert.
2. **Credits = 0, aber Nutzer hat MIST auf derselben Adresse:** **Kann** (wenn die App so gebaut ist) die Transaktion so konstruieren, dass der **Nutzer** das Gas aus **eigenem** Bestand zahlt — **ohne** Sponsor. **Voraussetzung:** Client kann **vollständige** TX mit **Gas-Objekt** des Nutzers signieren; **kein** automatisches Gesetz der Chain — ihr müsst es **implementieren**.
3. **Credits = 0 und MIST = 0:** Senden **nicht** möglich (außer ihr erlaubt andere Konstruktionen).

**Wichtig:** „Automatisch IOTA nutzen, wenn Tarif leer“ ist **sinnvoll**, aber **kein** Standardverhalten — es muss **explizit** (UX + Technik) sein, damit Nutzer **keine** unerwarteten Gas-Abbuchungen sehen.

### Kann der Nutzer „statt Nachricht“ IOTA senden?

- **IOTA/MIST an beliebige Adresse** zu senden ist eine **Standard-Transfer-Funktion** der Chain — **unabhängig** vom Messenger-Textkanal.
- **Ob** eure PWA das anbietet, ist **Produktfrage** (Mini-Wallet vs. reiner Messenger). **Credits** ersetzen **kein** freies Geld-Senden, sofern ihr sie **nicht** als Coin ausgebt.

### Missbrauch / Design

- **Credits „non-transferable“** zu halten (wenn gewünscht) verhindert **nicht** automatisch Geldwäsche über **native** IOTA — dafür **Compliance** und **Produktgrenzen** definieren.

---

## Self-Pay-Regel (Zielbild)

**Festlegung:** Wenn **Credits = 0** und **MIST > 0** (Nutzer hat auf seiner Adresse natives Gas-Guthaben), **soll** der Client die Transaktion so bauen können, dass der **Nutzer mit eigenem Gas** bezahlt (**Self-Pay**) — dann **entfällt** das Sponsoring für diesen Vorgang (sofern der Client die Transaktion **vollständig** selbst signieren und einreichen kann).

**Self-Pay optional (Produkt/Deployment):** Self-Pay **muss** per Konfiguration **abschaltbar** sein (z. B. `ENABLE_MESSENGER_SELF_PAY=false` als Default): Organisationen, die **keine** unerwarteten MIST-Abbuchungen wollen (Schulung, Kinder, striktes „nur Flatrate“), bleiben auf **Senden blockiert**, bis Credits wieder da sind — statt still Eigen-Guthaben zu verbrauchen.

**Hinweise:**

- **Ist-Code (Morgendrot):** Versand läuft typischerweise über **`/api/command`** → Backend signiert mit konfigurierter Wallet — **Self-Pay** ist eine **Erweiterung** (Client-SDK oder angepasster Befehlspfad).
- **Transparenz:** Nutzer muss **vorher** sehen, wenn Eigen-Guthaben genutzt wird (siehe Ampel + Schätzung unten).

---

## Kurztabelle (Guthaben / Fee)

| Situation | Wer zahlt Gas? (typisch, wenn so implementiert) |
|-----------|---------------------------------------------------|
| Credits ok + Sponsor | Server / Sponsor; Credits laut Vertrag |
| Credits leer, User hat MIST | **Kann** User selbst (Self-Pay) |
| Credits leer, kein MIST | Senden scheitert / Aufforderung aufladen |
| Nur IOTA-Transfer (Wallet-Funktion) | User mit eigenem MIST |

---

## Offline-Gas-Buffer (Vorschlag)

**Problem:** Im Funkloch (LoRa) kann der Nutzer **keine** Credits nachkaufen und evtl. **keinen** Kontakt zum Relay.

**Idee:** Im Geräte-Vault dauerhaft einen **kleinen** MIST-Puffer reservieren (Betrag produktpolitisch festlegen, z. B. feste MIST-Menge statt Euro — Kurse schwanken).

**Nutzen:** Die App kann bei **Credits = 0** trotzdem **Self-Pay**-Nachrichten bauen, **solange** MIST reicht — **ohne** Abrechnungs-Server.

**Kritik:** Erhöht **Verwahrungs**- und **UX**-Komplexität (Anzeige „Notfall-Depot“); rechtliche Hinweise bei „Pflichtguthaben“ auf dem Gerät klären.

---

## Idempotenz-Keys (Vorschlag)

**Problem:** Mesh/Wiederholungen können dieselbe Nutzlast **mehrfach** senden.

**Idee:** Pro Nachricht eine **eindeutige ID** (Client-Nonce); im **Move-Vertrag** nur **einmal** verarbeiten (Mapping „schon gesehen“) und **Gas nur einmal**.

**Voraussetzung:** Muss **im Package** designed und **speichernd** abgebildet sein (Kosten!).

---

## UI: Sponsoring-Status („Ampel“) & Gas-Schätzung (Vorschlag)

| Zustand | Bedeutung (Beispiel) |
|---------|----------------------|
| **Grün** | Relay erreichbar, Credits > 0 → Sponsoring möglich |
| **Gelb** | Credits leer, MIST > 0 → **Self-Pay** (Hinweis vor Senden) |
| **Rot** | Kein Credit, kein MIST → nur **Empfang** / Aufladen |

**Gas-Estimation:** Vor „Senden“ im Self-Pay kurz **geschätzte Kosten** anzeigen (SDK/RPC `dryRunTransaction` o. Ä.) — **Vertrauen** und weniger Panik vor „leerem Wallet“.

---

## Weitere sinnvolle Ergänzungen

- **Klare Trennung** im UI zwischen „Flatrate (Credits)“ und „zahle ich selbst (MIST)“.
- **Offline-Queue:** Nachrichten nur **lokal** speichern, bis Relay wieder da → dann **ein** Submit mit Idempotenz.
- **Monitoring:** Sponsor-Treasury-Alerts bei niedrigem Stand.

---

## Verwandte Dokumentation

- **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`** — Relay, Sponsor, SPOF, Skalierung / PTB
- **`docs/DEPLOY-SERVER-MESSENGER-ABGRENZUNG.md`** — Was auf den Server gehört vs. Messenger-only

---

*Limits und SDK-Verhalten vor jedem Release mit dem Zielnetz validieren.*
