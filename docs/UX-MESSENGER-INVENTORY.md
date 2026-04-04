# Messenger-UX: Bestand vs. Wunschliste (Stand 2026-03, aktualisiert 2026-03-28)

Kurzabgleich der besprochenen Punkte mit dem Code. Dient der Priorisierung (**`docs/ROADMAP-FAHRPLAN.md` § H.0**).

**Zuletzt umgesetzt (2026-03-28):** Wald-Check (grün/blau/rot) + Rollenzeile im Chat-Header; Toast „Basis wieder erreichbar“ nach API-Ausfall; globales `<Toaster />` (sonner); Modultest `computeWaldConnectionTier` in `scripts/run-tests.ts`. **Lite-UI:** `uiVariant` aus `/api/status` synchron mit Kachel-Auswahl (`dashboard.tsx` + `workspace-projects-panel.tsx`).

## 1. Login & Sicherheit (Entsperr-Dialog)

| Thema | Stand im Projekt | Sinn / nächster Schritt |
|--------|-------------------|-------------------------|
| **Mnemonic / SDK bei SIGNER=sdk** | Dashboard-Dialog sendet Passwort + optional `sdkSignerImport`, wenn `/api/status` → `signer: 'sdk'` | Passt; Overlay nur auf dem Dashboard – bei Navigation in den Chat bleibt der Dialog sichtbar (`sharedDialogs`). |
| **Session-Passwort für Schlüssel im Gerätespeicher** | Backend: `setWalletPassword` (RAM). **Kein** separates „lokales Handy-Passwort“ zum Verschlüsseln eines persistierten Keys in IndexedDB ohne Vault-Datei | **Sinnvoll als nächste Ausbaustufe**, wenn Keys clientseitig zwischengespeichert werden sollen – aktuell primär Server-Session + Vault-Datei. |
| **Login-Status in der Sidebar** | Chat: `ChatViewChatHeader` / Pulse-Zeile bei `apiStatus.locked`; Inbox-Toolbar deaktiviert Aktionen bei `locked` | **Vollständige „Sidebar“** wie klassische Apps: nur teilweise (Header/Toolbar). Erweiterung: kompakte Zeile „Gesperrt/Entsperrt“ in einem festen Chat-Layout. |

## 2. Rollen & UI (`UI_VARIANT=full` / Messenger)

| Thema | Stand | Sinn |
|--------|------|-----|
| **Rollen-Badge (Wanderer vs. Boss)** | **Chat-Header:** Zeile „Rolle: …“ (Wanderer/Boss/Kommandant/…) aus `role` | Dashboard weiterhin mit Rolle im Header; Einstellungen unverändert. |
| **Mobile: Blasen / Sidebar** | Responsive Klassen an vielen Stellen; kein durchgängiger QA auf allen Geräten | Laufend testen; `max-w-*` / `min-w-0` bei Bedarf nachziehen. |
| **Einfacher Modus: IOTA-Details ausblenden** | `effectiveWorkspaceTileSet === 'messenger'` (inkl. Backend `uiVariant=messenger`) filtert Kacheln; Package-ID-Banner existiert für Mismatch | **Sinn:** Messenger-Rolle: technische Hashes standardmäßig einklappen (nur auf Klick). |
| **`uiVariant` ↔ Arbeitsbereich** | Bei `uiVariant: 'messenger'` erzwingt das Dashboard **Messenger-Kacheln**; „Volldashboard“ ist deaktiviert; State + `localStorage` werden angeglichen | Kein Konflikt mehr zwischen altem `localStorage` und `UI_VARIANT=messenger`. |

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
