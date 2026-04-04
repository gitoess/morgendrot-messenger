# Morgendrot – M2M-Koordination einrichten

Fabrik-Roboter, Drohnen, Spielzeug-Autos – mehrere Geräte sollen zusammenarbeiten. Du richtest eine „Ameisen-Hierarchie“ ein: Boss → Kommandant → Arbeiter. Der Boss gibt Befehle, Kommandanten leiten weiter, Arbeiter führen aus (z. B. Tür öffnen). Optional: Maschinen ohne eigenes Wallet (Boss unterschreibt für alle).

**6 Schritte – folge einfach der Reihenfolge.**

Du musst nicht alles machen – nimm nur, was du brauchst.

---

## Rolle wählen (1 von 6)

**Sag der App: Wer bist du in der Hierarchie?**

- **ROLE** = `boss` / `kommandant` / `arbeiter`  
→ Das ist wie ein Kostüm: Jeder bekommt seine Aufgabe.

**Boss:** ROLE=boss + KOMMANDANT_ADDRESSES  
→ Der große Chef. Er sendet Befehle an alle Kommandanten (z. B. „alle Roboter in Pause“).  
→ Beispiel: Dein großer Computer ist der Boss → er sagt den Kommandanten, was sie tun sollen.

**Kommandant:** ROLE=kommandant + BOSS_ADDRESS + WORKER_ADDRESSES  
→ Der Vorarbeiter. Er hört auf den Boss und leitet Befehle an die Arbeiter weiter.  
→ Beispiel: Ein Raspberry Pi pro Stockwerk ist Kommandant → er hört auf den Boss und sagt den Robotern „stopp“.

**Arbeiter (Lock):** ROLE=arbeiter + BOSS_ADDRESS + KOMMANDANT_ADDRESSES  
→ Die kleinen Ameisen. Sie hören nur auf Boss oder Kommandanten und machen die Arbeit (z. B. Tür öffnen).  
→ Beispiel: Ein kleiner Roboter-Arm ist Arbeiter → er hört auf den Kommandanten und macht, was er sagt.

**Setzen?** Ja – jedes Gerät braucht seine Rolle. Ohne ROLE weiß die App nicht, was sie tun soll.

**Wer darf was? (Ameisen-Rechte, alle optional)**

| Recht | Boss | Kommandant | Arbeiter | Flag (in .env) |
|-------|------|------------|----------|----------------|
| Befehl senden (Handshake, Send) | Ja | Ja | Nein | ENABLE_COMMAND_DOWN |
| Schlüssel ausstellen | Ja | Nein | Nein | ENABLE_KEY_ISSUE |
| Widerruf / Sperren (Purge) | Ja | Ja | Nein | ENABLE_REVOKE_DOWN |
| Status von unten lesen | Ja | Ja | Nein | ENABLE_STATUS_READ_DOWN |
| Status von oben lesen | – | Ja (Boss) | Ja (Boss + Kommandant) | ENABLE_STATUS_READ_UP |
| Konfig ändern | Ja | Nein | Nein | ENABLE_CONFIG_CHANGE |
| Hierarchie ändern (ROLE, Adressen) | Ja | Nein | Nein | ENABLE_HIERARCHY_CHANGE |

In der UI und API siehst du nur die Optionen, die deine Rolle darf. Arbeiter sieht z. B. kaum etwas – nur Lesen von Status oben. Alle Flags default: true (Boss hat alles, Kommandant/Arbeiter nach Tabelle).

---

## Maschinen ohne Wallet? (2 von 6)

**Kleine Geräte brauchen kein eigenes Sparschwein – der Boss unterschreibt.**

- **SIGNER** = `remote`  
→ Die kleinen Ameisen haben kein eigenes Wallet – der Boss unterschreibt für sie.

- **REMOTE_SIGNER_URL** = `https://mein-boss-computer:3340/sign`  
→ Wo der Boss-Signer läuft (seine Adresse im Netzwerk).

