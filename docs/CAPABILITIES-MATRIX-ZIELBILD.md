# Capabilities-Matrix — Zielbild, Kritik, Migration

**Stand:** 2026-05-20  
**Status:** **Phase 1 (Ist)** — Schema, Resolver, Handoff-ZIP-Datei, Status-API; **Phase 2–4 (Backlog)** — UI-Gates + Backend pro Kanal  
**Verwandt:** `docs/HANDOFF-PERMISSIONS-MATRIX.md`, `docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`, `docs/TRANSPORT-AND-IOTA-LAYERS.md`

---

## 1. Kritische Einordnung deines Vorschlags

### 1.1 Das Problem ist real

Im **Ist-Code** koppelt das **S-Bit (2)** in `ROLE_ID` fast alles „Aktive“:

| Prüfung | Datei | Wirkung bei S aus |
|---------|-------|-------------------|
| `/send`, Mesh-Build | `send-commands.ts` | Senden verweigert |
| `.morg-pkg-export` | `send-commands.ts` | Export verweigert |
| Heartbeat | `messenger-command-handler.ts` | übersprungen |

**S** heißt im Kanon „Senden“ — nicht „nur IOTA“. Reporter (`ROLE_ID=12`, BW+L) kann deshalb **weder LoRa noch Telegram** senden, obwohl man fachlich „nur Chain/IOTA sperren“ meinen könnte.

Das ist **kein UX-Bug**, sondern **fehlende Dimension**: Transport und Produktfunktionen teilen sich ein Bit.

### 1.2 Was am Vorschlag stimmt

| Aussage | Bewertung |
|---------|-----------|
| Nicht alles in 0–63 quetschen | **Ja** — 6 Bits bleiben für **Chain/Gas/Pinnwand/Delegation** |
| Feature-JSON in Runtime | **Ja** — passt zu `.morgendrot-runtime-config.json` (existiert) |
| Boss wählt pro Gerät | **Ja** — Handoff + Export-Assistent |
| Kein Move-Redeploy nötig | **Ja** — Capabilities sind **Geräte-/Runtime-Policy**, nicht Package-ACL |

### 1.3 Was im Vorschlag **noch nicht** stimmt („ab jetzt“)

Bis Commit-Stand **nach Phase 1**:

- UI prüft **noch überwiegend** `ROLE`, `permissions`, `ROLE_ID` — nicht jede Komponente `status.capabilities`.
- Backend **`/send`** prüft weiter **S-Bit**, nicht `transport.lora.write`.
- Export-Assistent: **ROLE_ID-Bits** + **Capabilities-Matrix** (`HandoffCapabilitiesMatrixPicker`) — Backend nutzt Matrix noch nicht überall.
- **Verschlüsseltes** Handoff-ZIP enthält nur `.enc` — Runtime-JSON nur in **Klartext-ZIP** (oder separater Kanal).

---

## 2. Zwei-Schichten-Modell (verbindlich)

```
┌─────────────────────────────────────────────────────────────┐
│ Schicht A: ROLE_ID (D,LW,BW,L,S,P) — Chain & Nest           │
│   Gas, Pinnwand P, Delegation D, Senden on-chain (S)      │
│   → Move nicht ändern; Bits in .env behalten                │
├─────────────────────────────────────────────────────────────┤
│ Schicht B: messengerCapabilities — Produkt & Transport      │
│   transport.lora|telegram|iota|ble|streams {read, write}    │
│   product: Gruppe, Export, Einladen, …                      │
│   security: forceEncryptionOnly, …                        │
│   → .morgendrot-runtime-config.json (Handoff-ZIP)         │
└─────────────────────────────────────────────────────────────┘
```

**ROLE_ID ersetzen wir nicht.** Capabilities **ergänzen** und entkoppeln die UI/Transport-Policy.

---

## 3. Kanonisches JSON (Schema v1)

Implementierung: `src/shared/messenger-capabilities-matrix.ts`

```json
{
  "messengerCapabilities": {
    "version": 1,
    "roleId": 14,
    "simpleMode": true,
    "product": {
      "canCreateGroup": false,
      "canInviteMembers": false,
      "canExportData": false,
      "canManageEinsatzTemplates": false
    },
    "transport": {
      "lora":     { "read": true,  "write": true },
      "telegram": { "read": true,  "write": false },
      "iota":     { "read": false, "write": false },
      "ble":      { "read": true,  "write": true },
      "streams":  { "read": true,  "write": true }
    },
    "security": {
      "forceEncryptionOnly": true,
      "allowPlaintextFallback": false
    }
  },
  "handoff": {
    "schemaVersion": 1,
    "roleId": 14,
    "simpleMode": true,
    "generatedAt": "2026-05-20T12:00:00.000Z"
  }
}
```

