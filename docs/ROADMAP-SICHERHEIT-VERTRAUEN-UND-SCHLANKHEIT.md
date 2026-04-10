# Roadmap: Sicherheit, Vertrauen, Schlanke Härtung (ohne „50 Mio. €-Zulassung“)

**Zweck:** Ein **realistischer**, zum Projekt passender **Fahrplan** für **stabilere**, **schlankere** und **besser erklärbare** Sicherheit — **getrennt** vom operativen Feature-Fahrplan (**`docs/ROADMAP-FAHRPLAN.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**).  
**Nicht** Ziel dieses Dokuments: Behauptung einer **zulassungsfertigen** „Regierungs-“ oder „Military-Grade“-Software **ohne** separates Budget, **TOE** (Target of Evaluation) und **Audit**.

**Verknüpft:** **`SECURITY-RATING.md`**, **`docs/CONFIG-REFERENCE.md`**, **`docs/SECRETS-OPTIONS.md`**, **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**), **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** (**§ H.13**), **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`** (**§ H.14**), **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/TEST-STRATEGY.md`**, **`TESTING.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § **H.10**.

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
1. **`docs/ROADMAP-FAHRPLAN.md` § C.1** einhalten: **H.0 / H.1 / H.2**, dann **Phase B** (Mesh, **Delayed LoRa → IOTA**).  
2. **`TESTING.md`** (inkl. **Phase B — Mesh/Web-BT**) bei jedem Release-ähnlichen Stand durchgehen.

**B — Sicherheit/Schlankheit „klein und sofort“:**  
3. **Stufe 0:** Kurz **Bedrohungsmodell** / **Out-of-Scope** festhalten (verlinken von **`SECURITY-RATING.md`**).  
4. **Stufe 1:** Einmalig **SBOM** erzeugen (`npm sbom` / Tooling eurer Wahl) und **ablage** unter `docs/` oder CI-Artefakt — **Dokumentieren**, wie oft wiederholt.  
5. **`npm audit`**: bekannte **High/Critical** gezielt abarbeiten oder **documentiert** akzeptieren (mit Begründung).

**C — Nach stabilem Mesh-MVP (Phase B):**  
6. **Stufe 2** **Spike:** ein Zielgerät mit **Keystore**-Pfad evaluieren (nur Signatur/Unlock), **ohne** komplette App-Rewrite.  
7. **Delayed Upload** nach **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** — **Custody** und **Logs** so gestalten, dass **keine** Klartext-/Key-Leaks in Support-Logs (**bereits** in Ops-Doku angesprochen).

**D — Nicht parallel anfangen (Feature-Creep / Risiko):**  
8. Kein **Voll-Rewrite** „Rust statt TS“ ohne **Stufe 2–3**-Bedarf.  
9. Keine **Zulassungs-Narrative** nach außen ohne **Stufe 5**-Budget.  
10. **§ I** / **Macro-Gateway** / **ATAK** erst nach **stabilem B** (**`ROADMAP`** **H.9**).

---

## 5. Abgleich mit „Military-Grade“-Diskussion (kompakt)

- **Rust/Ada/seL4** sind **Werkzeuge** für **spezielle** Ziele (Speichersicherheit, Kernel-Nachweis) — **ersetzen** nicht **Prozess, Threat Model und minimierte Abhängigkeiten**.  
- **PWA verlassen** ist **nicht** die einzige Option: **externer Signer**, **HSM**, **dünne native Hülle** sind **mittlere** Stufen.  
- Diese Datei ist der **ortsfeste** Verweis dafür im Repo; der **operative** Alltag bleibt **`ROADMAP-FAHRPLAN.md`**.

---

*Stand: 2026-03-28*
