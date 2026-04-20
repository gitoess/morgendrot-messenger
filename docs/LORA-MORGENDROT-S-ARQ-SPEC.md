# Morgendrot Selective-ARQ (S-ARQ) — Spezifikation (Entwurf v0)

**Status:** Normative Basis; **Wire-Helfer + CRC + Budget** implementiert in `frontend/frontend/lib/lora-sarq-wire.ts` (Vitest: `frontend/frontend/lib/lora-sarq-wire.test.ts`). Parser/Empfang/Senden in der Chat-UI folgt später.

**Verwandt:** `src/morgendrot-image-transport-policy.ts`, `frontend/frontend/lib/lora-progressive-image-client.ts`, `docs/LORA-LUMA-CHROMA-UI-STATES.md`, Konstante `MESHTASTIC_LORA_TEXT_WIRE_UTF8_MAX_BYTES` in `frontend/frontend/lib/compact-image-wire.ts`.

---

## 1. Kritische Korrektur der Ausgangsannahmen

### 1.1 Harte Schranke (Repo-Ist)

Pro Meshtastic-Textnachricht gilt (Frontend, Abgleich mit Backend):

\[
L_{\max} := \texttt{MESHTASTIC\_LORA\_TEXT\_WIRE\_UTF8\_MAX\_BYTES} = 500
\]

Die **gesamte** UTF-8-Zeichenkette inkl. Marker, Metadaten, Base64 und ggf. Kanal-Signatur muss in \(L_{\max}\) passen — nicht „~700 Zeichen“.

### 1.2 Segmentgröße 512 Byte Roh + Base64

Base64-Länge für \(S\) Rohbytes:

\[
B(S) = \left\lceil \frac{4S}{3} \right\rceil
\]

Für \(S = 512\): \(B(512) = 684\) Zeichen (ASCII = 684 UTF-8-Bytes nur für den Payload).

Mit Header/Footer \(H\) (Marker, `msgId`, `seg`, `len`, `crc`, `]]`) gilt für **eine** Nachricht:

\[
\mathrm{UTF8\text{-}Bytes}(\text{Wire}) \approx H + B(S) \gg 500
\]

**Folgerung:** 512-Byte-Rohsegmente in **einer** Meshtastic-Nachricht sind mit typischem Framing **unvereinbar**. Die Segmentgröße \(S\) muss **rückwärts** aus \(L_{\max}\) und \(H\) berechnet werden:

\[
S_{\max} = \max\left\{ S \in \mathbb{N}_0 \;\middle|\; H + \left\lceil \frac{4S}{3} \right\rceil + F \le L_{\max} \right\}
\]

wobei \(F\) Footer/Overhead (z. B. `crc=…`, `]]`) ist. Für reine ASCII-Payload gilt oft \(\mathrm{UTF8\text{-}Bytes} \approx \text{Zeichenzahl}\).

**Ist-Wert (Default-Kopf):** Mit `DEFAULT_MORG_SEG_DIMS` (`msgId=deadbeef`, `phase=luma`, `seg=0`, `n=16`) liefert `computeMaxMorgSegV1RawPayloadBytes` / `MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES` aktuell **321** Rohbyte pro Meshtastic-Nachricht bei \(L_{\max}=500\) (siehe Vitest in `lora-sarq-wire.test.ts`). Längere Dezimaldarstellungen in `seg`/`n` verkleinern \(S_{\max}\) geringfügig.

### 1.3 „Perfekt“ vs. JPEG-Realität

Aktuell: **Zwei JPEGs** (LUMA + CHROMA), semantisch progressiv (S/W → Farbe), **nicht** beliebige 512-Byte-Stücke eines JPEG-Bytestroms.

- **Arbitrary chunking** von JPEG-Bytes: Decoder liefert erst sinnvolle Vorschau, wenn **gültige** JPEG-Struktur vorliegt (Restart-Marker / progressive Scan / vollständiger Entropy-Coded-Bereich je nach Encoder). „12/16 Segmente = unscharf“ ist **nur** bei **Raster-Rohdaten** oder speziell segmentiertem Codec trivial.
- **S-ARQ + LUMA/CHROMA beibehalten:** Sinnvolle Brücke: **S-ARQ pro Phase** — Segmentierung **innerhalb** des **einen** LUMA-Wires bzw. **einen** CHROMA-Wires (viele Meshtastic-Nachrichten, eine logische LUMA-Datei), erst nach vollständigem LUMA → CHROMA-Stream starten (wie heute UX-philosophisch).

