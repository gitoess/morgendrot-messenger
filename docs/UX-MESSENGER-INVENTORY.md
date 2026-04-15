# Messenger-UX: Bestand vs. Wunschliste (Stand 2026-03, aktualisiert 2026-03-28)

Kurzabgleich der besprochenen Punkte mit dem Code. Dient der Priorisierung (**`docs/ROADMAP-FAHRPLAN.md` § H.0**).

**Zuletzt umgesetzt (2026-03-28):** **Unlock L2:** Next-**`dashboard.tsx`** und **Lite `ui/index.html`** — **Tresor öffnen / Seed importieren / Neu anlegen**; bei `SIGNER=sdk` unter **Tresor öffnen** weiterhin Mnemonic **optional** (Schaltfläche) bzw. **`SIGNER_IMPORT_REQUIRED`** → Umschalten auf **Seed importieren**; **Next-Tresor** Checkbox **Signer-Import mit speichern** (Parität Lite). **Boss H.7:** Export-Assistent → **`POST /api/standalone-smartphone-handoff-zip`**. **Tests:** `unlock-response-parse.test.ts`. **Zuvor (2026-03-28):** Wald-Check + Rollenzeile; Toast Basis wieder da; **Lite** `uiVariant`↔Kacheln; **Recovery** Wallet & Backup; **`GET /api/help`**; **H.0 #3** Rollen-Hinweise Arbeitsbereich / Action Center / Radar.

**Posteingang / Chat-Verlauf (2026-03):** Backend lädt ein- und ausgehende Mailbox-/Event-Nachrichten; Next-UI nutzt `myAddressFull` und sichere Identitätsvergleiche; Filter Eingang|Ausgang|Alle inkl. Selbstnachrichten. **Doku:** `docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`, `docs/UI-NACHRICHTEN-STREAMS-ORT.md`.

## 1. Login & Sicherheit (Entsperr-Dialog)

**Gesamtbild & Backlog (L1–L6):** **`docs/ONBOARDING-WALLET-UX-SPEC.md`**.

| Thema | Stand im Projekt | Sinn / nächster Schritt |
|--------|-------------------|-------------------------|
| **Signer-spezifischer Hilfetext** | Unlock-Dialog: Absätze je **`signer`** (`cli` / `sdk` / `remote`) + Kurztext Passwort vergessen / kein Seed-Reset der alten Vault | **H.0 #4** |
| **Recovery / Seed erneut anzeigen** | **Einstellungen** (`settings-view.tsx`): Abschnitt **Wallet & Backup**; nur **`SIGNER=sdk`** + lokale Vault mit `iotaSdkSignerImport`; Passwort erneut eingeben | **`docs/RECOVERY-PHRASE-BACKUP.md`**; Szenario Geräteverlust / Credits-Identität. |
| **Mnemonic / SDK bei SIGNER=sdk** | **Next + Lite:** **Tresor öffnen** (Passwort; Mnemonic per Schaltfläche optional), **Seed importieren** (Passwort + Mnemonic sofort), **Neu anlegen** (Seed + Passwort jeweils doppelt). `POST /api/unlock` mit optionalem `sdkSignerImport` | Overlay Next: `sharedDialogs`. Lite: gleicher Ablauf im Passwort-Overlay. |
| **Tresor: Signer im Backup** | **Next** `vault-view.tsx`: wie Lite Checkbox **Signer-Import mit speichern** → `includeIotaMnemonic` auf `/vault-save` und `/vault-onchain` | Parität Lite ↔ PWA (**3341**). |
| **Session-Passwort für Schlüssel im Gerätespeicher** | Backend: `setWalletPassword` (RAM). **Kein** separates „lokales Handy-Passwort“ zum Verschlüsseln eines persistierten Keys in IndexedDB ohne Vault-Datei | **Sinnvoll als nächste Ausbaustufe**, wenn Keys clientseitig zwischengespeichert werden sollen – aktuell primär Server-Session + Vault-Datei. |
| **Login-Status in der Sidebar** | Chat: `ChatViewChatHeader` / Pulse-Zeile bei `apiStatus.locked`; Inbox-Toolbar deaktiviert Aktionen bei `locked` | **Vollständige „Sidebar“** wie klassische Apps: nur teilweise (Header/Toolbar). Erweiterung: kompakte Zeile „Gesperrt/Entsperrt“ in einem festen Chat-Layout. |

## 2. Rollen & UI (`UI_VARIANT=full` / Messenger)

