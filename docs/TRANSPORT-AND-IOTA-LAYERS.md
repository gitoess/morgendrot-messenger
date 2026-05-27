# Transport, IOTA und Offline — kanonische Schichten

**Stand:** 2026-05-20 (finalisiert)  
**Zweck:** Ein gemeinsames Bild — **IOTA bleibt gekoppelt** (Deploy, Mailbox, E2EE online); LoRa/Telegram sind **Zustellkanäle**. **Delayed Upload** und **Offline-TX** = **Phase B**.  
**Leitplanke:** **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** · Fahrplan **§ H.0-SIMPLE**, **§ H.3**, **§ H.15**

---

## 1. Kurzantwort (verbindlich)

| Frage | Antwort |
|-------|---------|
| **Bleibt LoRa → Internet → Tangle?** | **Ja** — als **Delayed LoRa → IOTA** (Queue/Gateway), nicht als rohe volle PTB im Funkframe. |
| **Bleibt Offline-TX / später einreichen?** | **Ja** — Client signiert lokal, Auslieferung wenn Netz da (**§ H.15**); Offline-Mailbox-Outbox **Ist** (Opt-in). Über Funk nur **kompakte** Relay-Envelope (**`docs/MORG_TX_RELAY_V1-SPEC.md`**, Phase B). |
| **Ist Morgendrot „ohne IOTA“?** | **Nein.** IOTA = Plattform. **Helfer-UI** blendet IOTA-Expert aus (`mesh-first`, `SIMPLE_MODE`) — Chain läuft weiter im Hintergrund / Pfad 4 / Outbox. |
| **Volle IOTA-TX über ein LoRa-Paket?** | **Nein** — **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** (**§ H.3m**). |
| **LoRa-Verschlüsselung?** | **Meshtastic-Kanal-PSK** (Team-Key im Kanal) — **kein** Morgendrot-Mesh-v2-E2EE im Produkt-Versand. |

---

## 2. Vier Nutzer-Transportmodi + Archiv (kanonische Tabelle)

Die **vier Modi** beschreiben, **wo** die Nachricht zuerst hingeht. **Archiv-TX** ist ein **Querschnitt**: zusätzliche IOTA/Mailbox-Kopie für Forensik — unabhängig vom Primärkanal.

| Modus | Primär-Zustellung | IOTA / Tangle (Primär) | Archiv-TX (Querschnitt) | Ist-Code / UI |
|-------|-------------------|------------------------|-------------------------|---------------|
| **1 — Nur LoRa** | Meshtastic (Klartext oder **Kanal-PSK**) | **Nein** (nur Funk) | Optional: **Pfad 4** (eigene Mailbox nach Netz) | Sendepfad **funk**; `sendMeshText` |
| **2 — LoRa + IOTA** | LoRa sofort; Chain wenn Netz/Gateway | **Ja** — Archiv/Forensik | **Pfad 4** (MVP) + geplant **Delayed Upload** | **funk** + Checkbox Pfad 4 (Expert); Helfer: Hinweis „später verankert“ |
| **3 — Nur IOTA** | Internet (Mailbox/Event, Direkt-RPC) | **Ja** — primär | — (ist schon on-chain) | Sendepfad **online**; `send*MailboxHybrid`, **§ H.15** |
| **4 — Nur Telegram** | Bot-API (Klartext) | **Nein** (Primär) | Optional Archiv nach Send (**Backlog**) | Telegram-Felder; Simple Mode oft ausgeblendet |

### Archiv-TX — was gemeint ist

| Mechanismus | Wann | Status |
|-------------|------|--------|
| **Pfad 4** | Nach **Klartext-Funk**: Kopie an **eigene MY_ADDRESS** (Mailbox/Tangle), Marker `[[MORG_PATH4_SELF_ARCHIVE_V1]]` | **MVP Ist** — `mesh-path4-self-archive.ts` |
| **Delayed LoRa → IOTA** | Nachricht/Foto zuerst dünn über LoRa; volle TX/PTB später via Basis/Gateway | **Phase B** — **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** |
| **Offline-Mailbox-Outbox** | Online-Send scheitert → lokal puffern, Drain bei Netz | **Ist** (Opt-in `morgendrot.offlineMailboxQueue=1`) |
| **MORG_TX_RELAY_V1** | Signierte Submit-Artefakte **nutzlastarm** über Funk | **Entwurf** — Phase B |

**Default Einsatz-Helfer:** Composer **funk**; Boss liefert **PACKAGE_ID**, RPC, Mailboxen in Handoff — IOTA nicht als Expert-UI, aber **gekoppelt**.

### Sendepfad-UI (nicht verwechseln)

| UI | Bedeutung |
|----|-----------|
| **funk** | Meshtastic / LoRa — praktisch oft **Web-BT → Heltec → LoRa** |
| **online** | IOTA / Mailbox / Direkt-RPC |
| **adhoc** | **Zukünftig:** BLE Handy↔Handy — **≠** Web-BT zum Radio |

