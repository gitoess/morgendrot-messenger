# Android: Foreground Service + minimale Sync-Ehrlichkeit (Zielbild)

**Zweck:** Kanonische Entscheidung nach Architektur-Review (Chat 2026-03): **kein** Modul-Zoo („Power-Sovereignty“, „Two-Stage Parser™“, …), aber auch **kein** Mythos „ein Foreground Service ersetzt Protokoll-Logik“.  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** **§ H.6f**; Querschnitt **§ H.6b** (Resilience), **§ H.6c** (Cold-Start, Teilbilder), **§ H.7** / **§ H.7b** (Feld/PWA), **§ H.2** (PWA-Realität), **§ H.12** (`SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`), **§ H.3n** (SOS).

---

## 1. Zwei Ebenen trennen (Pflicht)

| Ebene | Was sie löst | Wo im Projekt |
|--------|----------------|----------------|
| **A — OS / Prozess (Android)** | App wird nicht sofort gekillt; Nutzer sieht **bewusst**, dass etwas läuft | **Native Schale** (z. B. später **Capacitor**, **TWA+Companion**, oder **eigenes kleines Kotlin-Modul**) — **nicht** in der reinen **Browser-PWA** (`frontend/`). |
| **B — Medium / Nutzlast** | Mehrpaket (z. B. LoRa-Bild), Vollständigkeit, Retries ohne Doppel-Settlement | **Bestehende** Messenger-Pfade (Mesh-v2-**Empfang**/Legacy, Pfad-4-/Online-**LUMA+CHROMA**, Fortschritt, ggf. Mailbox-Outbox **§ H.3g 7a**) — **schlank erweitern**, **keine** zweite parallele „Backfill“-Architektur ohne **§ H.12**. |

**PWA (Chrome):** Es gibt **keinen** Foreground Service im Web. Gleiches **Nutzerversprechen** dort: ehrliche Texte, Status, Outbox-Opt-in — siehe **`docs/PWA-HANDBUCH-OFFLINE.md`**, **`docs/PWA-MANUAL-CHECKS.md`**.

---

## 2. Zielbild Ebene A (Android, nativ)

- Beim **Öffnen** der nativen Hülle oder bei **bestätigter Heltec-/Transport-Verbindung** (Policy im nativen Layer): **Foreground Service** mit **persistenter Notification** (kanonischer Kurztext, z. B. *„Morgendrot aktiv – Funk/Heltec verbunden“* — endgültige Copy im UI-Review).
- **Stopp-Regeln** (konfigurierbar, Vorschlag):
  - **Akku** unter Schwelle (z. B. 15 %) **und** nicht am Ladegerät → Service stoppen; beim nächsten Öffnen **ehrlicher** Hinweis (kein Marketing ohne Definition): was **noch** geht (z. B. nur SOS / nur lesen) muss **produktdefiniert** werden.
  - Optional: **Inaktivität** (z. B. keine Vordergrund-Interaktion seit *X* Minuten) → Service stoppen, **ohne** stillen Datenverlust zu verschweiern.
- **SOS (§ H.3n):** Erkennung bleibt im **bestehenden** Wire-/Chat-Pfad; native Schicht darf **zusätzlich** lautstarke Notification + Vibration auslösen, **sofern** Nutzer das erlaubt hat (`POST_NOTIFICATIONS` ab Android 13, Kanäle).

**Nicht** Ziel: periodisches **Wake-All-2–5-Min** als Ersatz für saubere Transport-Logik — das ist **Watchdog gegen das OS** und wird oft gedrosselt.

**Technische Realität:** Ein FG-Service hält den **Prozess**; er **garantiert** nicht automatisch **Web Bluetooth**-Qualität in einer **WebView**. Wenn BLE kritisch im Hintergrund laufen soll, gehört die Strategie in **dieselbe** native Architektur-Entscheidung (ggf. native BLE vs. WebView).

---

## 3. Zielbild Ebene B (minimal, „namenlos“)

- **Mehrteil / „fehlt was““:** Bereits nötig für **Mesh v2** / Bildpfade — weiter **ohne** neue Marketing-Modulnamen; Vollständigkeit = **bestehende** Checks + UI („unvollständig“, Fortschritt), optional **Nutzerwahl** „bei Online nachladen?“ statt automatischem **IOTA-Backfill**.
- **Mailbox / IOTA:** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** beachten; **§ H.3g Paket 7 voll** (Boss-Relay) **nicht** mit Client-Outbox verwechseln.

---

## 4. Umsetzungsreihenfolge (Repo-Ist: 2026-03)

1. **Doku & Fahrplan** (dieses Dokument, **§ H.6f**) — **erledigt** mit Einführung des Abschnitts.
2. **Native Projekt** anlegen oder bestehende Hülle wählen — **noch offen** im Hauptrepo (kein `android/` Ordner); bei Einführung: Manifest, `foregroundServiceType`, Notification-Channel, Tests auf Referenzgeräten.
3. **PWA:** unverändert ehrliche UX; keine falschen FG-Versprechen im Web.

---

## 5. Verwandte Dateien

- **`docs/ROADMAP-FAHRPLAN.md`** § **H.6f**, **H.6b**, **H.6c**, **H.7**, **H.12**, **H.3n**  
- **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**  
- **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**  
- **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** (PWA-Grenzen)  
- **`docs/PWA-HANDBUCH-OFFLINE.md`**, **`docs/PWA-MANUAL-CHECKS.md`**  
- **`frontend/frontend/lib/api/offline-queue.ts`** (§ H.3g 7a)

---

*Stand: 2026-03-31 — dokumentierte Entscheidung; native Implementierung folgt eigenem Meilenstein.*
