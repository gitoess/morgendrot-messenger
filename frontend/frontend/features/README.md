# `features/` — Messenger-UI vertical slices

**Konvention:** Größere Themen bekommen einen Unterordner (`attachments/`, `send/`, `inbox/`, `voice/`, …). Neuer Code, der klar zu einem Thema gehört, landet hier; geteilte Typen bleiben in `lib/` bis es einen stabilen `features/_shared`- oder `lib/messenger-types`-Cut gibt.

- **`send/`** — Mesh/Send-Pipeline (`chat-view-mesh-send`, `mesh-delayed-upload`, Outgoing/Validierung/`.txt`-Split); Tests bei `send/*.test.ts`.
- **`voice/`** — Sprachmemo-Limits und Recorder-MIME (`messenger-voice-record`).
- **Einstellungen (kleine Scheiben):** Onboarding-/Session-Link-Karte liegt in **`components/views/settings-wallet-session-card.tsx`** (§ **H.1b**-Extrakt aus **`settings-view.tsx`**, § **H.0**-Inhalt).
- **Dashboard / Messenger-Kacheln (H.17, H.1b):** Sichtbarkeit **`chat`/`vault`/`boss`** vs. schlank — **`lib/dashboard-workspace-tile-visibility.ts`** + Vitest; **`dashboard.tsx`** nutzt nur noch den Filter.

**Fahrplan:** `docs/MESSENGER-UI-MODULARITY-STRATEGY.md` und `docs/ROADMAP-FAHRPLAN.md` § H.1b.

**Importe:** z. B. `@/frontend/features/attachments/…`. Bestehende Pfade unter `lib/` können vorerst per Re-Export weiterleiten.
