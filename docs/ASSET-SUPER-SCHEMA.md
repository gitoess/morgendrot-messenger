# Super-Asset-Schema: Alle IDs pro Twin verknüpfen

Ein **aktiver Twin** in Morgendrot ist wie ein Ordner, der alle relevanten IDs der anderen Kacheln bündelt. So kann das Asset mit dem gesamten System (Messaging, Monitoring, Steuerung, Tresor) interagieren – nicht nur mit dem Streams-Kanal.

---

## 1. Welche IDs gibt es – und wozu?

| Feld / Verknüpfung | ID / Speicherort | Kachel / Säule | Nutzen |
|--------------------|------------------|----------------|--------|
| **Identity** | Object-ID | Asset-Twin | „Geburtsurkunde“ auf der Chain (haben wir). |
| **Control** | Access-Key-ID | Schlüssel & Tickets | Wer darf die Pumpe steuern? Key hat lock_id = Lock (Gerät). Verknüpfung: Metadaten `authorized_key: 0x…` oder beim Übertragen gemeinsam übergeben. |
| **Data** | Anchor-ID (Streams) | Streams | Wo fließen Live-Daten hin? **Bereits on-chain:** `streams_anchor_id`. |
| **Monitor** | Device-ID (Adresse) | Überwachung | Welcher Sensor / welches Gerät überwacht die Pumpe? = Adresse in MONITOR_DEVICES. Verknüpfung: Metadaten `monitor_device_id: 0x…`. |
| **Chat** | Mailbox-ID | Nachrichten (Säule 6) | Direktbefehle an die Maschine (privater Briefkasten). Verknüpfung: Metadaten `mailbox_id: 0x…`. Optional: `monitor_device_id` = Adresse des Geräts → „Zum Chat“ = Nachrichten an diese Adresse. |
| **Logic** | Package-ID | Setup / Chain | Mit welcher Software-Version (Contract) wurde das Asset erstellt? Wichtig für Langzeit: Maschinen laufen 20 Jahre, Package ändert sich. Verknüpfung: Metadaten `package_id: 0x…`. |
| **Tresor** | Vault-Registry-ID | Tresor | Falls das Asset eigene verschlüsselte Daten (Handbücher, Wartungsprotokolle) on-chain hat. Verknüpfung: Metadaten `vault_registry_id: 0x…`. |

---

## 2. Wo werden die IDs gespeichert?

- **On-chain (Move):**  
  - `streams_anchor_id` ist bereits ein Feld in `PhysicalAsset`.  
  - Alle weiteren IDs werden **optional in den Metadaten** (ein JSON-Objekt im Feld `metadata`) abgelegt, damit wir das Schema erweitern können, ohne den Move-Contract zu ändern.

- **Metadaten-JSON (Beispiel):**
```json
{
  "text": "Seriennummer 12345, Hersteller XY",
  "package_id": "0xecbd731a6504207079efe44814cecf4d3b53cd00ba92098e7339925b04c4008a",
  "mailbox_id": "0x…",
  "monitor_device_id": "0x…",
  "vault_registry_id": "0x…",
  "authorized_key_id": "0x…",
  "responsible": "0x…"
}
```

- **Bedeutung:**  
  - `text`: Freitext (wie bisher).  
  - `package_id`: Package-ID zum Erstellungszeitpunkt („Created with Package“).  
  - `mailbox_id`: Mailbox des Geräts (Nachrichten-Kachel).  
  - `monitor_device_id`: Adresse des Sensors/Geräts (Überwachungs-Kachel).  
  - `vault_registry_id`: Vault-Registry für asset-eigene Daten (Tresor-Kachel).  
  - `authorized_key_id`: Key, der die Steuerung erlaubt (Schlüssel & Tickets).  
  - `responsible`: Verantwortliche Adresse (Arbeiter/Kommandant).

---

## 3. Verknüpfung zu den Kacheln

| Kachel | Was die ID am Asset auslöst |
|--------|-----------------------------|
| **Streams** | `streams_anchor_id` → „Zur Überwachung“ setzt Kanal und wechselt in die Überwachung. |
| **Überwachung** | `monitor_device_id` → Zeile im Monitor = dieses Gerät; Anzeige „P-101 (0x…)“ möglich. |
| **Nachrichten** | `mailbox_id` / `monitor_device_id` → „Zum Chat“: Wechsel in Nachrichten, Empfänger = Gerät (Adresse). |
| **Schlüssel & Tickets** | `authorized_key_id` → Anzeige „Steuer-Key: 0x…“; beim Verkauf „Komplettes Paket übertragen“ (Asset + Key). |
| **Setup / Logic** | `package_id` → Anzeige „Created with Package: 0x…“; Langzeit-Referenz für Entschlüsselung/Regeln. |
| **Tresor** | `vault_registry_id` → Link/Info „Vault für dieses Asset: 0x…“. |

---

## 4. Industrie-Standard: Ein Eintrag = ein Super-Asset

Ein marktreifer Eintrag in der Asset-Kachel kann alle diese Verknüpfungen haben. Die UI unterstützt:

- Beim **Anlegen**: optionale Felder für Package-ID, Mailbox-ID, Monitor-Device-ID, Vault-Registry-ID, Authorized-Key-ID (und ggf. Verantwortlicher). Diese werden ins Metadaten-JSON geschrieben.
- In der **Liste**: Anzeige der gesetzten IDs und Buttons („Zur Überwachung“, „Zum Chat“, „Package im Explorer“, …) je nach vorhandener Verknüpfung.

Damit ist der Twin nicht nur ein toter Eintrag, sondern der zentrale Knoten zu allen relevanten Kacheln in Morgendrot.
