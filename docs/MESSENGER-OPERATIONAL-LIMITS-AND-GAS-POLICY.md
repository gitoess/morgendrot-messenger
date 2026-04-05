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

**Kern:** Das sind **zwei verschiedene Dinge**:

| Begriff | Typisch |
|--------|---------|
| **Messenger-Credits** | Move-Objekt(e), **Regeln** eures Vertrags (z. B. „Nachrichten kontingent“), oft **nicht** frei als Coin handelbar. |
| **IOTA/MIST auf der Nutzer-Adresse** | **Native** Zahlungsmittel für **Gas** und **Transfers** — sofern die Wallet **Guthaben** hat. |

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

## Kurztabelle (Guthaben / Fee)

| Situation | Wer zahlt Gas? (typisch, wenn so implementiert) |
|-----------|---------------------------------------------------|
| Credits ok + Sponsor | Server / Sponsor; Credits laut Vertrag |
| Credits leer, User hat MIST | **Kann** User selbst (Self-Pay) |
| Credits leer, kein MIST | Senden scheitert / Aufforderung aufladen |
| Nur IOTA-Transfer (Wallet-Funktion) | User mit eigenem MIST |

---

## Verwandte Dokumentation

- **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`** — Relay, Sponsor, SPOF
- **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`** (Abschnitt Skalierung / PTB)

---

*Limits und SDK-Verhalten vor jedem Release mit dem Zielnetz validieren.*
