# Posteingang: Package-ID / Vertrag (Expertenmodus)

Stand: 2026-11 — Vertrag-UI sitzt in **Einstellungen → Expertenmodus** (nicht mehr Posteingang-Toolbar).

## Kurzfassung

| Nutzer | Package-/Vertrags-UI |
|--------|----------------------|
| Standard (Simple Mode / ohne Toggle) | **Keine** Steuerung |
| Expertenmodus (Einstellungen, client) + IOTA-Transport | Block **IOTA-Vertrag (Package-ID)** unter dem Experten-Toggle |
| Dauerhafter Wechsel | `/set-package-id` (Button „Dauerhaft wechseln“) |
| Temporär | nur Posteingang-Filter (`inboxPackageFilter`), **ohne** Server-Wechsel |

## Was „Temporär“ macht

**Ja:** Der Posteingang lädt Nachrichten **nur für diese Move-Package-ID** (ein anderes Deploy/Programm). Server-Config und Sendepfad bleiben auf der aktiven ID.

**Nein:** Kein zweites Konto, kein dauerhafter Wechsel, kein `.morg-pkg`-Datei-Paket.

Amber-Hinweis im Panel = Temp-Filter aktiv. „Zurück zum aktiven Vertrag“ leert den Filter.

## Drei Schichten (wichtig)

1. **Server Simple Mode** (`ROLE=arbeiter`, `uiMode=simple`, …) — **hard block**, kein Toggle, kein Panel.
2. **IOTA-Transport sichtbar** — ohne IOTA kein Experten-Panel.
3. **Client Expertenmodus** (`localStorage` `morgendrot.messenger.expertMode`) — **opt-in** pro Browser.

## UX

- Einstellungen → Expertenmodus **an** → Vertrags-Panel.
- **Temporär anzeigen** — `writeInboxPackageFilterStore` + Event → Chat lädt `/inbox` mit Filter.
- **Dauerhaft wechseln** — `setPackageIdCommand` + Force-Refresh.
- Verlauf aus `GET /api/package-id-history`.

**Nicht verwechseln** mit Nachrichten → Optionen → **Pakete** = `.morg-pkg` Sneakernet.

## Bilder / Wire / Verschlüsselung (Posteingang)

| UI | Bedeutung |
|----|-----------|
| **Filter** | Richtung + Inhalt (Verschl./Klartext) + **Medien** (Bilder/Audio/Dateien) — nur Listenfilter |
| **Export → Medien-Galerie** | Kompaktbilder/Audio/Dateien aus Posteingang (Hauptweg für Medien) |
| **Optionen → Chain-Text…** | **Mailbox/Adresse** oder **Object-ID**; PWMSG mit Passphrase hier lesbar; ECDH-MsgKey nur Hinweis |
| **Optionen → PWMSG entschlüsseln…** | `MORG_PWMSG_V1` paste → Passphrase → Klartext **lokal** (out-of-band) |
| **Optionen → Hash & Prüfen** | SHA-256 von Text/Datei — Integrität, kein Entschlüsseln |

**Enc on-chain:** MsgKey findbar wie Klartext-Objekte. Lesen: ECDH-Session (Posteingang) bzw. PWMSG + Passphrase. Chain-Text entschlüsselt ECDH nicht still.

Kompaktbilder wirken in der Liste oft wie „Wire/Geheim“, sind aber nur das Bildformat — Posteingang-Bilder decodiert sie.

NFT-Mint/Galerie: **Hauptmenü-Wallet**.

## Code-Referenzen

| Datei | Rolle |
|-------|--------|
| `frontend/lib/messenger-client-expert-mode.ts` | Toggle localStorage + Event |
| `frontend/lib/inbox-package-filter-store.ts` | Temporärer Filter + Cross-View-Event |
| `frontend/lib/inbox-package-view.ts` | View-Modus + Fetch-Auflösung |
| `frontend/components/settings-expert-mode-section.tsx` | Toggle |
| `frontend/components/settings-inbox-package-contract-panel.tsx` | Vertrags-UI |
| `frontend/components/chat-view-inbox-package-expert-menu.tsx` | Shared Menu (`embedded`) |
| `frontend/hooks/use-chat-view-package-id.ts` | Chat: Filter-Event → Reload |

## Vorbereitung Multi-Package (Zukunft)

Volles Multi-Package-Dropdown / Side-by-Side bleibt Backlog (`docs/ROADMAP-FAHRPLAN.md`).
