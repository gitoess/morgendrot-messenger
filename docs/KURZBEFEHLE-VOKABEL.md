# Kurzbefehle (Stichwort-Kaskade)

Wenn du dich an diese **5 Satzanfänge** hältst, reagiert die KI in Millisekunden – ohne Grammatik-Analyse, nur Entitäten-Erkennung (Adressen, Zahlen). Das ist die schnellste und stabilste Taktik für den AI-Copilot.

## Ein Befehl pro Eingabe

**Gib der KI immer nur einen Befehl auf einmal.** Statt „sende 1 IOTA und danach einen Text“ besser: zuerst „sende 1 iota an 0x…“ eingeben und ausführen, danach „sende text“ (oder „Message 0x… Hallo“). So bleibt die Zuordnung eindeutig, die KI muss nicht mehrere Aktionen in einer Antwort bündeln, und Fehlerquellen (z. B. falsche Reihenfolge) entfallen.

## Die 5 Standard-Sätze

| Stichwort   | Muster                    | Auswirkung |
|------------|---------------------------|------------|
| **Setup**  | `Setup [Adresse]`         | Säule 1: Package-ID setzen (`/set-package-id`) |
| **Handshake** | `Handshake [Adresse]`  | Säule 2: ECDH-Handshake an Partner (`/handshake`) |
| **Message**   | `Message [Adresse] [Text]` | Säule 3: Klartext senden (`/send-plain`) |
| **Access**    | `Access [Adresse] [Tage]`  | Key ausstellen (`/create-key`), z. B. `Access 0x… 7` |
| **Purge**     | `Purge [ID]` oder `Purge handshake` | Säule 4: Rebate/Löschen (`/purge-key`, `/purge-ticket`, `/purge-handshake`) |

## Beispiele

- `Setup 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5`
- `Handshake 0x0748…`
- `Message 0x0748… Hallo, Termin steht.`
- `Access 0x0748… 7`  → Key für 7 Tage
- `Purge 0x1111…`  → Key löschen (Rebate)
- `Purge handshake`  → Handshake aus Mailbox löschen

## Technik

- **Intent-Matcher:** Die Stichwort-Kaskade wird zuerst geprüft (`tryStichwortKaskade` in `src/ai-intent-matcher.ts`). Erst danach laufen die übrigen Phrasen und optional Ollama.
- **UI:** Die Liste ist auf dem Dashboard unter „Sag, was du willst“ als aufklappbare **Kurzbefehle** sichtbar und im Chat-Tab im Copilot-Bereich erwähnt.

## Abhängigkeiten: KI fragt nach

Die KI kennt die Abhängigkeiten und fragt bei Mehrdeutigkeit nach:

- **Tickets und Keys** brauchen **keinen** Handshake, **keinen** /connect (On-Chain-Objekte).
- Nur **verschlüsselte** Nachrichten (/send) brauchen vorher: /handshake → Partner /connect → /send.
- **Klartext** (/send-plain) und **IOTA** (/transfer-coins) brauchen keinen Handshake.

Wenn du z. B. sagst: „Sende Einladung an 0x…“, ohne „Klartext“ oder „Verschlüsselt“, fragt die KI: *„Wie soll die Nachricht ankommen? (1) Klartext – sofort mit /send-plain. (2) Verschlüsselt – zuerst /handshake …“* So werden die nächsten Schritte (wie beim Durchgehen der 13 Schritte) aktiv abgefragt.

## Warum diese Taktik?

- **Geschwindigkeit:** Kein „Nachdenken“, nur Mappen → Antwort in Echtzeit (< 100 ms).
- **Präzision:** Keine Missverständnisse durch „Heyyy“ oder „Kannst du mal …“.
- **Stabilität:** Bei standardisierten Befehlen arbeitet ein kleines Modell (z. B. Qwen) so zuverlässig wie ein großes.