**Mit eigenem Wallet:** SIGNER=cli oder sdk → jede Maschine hat eigenes Passwort (komplizierter).

**Ohne Wallet (Boss signiert):** SIGNER=remote + REMOTE_SIGNER_URL  
→ Beispiel: Die kleinen Roboter schicken dem Boss „bitte unterschreib für mich“ → der Boss macht es.

**Setzen?** Ja – mach SIGNER=remote für kleine Geräte, dann brauchst du keine Passwörter überall.

---

## Streams – schneller Kanal (3 von 6)

**Soll es einen superschnellen „Tunnel“ für Befehle geben?**

- **OPEN_STREAMS_ENABLED** = `true` oder `false`  
→ Bei „open“ oder anderen Befehlen auch über Streams schicken? (schneller und fast kostenlos.)

- **STREAMS_BRIDGE_URL** = `…`  
→ Wo der Streams-Dienst läuft.

**Beispiel:** Boss sagt „alle Roboter stopp!“ → über Streams in 0,5 Sekunden bei allen an – viel schneller als normale Kette.

**Setzen?** Nein – nur wenn du superschnell sein willst (z. B. Roboter müssen sofort stoppen).

---

## Connect – Hallo sagen (4 von 6)

**Damit die Geräte sich „kennen“ und verschlüsselt reden können.**

- **/connect** `0xAdresse`  
→ Das ist wie „Hallo, ich bin da!“ – Boss oder Kommandant und Arbeiter tauschen einen geheimen Schlüssel aus.

**Vorher:** Die kleinen Roboter verstehen die Befehle nicht (oder nur unverschlüsselt).

**Nachher:** Nach /connect können sie geheime Befehle empfangen (z. B. „stopp!“).

**Beispiel:** Boss tippt /connect 0xRoboter1 → Roboter1 und Boss vertrauen sich → ab jetzt läuft die Koordination.

**Dafür brauchst du:** MY_ADDRESS, PACKAGE_ID, Adresse vom anderen

**Setzen?** Ja – mach das einmalig mit jedem neuen Roboter oder Kommandanten.

---

## Befehle senden (5 von 6)

**Der Boss oder Kommandant sagt, was alle tun sollen.**

Nachrichten gehen an alle verbundenen Partner. Du tippst z. B. „alle stopp!“ → alle Roboter hören es und stoppen.

**Beispiel:** Boss schreibt „alle Roboter in Pause“ → Kommandanten leiten weiter → Arbeiter machen Pause.

**Setzen?** Nein – das passiert automatisch, wenn die Rollen und Adressen richtig gesetzt sind.

---

## Zusätzliche Optionen (6 von 6)

**Extras – nimm nur, was du brauchst:**

- **Zahlungs-Trigger:** Arbeiter als Lock → bei Zahlung öffnen (z. B. Roboter arbeitet nur nach Bezahlung).  
  → PAYMENT_TRIGGER_ENABLED = true

- **AccessKey für Maschinen:** Boss stellt Keys für Arbeiter aus (z. B. Roboter 1 darf 7 Tage durchs Gate).  
  → /create-key

- **Ticket-NFT (hasValidTicket):** Ein Gate prüft, ob jemand ein gültiges Ticket hat – statt oder zusätzlich zu AccessKey.

**Setzen?** Nein – nur wenn du solche Extras willst.

---

## Minimal-Beispiel

**Boss (.env):** ROLE=boss, KOMMANDANT_ADDRESSES=0x…,0x…  
**Kommandant (.env):** ROLE=kommandant, BOSS_ADDRESS=0x…, WORKER_ADDRESSES=0x…  
**Arbeiter (.env):** ROLE=arbeiter, BOSS_ADDRESS=0x…, KOMMANDANT_ADDRESSES=0x…, ggf. SIGNER=remote + REMOTE_SIGNER_URL

Mit jedem Gerät einmal /connect, dann gehen Befehle von Boss → Kommandant → Arbeiter.
