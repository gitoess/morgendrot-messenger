# Entwicklungsrhythmus und Git (verbindlich für dieses Repo)

**Zweck:** Erklären, warum Git „alt“ wirkt, obwohl täglich am Projekt gearbeitet wird — und wie wir das vermeiden.

**Stand:** 2026-05-20

---

## Kurzfassung

| Phänomen | Ursache |
|----------|---------|
| Letzter Messenger-Commit **17.05.**, heute **20.05.** | Code-Änderungen lagen **nur im Working Tree** (Cursor/IDE), **ohne** `git commit` |
| „Gestern ging es noch“ | Gestern lief vermutlich **anderer** Code (uncommitted Experimente **oder** stabiler Stand **vor** großen Inbox-Send-Änderungen) |
| `git log` zeigt nur Doku am 20.05. | Nur Checklisten committed, **nicht** die Messenger-Fixes |

**Regel:** Nach jeder **funktionierenden** Schicht (Posteingang, Senden, Deploy) → **kleiner Commit**. Sonst ist „gestern“ nicht reproduzierbar.

---

## Was zählt als „Stand“?

1. **`git commit` auf `main`** = reproduzierbarer Stand (CI, anderer PC, Rollback).
2. **Uncommitted Dateien** = nur auf **diesem** Rechner; ein Neustart von `npm run dev` nutzt sie, **Git** kennt sie nicht.
3. **`.env` / Vault / Package-Verlauf** = lokal, **nie** committen (siehe `.gitignore`).

Prüfen:

```powershell
git status -sb
git log -3 --oneline
```

Wenn `git status` viele `M`/`??` unter `frontend/` und `src/messenger-nest/` zeigt → **das** ist der „aktuelle“ Code, nicht der letzte Commit.

---

## Empfohlener Rhythmus (Messenger / Inbox)

| Wann | Aktion |
|------|--------|
| Vor größerer KI-Session | `git status`; optional Branch `wip/inbox-…` |
| Nach **einem** klar getesteten Fix | `git add` nur die betroffenen Dateien → Commit (1 Satz **warum**) |
| Nach Deploy neuer `PACKAGE_ID` | Commit: Doku + ggf. `docs/examples/package-profiles.manifest.json` — **nicht** `.env` |
| Wenn Posteingang/Senden kaputt | Zuerst **Rollback einer Datei**, nicht weiter experimentieren: siehe unten |
| Tagesende | Entweder committen oder bewusst verwerfen (`git checkout -- <pfad>`) |

**Commit-Nachricht-Stil** (wie im Repo): `fix(messenger): …`, `feat(messenger): …`, `docs: …` — ein Satz, Fokus auf **Warum**.

---

## Rollback: „Wieder wie letzter Commit“

Einzelne Datei auf letzten Commit (17.05. Messenger-Stand):

```powershell
git checkout HEAD -- frontend/frontend/hooks/use-chat-view-inbox.ts
```

Mehrere Messenger-Kernpfade:

```powershell
git checkout HEAD -- frontend/frontend/hooks/use-chat-view-inbox.ts frontend/frontend/hooks/use-chat-view-handle-send.ts src/messenger-nest/messenger-fetch.ts
```

Danach **Hard-Refresh** im Browser (3341) und API einmal neu starten.

---

## Typische Fehlerquellen (unabhängig von Git-Alter)

| Symptom | Häufige Ursache (kein „3-Tage-Git“) |
|---------|-------------------------------------|
| Keine **neuen** Nachrichten in der UI | Uncommitted Inbox-Hook-Experimente; Session-Filter (`sessionStorage`); Wallet **locked**; falsche Package-ID im Filter |
| Verschlüsselt senden **manchmal** | `connectedAddresses` leer / wechselnd; UI „Event“ vs Server `USE_MAILBOX`; Race bei Auto-Connect |
| Alte Nachrichten weg | Neues Deploy → **neue leere** `MAILBOX_ID`; ~4 Zeilen = alles in der **neuen** Mailbox; ~100 am **alten** Postamt-Objekt |
| Telegram ja, IOTA nein | Telegram = Journal-Datei; IOTA = Scan unter `MAILBOX_ID` |
| Bilder/Dateien fehlen | In Mailbox-Nutzlast (`MORG_*`-Wire); ohne alte `MAILBOX_ID` keine Zeilen → keine Anhänge |

Siehe auch: `docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`, `docs/DEPLOY-CHECKLIST.md` (§ **Alte Nachrichten / Bilder**).

---

## Posteingang-Union (ab 2026-05-20) — Problem & Pflege

### Was kaputt war (Kurz)

1. **Nur Mailbox-Scan** bei `USE_MAILBOX=true` — **Events** (und oft **verschlüsselte** alte Nachrichten) fehlten, obwohl Telegram/Mesh sichtbar waren.
2. **Neues Deploy** → neue leere `MAILBOX_ID`; alte ~100 Zeilen am **alten** Postamt; Package-ID-Filter allein half nicht.
3. **UI-Filter** (`sessionStorage`, Partner-Chip) blendete alles aus; Selbst-Nachrichten bei falschem Partner unsichtbar.
4. **Viel Code uncommitted** — schwer rollbackbar; teils experimentelle Inbox/Send-Hooks.

**Fix im Repo (Working Tree):** `messenger-fetch.ts` lädt **Mailbox + Events** für aktuelle + `.morgendrot-package-id-history`; UI-Filter-Reset; Partner-Filter für Selbst-an-selbst.

### Ab jetzt vermeiden — Checkliste

| Nach … | Tun |
|--------|-----|
| **`create_globals` / neues Deploy** | `PACKAGE_ID` **und** `MAILBOX_ID` in `.env` + Eintrag in `docs/examples/package-profiles.manifest.json` (Paar `packageId` + `mailboxId`) + `npm run sync:package-profiles` |
| **Package-ID gewechselt** | Alte ID bleibt in `.morgendrot-package-id-history` (automatisch bei `/set-package-id`) — **keine** Wallet-Adresse (`MY_ADDRESS`) in diese Datei schreiben |
| **Posteingang wirkt leer** | Toolbar: Partner **Alle**, Richtung **Alle**; Hard-Refresh; API neu starten nach Backend-Änderung |
| **Funktionierender Fix** | Commit: z. B. `fix(messenger): Posteingang Union Mailbox+Events` — nicht wochenlang nur lokal |

**IDs sichtbar machen (Boss):**

- `GET /api/status` → `packageId`, `mailboxId`
- Datei `.morgendrot-package-id` (aktuell), `.morgendrot-package-id-history` (Verlauf)
- Manifest: `frontend/public/package-profiles.manifest.json` (später H.24b Profil-Wechsel)

**Noch nicht automatisch:** Pro **alter** Package-ID die passende **alte** `MAILBOX_ID` — nur im Manifest oder alter `.env` notieren. Union holt **Events** über alle Package-IDs; **Mailbox-DFs** nur vom aktiven `MAILBOX_ID` (bzw. `mailboxObjectId` beim Fetch, wenn im Manifest hinterlegt).

---

## Verknüpfung

- Start/Dev: **`docs/DEV-START.md`**
- Nach Deploy: **`docs/DEPLOY-CHECKLIST.md`**
- Inbox-Technik: **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**
