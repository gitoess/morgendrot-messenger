# Roadmap: Sicherheit, Vertrauen, Schlanke Härtung (ohne „50 Mio. €-Zulassung“)

**Zweck:** Ein **realistischer**, zum Projekt passender **Fahrplan** für **stabilere**, **schlankere** und **besser erklärbare** Sicherheit — **getrennt** vom operativen Feature-Fahrplan (**`docs/ROADMAP-FAHRPLAN.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**).  
**Nicht** Ziel dieses Dokuments: Behauptung einer **zulassungsfertigen** „Regierungs-“ oder „Military-Grade“-Software **ohne** separates Budget, **TOE** (Target of Evaluation) und **Audit**.

**Verknüpft:** **`SECURITY-RATING.md`**, **`docs/SICHERHEITS-AUDIT.md`** (§2 Schlüssel-Trennung), **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`** (**§ H.23**), **`docs/FELDTEST-BOSS-BEI-0.md`**, **`docs/CONFIG-REFERENCE.md`**, **`docs/SECRETS-OPTIONS.md`**, **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**), **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** (**§ H.13**), **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`** (**§ H.14**), **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/BOSS-WORKER-SEED-CUSTODY.md`** (**§ H.10b** — Boss/Arbeiter-Seed, Team vs. dezentral), **`docs/TEST-STRATEGY.md`**, **`TESTING.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § **H.10**, § **H.23**.

**Einordnung § H.10:** In **`docs/ROADMAP-FAHRPLAN.md`** § **C.0b** (Phase-A-Rand) folgt **§ H.10** auf **§ H.8**; **parallel** dazu **§ H.10b** (**`BOSS-WORKER-SEED-CUSTODY.md`**). **Blockiert** Phase A/B/C **nicht** — kleines Doku-/Prozess-Budget neben **`TESTING.md`**, **`docs/PWA-MANUAL-CHECKS.md`** (§ **H.2**) und dem **Mesh-/IOTA-MVP** (**Phase B**).

---

## 1. Zielbild: was Morgendrot **ist** und **nicht** verspricht

| Ebene | Morgendrot (Ist-Ziel) | „Regierungs-/Hochzulassungs-Niveau“ |
|--------|------------------------|-------------------------------------|
| **Nutzer** | Wanderer, Krisenvorsorge, Hilfsorganisationen, **zivile** Einsätze | Behörden mit **Common Criteria** / **landesspezifischen** Verfahren |
| **Stack** | Node/TS, Next/PWA, npm-Ökosystem, IOTA, optional LoRa/Meshtastic | Minimale **TCB**, oft **native/HSM**, **reproduzierbare Builds**, **formale** Nachweise für definierte Aussagen |
| **Kommunikation** | E2EE mit dokumentierten Grenzen (z. B. **kein** Signal-artiges Forward Secrecy — siehe **`SECURITY-RATING.md`**) | Zusatzanforderungen nur mit **eigenem** Krypto-/Protokoll-Review |

**Fazit:** Das Projekt kann **zivil stark** und **betrieblich sauber** sein, ohne **hochzulassungsfähig** zu sein. Beides **nicht vermischen** in Marketing und Doku.

---

## 2. Kurz-Review: Ist-Stand Code & Architektur (logisch, stabil, schlank)

**Methodik:** Stichprobe und bestehende Projekt-Doku — **kein** vollständiges externes Audit.

| Bereich | Befund |
|---------|--------|
| **Krypto-Kern / Vault / Move** | **`SECURITY-RATING.md`** bewertet Schichten (Crypto, Vault, Lock, Chain, Move) **konsistent**; bekannte Grenzen dort genannt (Replay-State-Datei, TTY-Passwort, kein FS in Messenger-Layer). |
| **Offensichtliche Web-XSS-Schnitzer** | Stichprobe: **kein** `eval`, **kein** `dangerouslySetInnerHTML** in **`src/`** und **`frontend/`** (Stand Abgleich im Repo). |
| **Shell-Injection** | Kritische Pfade nutzen **`spawn` ohne Shell** wo dokumentiert (`SECURITY-RATING`, Lock/Messenger). |
| **Schlankheit / Logik** | **`PROJECT-FOCUS`** hält **A → B → C** und **Meshtastic-First**; parallele Großprojekte werden **bewusst** zurückgestellt — das **reduziert** Fläche und Widersprüche. |
| **Modulare Grenzen** | **`MODULAR-KERN-ADAPTER-INTEROP.md`**, **`LORA-*`**, **`lora-bridge`**: Transport/Settlement **am Rand** denken — **passt** zur langfristigen Härtung ohne Kern-IOTA zu leugnen. |
| **Abhängigkeiten (npm)** | **Große** transitive Fläche — **normal** für TS/Next; für **Hochvertrauen** später: **SBOM**, **Pinning**, **minimale** Runtime-Images (siehe Phasen unten). |
| **Stabilität laufend** | **`npx tsc`**, **`TESTING.md`**, Phase-B **Mesh/BLE** (siehe Fahrplan); Regressionen **prozessual** abfangen. |

