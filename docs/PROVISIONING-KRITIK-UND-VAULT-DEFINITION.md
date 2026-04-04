# Kritische Prüfung: Provisioning-Entscheidungen & Vault-Definition

Dieses Dokument prüft die vier getroffenen Entscheidungen gegen den **aktuellen Code** und klärt die **Vault-Definition**, um Missverständnisse zu vermeiden.

---

## Vault-Definition (Code-Ist vs. mögliches Missverständnis)

### Was der Vault im Code tatsächlich ist

| Inhalt | Speicherort | Zweck |
|--------|-------------|--------|
| **ECDH-Keypair** (privateKey + pubRaw) | Vault-Datei (verschlüsselt mit Passwort) bzw. On-Chain-VaultRegistry | Messaging: Handshake/Chat mit Partnern; stabiler Shared Secret über Neustarts. |
| **Streams Anchor-ID** | Sidecar-Datei `VAULT_FILE.streams-anchor` (verschlüsselt) | Optional; wird bei `/vault-save` mitgeschrieben, beim Start aus Vault wiederhergestellt (`readVaultAnchorId`). |
| **Package-ID** | Sidecar `VAULT_FILE.package-id` (Klartext) | Kontext, in dem die Keys gültig sind (Handshakes on-chain). |

**Quellen:** `vault-local.ts` (VaultKeys, saveVaultLocal, loadVaultLocal, writeVaultAnchorId, readVaultAnchorId), `wallet-bridge.ts` (vault-save schreibt Keys + Anchor-ID).

### Was der Vault im Code **nicht** ist

- **Kein „Filter“ für Purge:** Die Befehle `/purge-handshake`, `/purge-msg`, `/purge-key`, `/purge-ticket` entscheiden **nicht** anhand des Vault-Inhalts, was gelöscht wird. Sie löschen konkrete Objekte (Mailbox-Einträge nach recipient/sender/nonce, Keys/Tickets nach Objekt-ID). Es gibt **keine** Logik „alles, was im Vault steht, bleibt bei Purge erhalten“.
- **Kein generischer Speicher für beliebige „kritische Systemdaten“:** Nur ECDH-Keys und (optional) Streams Anchor-ID + Package-ID sind vorgesehen.

### Konsequenz für „Kommandant braucht Vault (Lesen + Schreiben)“

- **Richtig:** Der Kommandant muss **schreiben** können, damit er nach Kanal-Erstellung (oder Übernahme der Anchor-ID) **`/vault-save`** ausführen kann – so werden **Streams Anchor-ID** und **Messaging-Keys** persistent gespeichert und gehen bei Neustart/Purge-Handlungen nicht verloren.
- **Begründung ohne „Filter“:**  
  „Ohne Schreibrechte könnte der Kommandant keine neuen kritischen Systemdaten vor dem Löschen schützen“ – im Code gibt es **keinen** Purge-Filter, der den Vault-Inhalt ausliest. Die treffende Begründung ist: **Ohne Schreibrechte könnte der Kommandant Anchor-ID und Keys nicht im Vault persistieren** (kein `/vault-save`), und bei Neustart oder getrenntem Speicher wären sie weg. Das reicht für „Kommandant zwingend Vault Lesen + Schreiben“.

**Empfehlung:** In der Doku und im Plan die **Vault-Definition** so festschreiben:  
**„Vault = sicherer Speicher für ECDH-Messaging-Keys und optional Streams Anchor-ID (und Package-ID-Kontext). Kommandant braucht Lese- und Schreibzugriff, um diese Daten mit `/vault-save` zu sichern und bei Bedarf wiederherzustellen.“**  
Die Formulierung „Nicht-Löschen-Zone“ / „Filter bei Purge“ **nicht** verwenden, solange keine solche Logik im Code existiert (sonst entsteht ein Missverständnis).

---

## 1. Kommandant Vault: Immer Lesen + Schreiben

**Entscheidung:** Kommandant hat zwingend vollen Vault-Zugriff.

**Prüfung:**  
- **Passt zum Code:** Kommandant kann so `/vault-save` nutzen und Anchor-ID + Keys im Vault ablegen; ohne Schreiben keine Persistenz.  
- **Klarstellung:** Die Begründung über „Purge-Filter“ und „alles im Vault bleibt erhalten“ trifft im aktuellen Code **nicht** zu. Siehe Vault-Definition oben.  
- **Umsetzung:** Beim Provisioning für Kommandant **immer** VAULT_FILE (und optional VAULT_REGISTRY_ID) mit ausgeben; keine optionale Checkbox „Vault ja/nein“ für Kommandant.

**Fazit:** Entscheidung beibehalten; Begründung in Doku/Plan auf „Persistenz von Anchor-ID und Keys“ umstellen, nicht auf „Filter bei Purge“.

---

## 2. Wärter: ROLE=messenger, RoleID 14, keine ROLE=gate

**Entscheidung:** Wärter = Standard-Binary (messenger), UI nur Ticket-Funktionen, RoleID 14 (S-Bit für Entwertung).

**Prüfung:**  
- **ROLE=messenger:** Im Code sind nur `lock`, `monitor`, `boss`, `kommandant`, `arbeiter` explizit; alles andere → `messenger`. Wärter als messenger ist konsistent.  
- **RoleID 14 (BW+L+S):** S-Bit ist nötig, damit `/use-ticket` (TX signieren/senden) erlaubt ist. BW = „Boss Wallet“ = Konvention „Gas zahlt ein anderer“. **Umsetzung:** `useTicket` unterstützt optional `options: { sponsorAddress, sponsorPassword }`; Wallet-Bridge nutzt bei Wärter `SPONSOR_GAS_OWNER` + `SPONSOR_GAS_PASSWORD` (oder `SPONSORED_TRANSACTION_ENABLED`), sodass der Boss das Gas für use_ticket zahlen kann (Wärter-Instanz: SPONSOR_GAS_OWNER=Boss, SPONSOR_GAS_PASSWORD=Boss-Passwort).

