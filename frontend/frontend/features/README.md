# `features/` — Messenger-UI vertical slices

**Konvention:** Größere Themen bekommen einen Unterordner (`attachments/`, `send/`, später `inbox/`, …). Neuer Code, der klar zu einem Thema gehört, landet hier; geteilte Typen bleiben in `lib/` bis es einen stabilen `features/_shared`- oder `lib/messenger-types`-Cut gibt.

- **`send/`** — `chat-view-mesh-send.ts` (Mesh-v2-Burst), `chat-view-send-utils.ts` (Outgoing-Validierung); Tests bei `send/*.test.ts`.

**Fahrplan:** `docs/MESSENGER-UI-MODULARITY-STRATEGY.md` und `docs/ROADMAP-FAHRPLAN.md` § H.1b.

**Importe:** z. B. `@/frontend/features/attachments/…`. Bestehende Pfade unter `lib/` können vorerst per Re-Export weiterleiten.
