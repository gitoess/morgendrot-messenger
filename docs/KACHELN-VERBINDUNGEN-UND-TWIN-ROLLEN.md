# Kacheln: Verbindungen, Überschneidungen, Twin ↔ Arbeiter/Kommandant/Boss

## 1. Übersicht aller Kacheln und was sie nutzen

| Kachel | Kern-Daten / Env | Zweck |
|--------|------------------|--------|
| **Nachrichten (Chat)** | PARTNER_ADDRESS, Mailbox, Vault (Keys) | Senden/Empfangen verschlüsselt, Handshake, /fetch, /send. Kein direkter Bezug zu Assets oder Rollen. |
| **Schlüssel & Tickets** | LOCK_ID (Lock-Adresse), Keys (lock_id, recipient), Tickets (event_id, recipient) | Keys = Zutritt für ein **Lock** (Tür/Pumpe). Lock = Gerät mit Adresse. Key wird an **Empfänger** (Arbeiter/Gast) übergeben. Tickets = Event-Eintritt. |
| **Asset-Twin** | PhysicalAsset (name, metadata, streams_anchor_id, nfc_uid), PACKAGE_ID | Physische Objekte on-chain. QR-Label, Übertrag, Purge. „Zur Überwachung“ → setzt STREAMS_ANCHOR_ID und wechselt zu Überwachung. |
| **Streams** | STREAMS_BRIDGE_URL, STREAMS_ANCHOR_ID | Kanal für feeless Daten (Publish/Fetch, Subscribe). Wird von **Überwachung** (Heartbeat) und vom **Asset** (streams_anchor_id) genutzt. |
| **Steuerung (Boss)** | BOSS_ADDRESS, KOMMANDANT_ADDRESSES, WORKER_ADDRESSES, MONITOR_DEVICES, DEVICE_NAMES | **Geräte** = Adressen von Arbeitern/Kommandanten. Boss fügt Geräte hinzu, weist Rolle zu, sendet Befehle, provisioniert Keys. |
| **Überwachung (Monitor)** | MONITOR_DEVICES, STREAMS_ANCHOR_ID, Heartbeat-State | Zeigt **letzten Heartbeat** pro Geräte-Adresse (aus MONITOR_DEVICES). Liest Streams-Kanal; Geräte senden Heartbeat auf ihren Kanal. |
| **Tresor** | VAULT_FILE, ENCRYPTED_ENV_FILE | Keys sichern/laden. Quer zu allen Kacheln (Signatur). |
| **IDs & Verlauf** | Package-IDs, Anchor-IDs, Adressen | Listen, keine Steuerlogik. |

---

## 2. Verbindungen und Überschneidungen (logisch)

```
                    ┌─────────────────┐
                    │  PhysicalAsset   │  (Asset-Twin)
                    │  streams_anchor_id│
                    └────────┬─────────┘
                             │ gleicher Kanal
                             ▼
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Boss/Steuerung│────▶│  STREAMS_ANCHOR │◀────│  Überwachung    │
│ Geräte (Adressen)   │  (ein Kanal)   │     │  Heartbeat/Zeile │
│ MONITOR_DEVICES     └─────────────────┘     └─────────────────┘
│ WORKER_ADDRESSES          ▲
└──────────────┘             │ sendet Heartbeat
        │                   │
        │ Key für Lock      │ Lock = Pumpe/Controller
        ▼                   │ (hat Adresse = LOCK_ID)
┌──────────────┐     ┌─────────────────┐
│ Schlüssel &  │────▶│  AccessKey      │  lock_id = Lock-Adresse
│ Tickets      │     │  recipient = 0x… │  (Arbeiter hält Key)
└──────────────┘     └─────────────────┘
```

- **Asset ↔ Streams:** Asset speichert `streams_anchor_id`. Das ist derselbe Kanal, auf dem z. B. die Pumpe (Lock/Controller) Heartbeats sendet. Verbindung: **ein Kanal pro Asset (bzw. pro Gerät)**.
- **Asset ↔ Key:** Nicht on-chain verknüpft. Key hat `lock_id` = Adresse des **Locks** (Tür/Pumpen-Controller). Wenn das Lock die Pumpe ist, dann „gehört“ der Key zur Pumpe. Verknüpfung über **Lock-Adresse**: Asset könnte dieselbe Adresse in Metadaten führen (z. B. `lock_id: 0x…`) oder man hält es konventionell.
- **Boss-Geräte ↔ Überwachung:** `MONITOR_DEVICES` = Liste von Adressen, die in der Überwachung als Zeilen erscheinen (letzter Heartbeat). Oft dieselben Adressen wie in **Steuerung → Geräte** (Arbeiter/Kommandant). Wer also als „Gerät“ beim Boss eingetragen ist und Heartbeat sendet, erscheint im Monitor.
- **Twin ↔ Arbeiter/Kommandant/Boss:** Bisher **keine** explizite Verknüpfung im System. Sinn und mögliche Umsetzung siehe unten.

---

## 3. Haben wir „alles“? Lücken

- **Asset ↔ Kanal:** Da. (streams_anchor_id, „Zur Überwachung“.)
- **Asset ↔ Key (Besitz/Steuerung):** Nur konventionell (Metadaten oder „Komplettes Paket übertragen“). Kein on-chain Feld „authorized_key“.
- **Asset ↔ „Welches Gerät sendet für diesen Twin?“:** Nicht abgebildet. Monitor zeigt Adressen aus MONITOR_DEVICES; welche Adresse zu welchem Asset gehört, steht nirgends.
- **Rolle (Arbeiter/Kommandant/Boss) ↔ Asset:** Keine Verknüpfung. Boss sieht seine Geräte, sieht aber nicht „Pumpe P-101 → verantwortlich: Arbeiter X“.