**Lücken (bewusst nicht „sofort Bug“):**  
Kein **Keystore-gebundener** Signaturpfad in der **PWA** (Browser-Speicher-Modell); **Replay** abhängig von **Integrität** der State-Datei auf dem Host; **Forward Secrecy** nicht wie bei Signal — in **`SECURITY-RATING.md`** bereits ehrlich.

---

## 3. Phasen-Roadmap „Vertrauen & Schlanke“ (an priorer Diskussion gemessen)

Diese Phasen **überlagern** **nicht** **A/B/C** — sie **füttern** Entscheidungen und **kleine** Härtungen, **ohne** jeden Sprint zu sprengen.

### Stufe 0 — Bedrohungsmodell & Anspruch (Doku, geringer Aufwand)

- **Wer** soll vor **wem** geschützt werden? (Vertraulichkeit der Nachricht, Integrität der Befehle, Verfügbarkeit der Basis, …)  
- **Was** ist **out of scope**? (z. B. „BSI-Zulassung“, „Angreifer mit physischem Gerätezugriff“)  
- **Deliverable:** 1–2 Seiten **Projekt-intern** oder Abschnitt in **`SECURITY-RATING.md`** verlinken.

### Stufe 1 — Lieferkette & Transparenz (ohne Sprachwechsel)

- **SBOM** für **Release-Artefakte** (Root + `frontend`), **regelmäßige** `npm audit` / Policy (kein blindes Ignorieren).  
- **Reproduzierbare** Builds wo möglich; **keine** Secrets in Git (**`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`**).  
- **Align:** **`docs/SECRETS-OPTIONS.md`**, **`deploy/README-*.md`**.

### Stufe 2 — Schlüssel & Signatur aus dem „weichen“ Browser-Kontext (mittelfristig)

- **Native Shell** (z. B. Capacitor / React Native / Flutter) **oder** **externer Signer**: **Android Keystore / StrongBox**, **iOS Secure Enclave** — **nur** für **kritische** kryptografische Schritte; UI darf **Web** bleiben.  
- **Align:** frühere Einordnung „**kleinster Hebel** vor Rust-Gesamtrewrite“.

### Stufe 3 — Backend-Vertrauensanker (optional, projektabhängig)

