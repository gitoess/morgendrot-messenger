# PWA-Handbuch: Offline-Verhalten (Ist vs. Erwartung)

**Zweck:** Die Story „Handbuch in der tiefsten Höhle“ **präzise** halten — was der **Service Worker** wirklich tut, was **nicht** automatisch geht.

**Verwandt:** `docs/BOSS-ORIENTIERUNG.md`, `frontend/public/sw.js`, `frontend/public/handbook/*.md` (Kopien aus `docs/`, siehe `scripts/sync-pwa-handbook.mjs`).

---

## 1. Was stimmt

- **Same-Origin-Assets** der Next-PWA: `/_next/static/*` wird **cache-first** gehalten — App-Shell und JS/CSS sind nach dem ersten erfolgreichen Laden oft **ohne Netz** nutzbar (begrenzt: ohne Backend keine API).
- **Handbuch als statische Dateien:** Unter **`/handbook/*.md`** liegen **Kopien** der Markdown-Dateien im `public/`-Ordner. Sie sind **Teil des Web-App-Bundles** (nicht `/api/doc` vom Node-Server). Die Seite **„Handbuch“** in der PWA lädt diese per `fetch` — der Service Worker kann sie **cachen**, sodass der Text **nach einmaligem erfolgreichen Abruf** offline lesbar ist.
- **In-App statt externer Link:** Die Messenger-PWA zeigt die Texte **in der App** (`/handbook`), nicht als Weiterleitung auf eine fremde Domain.

## 2. Was nicht automatisch gilt

- **„Saugt alle .md aus docs/“:** Nein — nur die Dateien, die **`sync-pwa-handbook`** nach **`frontend/public/handbook/`** kopiert und die im **Service Worker** eingetragen sind. Erweiterung = Datei in `docs/` pflegen + Sync-Liste anpassen + ggf. SW-Liste.
- **„Erster Start komplett ohne Netz“:** Ohne vorherigen erfolgreichen Besuch (oder Build mit precache) kann der Cache **leer** sein. Für echte Krisen bleiben **Papier/QR** und die optionale **`offlineBriefing`**-Notiz im Profil sinnvoll.
- **`/api/*` offline:** Unverändert **nicht** zuverlässig — Backend muss laufen oder es gibt keine Befehle/Status.

## 3. Ebenen (dreifach)

| Ebene | Inhalt |
|--------|--------|
| **PWA-Cache** | Statisches Handbuch unter `/handbook/` nach erstem Laden (SW). |
| **`initialProfile.offlineBriefing`** | Kurznotiz (vom Boss) im Provision-Paket — **Klartext im JSON** bis zur eigenen Speicherlogik; **kein** automatischer „immer im verschlüsselten Vault“ ohne expliziten Vault-Schritt (siehe `API-INITIAL-PROFILE.md`). |
| **Papier / QR am Gerät** | Low-Tech; QR kann nur begrenzt viel Nutzlast fassen — Parameter kurz halten. |

## 4. Pflege

- Nach inhaltlichen Änderungen an `docs/BOSS-ORIENTIERUNG.md` oder dieser Datei: **`npm run sync:handbook`** im Repo-Root (oder vor `next build` ausgeführt), dann Commit von `frontend/public/handbook/*`.

---

*Stand: Abgleich mit implementiertem SW und Next `public/handbook/`.*