---

## 2. Verbessertes Wire-Modell (Text-sicher, parserfest)

### 2.1 Warum nicht `|`-CSV mit Roh-Payload

`PAYLOAD` darf **kein** freies `|` enthalten, wenn `|` Trenner ist. Base64 nutzt `A–Z a–z 0–9 + /` und Padding `=` — **kein** `|`. Trotzdem: **Längen-präfix** (`len=`) wie bei `MORG_LUMA_V1` vermeidet Parser-Gier und erlaubt zukünftige Alphabete.

### 2.2 Segment-Frame (Vorschlag `MORG_SEG_V1`)

Einheitliches Muster (analog zu `MORG_LUMA_V1`):

```text
[[MORG_SEG_V1:msgId=<hex8>|phase=luma|seg=<i>|n=<N>|len=<L>|<payload>|crc=<hex4>]]
```

| Feld | Bedeutung |
|------|-----------|
| `msgId` | 8 hex Zeichen; **pro Bild** (LUMA-Kette) bzw. eigene ID für CHROMA-Kette |
| `phase` | `luma` \| `chroma` |
| `seg` | \(i \in \{0,\ldots,N-1\}\) |
| `n` | \(N\) (Gesamtsegmentzahl dieser Phase) |
| `len` | Zeichenlänge von `payload` (Base64), wie heute |
| `payload` | Base64(Rohbytes des Segments) |
| `crc` | **CRC16-CCITT-FALSE** über **Rohbytes** des Segments, hex 4 Zeichen (führende Nullen) |

**CRC16-CCITT-FALSE (XMODEM-üblich):** Polynom `0x1021`, Init `0xFFFF`, kein Refin/Refout, XOROUT `0x0000`. Testvektor dokumentieren (z. B. ASCII `"123456789"` → `0x29B1` nach Implementierung verifizieren).

### 2.3 Abschluss einer Phase

Option A: explizites **DONE**-Paket (klein):

```text
[[MORG_SEG_DONE_V1:msgId=<hex8>|phase=luma|n=<N>|sha256=<hex64>]]
```

`sha256` über Konkatenation aller Rohsegmente **in Reihenfolge** (Integrität über die ganze Phase).

Option B: nur Timeout + \(i\) erwartet — schlechter für Airtime (Empfänger rät).

---

## 3. Selective-ARQ — NAK (Sammel)

### 3.1 Empfängerzustand

Bitvektor \(b \in \{0,1\}^N\): \(b_i = 1\) ⇔ Segment \(i\) **vollständig und CRC ok**.

Empfangene Menge \(R \subseteq \{0,\ldots,N-1\}\) (Indices mit gültigem Frame). Update: \(b_i := 1\) für validierte \(i\).

### 3.2 NAK-Trigger

- Empfang **DONE** für (`msgId`, `phase`), oder
- Timeout \(T\) nach letztem Segment-Frame (Policy), oder
- Sprung in `seg` erkennbar fehlend (optional).

### 3.3 NAK-Nachricht (kompakt)

Bitmaske \(M = \sum_{i: b_i=0} 2^i\) für fehlende Segmentindizes \(i\) (Bit \(i\) gesetzt = „Segment \(i\) fehlt“). Im Wire: **32 Bit** = **8 Hex-Ziffern** (Indizes \(0..31\)); fehlende \(i \ge 32\) sind in dieser Nachricht nicht kodierbar — ggf. zweite Runde / kürzeres \(N\) planen.

```text
[[MORG_NAK_V1:msgId=<hex8>|phase=luma|mask=<hex8>]]
```

**Vorteil gegenüber `3,7`:** feste Länge, kein CSV-Parsing, keine Mehrdeutigkeit bei zweistelligen Indizes.

### 3.4 Sender-Reaktion

Eingabe: \((\texttt{msgId}, \texttt{phase}, M)\). Sende erneut **alle** \(i\) mit Bit \(i\) in \(M\) gesetzt (fehlend). Maximal \(K\) NAK-Runden (z. B. \(K=3\)) — **Airtime-Schutz**.

---

## 4. Luftzeit / Taktung (Pflicht, keine Marketingzahl)

