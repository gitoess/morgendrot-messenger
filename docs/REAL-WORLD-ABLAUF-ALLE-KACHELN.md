# Real-World-Ablauf mit allen Kacheln

Ein durchgängiger Ablauf, in dem **alle Kacheln** der Lite-UI vorkommen – von der ersten Einrichtung bis zu Nachrichten, Keys, Streams, Überwachung, Tresor und Verlauf.

---

## Die Kacheln im Überblick

| Kachel | Kurz | Wofür |
|--------|-----|--------|
| **Nachrichten** | Posteingang, Senden/Empfangen | On-Chain-Nachrichten (Klartext & verschlüsselt), Posteingang pro Package |
| **Schlüssel & Tickets** | Keys, Tickets | AccessKeys (Zutritt), Tickets (Events), Purge, Rebate |
| **Streams** | Feeless-Datenkanal | Kanal erstellen/beitreten, Nachrichten im Stream senden/lesen |
| **Steuerung** | Boss, Geräte, Rollen | Geräte/Rollen verwalten, Code ausgeben (Env für Arbeiter/Kommandant) |
| **Überwachung** | Monitor, Heartbeat | Geräte-Status, Heartbeats lesen, MONITOR_DEVICES, ENABLE_MONITOR |
| **Tresor** | Sichern & Notfall | Backup (Vault), Wiederherstellung, Anchor/Package/Adressen sichern |
| **IDs & Verlauf** | Listen & Verlauf | Aktuelle Package, Von Chain entdeckte Packages, Verlauf, Streams-Anchor-Listen |

---

## Szenario: Boss richtet Team ein, Arbeiter meldet sich und tauscht Nachrichten

**Beteiligte:** Ein **Boss** (eine Instanz) und ein **Arbeiter** (zweite Instanz oder später zweites Gerät). Beide nutzen die gleiche Lite-UI; die Rolle und die Env (Package, Anchor, Adressen) unterscheiden sie.

---

### Phase 1: Einrichtung (Boss)

1. **Backend starten**  
   `npm run start:secrets` (oder `npm run dev:lite`), Lite-UI im Browser öffnen (z. B. `http://127.0.0.1:3342/`).

2. **Tresor – Kachel „Tresor“**  
   - Wallet anlegen/importieren, **entsperren**.  
   - Optional: **Vault speichern** (Backup von Package, Anchor, Adressen).  
   → Ohne entsperrtes Wallet laufen keine On-Chain-Aktionen.

3. **IDs & Verlauf – Kachel „IDs & Verlauf“**  
   - **Aktuelle Package** prüfen oder aus **Von Chain** / **Verlauf** eine Package auswählen (ein Klick setzt sie als aktuell).  
   - So ist sichergestellt, mit welcher Package (und ggf. Mailbox) gearbeitet wird.

4. **Streams – Kachel „Streams“**  
   - **STREAMS_BRIDGE_URL** eintragen (z. B. Mock: `http://127.0.0.1:9343`), **Setzen**.  
   - **Kanal erstellen** klicken → Backend erhält **Anchor-ID**, speichert sie in `STREAMS_ANCHOR_ID`.  
   - Optional: In **Tresor** erneut **Vault speichern**, damit die Anchor-ID mit gesichert ist.

5. **Steuerung – Kachel „Steuerung“**  
   - Rolle **Boss** (oder Kommandant) ist gesetzt.  
   - **Code ausgeben**: Rolle **Arbeiter** wählen, **STREAMS_ANCHOR_ID** und **STREAMS_BRIDGE_URL** (und ggf. RPC, PACKAGE_ID) mit ausgeben.  
   - Diesen „Code“ (Env-Snippet) dem Arbeiter geben (z. B. per sicherem Kanal), damit er dieselbe Package und denselben Streams-Kanal nutzt.

6. **Überwachung – Kachel „Überwachung“**  
   - **MONITOR_DEVICES:** Adresse des Arbeiters eintragen (die `MY_ADDRESS` der Arbeiter-Instanz).  
   - **ENABLE_MONITOR** aktivieren, **Setzen**.  
   - Optional: **Geräte-Status** prüfen (anfangs „nie“/offline, bis der erste Heartbeat kommt).  
   - **Wichtig:** Backend einmal **neu starten**, damit der Monitor-Loop (Heartbeat-Lesen) startet.

---

### Phase 2: Arbeiter schließt sich an

7. **Zweite Instanz** (Arbeiter) starten (anderer Port oder anderes Gerät), Lite-UI öffnen.

8. **Tresor – Kachel „Tresor“**  
   - Beim Arbeiter: Wallet mit dem vom Boss bereitgestellten Seed/Mnemonic wiederherstellen (oder bereits angelegt), **entsperren**.

9. **IDs & Verlauf – Kachel „IDs & Verlauf“**  
   - **Aktuelle Package** setzen (dieselbe wie Boss, aus Verlauf oder „Von Chain“, falls schon bekannt).  
   - Oder Package vom Boss übernommen (z. B. aus dem „Code ausgeben“) in der Konfiguration eintragen.

