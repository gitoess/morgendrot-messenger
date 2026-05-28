# PWA-Handbuch: Offline-Verhalten (Ist vs. Erwartung)

**Zweck:** Die Story „Handbuch in der tiefsten Höhle“ **präzise** halten — was der **Service Worker** wirklich tut, was **nicht** automatisch geht.

**Verwandt:** `docs/BOSS-ORIENTIERUNG.md`, `frontend/public/sw.js`, `frontend/public/handbook/*.md` (Kopien aus `docs/`, siehe `scripts/sync-pwa-handbook.mjs`). **Manuelle Release-/Feld-Checks:** **`docs/PWA-MANUAL-CHECKS.md`**.

---

## 1. Was stimmt

- **Same-Origin-Assets** der Next-PWA: `/_next/static/*` wird **cache-first** gehalten — App-Shell und JS/CSS sind nach dem ersten erfolgreichen Laden oft **ohne Netz** nutzbar (begrenzt: ohne Backend keine API).
- **Handbuch als statische Dateien:** Unter **`/handbook/*.md`** liegen **Kopien** der Markdown-Dateien im `public/`-Ordner. Sie sind **Teil des Web-App-Bundles** (nicht `/api/doc` vom Node-Server). Die Seite **„Handbuch“** in der PWA lädt diese per `fetch` — der Service Worker kann sie **cachen**, sodass der Text **nach einmaligem erfolgreichen Abruf** offline lesbar ist.
- **In-App statt externer Link:** Die Messenger-PWA zeigt die Texte **in der App** (`/handbook`), nicht als Weiterleitung auf eine fremde Domain.
- **Installierte PWA (standalone):** Wechsel in den **Hintergrund** kann die **API-Sitzung sperren** (`/vault-lock`) — danach ist wieder **Entsperren** nötig; Details **§ 2.2.1** in **`docs/ONBOARDING-WALLET-UX-SPEC.md`**.

## 2. Was nicht automatisch gilt

- **„Saugt alle .md aus docs/“:** Nein — nur die Dateien, die **`sync-pwa-handbook`** nach **`frontend/public/handbook/`** kopiert und die im **Service Worker** eingetragen sind (Liste in `scripts/sync-pwa-handbook.mjs`). Erweiterung = Datei in `docs/` pflegen + Sync-Liste anpassen + ggf. SW-Liste + **`VERSION`** in `sw.js` erhöhen + Eintrag in `frontend/components/handbook-client.tsx` (z. B. **`MESSENGER-CHAT-HANDBUCH.md`** für Messenger-Hilfetexte).
- **„Erster Start komplett ohne Netz“:** Ohne vorherigen erfolgreichen Besuch (oder Build mit precache) kann der Cache **leer** sein. Für echte Krisen bleiben **Papier/QR** und die optionale **`offlineBriefing`**-Notiz im Profil sinnvoll.
- **`/api/*` offline:** Unverändert **nicht** zuverlässig — Backend muss laufen oder es gibt keine Befehle/Status.

## 3. Ebenen (dreifach)

| Ebene | Inhalt |
|--------|--------|
| **PWA-Cache** | Statisches Handbuch unter `/handbook/` nach erstem Laden (SW). |
| **`initialProfile.offlineBriefing`** | Kurznotiz (vom Boss) im Provision-Paket — **Klartext im JSON** bis zur eigenen Speicherlogik; **kein** automatischer „immer im verschlüsselten Vault“ ohne expliziten Vault-Schritt (siehe `API-INITIAL-PROFILE.md`). |
| **Papier / QR am Gerät** | Low-Tech; QR kann nur begrenzt viel Nutzlast fassen — Parameter kurz halten. |

## 4. Entwicklung: Port 3341 vs. 3342

- **`npm start`** startet **nur** das Morgendrot-Backend (typisch **3342**) und den Streams-Mock — **ohne** Next.js. Es gibt **keine** Dev-Oberfläche auf **3341**.
- **`npm run dev`** startet **3342** und **3341** parallel (Messenger/PWA im Browser: **http://127.0.0.1:3341**). Details: **`docs/DEV-START.md`**.
- **Next vs. API-Port, Lite-UI, `UI_VARIANT`:** siehe **`docs/DASHBOARD-PORT-UND-OBERFLAECHE.md`** (in der PWA unter `/handbook` nach `npm run sync:handbook`).

## 5. Notfall ohne laufendes Morgendrot-Backend (Kurz)

**Übergang (Code noch Node-first):** Ohne laufenden Morgendrot-Node gibt es **kein** zuverlässiges **`/api`** für Relay-Pfade. **Zielbild (ab 2026-04-28):** Messenger **primär** ohne Pflicht-Node — Client-Signatur + **IOTA-RPC**; **`/api`** nur bei **opt-in** Relay — **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6, **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**. Für einen **organisatorischen** Notfall-Beacon (vereinbarter **MIST-Transfer**) kann weiterhin ein **eigenständiges IOTA-Wallet** genutzt werden.

**Sendeweg in der PWA (Stufe 0, § H.15):** Unter **Chat → Puls (Einstellungen)** kann der Modus **„Direkt (Standard)“** vs. **„Nur Morgendrot-API“** gewählt werden. Persistenz: **`localStorage`**-Schlüssel **`morgendrot.iotaSubmitMode`** — bei Wert **`relay`** sendet die Klartext-Mailbox **nicht** mehr per Fullnode aus dem Browser; es gilt dann **`/api`**, sobald die Basis erreichbar ist.

**Posteingang per Fullnode (§6.B.4):** Ohne **`/api/inbox`**, wenn der Messenger Klartext- und/oder (mit aktivem **Direkt-Mailbox-Drain** und Chat-ECDH) verschlüsselte Mailbox-Einträge vom Fullnode lesen und anzeigen kann; sonst Posteingang wie gewohnt über die Basis.

**Live-Send & Mailbox-Spiegel:** Zentral **`mailbox-send-hybrid.ts`** — **Direct** (Fullnode + PTB im Browser) zuerst, sonst **`/api`** (Composer, SOS-Mailbox-Fallback, B2-Spiegel, Delayed-Mirror, LUMA/CHROMA-Online, Einsatzprotokoll-Anker). Status im Chat-Kopf: **`getDirectIotaPathUiState`**.

## 6. Pflege

- Nach inhaltlichen Änderungen an `docs/BOSS-ORIENTIERUNG.md`, **`docs/ONBOARDING-WALLET-UX-SPEC.md`**, **`docs/RECOVERY-PHRASE-BACKUP.md`**, **`docs/WAS-IST-MORGENDROT-MESSENGER.md`**, **`docs/VAULT-EINRICHTEN.md`**, **`docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md`** oder dieser Datei: **`npm run sync:handbook`** im Repo-Root (oder vor `next build` ausgeführt), dann Commit von `frontend/public/handbook/*` und **`frontend/public/sw.js`** (**`HANDBOOK_URLS`** + **`VERSION`**, siehe **`docs/PWA-MANUAL-CHECKS.md`** **D**).

---

*Stand: Abgleich mit implementiertem SW und Next `public/handbook/`; § 4–5 ergänzt 2026-03-28. § 6: Vault-Handbücher ergänzt 2026-04-21.*
