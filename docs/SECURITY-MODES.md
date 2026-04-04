# Sicherheit der optionalen Modi (Pinnwand, Pairwise, Ameisen)

## Übersicht

Alle Modi nutzen dieselben kryptografischen Primitive (ECDH P-256, AES-GCM) und fügen **keine neuen** hinzu. Die Sicherheitsgarantien bleiben mathematisch gleich.

## Broadcast-Pinnwand

| Aspekt | Garantie |
|--------|----------|
| **Verschlüsselung** | Klartext (PlaintextMessage). Nur für Status/Alarm – keine sensiblen Daten. |
| **Sender-Autorisierung** | `BROADCAST_AUTHORIZED_SENDERS` **Pflicht** (nicht leer). Ohne Whitelist wird Pinnwand deaktiviert. |
| **Replay-Schutz** | Nonce pro Sender (acceptAndUpdate, REPLAY_STATE_FILE). |
| **AccessKey** | Unverändert – Lock prüft weiterhin AccessKey on-chain. |
| **Schwachstelle** | Klartext = jeder auf der Chain kann lesen. Nur für nicht-sensible Meldungen nutzen. |

**Sichere Konfiguration:** `ENABLE_BROADCAST_PINNWAND=true` nur mit `BROADCAST_PINNWAND_ADDRESS` und `BROADCAST_AUTHORIZED_SENDERS` (nicht leer).

## Pairwise-Groups

| Aspekt | Garantie |
|--------|----------|
| **Verschlüsselung** | ECDH + AES-GCM pro Partner. Jede Nachricht einzeln verschlüsselt. |
| **Handshake** | Jeder Partner hat eigenen ECDH-Handshake. Kein gemeinsamer Schlüssel. |
| **Replay** | Nonce-Toleranz (handshakeNonce) wie bei 1:1. |
| **Sender-Validierung** | Nur Nachrichten von Partnern in peerMap werden entschlüsselt. Unbekannte Sender ignoriert. |

**Keine neuen Schwachstellen.** Teurer (n TX pro Nachricht), aber sicherer als Broadcast.

## Ameisen-Modell

| Rolle | Autorisierung | Sicherheit |
|-------|---------------|-------------|
| **Arbeiter** | `getEffectiveAuthorizedSenders()` = BOSS_ADDRESS + KOMMANDANT_ADDRESSES (wenn AUTHORIZED_SENDERS leer) | Nur Boss und Kommandanten dürfen OPEN auslösen. AccessKey bleibt Pflicht. |
| **Boss** | Sendet an KOMMANDANT_ADDRESSES. Keine zusätzliche Prüfung. | Gleiche Krypto wie Messenger. |
| **Kommandant** | Empfängt von BOSS_ADDRESS, sendet an WORKER_ADDRESSES. | Pairwise – jeder Kanal einzeln verschlüsselt. |

**Mathematisch:** Keine Änderung an ECDH/AES-GCM. Nur Routing-Logik.

## Checkliste (mathematisch 100 % sicher)

- [x] Keine neuen Krypto-Primitive
- [x] Replay-Schutz (Nonce) für alle Modi
- [x] Sender-Whitelist (BROADCAST_AUTHORIZED_SENDERS, AUTHORIZED_SENDERS) vor Verarbeitung
- [x] AccessKey-Prüfung (Lock) unverändert
- [x] Pinnwand: Whitelist Pflicht, sonst deaktiviert
- [x] Keine Umgehung der bestehenden Sicherheitslogik