10. **Streams – Kachel „Streams“**  
    - **STREAMS_BRIDGE_URL** und **STREAMS_ANCHOR_ID** (vom Boss) eintragen, **Setzen**.  
    - **Kanal abonnieren** klicken → Arbeiter ist im gleichen Kanal wie der Boss.

11. **Überwachung – Kachel „Überwachung“** (beim Arbeiter)  
    - Heartbeat wird automatisch gesendet, wenn **ENABLE_HEARTBEAT** aktiv ist und die Rolle **S-Bit** hat (z. B. RoleID 14).  
    - Boss sieht in **Überwachung → Geräte-Status** den Arbeiter nach dem ersten Puls.

---

### Phase 3: Nachrichten und Schlüssel

12. **Nachrichten – Kachel „Nachrichten“**  
    - **Boss:** Im Posteingang die **Package** wählen (Dropdown), Nachrichten lesen.  
    - **Senden:** Empfänger (z. B. Arbeiter-Adresse) wählen, Klartext oder nach Handshake/Connect verschlüsselt senden.  
    - **Arbeiter:** Ebenso Package wählen, Posteingang lesen, an Boss (oder andere) antworten.

13. **Schlüssel & Tickets – Kachel „Schlüssel & Tickets“**  
    - **Boss:** AccessKey oder Ticket erstellen, **Empfänger** = Arbeiter-Adresse (oder Gast).  
    - Response enthält Object-IDs und ggf. **Explorer-Links**.  
    - **Purge:** Abgelaufene Keys/Tickets können gepurged werden (Rebate); **IDs & Verlauf** zeigt ggf. rebate-relevante Objekte.

---

### Phase 4: Alles im Blick und Notfall

14. **Überwachung – Kachel „Überwachung“** (Boss)  
    - **Geräte-Status** regelmäßig prüfen: Wer ist online, wer offline (Heartbeat ausgeblieben)?  
    - Bekannte **Heartbeat-Kanäle** (Streams-Anchor-IDs) aus der Liste wählbar.

15. **Streams – Kachel „Streams“** (beide)  
    - **Bekannte Streams-Kanäle** (Anchor-IDs) aus der Liste auswählbar, falls mehrere Kanäle genutzt werden.  
    - Nachrichten im Stream **publizieren** und **abrufen** (zusätzlich zu On-Chain-Nachrichten).

16. **Tresor – Kachel „Tresor“**  
    - Regelmäßig **Vault speichern** (Backup).  
    - **Notfall:** Vault-Datei wiederherstellen → Package, Anchor, Adressen, Keys werden zurückgesetzt.

17. **IDs & Verlauf – Kachel „IDs & Verlauf“**  
    - **Aktuelle Package** wechseln (z. B. nach Migration oder mehreren Mailboxes).  
    - **Von Chain** prüfen: alle für die Adresse entdeckten Packages; ein Klick setzt eine davon als aktuell.  
    - **Verlauf** und **Streams-Anchor-Listen** für saubere Auswahl ohne manuelles Copy-Paste.

---

## Reihenfolge der Kacheln in einer Session (Kurz)

| Schritt | Kachel | Aktion |
|--------|--------|--------|
| 1 | Tresor | Wallet entsperren, ggf. Vault speichern |
| 2 | IDs & Verlauf | Package (und ggf. Anchor) auswählen/setzen |
| 3 | Streams | Bridge-URL setzen, Kanal erstellen (Boss) / beitreten (Arbeiter) |
| 4 | Steuerung | Rolle, Code ausgeben für Arbeiter |
| 5 | Überwachung | MONITOR_DEVICES, ENABLE_MONITOR (Boss); Heartbeat (Arbeiter) |
| 6 | Nachrichten | Posteingang, Senden/Empfangen |
| 7 | Schlüssel & Tickets | Keys/Tickets erstellen, Purge |
| 8 | Überwachung / Streams | Status prüfen, Kanäle wechseln |
| 9 | Tresor / IDs & Verlauf | Backup, Wiederherstellung, Verlauf nutzen |

---

## Zusätzliche Hinweise

- **Konfiguration (Setup):** Viele Werte (RPC, Package, Anchor, MONITOR_DEVICES, …) können auch in der **Konfiguration** bzw. in den jeweiligen Kacheln gesetzt werden; **IDs & Verlauf** und **Streams** bieten die direkte Auswahl aus bereits bekannten Listen.
- **Explorer:** Bei echten TX liefern Keys/Tickets/Nachrichten **Explorer-Links** (z. B. Testnet); siehe `docs/REAL-WORLD-ECHTE-TX-TEST.md`.
- **Zwei Instanzen:** Vollständiger Ablauf mit Nachrichten und Heartbeat erfordert zwei Instanzen (Boss + Arbeiter) oder Mock-Arbeiter; siehe `docs/HEARTBEAT-REALWORLD-FLOW.md`.

Mit diesem Ablauf sind **alle sieben Kacheln** (Nachrichten, Schlüssel & Tickets, Streams, Steuerung, Überwachung, Tresor, IDs & Verlauf) in einem realen Nutzungsszenario verbunden.