---

## 4. Sinn: Twin mit Arbeiter/Kommandant/Boss verknüpfen?

### Wofür eine Verknüpfung gut ist

- **Verantwortung:** „Diese Pumpe (Asset) ist zugewiesen an Arbeiter 0x… / Kommandant 0x….“  
  → Boss sieht in einer Ansicht: Asset + verantwortliche Person, kann gezielt Befehle schicken oder Keys für dieses Lock an genau diese Adresse ausstellen.
- **Überwachung lesbar machen:** Wenn ein Eintrag im Monitor „0xAbc…“ ist, weiß der Boss nur über Konvention oder Namen (DEVICE_NAMES), dass es „Pumpe West“ ist. Mit Verknüpfung **Asset ↔ Adresse** könnte die Überwachung anzeigen: „P-101 (0xAbc…) – letzter Heartbeat …“.
- **Eskalation:** Offline-Alarm geht an Webhook; wenn zusätzlich „Asset P-101 → Kommandant Y“ gespeichert ist, könnte später (z. B. in eigener Logik) „Alarm für P-101 an Kommandant Y“ abgebildet werden.

### Welche Verknüpfung wohin?

| Verknüpfung | Sinn | Wo speichern |
|-------------|------|----------------|
| **Twin → verantwortliche Adresse (Arbeiter/Kommandant)** | „Wer ist für dieses Asset zuständig?“ | In **Metadaten** des Assets (z. B. `responsible: 0x…`) oder in einer Konfiguration (z. B. Boss: Gerät → Liste von Asset-IDs). |
| **Twin → Boss** | Meist redundant: Boss ist Besitzer (Wallet) oder hat die Geräteliste. | Kein extra Feld nötig. |
| **Twin → Lock-Adresse** | „Dieses Asset wird von diesem Lock (Pumpe/Controller) gesteuert.“ Key hat dasselbe lock_id. | In Metadaten z. B. `lock_id: 0x…` oder über streams_anchor_id + Konvention (ein Kanal = ein Lock). |

### Welche Daten konkret?

- **Pro Asset optional:**
  - `responsible_address` oder in Metadaten: `responsible: 0x…` (eine Adresse: Arbeiter oder Kommandant).
  - Optional `lock_id: 0x…` (wenn das physische Steuergerät = Lock und Keys für dieses Lock ausgestellt werden).
- **Pro Gerät (Boss-Liste) optional:**
  - `assigned_asset_ids: ["0xAsset1…", "0xAsset2…"]` – welche Assets diesem Gerät (Arbeiter/Kommandant) zugeordnet sind.

Eine davon reicht für „Twin mit Arbeiter/Kommandant verknüpfen“; die andere Seite kann daraus abgeleitet werden.

---

## 5. Empfehlung: Minimale sinnvolle Verknüpfung

- **Sinnvoll und ohne Move-Änderung:**  
  Beim Anlegen/Bearbeiten eines Assets im **Asset-Twin** ein optionales Feld **„Verantwortlich (Adresse)“** oder **„Zugewiesen an (Gerät)“**: eine Adresse 0x… (Arbeiter/Kommandant aus der Boss-Liste).  
  Speicherung: im **Metadaten**-Text des Assets (z. B. JSON `responsible: "0x…"`) oder in einer **lokalen/Backend-Konfiguration** (z. B. Config-Key `ASSET_RESPONSIBLE` = JSON `{ "0xAssetId": "0xWorkerAddr" }`).
- **Anzeige:**  
  In der Asset-Twin-Liste optional anzeigen: „Verantwortlich: 0x…“ bzw. Namen aus DEVICE_NAMES, falls vorhanden.  
  In der Steuerung könnte bei Geräten optional stehen: „Zugewiesene Assets: P-101, …“ (wenn man die Zuordnung andersherum pflegt).
- **Überwachung:**  
  Wenn MONITOR_DEVICES = Geräte-Adressen und eine Tabelle „Asset → responsible_address“ existiert, kann die Monitor-Ansicht pro Zeile anzeigen: „P-101 (0x…)“ statt nur „0x…“, sofern die Adresse einem Asset zugeordnet ist.

---

## 6. Kurz: Macht das Sinn, haben wir alles?

- **Sinn:** Ja. Twin mit **Arbeiter/Kommandant** zu verknüpfen („verantwortlich / zugewiesen“) ist sinnvoll für Verantwortung, bessere Lesbarkeit der Überwachung und gezielte Steuerung/Keys. Twin mit **Boss** explizit zu verknüpfen bringt meist keinen Zusatznutzen (Boss = Besitzer oder oberste Instanz).
- **Haben wir alles?**  
  - Für **Betrieb des Zwillings** (QR, Kanal, Überwachung, Übertrag, Key+Asset-Paket): Ja, die beschriebenen Verbindungen sind vorhanden oder angelegt.  
  - Für **„Welcher Mensch/Gerät ist für welchen Twin zuständig?“**: Nein, diese Verknüpfung fehlt noch; sie lässt sich mit **optionalem Feld „Verantwortlich (Adresse)“** und Speicherung in Metadaten oder Config ohne Contract-Änderung umsetzen.

Wenn du willst, kann als nächster Schritt genau diese optionale Verknüpfung (ein Feld + Speicherort + Anzeige in Asset-Twin und ggf. Monitor) konkret im UI/Backend ausgearbeitet werden.