- **Getrennter Signer-Service** oder **HSM**-Anbindung für **hochwertige** On-Chain-Operationen; **nicht** zwingend gesamtes Node in Rust portieren.  
- **Align:** **`IOTA-SDK`**, **`BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**.

### Stufe 4 — Betrieb & Verfügbarkeit (Hochverfügbarkeit „light“)

- **Healthchecks**, **Backups** sensibler State-Dateien, **Runbook**, **2. Instanz** nur wo Sinn (siehe Shop-State / Mehrinstanz in **`OPERATIONS-SNAPSHOT`**).  
- **Kein** „Herzschrittmacher-Niveau“ ohne **IEC-62304-ähnliche** Prozesse — hier nur **realistische** Ops.

### Stufe 5 — Formale Zulassung / CC (nur bei Auftrag & Budget)

- **Eingefrorener** Umfang (**TOE**), **unabhängige** Evaluation — **eigenes** Projekt; **nicht** Standard-Morgendrot-Open-Source-Pfad.

---

## 4. Nächste **logische** Schritte (konkret, priorisiert)

**A — Weiter wie im Produktfahrplan (ohne Umweg):**  
1. **`docs/ROADMAP-FAHRPLAN.md`** § **C.1** und § **C.0b** einhalten: **H.0 / H.1 / H.1a / H.2**, **§ H.8** (Dienst/Testnet-Doku), **§ H.10** / **§ H.10b** (dieses Dokument + Seed-Custody — **kleines** Budget), dann **Phase B** (Mesh, **Delayed LoRa → IOTA**).  
2. **`TESTING.md`** (inkl. **Phase B — Mesh/Web-BT**) bei jedem Release-ähnlichen Stand durchgehen.

**B — Sicherheit/Schlankheit „klein und sofort“:**  
3. **Stufe 0:** Kurz **Bedrohungsmodell** / **Out-of-Scope** festhalten (verlinken von **`SECURITY-RATING.md`**).  
4. **Stufe 1:** Einmalig **SBOM** erzeugen (`npm sbom` / Tooling eurer Wahl) und **ablage** unter `docs/` oder CI-Artefakt — **Dokumentieren**, wie oft wiederholt.  
5. **`npm audit`**: bekannte **High/Critical** gezielt abarbeiten oder **documentiert** akzeptieren (mit Begründung).

**C — Messenger-Krypto (§ H.23 Session Keys+, nach Modus-A-Feldtest):**  
6. **Voraussetzung:** **`docs/FELDTEST-BOSS-BEI-0.md`** (Modus A) einmal grün — Wizard/Readiness nicht durch Krypto-Migration blockieren.  
7. **Erste Implementierungsscheibe:** **Session Keys+** (Entscheidung 2026-06-16, SSOT **`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`**) — `keyEpoch`, Vault-Key-Archiv, dokumentierte Rotation; **kein** Parallel-Experiment mit Double Ratchet.  
8. **UI/Copy:** Stufen-Kennzeichnung im Chat (transport-strong, FS erst ab Rotation) — bis H.23-B live, kein „Signal-Niveau“-Wording.

**D — Nach stabilem Mesh-MVP (Phase B):**  
9. **Stufe 2** **Spike:** ein Zielgerät mit **Keystore**-Pfad evaluieren (nur Signatur/Unlock), **ohne** komplette App-Rewrite.  
10. **Delayed Upload** nach **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** — **Custody** und **Logs** so gestalten, dass **keine** Klartext-/Key-Leaks in Support-Logs (**bereits** in Ops-Doku angesprochen).

**E — Nicht parallel anfangen (Feature-Creep / Risiko):**  
11. Kein **Voll-Rewrite** „Rust statt TS“ ohne **Stufe 2–3**-Bedarf.  
12. Keine **Zulassungs-Narrative** nach außen ohne **Stufe 5**-Budget.  
13. **§ I** / **Macro-Gateway** / **ATAK** erst nach **stabilem B** (**`ROADMAP`** **H.9**).  
14. **BIP44 allein** als „SPOF gelöst“ verkaufen — mehr Derivation-Pfade vom **gleichen** Seed senken den Root-SPOF **nicht**; echter Hebel ist **§ H.23** (Rotation/FS) und getrennte Schlüssel-Domänen (§ **6b**).

---

## 5. Abgleich mit „Military-Grade“-Diskussion (kompakt)

- **Rust/Ada/seL4** sind **Werkzeuge** für **spezielle** Ziele (Speichersicherheit, Kernel-Nachweis) — **ersetzen** nicht **Prozess, Threat Model und minimierte Abhängigkeiten**.  
- **PWA verlassen** ist **nicht** die einzige Option: **externer Signer**, **HSM**, **dünne native Hülle** sind **mittlere** Stufen.  
- Diese Datei ist der **ortsfeste** Verweis dafür im Repo; der **operative** Alltag bleibt **`ROADMAP-FAHRPLAN.md`**.

---

## 6. Boss / Arbeiter: Seed-Verwahrung (Teil des Threat Models)

**Kurz:** Ob der **Boss** Worker-**Seeds** dauerhaft **verschlüsselt** mitschreibt, ist **kein** reines Crypto-Detail, sondern **Custody vs. Autarkie**. Für Rettungs-/Team-Einsätze oft **gewollt**; für Privatnutzung **riskant**, wenn still passiert.

**Ausführlich (Policy, Tabellen, Alternativen, UX-Pflicht):** **`docs/BOSS-WORKER-SEED-CUSTODY.md`** — im Fahrplan **`docs/ROADMAP-FAHRPLAN.md`** als **§ H.10b** geführt.

**Stufe 0 (Threat Model):** Bei der nächsten Aktualisierung des Kurz-Bedrohungsbildes explizit festhalten: *Welcher Modus ist Default? Wer darf welche Geheimnisse in welcher Form lagern?*

---

## 6b. Seed-SPOF vs. getrennte Keys

**Kurz:** Der **IOTA-Seed** ist bewusst **SPOF für On-Chain-Signing** — **nicht** für den gesamten Kryptostack. Externe Kritik („alles hängt am einen Seed“) trifft Morgendrot nur **teilweise** zu.

| Thema | Ist Morgendrot | Bewertung |
|-------|----------------|-----------|
| **Signing** | Ed25519 aus Mnemonic/CLI; optional BIP44-Pfad (`WALLET_DERIVATION_PATH`) | SPOF **bewusst** — Recovery und Einsatz-Autarkie |
| **Messenger E2E** | P-256 ECDH **eigenständig** (`generateKeyPair`), im Tresor | **Getrennt** vom IOTA-Seed |
| **Tresor** | Eigenes Passwort (PBKDF2 + AES-GCM); ≠ Mnemonic | **Zweiter** kritischer Pfad |
| **Optional `includeIotaMnemonic`** | Signer-Import im Tresor | Kopplung nur bei **bewusster** Wahl — im Feld eher vermeiden |
| **Forward Secrecy** | Statisches ECDH pro Partner (v1) | **Größte echte Lücke** vs. „moderner Standard“ — **§ H.23 Session Keys+** |
| **BIP44 „trennt Zwecke“** | Mehr Adressen, **gleicher** Root-Seed | Senkt Root-SPOF **nicht** — architektonische Trennung (Signing ≠ ECDH) ist relevanter |
| **Hardware Wallet** | Nicht implementiert; Roadmap Stufe 2–3 | Sinnvoll für Boss-Signing; ersetzt H.23 **nicht** |

**Betrieb Boss (Einsatz):** `SIGNER=remote` auf Helfer-Geräten = kein Seed im Feld; Boss-PC gehärtet halten. Siehe **`docs/BOSS-WORKER-SEED-CUSTODY.md`**.

**Priorität:** Doku-Wahrheit (dieses Kapitel, **`SICHERHEITS-AUDIT.md` §2**) → Modus-A-Feldtest → **§ H.23** erste Scheibe → HW-Wallet/Keystore (Stufe 2). Double Ratchet bleibt **Phase 3** (`docs/MESSENGER-E2EE-ZIELARCHITEKTUR.md`).

---

*Stand: 2026-06-16*