| Thema | Stand | Sinn |
|--------|------|-----|
| **Rollen-Badge (Wanderer vs. Boss)** | **Chat-Header:** Zeile „Rolle: …“ (Wanderer/Boss/Kommandant/…) aus `role` | Dashboard weiterhin mit Rolle im Header; Einstellungen unverändert. |
| **Mobile: Blasen / Sidebar** | Responsive Klassen an vielen Stellen; kein durchgängiger QA auf allen Geräten | Laufend testen; `max-w-*` / `min-w-0` bei Bedarf nachziehen. |
| **Einfacher Modus: IOTA-Details ausblenden** | `effectiveWorkspaceTileSet === 'messenger'` (inkl. Backend `uiVariant=messenger`) filtert Kacheln; Package-ID-Banner existiert für Mismatch | **Sinn:** Messenger-Rolle: technische Hashes standardmäßig einklappen (nur auf Klick). |
| **`uiVariant` ↔ Arbeitsbereich** | Bei `uiVariant: 'messenger'` erzwingt das Dashboard **Messenger-Kacheln**; „Volldashboard“ ist deaktiviert; State + `localStorage` werden angeglichen | Kein Konflikt mehr zwischen altem `localStorage` und `UI_VARIANT=messenger`. |
| **Hilfe (`/api/help`)** | Header-Button + **„Hilfe (Kurz + Befehle)“** in „Erste Schritte“ → Dialog mit **`HELP_UI_INTRO`** + `HELP_START`/`HELP_CHAT` | Vorher war der Dialog im Code ohne sichtbaren Trigger (**Roadmap H.0 #4**). |
| **Rollen-Hinweise (H.0 #3)** | **`workspace-projects-panel`:** Glossar `show_all_tiles` vs. `workspace_tile_set` vs. Chat-`bossView`; **Geräte-Radar** nur bei Arbeitsbereich **`full`** (Messenger: nur **Boss**) | Verwechslung **Radar** vs. **Chat-Boss-Übersicht** vs. **„Volldashboard“**-Button vermeiden (**`docs/UI-ROLLEN-WORKSPACES.md`** §6). |

## 3. Status („Wald-Check“)

| Thema | Stand | Sinn |
|--------|------|-----|
| **Grün / Blau / Rot** | **Chat-Header:** Pill „Wald“ + Punkt – `computeWaldConnectionTier` in **`frontend/frontend/lib/chat-wald-connection.ts`** (grün = Basis erreichbar, blau = Basis weg aber Mesh/BLE, rot = beides weg) | Feintuning: Tooltips/Copy bei Bedarf. |
| **Toast bei Wiederherstellung** | **`use-chat-view-api-status-poll`:** einmal `toast.success('Basis wieder erreichbar')` nach vorherigem `basisUnreachable` | Kein Spam bei jedem Poll. |

## 4. PWA

| Thema | Stand | Sinn |
|--------|------|-----|
| **Splash / großes Logo Android** | `manifest.ts`: SVG-Icons; Kommentar zu 192/512 PNG + maskable | PNGs unter `public/` nachziehen für bestes Splash-Verhalten. |
| **Install-Banner** | **Einstellungen:** Karte „App auf den Startbildschirm“ + `beforeinstallprompt` | Umgesetzt; iOS-Hinweis „Teilen → Zum Home-Bildschirm“. |

## 5. Anhänge: Kamera

| Thema | Stand |
|--------|------|
| **Von Kamera** | Chat: Button „Von Kamera“ – Handy/Tablet: `<input capture>`; PC: Webcam-Dialog → gleiche Ingest-Pipeline wie Datei. |

## 6. Onboarding / „Ready to go“ (Diskussion)

- **Einheitliche Story:** Erst Backend starten → UI öffnen → entsperren (`/api/unlock`) → optional Vault anlegen/speichern, wenn ihr Tresor-Features braucht.
- **Vorgefertigte `PACKAGE_ID`:** nur für **Demo/Lab** sinnvoll (Boss stellt bereit); für echte Einsätze weiterhin pro Package deployen.
- **Nur Seed einfügen:** mit **SIGNER=sdk** und ohne Vault reicht Mnemonic/Secret im Unlock-Formular – **Sinn**, wenn kein Tresor auf dem Gerät nötig ist; Shadow-/Vault-Flows bleiben für höhere Anforderungen.

---

*Bei Abweichung zum Code: dieses Dokument anpassen.*
