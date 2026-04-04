# Morgendrot Design-Manifest – 7 Grundregeln

Alle Regeln sind optional und per `.env`-Flag umschaltbar. Standard = sicher & restriktiv. Der User entscheidet.

---

## 1. SPOF = Seed

Der Master-Seed (Mnemonic) ist der einzige kritische Punkt. Alles andere (Keys, Vault, Nachrichten, Objekte) darf verloren gehen – es ist ersetzbar oder neu erzeugbar.

→ Kein Flag nötig (fest verdrahtet)

---

## 2. Standard ist verschlüsselt & sicher – aber der User entscheidet

Alles, was standardmäßig öffentlich werden würde, wird verschlüsselt – außer der User stellt es explizit anders ein.

- **Default:** ECDH + AES-GCM für Nachrichten
- **Opt-in Klartext:** z.B. für Tests, Demos, öffentliche Bekanntmachungen

→ `ENABLE_PLAINTEXT_CHANNEL=false` (Default: verschlüsselt)  
→ `ENABLE_PLAINTEXT_CHANNEL=true` (Allow Cleartext)

---

## 3. Jedes Gerät handelt nur lokal & autark

Jede Instanz entscheidet selbst und nur nach lokalen Regeln:

- Sender in Whitelist?
- Nonce > letzter bekannter?
- AccessKey gültig?
- Befehl erlaubt? (`ENABLE_AUTO_EXECUTE`)

→ Kein Flag (Kernprinzip)  
→ `AUTHORIZED_SENDERS`, `ENABLE_AUTO_EXECUTE` steuern Verhalten

---

## 4. Discovery ist blind & öffentlich – aber optional verschlüsselt

Handshake-Events (EcdhInit) werden standardmäßig offen gesendet. Der User kann auf verschlüsselte Discovery umstellen (z.B. Streams, private Kanäle).

→ `USE_ENCRYPTED_DISCOVERY=false` (Default)  
→ `USE_ENCRYPTED_DISCOVERY=true` (geplant – z.B. Streams-basierte Discovery)

---

## 5. Alles Kritische ist standardmäßig löschbar – aber der User entscheidet

Vault, Mailbox-Inhalte, AccessKeys, temporäre Nachrichten sind purgebar (manuell oder nach TTL). Der User kann Purge deaktivieren – dann bleiben Daten dauerhaft.

→ `ENABLE_PURGE=true` (Default)  
→ `ENABLE_PURGE=false` (Daten bleiben, Purge-Befehle werden abgelehnt)  
→ `DEFAULT_TTL_DAYS=30`

---

## 6. Automatisierung ist standardmäßig aktiv – aber abschaltbar

Listener, Auto-Execution, Purge-Checks, Hardware-Befehle laufen automatisch. Der User kann alles abschalten.

→ `ENABLE_AUTO_EXECUTE=true` (Default)  
→ `ENABLE_HARDWARE_OPEN=true` (Default, wenn OPEN_COMMAND/OPEN_URL gesetzt)  
→ `ENABLE_LISTENER=true` (Default)

---

## 7. Der User ist König – er überschreibt alles

Alle Regeln sind optional und per Konfig/Flag umschaltbar. Sicherheit = Default, Flexibilität = User-Wahl.

---

## Flag-Zuordnung (Übersicht)

| Regel | Flag(s) | Default |
|-------|---------|---------|
| 2 | ENABLE_PLAINTEXT_CHANNEL | false |
| 5 | ENABLE_PURGE | true |
| 4 | USE_ENCRYPTED_DISCOVERY | false |
| 6 | ENABLE_AUTO_EXECUTE, ENABLE_HARDWARE_OPEN, ENABLE_LISTENER | true |