Zwischen **Meshtastic-`sendText`-Aufrufen** muss eine Pause \( \Delta t \) existieren, die **Duty-Cycle** und Firmware-Stabilität respektiert (EU 868: mittlere Sendezeit begrenzt). „2 s“ ist eine **Startheuristik**, kein Beweis — messen und an `NO_RESPONSE`/error 8 anpassen.

---

## 5. Zustandsautomat (Empfänger, pro `msgId` + `phase`)

Zustände: `IDLE` → `HDR` (optional, falls msgId nur aus erstem SEG kommt) → `RECV` → `NAK_PENDING` | `ASSEMBLE` → `DONE` | `ABORT`.

Übergänge:

- Gültiges `SEG` → Buffer update + CRC ok → \(b_i := 1\)
- `SEG_DONE` oder Timeout in `RECV` → wenn \(\exists i: b_i=0\) → sende `MORG_NAK_V1`, sonst `ASSEMBLE`
- `ASSEMBLE` → JPEG aus Bytes bauen → Anzeige / Fusion (CHROMA erst nach LUMA-DONE laut Produkt)

---

## 6. Migration neben `MORG_LUMA_V1` / `MORG_CHROMA_V1`

- **V1** bleibt für kleine Bilder / Abwärtskompatibilität.
- **S-ARQ** ist **opt-in** (Feature-Flag oder automatisch, wenn Roh-JPEG nach V1-Encode > eine Nachricht): Sender wählt `MORG_SEG_V1`-Strom statt monolithischem `MORG_LUMA_V1`.

Parser-Reihenfolge in `ChatMessageBody`: zuerst V1 erkennen; wenn Teilstring `MORG_SEG_V1` für gleiche Session → S-ARQ-Pfad.

---

## 7. Implementierungs-Fahrplan (ohne Hype)

1. **`S_max` messen** mit realem Header-String gegen `500` UTF-8.
2. **Server:** optional gleicher Encoder wie heute, Ausgabe **Roh-JPEG-Bytes** + Aufteilung in Segmente + `sha256` der Phase (oder Client splittet V1-Wire zurück-decodiert — ineffizient; besser API liefert Segmente).
3. **Client senden:** Burst mit \(\Delta t\), NAK lesen, Retransmit nur `mask`.
4. **Client empfangen:** Buffer + UI „\(k/N\) Segmente“, NAK senden (Button „Lücken anfordern“ vs. automatisch — politisch).
5. **Tests:** CRC-Golden Vectors; Parser mit trunciertem `len`; NAK roundtrip.

---

## Anhang A — TypeScript-Skizzen (nicht eingebunden)

### A.1 Referenz-Implementierung

Siehe `frontend/frontend/lib/lora-sarq-wire.ts`: `crc16CcittFalse`, `buildMorgSegV1Wire`, `buildMorgNakV1Wire`, `nakMaskFromMissingIndices`, `missingIndicesFromNakMask`, `computeMaxMorgSegV1RawPayloadBytes`, Konstante `MORG_SEG_V1_DEFAULT_MAX_RAW_BYTES`. Parser/Reassembly: `lora-sarq-parser.ts`, `lora-sarq-reassembly.ts`, Hook `use-morg-seg-reassembly.ts`.

Goldtest: ASCII `"123456789"` → CRC `0x29B1`.

---

## Kurzfassung

| Idee | Urteil |
|------|--------|
| LUMA/CHROMA + S-ARQ | **Sinnvoll** als **zwei Phasen**, S-ARQ **innerhalb** jeder Phase |
| 512 B/Segment in **einer** MTU | **Verworfen** unter \(L_{\max}=500\) |
| `[[MORG_NAK\|ID\|3,7]]` | **Verbesserbar** → **hex Bitmaske** |
| CRC16 0x1021 | **Standard** — **exakt** spezifizieren + Goldtests |
| „Unscharf nach Teil-LUMA“ bei JPEG-Segmentierung | **Nur** mit passendem Bildformat/Encoder **garantierbar**; sonst nur **Fortschritt „Bytes da“** |

Damit ist „Morgendrot S-ARQ“ **kein Ersatz** für die mathematische Realität der **500-Byte-Wire**, sondern eine **korrekt dimensionierte** Erweiterung derselben Infrastruktur.
