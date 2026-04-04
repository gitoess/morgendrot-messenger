# Prüfung: Wie bekommt der Gast sicher seinen QR-Code?

**Ziel:** Die Beschreibung der drei Zustellungs-Szenarien und Sicherheitslayer auf Korrektheit und Umsetzbarkeit prüfen. Unterscheidung: **Was existiert heute** vs. **Was ist Zielbild/geplant**.

---

## 1. Die drei Zustellungs-Szenarien – Prüfung

### 1.1 Magic Link (E-Mail / WhatsApp)

| Aussage | Prüfung | Status |
|--------|---------|--------|
| Boss-Wizard generiert verschlüsselten Link (z. B. `morgendrot.app/access/xyz123...`) | **Geplant.** Im Code existiert keine Route `/access/*` und keine Einmal-Link-Generierung. Wizard erstellt heute Key/Ticket und kann an Adresse senden; „Link an Gast“ ist konzeptionell. | Zielbild |
| Link enthält Einmal-Signatur; Klick öffnet minimalistische Web-App (Lite-UI), die QR anzeigt | **Teilweise.** Lite-UI existiert (`ui/`, API-Port); eine **gastseitige** „Lite-UI“ nur für QR-Anzeige nach Klick auf Einmal-Link existiert nicht. „Einmal-Signatur“ wäre serverseitig (Token) oder optional on-chain – aktuell nicht implementiert. | Geplant |
| Schutz: Link nur von einer IP (Handy des Gastes) oder nur nach SMS-Code-Check | **Nicht implementiert.** Kein IP-Binding, kein SMS-Code im Codebase. Als optionale Erweiterung dokumentierbar. | Geplant |

**Fazit:** Das Szenario ist **konzeptionell stimmig**. Umsetzung erfordert: (1) Einmal-Token (Server oder Chain), (2) gastseitige Minimal-Seite „QR anzeigen“ nach Token-Validierung, (3) optional IP/SMS – alles Zielbild für den Wizard.

### 1.2 Schatten-Wallet (zKLogin / Google/Apple)

| Aussage | Prüfung | Status |
|--------|---------|--------|
| Boss sendet Schlüssel an E-Mail des Gastes | Heute: Key wird an **IOTA-Adresse** (recipient) gesendet. „An E-Mail senden“ bedeutet: Zuordnung E-Mail → Adresse (zKLogin/Enoki) – **nicht im Code**. | Zielbild |
| Gast klickt „Mit Google einloggen“; erst dann wird Ticket-NFT für sein Handy sichtbar | zKLogin/Enoki-ähnliche Bindung „Google-Account ↔ IOTA-Adresse“ ist **nicht** implementiert. Entspricht §9.2 in BEGRIFFE-MOVE-REBASED. | Zielbild |
| E-Mail-Abfang: Ohne Google-Konto kein QR-Zugriff | Logisch korrekt, sobald Schatten-Wallet umgesetzt ist. | Konzept ok |

**Fazit:** Inhaltlich **korrekt** beschrieben; technische Umsetzung (IOTA zKLogin/Enoki-Integration) steht aus.

### 1.3 Hardware-Token (physischer Ausdruck)

| Aussage | Prüfung | Status |
|--------|---------|--------|
| Boss druckt QR auf Papier/Karte | Heute: Wizard kann Key/Ticket erstellen; **QR-Ausgabe** für „Key beim Boss“ (ohne Transfer) ist in der Doku (§9) beschrieben, in der UI optional (QR/Explorer-Link). Druck = Darstellung desselben QR. | Umsetzbar |
| TTL: Code nach Aufenthalt wertlos | **Implementiert.** `valid_until_ms` / TTL in Move und Config (`DEFAULT_KEY_TTL_DAYS`); Key/Ticket nach Ablauf ungültig. | ✅ Ist |
| Aktivierung erst bei Check-in vor Ort | **Nicht implementiert.** Kein Geofencing oder „aktivieren bei Ankunft“ im Code. Als optionale Regel dokumentierbar. | Geplant |

**Fazit:** TTL-Story **stimmt**; „erst bei Check-in aktiv“ ist sinnvolle Erweiterung.

---

## 2. Sicherheits-Layer – Prüfung

| Layer | Beschreibung | Im Code / Doku |
|-------|---------------|----------------|
| **TTL** | Code nach Checkout ungültig | ✅ Config + Move: `DEFAULT_KEY_TTL_DAYS`, `valid_until_ms`. |
| **Replay-Schutz** | Kopierter/abfotografierter Code optional auf Einmalnutzung begrenzt | ✅ `replay-state.ts`, `ENABLE_REPLAY_PROTECTION`, `REPLAY_STATE_FILE`; optional pro Lock. |
| **Geofencing** | Code nur in der Nähe des Schlosses (Browser-Standort) | ❌ Nicht implementiert. Zielbild. |

---

## 3. Kurzbewertung

- **Inhaltlich:** Die drei Wege (Magic Link, Schatten-Wallet, Hardware-Token) und die Sicherheitslayer sind **sachlich richtig** und passen zu §9 (BEGRIFFE-MOVE-REBASED). Die Aussage, dass Sicherheit durch **Verschlüsselung auf der IOTA-Chain und den Einmal-Link** garantiert wird, ist für „Key beim Boss“ + Einmal-Token **konzeptionell** richtig; die Einmal-Logik muss serverseitig oder on-chain noch ergänzt werden.
- **Umsetzung:** TTL und Replay-Schutz **existieren**. Magic Link, Schatten-Wallet (zKLogin), IP/SMS, Geofencing und „Aktivierung bei Check-in“ sind **Zielbild** und sollten im Wizard-/Produkt-Backlog als Anforderungen geführt werden.

---

## 4. Empfehlung für den Boss-Wizard

- **Jetzt:** Im Wizard klar machen: „Schlüssel per E-Mail/Link senden“ = heute entweder (a) Key an **Adresse** senden (Gast braucht Wallet/Schatten-Wallet) oder (b) **QR ausstellen ohne Transfer** (Key bleibt beim Boss, §9.3) und QR/Link manuell (z. B. E-Mail/WhatsApp) schicken. Beides in der Doku abgedeckt.
- **Später:** Einmal-Link-Generierung, optional Schatten-Wallet (zKLogin), optional IP/SMS/Geofencing als eigene Backlog-Punkte.

**Referenzen:** `docs/BEGRIFFE-MOVE-REBASED.md` §9, `src/config.ts` (TTL), `src/replay-state.ts`, `src/m2m-lock.ts` (Replay).