### Mapping Alltagsbegriff → Feld

| Du meinst | Feld |
|-----------|------|
| Gruppe erstellen | `product.canCreateGroup` |
| Einladen | `product.canInviteMembers` (+ Hierarchie `teamManage`) |
| Protokoll exportieren | `product.canExportData` |
| Funk schreiben | `transport.lora.write` |
| Telegram nur lesen | `transport.telegram.read=true`, `write=false` |
| IOTA TX sperren | `transport.iota.write=false` (+ ggf. S-Bit / Tresor) |
| Kein Klartext auf Funk | `security.forceEncryptionOnly` |

---

## 4. Beispiel „Medic-Funker“ (dein Konflikt gelöst)

| Parameter | Wert |
|-----------|------|
| `ROLE_ID` | `12` (BW+L) — Chain: Boss-Gas, empfangen, **kein** klassisches S-Senden |
| Override | `transport.lora.write: true`, `telegram.write: false`, `iota.write: false` |

Ergebnis nach `resolveMessengerCapabilities()`:

- LoRa-Composer: **senden** (wenn Phase 3 Backend-Gate)
- Telegram: UI grau „Nur Lese-Berechtigung“
- IOTA-Submit: blockiert

---

## 5. Wie der Messenger reagieren soll (Phasen)

| Phase | Inhalt | Status |
|-------|--------|--------|
| **1** | Shared Schema, Resolver, Handoff-ZIP enthält Runtime-JSON, Import merged, `GET /api/status` → `capabilities` | **Ist** |
| **2** | Export-Assistent: Capability-Matrix-UI (Transport + Produkt), Presets (Medic-Funker, …) | **Ist** |
| **3** | Frontend: Composer, Senden, Telegram, Gruppe, Posteingang-Quellenfilter, Nachrichtenverlauf-Export (`canExportData`) | **Ist 2026-06-02** (`messenger-capability-gates.ts`, Posteingang + Export) |
| **4** | Backend: `send-commands` + Telegram notify/journal nach Transport-Kanal | **Ist 2026-06-02** (`src/messenger-capability-gates.ts`) |

Hilfsmodul Frontend: `frontend/frontend/lib/messenger-capability-gates.ts`

---

## 6. Handoff-Workflow (Ist Phase 1)

1. Boss exportiert ZIP → enthält `morgendrot-standalone-handoff.env` + **`.morgendrot-runtime-config.json`**
2. Runtime-JSON = `buildHandoffRuntimeConfigPayload({ roleId, simpleMode, transportProfile, hierarchyRole })` — Default aus ROLE_ID, später Boss-Overrides
3. Helfer importiert → `POST /api/apply-handoff-env` mit `envText` + optional `runtimeConfigJson`
4. Nach Reload: `GET /api/status` liefert aufgelöste `capabilities`

---

## 7. Warum nicht nur ROLE_ID erweitern?

| Ansatz | Problem |
|--------|---------|
| 10+ neue Bits in ROLE_ID | Kollision mit D/LW/BW/L/S/P; Lite-UI-Profile brechen |
| `ROLE_ID` 0–63 „Lesen/Schreiben pro Kanal“ | Max. 6 Bits — mathematisch unmöglich für 3×2 Transporte + 10 Produktflags |
| Nur `TRANSPORT_PROFILE` | Nur ein Global-Schalter (mesh-first vs iota), kein „Telegram lesen, LoRa schreiben“ |

Capabilities sind der **richtige** Enterprise-Ansatz — als **zweite Schicht**, nicht Ersatz für Chain-Bits.

---

## 8. Fazit

| Frage | Antwort |
|-------|---------|
| Ist der Vorschlag richtig? | **Ja** — Problem und Richtung stimmen |
| Ist es schon überall umgesetzt? | **Nein** — Phase 1 legt Fundament; S-Bit-Kopplung besteht im Backend noch |
| Move ändern? | **Nein** |
| Boss-UI? | Bit-Checkboxen **Ist**; feingranulare Matrix **Backlog Phase 2** |

**Nächster sinnvoller Schritt:** Phase 3–4 — Composer/Gruppen-Gates + `send-commands` Kanal-Check.

**Phase 2 UI:** `handoff-capabilities-matrix-picker.tsx`, Presets in `handoff-capability-presets.ts` (Medic-Funker, Reporter, Nur Funk).