**Lücke:** Damit der **Boss** die Gebühren für die Wärter-Entwertung zahlt, müsste eine von zwei Varianten umgesetzt werden:  
- **A)** `useTicket` (und Aufruf in wallet-bridge) um optionale **Sponsor-Optionen** erweitern (SPONSOR_GAS_OWNER + Passwort vom Boss), wenn Wärter-Instanz so konfiguriert ist;  
- **B)** Wärter behält eigenes Wallet mit Gas; Boss füllt es per Gas-Station/Überweisung auf.

**Fazit:** Entscheidung (kein ROLE=gate, messenger + ID 14) ist sinnvoll. Zusätzlich: Entweder Sponsor für use_ticket ergänzen (Boss zahlt) oder explizit dokumentieren, dass der Wärter heute selbst Gas braucht bzw. vom Boss „betankt“ wird.

---

## 3. Abgespeckter Code: One Binary, JSON/.env-Steuerung

**Entscheidung:** Ein Binary; keine separaten Builds (z. B. Lock-only-ZIP); Steuerung über config/.env.

**Prüfung:**  
- **Code:** Es gibt **ein** Hauptbinary (wallet-bridge startet je nach ROLE Lock, Monitor oder Messenger). Es werden **nicht** nur die „aktiv geschalteten“ Module geladen; es werden alle Module importiert, Verhalten wird über **CFG** (ROLE, ENABLE_*, etc.) gesteuert. Das ist faktisch „one binary, config steuert Verhalten“.  
- **README §16 (Lean Layer):** Beschreibt minimale **Modul-Sets** pro Einsatz (Lock-only, Chat, …), erwähnt aber, dass in der Praxis die **Haupt-App** mit ROLE=lock/monitor alles abdeckt und nur Features abgeschaltet werden (ENABLE_UI=false etc.). Ein separater „tur/“-Ordner (Lock-only) ist aktuell nicht enthalten.

**Fazit:** Entscheidung passt zum Ist: Ein Binary, Steuerung über .env/config. Kein Widerspruch; optional könnte später ein festes „Lean“-Template (z. B. Lock-only) als vordefinierter Ordner/ZIP ohne dynamische Code-Generierung ergänzt werden.

---

## 4. Ticket-User: Explizit im Wizard, kein Code-Output

**Entscheidung:** Ticket-User als eigene Kategorie im Wizard; Ausgabe = QR oder Explorer-Link für Gast, **kein** config/.env.

**Prüfung:**  
- **Konsistent** mit „Hardware-Provisioning (Code) vs. Zutritts-Vergabe (NFT)“: User bekommt kein Morgendrot, nur Zugangsnachweis (Key/Ticket/QR).  
- **Umsetzung:** Im Wizard eine Option „Ticket-User / Gast (nur Zugang)“; am Ende **kein** buildDeviceEnv/buildDeviceJson, sondern z. B. Anzeige/Link/QR für das erstellte Key/Ticket oder Explorer-Link. Dafür muss der Wizard ggf. wissen, ob gerade ein Key/Ticket für einen Gast erstellt wurde (oder es ist ein reiner Hinweis- Schritt „Für Gäste: Key/Ticket ausstellen und QR oder Link übergeben“).

**Fazit:** Entscheidung klar und umsetzbar; Wizard um „Ticket-User“-Kategorie und Ausgabe „QR / Link, kein Code“ erweitern.

---

## Kurz: Missverständnisse vermeiden

| Thema | Risiko | Klarstellung |
|-------|--------|--------------|
| **Vault = Purge-Filter** | Vault wird als „Nicht-Löschen-Zone“ bei Purge missverstanden. | Im Code ist Vault **kein** Filter für purge-*. Vault = Speicher für ECDH-Keys + optional Anchor-ID. Kommandant braucht Schreiben für **Persistenz** dieser Daten. |
| **BW = Boss zahlt automatisch** | Erwartung: RoleID 14 (BW) → Boss zahlt Gas für Wärter. | BW ist Konvention; **use_ticket** nutzt aktuell **keinen** Sponsor. Entweder Sponsor für use_ticket ergänzen oder Dokumentation: Wärter braucht Gas (oder Boss betankt). |
| **One Binary = lazy loading** | Erwartung: Nur „aktive“ Module werden geladen. | Alle Module werden geladen; Verhalten wird über ROLE/ENABLE_* gesteuert. Aus Sicht Nutzer trotzdem „one binary, config steuert“. |

---

## Nächste Schritte (nach Prüfung)

1. **Vault-Definition** in `PROVISIONING-PLAN-ROLLEN-CODE.md` und ggf. `ENV-ERKLAERUNG.md` / `VAULT-EINRICHTEN.md` einheitlich auf „ECDH-Keys + optional Anchor-ID; Kommandant immer Lese+Schreibzugriff für Persistenz“ setzen; „Filter bei Purge“ entfernen.  
2. **Wärter/Gas:** Entweder Sponsor-Option für `useTicket` in chain-access + wallet-bridge ergänzen (SPONSOR_GAS_OWNER beim Wärter) oder explizit dokumentieren, dass Wärter selbst Gas benötigt.  
3. **Plan umsetzen:** Rollen (Lock, Monitor, Wärter, Ticket-User) im Wizard; passgenaue buildDeviceEnv je Rolle; Kommandant immer VAULT_FILE; Ticket-User nur QR/Link, kein Code.
