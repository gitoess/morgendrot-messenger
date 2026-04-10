# Morgendrot Hardening V3 (Final Precision) — Master-Prompt / Arbeitspaket

**Status:** **Umsetzungs-Rahmen** — bündelt **PWA-Speicher**, **Lite-UI-Onboarding**, **Client-Wipe**, **Idempotenz** und **PTB-Größe**. Dient als **Arbeitsvorlage** für Cursor/Implementierung; **kein** Ersatz für die Einzeldokus in **`docs/ONBOARDING-WALLET-UX-SPEC.md`**.

**Verknüpft:** **`docs/ONBOARDING-WALLET-UX-SPEC.md`** (L1–L6, L2-Lücke), **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** (**§ H.13**), **`docs/API-PROVISION-DEVICE-IDEMPOTENCY-SKIZZE.md`**, **`docs/API-VOUCHER-CLAIM-SPEC.md`**, **`docs/ROADMAP-FAHRPLAN.md`** **§ H.14**, **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** (**§ H.10**), **`docs/PWA-MANUAL-CHECKS.md`**.

---

## Leitplanken (kritisch, kurz)

| Formulierung im Prompt | Präzision |
|------------------------|-----------|
| **„Hardware-nahe Verschlüsselung im Browser“** | Umsetzung typisch über **Web Crypto API** (PBKDF2/AES-GCM im User-Space). **Kein** automatischer HSM/Secure-Enclave ohne **zusätzliches** Konzept (z. B. Passkeys, plattformspezifische APIs). |
| **„Nach Sperren/Schließen kein Klartext auf dem Gerät“** | Für **persistierten** Speicher anstreben; **RAM**, **DevTools**, **Extensions** und **OS** bieten **keine** absolute Garantie — als **best effort** kommunizieren. |
| **Lite-UI vs. PWA** | **Lite-UI (`ui/`)** = Boss-Werkstatt (API am gleichen Origin). **PWA** = **`frontend/`** Messenger. **Aufgabe 1 + 3** betreffen primär die **PWA**; **Aufgabe 2** primär **Lite-UI** — nicht vermischen. |

---

## 1. PWA-Verschlüsselungsschicht (Endgerät)

- **Inventar:** Alle Klartext-Speicher erfassen: **IndexedDB**, **localStorage**, **sessionStorage**, **Cache Storage** (und ggf. weitere APIs, sobald genutzt).
- **Verschlüsselung:** Schicht mit **PBKDF2** (Iterationen explizit wählen, z. B. Richtung OWASP-Empfehlung; **Salt** pro Gerät/Profil) und **AES-GCM** über **Web Crypto**.
- **Logik:** Vom Nutzer gewähltes Passwort schützt **nur** den **lokalen Browser-Speicher** — **bewusst getrennt** vom **Server-Vault** / Node-`.env`, solange kein abgestimmter Sync existiert.
- **Ziel:** Persistente Medien enthalten **keine** lesbaren Kontakte/Inbox-Klartexte ohne Unlock — siehe Leitplanken zu RAM/OS.

---

## 2. Onboarding-Wizard L2 (Lite-UI / Boss-Werkstatt)

- **Ziel:** Geführter **Erststart** in **`ui/`** für **Boss-Identität** und **initiale Provisionierung** (Anschluss an **L2** in **`ONBOARDING-WALLET-UX-SPEC.md`**).
- **Technik:** **Ausschließlich HTTP-API** (z. B. **`POST /api/generate-mnemonic`**), **keine** direkten Imports von **`wallet-bridge.ts`** o. ä. aus dem Browser.
- **Trennung:** Passwort für **PWA-lokalen Speicher** (Aufgabe 1) liegt in **`frontend/`**, **nicht** im Lite-UI-Wizard — im Wizard nur Boss-relevante Schritte (Wallet/Env/Provisionierung nach Produktentscheidung).

---

## 3. Emergency Wipe (PWA-Client)

- **`performEmergencyWipe()`** (oder gleichwertig): bei Auslösen **alle** für den **Origin** relevanten Client-Daten entfernen:
  - **IndexedDB:** alle genutzten Datenbanken (`deleteDatabase` pro Name),
  - **localStorage** / **sessionStorage** leeren,
  - **Cache Storage:** `caches.keys()` → löschen,
  - **Service Worker:** deregistrieren (und ggf. Clients `claim` / Reload-Hinweis).
- **Abgrenzung:** **Keine** Löschung von Server-Dateien (z. B. **`.morgendrot-contact-labels.json`** auf dem Boss-Rechner) — technisch aus der PWA **nicht** möglich.

---

## 4. Idempotenz-Check

- **Provisioning:** Lite-UI sendet **`Idempotency-Key`** (Header); Backend **`src/provision-idempotency-state.ts`** + **`api-server.ts`** (`POST /api/provision-device`) — **Regression-Tests** / manuelle Checkliste bei Änderungen.
- **Claiming:** **`POST /api/voucher-claim`** — **stabiler Anker** = **Token-Hash** in **`src/voucher-claim-state.ts`** (`consumeClaimTokenOnce`); **keine** Duplikat-Logik aus **`provision-idempotency-state.ts`**.

---

## 5. 128-KiB-Batch-Audit (`chain-access.ts`)

- **Review** aller Pfade, die **PTBs** bauen und **`signAndExecute`** (oder gleichwertig) aufrufen.
- **Konstante** **`maxTxBytes`** (ca. **128 KiB − Reserve**) **vor** dem Senden durchsetzen; jeder **Batch-Pfad** muss **hart abbrechen** mit verständlichem Fehler, wenn die **serialisierte TX** zu groß ist (inkl. Puffer für Signatur-/Netz-Overhead nach Ist-Definition im Code).

---

## Priorität (Empfehlung)

**Mit § H.0 / Phase A** verzahnen (Onboarding, PWA-Sicherheit); **Idempotenz + PTB-Audit** **parallel** zu **§ H.13**; **blockiert** Mesh **Phase B** **nicht**, außer dieselben Module werden gerade stark umgebaut.

---

*Stand: 2026-03-28*
