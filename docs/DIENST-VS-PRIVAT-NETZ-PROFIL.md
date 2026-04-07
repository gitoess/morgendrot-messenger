# Dienst (Mainnet) vs. privat (Testnet) — Einordnung für Interessierte

**Zielgruppe:** Teams, die den **Notfall-/Einsatz-Messenger** verstehen wollen, aber **zusätzlich** eine realistische Alltagsnutzung diskutieren (kostenloser Chat mit Bekannten auf dem Testnet).  
**Kein Produktversprechen:** Der Fokus des Projekts bleibt **Einsatz und Zuverlässigkeit**, nicht „Freizeit-Chat als Hauptfeature“.

---

## 1. Szenario: sinnvoll, aber klar abgrenzen

| Aspekt | Kurz |
|--------|------|
| **Dienst / Pflicht (Mainnet)** | Organisatorisch nachvollziehbar: verbindliche Konfiguration, echtes Gas, produktionsnahe Kette — wenn die Organisation das so vorgibt. |
| **Privat / Testnet** | Realistisch für **kostenlose** Übungen oder privaten Gebrauch: andere Kette, andere Objekt-IDs, kein echtes Gas in der gleichen Weise wie Mainnet. |
| **Risiko** | Verwechslung im Einsatz („ich dachte, ich bin noch im Übungsmodus“) — **operativ gefährlicher** als technische Komplexität. |

**Verbesserung gegenüber „Notfall-Umschalten“:** Nicht einen **Kontext** ständig umlöten, sondern **zwei getrennte Betriebskontexte** planen (siehe unten). Das passt besser zur Architektur als „ein Verlauf, zwei Netze“.

---

## 2. Technische Korrektur: nicht „nur zwei Vaults“

Ein **Vault** (lokale Datei, `VAULT_FILE`) enthält vor allem **Schlüsselmaterial** und Tresor-Inhalt — **nicht** die komplette Netzwerkkonfiguration.

Der Messenger spricht die Kette über **`RPC_URL`**, **`PACKAGE_ID`**, **`MAILBOX_ID`** usw. (`.env` / Laufzeitkonfiguration). Beim Laden eines Vaults prüft die Laufzeit u. a., ob gespeicherte Package-Informationen zur **aktuellen** `PACKAGE_ID` passen; bei Abweichung gibt es **Warnungen** — ein Vault „von allein“ wechselt **nicht** zuverlässig das Netz.

**Sauberer Begriff:** Zwei **Profile** (oder **Kontexte**), jeweils bestehend aus:

- **Vault-Datei** (Pfad, z. B. unterschiedliche `VAULT_FILE`-Namen), **und**
- **passender** `.env` / Konfiguration: `RPC_URL`, `PACKAGE_ID`, `MAILBOX_ID`, Partner, Streams, …

Nur so sind **Testnet** und **Mainnet** konsistent getrennt.

**Wechsel:** Praktisch z. B. **zwei Ordner** (Portable/Deployments), **zwei** vorkonfigurierte `.env`, oder ein dokumentierter Ablauf: **entsperren →** Vault laden (`/vault-load …`) **und** Umgebungsvariablen/Profil so setzen, dass sie zum gewählten Netz gehören — dann **Neustart** bzw. Konfiguration neu laden, je nach Setup.

---

## 3. „Multi-Account-Management“ — Richtung ja, Stand im Produkt

Die Richtung **getrennte Kontexte statt Merge** ist **richtig** (siehe auch Abgleich Inbox-Cache und `PACKAGE_ID` in `src/messenger-nest/messenger-fetch.ts`).

**Ist:** Kein vollständiges **In-App-Multi-Account-Produkt** mit einem Tap „Dienst ↔ Privat“ ist als Standardpfad beschrieben; eher **manuelle** oder **deploymentspezifische** Trennung (zwei Installationen, zwei Profile, oder klare Checklisten).

**Offen / Roadmap:** Einheitliche **Profil-UI** (Label, Farbe, Pflicht-Bestätigung vor dem Senden im Dienstprofil) wäre eine **Produktentscheidung** — nicht nur Technik.

---

## 4. UI-Farben (Rot/Blau vs. Grün)

**Idee:** Sichtbarer **Modus** (Dienst vs. privat) reduziert Verwechslung.  
**Ist:** Keine fest eingebaute **Behörden-Farbgebung** pro Profil im gesamten Repo; das bleibt **UX-Zielbild**. Umsetzung = eigenes Design-Ticket + klare **Banner** („Mainnet / Dienst“, „Testnet / Privat“).

---

## 5. „Vor dem Anmelden“ Netz wählen — sinnvoll, aber aufwendig im Code?

