# Was ist der MORGENDROT-Messenger?

**MORGENDROT** — das krisensichere Hybrid-Messengersystem  
*Idee, Technik und Einsatzalltag in verständlicher Sprache*

**Stand:** 2026-05-20 · Technik-Details: `docs/EINFUEHRUNG-MORGENDROT-LAIEN.md`, `docs/TRANSPORT-AND-IOTA-LAYERS.md`

---

## 1. Das Problem: Wenn normale Messenger versagen

Bei Unwettern, Blackouts oder überlasteten Netzen bricht die gewohnte Kommunikation schnell weg.

| Kanal | Grenze im Ernstfall |
|-------|-------------------|
| **WhatsApp, Signal, Threema** | Brauchen funktionierende Mobilfunkmasten und Internet |
| **Klassischer Behördenfunk** | Sprachfunk ja — aber schwer mit Lagebildern, langen Protokollen und lückenloser Nachweisführung für die Leitung |

**MORGENDROT** ist ein **Hybrid-System**: im Alltag nutzt es das Internet, im Feld kann das Team **bewusst auf Funk** setzen — ohne eine zweite App. Für die Einsatzleitung gibt es optional **IOTA** als Archiv- und Forensik-Schicht (nicht als langsamen Gruppenchat).

---

## 2. Drei Ebenen — ein Messenger, mehrere Wege

Der **Inhalt** (Text, Anhang, SOS) ist getrennt vom **Transport** (Funk, Internet, Chain).

### Ebene 1 — Krisen-Funk (LoRa / Meshtastic)

Wenn kein zuverlässiges Internet da ist, wählt der Nutzer im Chat den Sendepfad **„Funk“**.

- Das Handy koppelt sich per **Bluetooth** an ein Funkmodul (z. B. **Heltec V3**).
- Nachrichten laufen **von Gerät zu Gerät** im Meshtastic-Mesh — ohne Mobilfunkmasten.
- Im Team schützt ein **gemeinsamer Kanal-Schlüssel (PSK)** die Funkstrecke; den legt die Einsatzleitung im Handoff fest.

> **Wichtig:** Funk ist nicht „automatisch immer an“. Der Helfer (oder sein Profil) entscheidet **Funk oder Online** — je nach Lage.

### Ebene 2 — Internet (Mailbox, optional Telegram)

Wenn WLAN oder LTE funktionieren, ist **Online** der schnelle Weg: verschlüsselte Partner-Adressen (IOTA-Mailbox, Handshake).

**Telegram** ist ein **optionaler Zusatzkanal** (oft am Server konfiguriert): Hinweise, Alarme, Rücklauf — **Klartext** über die Bot-API. Helfer im **Simple Mode** sehen Telegram oft gar nicht; es ersetzt weder Funk noch die Einsatz-Mailbox.

### Ebene 3 — IOTA als digitaler Notar (Archiv)

**IOTA Rebased** dient nicht dazu, jeden Chat-Verlauf live auf der Chain zu tippen.

| Was IOTA leistet | Was nicht |
|------------------|-----------|
| Verankerung wichtiger Vorgänge, Mailbox, Forensik für die Leitung | Kein WhatsApp-Ersatz auf der Blockchain |
| Optional: Kopie nach Funk (**Pfad 4**) oder geplant **Delayed Upload** (erst dünn über Funk, später on-chain) | Nicht jede Zeile sofort und automatisch |

Rechtssicherheit entsteht durch **Betriebskonzept + Export** — nicht durch ein pauschales „gerichtsfest“-Versprechen im Produkttext.

---

## 3. Zwei Schutzschichten für den Einsatz-Stress

### Schicht 1 — ROLE_ID (Chain, unsichtbar)

Eine feste **Bitmaske** (D, L, S, P, …) steuert, was das Gerät **on-chain** darf: Gas-Modell, Senden, Pinnwand, Delegation. Das bleibt kompatibel mit dem bestehenden IOTA-Vertrag — **ohne** Move-Neudeploy.

