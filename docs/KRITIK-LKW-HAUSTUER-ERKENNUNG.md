# Kritische Prüfung: Was braucht LKW-Fahrer / Haustürnutzer zur Erkennung?

**Frage:** Was haben wir davon, was macht Sinn, wie und wo ist es umgesetzt?

---

## 1. Was der Nutzer heute braucht (Ist-Zustand)

Damit jemand vom MORGENDROT-System **erkannt** und das Tor **geöffnet** wird, gilt aktuell:

| Anforderung | Umsetzung im Code |
|-------------|-------------------|
| **Identität** | Der **Sender** wird über seine **IOTA-Adresse** identifiziert (aus Chain-Events / Mailbox). Es gibt kein separates „Fahrer-Profil“ – wer eine gültige Berechtigung (AccessKey) **besitzt** und vom richtigen Kanal sendet, wird erkannt. |
| **Berechtigung** | **AccessKey-NFT** on-chain: Das Tor prüft `hasValidAccessKey(sender, lockAddress)`. Ohne Key keine Öffnung. |
| **Aktion** | Der Key-Halter muss ein **„open“-Befehl** senden: verschlüsselt (nach Handshake an LOCK_ID + Connect) oder als Klartext (an LOCK_ID). Das Tor pollt Chain-Events, entschlüsselt, prüft Replay-Nonce, Autorisation und AccessKey, dann `executeOpenAction(sender)`. |

**Konkret:** Der Nutzer braucht eine **Wallet/Instanz**, die (1) den AccessKey besitzt und (2) die Nachricht „open“ (oder konfiguriertes OPEN_COMMAND_WORD) an die Lock-Adresse sendet. **Kein QR-Code, kein Magic Link, kein Meshtastic** im aktuellen Code – die Erkennung läuft über **Adresse + AccessKey + gesendete Nachricht**.

---

## 2. Drei Stufen (Beschreibung) vs. Implementierung

| Stufe | Beschreibung (KI-Text) | Im Projekt umgesetzt? | Wo / Anmerkung |
|-------|------------------------|------------------------|----------------|
| **1. Low-Tech: Statischer QR-Code** | Fahrer hält QR vor Kamera des Tors; Code = signierter Einmal-Token; Tor prüft gegen Chain. | **Nein.** Es gibt keinen QR-Scanner am Tor, keine Route „QR-Inhalt → Validierung → open“. Wizard/UI können Key/Ticket als **Objekt-ID + Explorer-Link** ausgeben (z. B. für User-Rolle); die **Prüfung am Tor** erfolgt nicht per QR-Scan, sondern über eingehende Chain-Nachricht vom Key-Besitzer. | Zielbild: Kamera + Decode + Token-Check (lokal oder on-chain) + open. |
| **2. Standard: Magic Link (Web-App)** | Link per WhatsApp; Webseite mit „Tor öffnen“; zKLogin (Google/Apple) im Hintergrund. | **Nein.** Kein Magic-Link-Endpunkt, keine zKLogin-Integration, keine gastseitige „Öffnen“-Web-App. | Zielbild: Einmal-Link, PWA, zKLogin → Identität → Befehl an Tor (z. B. über unseren Backend-Proxy oder Chain). |
| **3. Pro: Meshtastic/LoRa** | LoRa-Device im LKW; verschlüsselte Anfrage per Funk; Tor validiert HMAC, öffnet. | **Teilweise.** Es gibt **Tiny-Gateway** (HMAC-Verifikation, `ticket_used` → Settlement-Queue, Heartbeat mit `transport: 'lora'`). Das Tor selbst **öffnet** aber nicht auf Basis eines LoRa-Pakets; LoRa/Tiny fließt in Heartbeat und in **Deferred Settlement** (Ticket-Entwertung offline). Kein „OPEN“-Befehl, der von Meshtastic ans Tor geht und dort die Tür auslöst. | `tiny-gateway.ts`, `settlement-queue.ts`, `monitoring.ts` (transport: lora). Offline-OPEN existiert nur für **AccessKey** (Cache bei OFFLINE_OPEN_ENABLED), nicht für Ticket-Einlösung per LoRa. |

---

## 3. Erkennung „Wer / Wann / Wo“

| Check | Beschreibung | Umsetzung |
|-------|---------------|-----------|
| **Wer?** (Identity) | Gültiges Ticket/Key-NFT. | **Ja:** `hasValidAccessKey(sender, lockAddress)`; für Tickets `hasValidTicket(owner, eventId)`. Kein Ticket-OPEN im Lock-Modus – Lock ist key-basiert. |
| **Wann?** (TTL/Zeit) | Zeitraum aktiv. | **Ja:** Key/Ticket haben `valid_until_ms`; Prüfung on-chain. |
| **Wo?** (Location/Geofencing) | Nutzer am richtigen Tor. | **Nein.** Kein Geofencing, keine Standortprüfung im Code. |