**Simple Mode:** nur **funk** + **online**; **adhoc** ausgeblendet (Expert/Boss).

---

## 3. Zweistufen-Modell LoRa ↔ IOTA

```text
[Feld]  kompakte Nutzlast (Text, MORG_*, LUMA/CHROMA, ggf. MORG_TX_RELAY_V1)
           │
           ▼  Meshtastic (Kanal-PSK oder Klartext; Store-and-Forward)
[Basis]  Morgendrot-Node / Gateway — Queue, Parser, Wallet/Vault
           │
           ▼  Internet + RPC
[Tangle] volle PTB / Mailbox store_* — wie heute
```

**Semantik:** „IOTA-Nachricht über LoRa“ = **zuerst** dünn über Funk, **später** on-chain — **nicht** die signierte Rebased-TX bytegenau im Airtime-Paket.

---

## 4. Verschlüsselung (pro Kanal)

| Kanal | Empfohlen | Anmerkung |
|-------|-----------|-----------|
| **LoRa** | **Meshtastic-Kanal-PSK** | Team-Key im Kanal; Boss gibt PSK im Einsatzbrief/Handoff-README mit |
| **IOTA online** | **ECDH + AES-GCM** (Handshake/Connect) | Forensik, Mailbox — **behalten** |
| **Telegram** | **Klartext** (Bot-API) | Kein Telegram-E2EE-Nachbau |
| **Pfad 4 Luft** | Klartext (+ optional PSK auf Kanal) | Mailbox-Kopie on-chain für Archiv |

**Produkt:** verschlüsselter **Mesh-v2-Versand aus**; Empfang Legacy möglich. **Kein** Reaktivieren von Morgendrot-E2EE über LoRa.

---

## 5. Env-Achsen

| Variable | Helfer-Default | Boss/Kommandant |
|----------|----------------|-----------------|
| `TRANSPORT_PROFILE` | `mesh-first` | `iota-anchored` / `iota-full` |
| `SIMPLE_MODE` | `true` | `false` |
| `UI_VARIANT` | `messenger` | `full` |

**`mesh-first`:** Default-**Transport in der UI** = Funk; **kein** Entfernen von IOTA aus Deploy/Handoff.

---

## 6. UI: Expert vs. Simple (keine Doppel-Checkboxen)

| UI-Element | Wo | Simple Mode (Helfer) | Expert (Boss/Kommandant) |
|------------|-----|----------------------|---------------------------|
| **Pfad 4** (LoRa + eigene Verankerung) | Composer | Nur **Hinweis** „später verankert“ | **Checkbox** aktiv |
| **IOTA-Archiv im README** | Boss Export-Assistent | — (empfängt Text) | **Checkbox** (Presets `mesh-first`) |
| **Meshtastic-PSK** | Handoff | README + `.env`-Kommentar | Hinweis-Box im Assistenten |
| **Offline-Warteschlange** | Chat-Kopf | Streifen **immer** sichtbar | wie Simple oder Expert-Menü |

**Feldtest-Protokoll:** **`docs/FELDTEST-BLOCK2-SIMPLE-HANDOFF.md`**.

## 7. Umsetzungsstand (Tranche A)

| # | Schritt | Status |
|---|---------|--------|
| 1 | Dieses Dokument + PROJECT-FOCUS / § H.0-SIMPLE | **Ist** |
| 2 | Handoff: PSK-Hinweis, ZIP-Import in Einstellungen | **Ist** |
| 3 | Chat: Default **funk**, Offline-Banner, Pfad-4-Hinweis (Simple) | **Ist** |
| 4 | UI-Gates (`messenger-role-capabilities`) | **Ist** |
| 5 | Feldtest Block 2 (manuell) | **Offen** — siehe Feldtest-Doku |
| 6 | Delayed-Upload-MVP | **Phase B** |

**Nicht in Tranche A:** Move-Publishes, Mesh-v2-Versand, Makros/Gateway/Discord.

---

## 8. Verweise

| Thema | Dokument |
|-------|----------|
| Delayed Upload | **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** |
| Keine volle TX über Funk | **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** |
| TX-Relay über Funk | **`docs/MORG_TX_RELAY_V1-SPEC.md`** |
| Client-IOTA | **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** |
| Sync / Queue | **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** |
| Sendewege UI | **`docs/SENDEWEGE-KANAL-MAILBOX-UEBERSICHT.md`** |
| Handoff importieren | **`docs/HANDOFF-IMPORT-UX.md`** |
| Aktives Profil / Theme | **`docs/HANDOFF-PROFILE-UX.md`** |
| Handoff ZIP (~3 KB) verschlüsseln / optional IOTA | **`docs/HANDOFF-ZIP-ENCRYPTION.md`** |
| Rollen / Status-API | **`docs/TEST-ROLLE-PROFILES.md`**, **`docs/PWA-MANUAL-CHECKS.md`** |