### Schicht 2 — Capabilities-Matrix (sichtbar in der App)

In `.morgendrot-runtime-config.json` legt der Boss **fein** fest: LoRa, Telegram, IOTA jeweils **lesen/schreiben**, Gruppen, Export, Verschlüsselungspflicht auf Funk.

**Beispiel Medic-Funker:**

| Kanal | Recht |
|-------|--------|
| **LoRa** | Senden und empfangen |
| **Telegram** | Mitlesen, nicht schreiben |
| **IOTA** | Gesperrt (z. B. wenn das Gerät verloren gehen könnte) |

So löst man das alte Problem: „Senden aus“ (S-Bit) hat früher **überall** stumm geschaltet — auch auf Funk. Capabilities entkoppeln das.

---

## 4. Rollen — eine App, verschiedene Gesichter

| Rolle | Für wen | Was sie sieht |
|-------|---------|----------------|
| **Helfer / Arbeiter** | Einsatzkraft | Simple Mode: schlanker Chat, SOS, Sendepfad Funk/Online — wenig Technik |
| **Kommandant (Führer)** | Truppführer | Team-Postfächer, Telefonbuch, Einsatzleitung |
| **Boss** | Leitstelle / Admin | PC: Export-Assistent, Handoff, Vorlagen, Archiv |
| **Wanderer / Prepper** | **Privat**, nicht vom Boss „eingeteilt“ | Eigenes Bundle, Offline-Fokus — **kein** Einsatz-Handoff durch die Leitung |

Navigation typisch: **Nachrichten · Einsatzleitung** (nur Führung) **· Telefonbuch** — kein separates „Funk-Programm“.

---

## 5. Posteingang — alles an einem Ort

Beim **Aktualisieren** des Posteingangs holt das Backend eine **Union** aus mehreren Quellen und sortiert chronologisch:

- IOTA-Mailbox / Events (verschlüsselt, wo vorgesehen)
- Lokales **Telegram-Journal** (wenn angebunden)
- **Funk/Mesh** (über gekoppeltes Modul)
- Handshake- und Einsatz-Kontext

So entsteht **ein** Verlauf — auch wenn die Nachricht physisch über verschiedene Wege kam.

---

## 6. Wirtschaftlich, schnell startklar, echtes Produkt

| Vorteil | Kurz |
|---------|------|
| **Keine eigene Chat-Serverfarm** | Telegram optional; IOTA nutzt öffentliche Nodes; der Betrieb skaliert über vorbereitete Geräte |
| **Handoff in Minuten** | Boss exportiert ein kleines Paket (ZIP oder per IOTA an Partner): Rechte, Partner, Funk-Hinweise — **keine** E-Mail-Registrierung für die 0x-Identität |
| **Endnutzer-Produkt** | PWA/APK fürs Handy, Programm für den PC — **kein** Terminal-Zwang für Helfer |

Ersteinrichtung: Tresor/Wallet auf dem Gerät — der Handoff liefert nur **öffentliche** Parameter, nie den Seed.

---

## 7. In einem Satz

**MORGENDROT** verbindet **Internet-Komfort**, **Funk-Ausfallsicherheit** und **optionale Blockchain-Nachweise** — vorbereitet vom Boss, bedienbar unter Stress, steuerbar bis auf den einzelnen Kanal (Medic-Funker und Reporter).

---

## Weiterlesen

| Thema | Dokument |
|-------|----------|
| Kurz-Einstieg | `docs/EINFUEHRUNG-MORGENDROT-LAIEN.md` |
| Transport & Archiv | `docs/TRANSPORT-AND-IOTA-LAYERS.md` |
| Einsatz vs. Privat | `docs/HANDOFF-UND-MODUS-ZIELBILD.md` |
| Capabilities | `docs/CAPABILITIES-MATRIX-ZIELBILD.md` |