---

## 4. Ticket vs. AccessKey (Funkloch / Offline)

| Aspekt | AccessKey (Schloss/Tür) | Ticket (Event/Einlass) |
|--------|--------------------------|-------------------------|
| **Prüfung** | „Hat Sender gültigen Key für dieses Schloss?“ (Besitz + TTL). | „Wurde dieses Ticket schon eingelöst?“ (used-Flag). |
| **Offline** | **Ja:** `OFFLINE_OPEN_ENABLED` + Cache: Nach einmaliger on-chain-Prüfung wird Sender für `OFFLINE_CACHE_TTL_MS` als gültig gecacht; Tor kann offline öffnen. | **Schwieriger:** Entwertung (`use_ticket`) muss on-chain oder über **Deferred Settlement** laufen. Tiny-Gateway kann `ticket_used` in die Settlement-Queue schreiben; wenn das Gateway wieder online ist, wird `batchUseTickets` ausgeführt. Kein „OPEN“-Pfad, der nur per LoRa ausgelöst wird – Ticket-Einlösung und Rebate laufen über Queue. |
| **Mesh-Sync** („Ticket #123 entwertet“) | Nicht nötig: Key bleibt gültig bis TTL. | **Nicht implementiert:** Keine verteilte Sperrliste im Mesh. Doppel-Nutzung an zwei Toren wäre theoretisch möglich, wenn beide offline sind und nur lokal „entwerten“. Deferred Settlement reduziert das Risiko, sobald ein Gateway online geht. |

---

## 5. Deferred Settlement / Rebate

- **Umsetzung:** `settlement-queue.ts`: Offline-Bestätigungen (z. B. `ticket_used` vom Tiny) werden in eine JSONL-Queue geschrieben; ein Worker ruft `batchUseTickets` auf und holt Rebate on-chain. **Sinnvoll** und vorhanden.
- **Rebate-Ernte:** Wenn das Gateway wieder online ist, werden die gesammelten Entwertungen in einer TX on-chain gebracht – passt zur Beschreibung.

---

## 6. PWA / „Keine App“

- **Umsetzung:** Keine PWA, keine offline-fähige Fahrer-Web-App im Repo. Die beschriebene „einfache Webseite mit Öffnen-Button“ und „QR groß für Kamera“ sind **Zielbild**, nicht Code.

---

## 7. Zusammenfassung für den Boss

| Behauptung | Realität |
|------------|----------|
| „Fahrer braucht nur QR oder Link“ | **Heute:** Fahrer braucht eine **Wallet/Instanz**, die den AccessKey hält und „open“ an die Lock-Adresse sendet. QR/Link/Magic Link/Meshtastic als **Anzeige/Übermittlung** des Schlüssels sind Konzept, nicht implementiert. |
| „Tor prüft QR gegen Chain“ | **Nein.** Tor prüft eingehende **Nachrichten** (Chain/Mailbox) von einer Adresse mit gültigem AccessKey. |
| „Meshtastic: Tor öffnet auf Funk“ | **Teilweise:** LoRa/Tiny für Heartbeat und Ticket-Settlement; kein OPEN-Befehl, der vom LoRa-Paket direkt die Tür auslöst. |
| „Ticket = Entwertung + Mesh-Sync“ | Entwertung: **Ja** (on-chain + Deferred Settlement). Mesh-Sync (Sperrliste an alle Tore): **Nein.** |

**Was sinnvoll und umgesetzt ist:** AccessKey-Prüfung, TTL, Replay-Schutz, Offline-Cache für Keys, Deferred Settlement für Tickets, Tiny-HMAC und Settlement-Queue.  
**Was fehlt für die beschriebene UX:** QR-Scanner am Tor, Magic Link/zKLogin, PWA für Fahrer, OPEN aus Meshtastic-Paket, Geofencing, Mesh-Sperrliste für Tickets.

---

## 8. Referenzen im Code

- Erkennung/OPEN: `src/m2m-lock.ts` (listenForOpenCommands, hasValidAccessKeyOrCached, OPEN_COMMAND/OPEN_URL).
- Offline-Cache: `OFFLINE_OPEN_ENABLED`, `OFFLINE_CACHE_TTL_MS` in `config.ts`; Cache in `m2m-lock.ts`.
- Ticket: `hasValidTicket`, `useTicket`, `useTicketWithOrigin` in `chain-access.ts`; Settlement: `settlement-queue.ts`, `tiny-gateway.ts`.
- Replay: `replay-state.ts`, `REPLAY_STATE_FILE`, `ENABLE_REPLAY_PROTECTION`.
- Gast ohne Wallet (Konzept): `docs/BEGRIFFE-MOVE-REBASED.md` §9.
