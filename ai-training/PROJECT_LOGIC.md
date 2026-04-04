# Morgendrot – System-Logik & Kausalitäts-Matrix

Reine Kausalität ohne Codezeilen. Dient der KI als Landkarte: welche Säule, was davor/danach, welches Move-Event.

---

## Ebene 1: Die 4 Säulen (Struktur)

- **Säule 1 (Fundament):** Definiert MY_ADDRESS und PACKAGE_ID. Ohne diese gibt es keine On-Chain-Existenz. RPC muss erreichbar sein. Wallet entsperrt.
- **Säule 2 (Kanal):** Regelt das Vertrauen. Erst /handshake (ECDH-Schlüsseltausch), dann /connect (Leitung offen). Partner in PARTNER_ADDRESS/PARTNER_ADDRESSES.
- **Säule 3 (Aktivität):** Das operative Geschäft. Senden von Nachrichten (/send, /send-plain), Erstellen von AccessKeys/Tickets via PTB, /fetch.
- **Säule 4 (Nachsorge):** Die ökonomische Reinigung. /vault-save sichert Keys lokal, /purge-handshake und /purge-key holen IOTA-Rebate zurück (ENABLE_PURGE, MAILBOX_ID).

---

## Ebene 2: Logische Abhängigkeiten (Wenn-Dann)

1. **Zutritts-Logik:** Wenn create_access_key (Move) erfolgreich → dann Objekt-ID optional in VAULT_FILE (Node) speichern → nach Ablauf /purge-key (Rebate) auslösen.
2. **Chat-Logik:** Wenn Nachricht verschlüsselt → dann muss EcdhInit/Handshake auf der Chain existieren (peerMap) → sonst zuerst /handshake, Partner /connect. /send nur wenn verbunden.
3. **Hardware-Logik (Lock):** Wenn OPEN-Befehl empfangen → prüfe AUTHORIZED_SENDERS und AccessKey on-chain → nur bei Treffer OPEN_COMMAND/OPEN_URL ausführen.
4. **IOTA senden:** /transfer-coins braucht keine Säule 2 (kein /connect). Braucht Säule 1 (MY_ADDRESS, Wallet).

---

## Ebene 3: Befehls-Mapping (Technik)

- /create-key → Move: create_access_key → Event AccessKeyCreated → Gast wird Owner. FOLGEAKTION: /vault-save (Säule 4), später /purge-key (Rebate).
- /handshake → Move: store_ecdh_init (Mailbox) → Partner muss /connect ausführen → dann /send möglich.
- /send → Move: store_encrypted_message (Mailbox). Voraussetzung: peerMap nicht leer (nach /connect).
- /send-plain → Move: store_plaintext_message / PlaintextMessage Event. Kein Handshake nötig.
- /transfer-coins → Chain: transferCoins (native IOTA). Kein Move-Messaging.
- /vault-save → Lokal: AES-verschlüsselte JSON in VAULT_FILE. Keine Chain-TX.
- /purge-handshake, /purge-msg, /purge-key → Move: purge_* → Rebate (IOTA zurück). ENABLE_PURGE, MAILBOX_ID nötig.

---

## Verknüpfung: Dashboard (Node/UI) ↔ Move-Contract

- Die 0x…-Adresse in der UI (Partner, Gast) ist dieselbe wie owner/recipient im Move-Objekt.
- PACKAGE_ID (Säule 1) = Package auf der Chain, unter dem messaging, vault, access_key laufen.
- Was die UI als „Verbunden“ (🟢) anzeigt, entspricht peerMap.size > 0 (Handshake + Keys vorhanden).