**Kurz:** Die **Idee** (beim ersten Start klar entscheiden: Testnet vs. Mainnet) ist **fachlich richtig** — sie verringert das Risiko, im falschen Netz zu „funktionieren“. **Technisch** bindet sie aber nicht nur an `RPC_URL`, sondern an ein **konsistentes Paket** aus Umgebungsvariablen und oft **getrennten** On-Chain-Objekten (`PACKAGE_ID`, `MAILBOX_ID`, …). Das Backend liest beim Start **`process.env`** / `CFG`; ein sauberer **Laufzeit-Wechsel** aller relevanten Parameter inkl. neu initialisiertem RPC-Client, Caches und UI-Zustand wäre **spürbar mehr** als ein Dialog — **kein** kleines Feature ohne Architektur-Review.

**Für Interessierte / optional:** Eine **Startwahl-UI** ist **machbar** als Produktentscheidung, aber **nicht** „nur ein Dropdown“ — eher Profil-Persistenz, Validierung und klare Regeln beim Wechsel.

**Pragmatische „Morgendrot-Lösung“ (wenig Code, hohe Trennschärfe):** Zwei **getrennte Arbeitsverzeichnisse** (oder zwei Portable-Bundles), jeweils eigene **`.env`**, eigener **`VAULT_FILE`**-Pfad, ggf. eigene Shortcuts:

| Variante | Inhalt |
|----------|--------|
| **Icon / Starter „EINSATZ“** | Start im Ordner A → Mainnet-`.env` → nur Dienst-Kontext. |
| **Icon / Starter „TEST“** | Start im Ordner B → Testnet-`.env` → nur Privat/Übung. |

**Vorteile:** Keine neue Kernlogik nötig; **physische** Trennung der Konfiguration; im Dienst-Fenster sieht man **nur** den Dienst-Chat (andere Dateien, andere Chain-IDs). **Nachteil:** Zwei Installationen pflegen (Updates zweimal oder symlinked binary mit unterschiedlichem `cwd`).

**Fazit:** „Vor dem Anmelden entscheiden“ ist **nicht** zu kompliziert als **Konzept** — aber **in einer einzigen App-Instanz** sauber zu bauen ist **aufwendiger** als zwei Starter. Für **Helfer im Einsatz** bleibt ohnehin meist **ein** Profil (Organisationsvorgabe); die **Zwei-Ordner-Idee** richtet sich an **Interessierte** und Labore, nicht als Pflicht für das Einsatzpersonal.

---

## 6. Was **nicht** ohne Weiteres behauptet werden sollte

Der folgende Satz aus Diskussionsentwürfen sollte **nicht** als Lieferumfang des Kern-Messengers stehen:

- *„… aktiviert die professionellen Features (Selective NACK, RS485-Bridge).“*

**Einordnung:**

- **Selective NACK / Chunking** taucht in der Codebasis eher im **LoRa-/Bild-Pipeline**-Kontext auf (Firmware/andere Schicht), **nicht** als einheitlicher Schalter „Dienstprofil an/aus“ im Messenger.
- **RS485** ist **kein** Standard-Messenger-Feature in dieser Form — höchstens **spezifische Hardware** oder **Zukunfts-/Integrations**thema.

**Bessere Formulierung:** Im Dienstprofil gelten die **organisatorisch vorgegebenen** Funktionen (Streams, Heartbeat, Rollen, ggf. **eure** Brücken) — **konkret** aus eurer **Konfiguration** und Doku, nicht als automatisches Bundle exotischer Protokolle.

---

## 7. Empfohlene Kurzfassung für Texte / Schulungen

1. **Einsatz:** Ein **definiertes** Mainnet-Profil (Organisation stellt `.env` + Vault-Pfad aus).  
2. **Privat/Testnet:** **Separates** Profil, **nie** dieselbe Oberfläche ohne klaren Modus-Hinweis wie der Dienst-Chat.  
3. **Kein** automatisches Mischen der Chat-Historie über beide Ketten in einer Zeile — Verwechslungsrisiko.  
4. **Helfer im Ernstfall:** Nur was in der **Einsatzvorgabe** steht (typisch Mainnet + eure Parameter); Freizeit-Testnet ist **kein** Ersatz für Einsatz-Übung.

---

## Verwandte Dokumente

- `docs/ROADMAP-FAHRPLAN.md` — **§ H.8** (zwei Installationen, Prioritäten, „nicht gleich coden“)  
- `docs/ROLLENWECHSEL-TEAM-EINSATZ.md` — Rollen/Vault vs. Provisioning  
- `docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md` — Inbox, Cache, `PACKAGE_ID`  
- `docs/BOSS-ORIENTIERUNG.md` — Lieferwege Konfiguration  

---

*Stand: 2026-03-28 (§ 5 ergänzt) — Abgleich mit `src/config.ts`, `src/wallet-bridge.ts`, `src/messenger-nest/messenger-fetch.ts`.*
