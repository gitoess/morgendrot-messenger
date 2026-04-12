# LoRa, Notfall & IOTA: Realitätscheck (keine volle TX über Funk)

**Zweck:** Eine **kanonische** Einordnung der Idee „im Notfall eine **IOTA-Transaktion** über **LoRa** schicken, Gateway leitet ins Internet“.  
**Stand:** 2026-03-30  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** **§ H.3m**  
**Verwandt:** **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** (Delayed Upload, `MESH_V2_MAX_BYTES`, Gateway), **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** (**§ H.3n** — SOS-Wire, App-Priorität, Basis), **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** (112, Leitstellen, **kein** offizieller IOTA-Notruf), **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`**, **`docs/ROADMAP-FAHRPLAN.md`** **§ H.7b** (Backpack-Node / Basis).

---

## 1. Kernurteil

| Behauptung | Bewertung |
|------------|-----------|
| **Volle, signierte IOTA-Rebased-TX „roh“ über ein LoRa/Meshtastic-Paket** | **Praktisch nein** — Nutzlast zu groß; Fragmentierung macht das im Mesh **unzuverlässig**. |
| **Kompaktes Notfall-Signal über LoRa → Basis/Gateway mit Internet → IOTA-Verankerung (+ ggf. SMS/API)** | **Ja** — das ist das **Zweistufen-Modell** (Funk = dünn, Chain = schwer), passend zu **Delayed LoRa → IOTA**. |

---

## 2. Payload: das harte Limit

- **Meshtastic / LoRa:** Effektiv **≈200–237 Byte** pro **Airtime-Paket** (Header, Verschlüsselung, Protobuf — je nach Kanal/Modus). Größere Nutzlasten = **Fragmentierung**; verlorenes Fragment = oft **ganzer Vorgang unbrauchbar**.
- **IOTA Rebased (Move):** Typische **signierte PTB** liegt bei **vielen hundert Byte bis KB** (Kommandos, Objektreferenzen, Gas, Signaturen).

**Fazit:** Eine **komplette** TX passt **nicht** zuverlässig in **ein** LoRa-Paket. Mehrere Fragmente über viele Hops sind **kein** verlässlicher Notfallpfad.

---

## 3. Machbare Architektur (Morgendrot-Zielbild)

1. **Feld (Vortrupp / Heltec):** Sendet **nur** **Morgendrot-konforme**, **kleine** Wire-Nutzlasten (Text, komprimierte Medien nach Spec, **GPS-Beacon**, **Heartbeat**, künftig z. B. **`MORG_EMERGENCY_V1`** — alles **LoRa-tauglich**, typ. **≤240 B** pro Frame bzw. bewusst fragmentiert mit **eigenem** Retry/Idempotenz-Konzept, nicht „rohe TX“).
2. **Basis / Gateway** (Boss-Messenger, Raspberry, Meshtastic-Node mit **MQTT**/IP): Empfängt Mesh-Traffic, **erkennt** definierte Ports/Typen, **puffert** kurz (**Delayed Upload**).
3. **Online:** Die Basis baut **volle IOTA-Transaktionen** (Signatur mit Wallet/Vault am Gateway) und **lädt** ins Netz — semantisch wie heute über Backend/RPC, **Zielbild** zunehmend **direkt von der Basis** (weniger VPS-Zwang).

Das entspricht dem **hybriden** Design: **LoRa = Offline-Feld**, **IOTA = manipulationssichere Verankerung**, **Gateway = Brücke**.

---

## 4. Gateway & IP — technisch gut machbar

- **Meshtastic** kann über **MQTT** oder serielle Brücken an einen **Host** angebunden werden; dort läuft **Morgendrot**-Logik (Queue, Parser, RPC).
- Ein **eigener** Dienst kann **nur** definierte Payload-Typen verarbeiten (z. B. dedizierter **Port** / **Envelope-Version**), **Priorisierung** für SOS/Beacon, **kein** blindes Forwarding beliebiger Bytes zur Chain.

---

## 5. Vertrauen & Missbrauch (kurz)

- **Stärke IOTA:** Signierte On-Chain-Ereignisse sind **prüfbar** (Identität/Objekt — je nach Modell).
- **Profil-/Prioritäts-Ideen** (registrierte Wallet, Kaution) sind **Produkt-/Policy-Themen**, nicht „LoRa-Physik“.
- **Rettungskette:** Leitstellen arbeiten **nicht** mit „IOTA-TX = offizieller Notruf“. Es braucht **immer** eine **Brücke** zu **etablierten** Kanälen (Telefon, SMS, definierte APIs) — siehe **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**.

---

## 6. Risiken (ohne Beschönigung)

| Risiko | Kurz |
|--------|------|
| **Latenz** | Mesh-Hops + Queue + TX-Bau: **Zehn bis niedrige dreißig Sekunden** und mehr sind **normal** — für manche Notfälle **zu spät** als **alleiniger** Kanal. |
| **Zuverlässigkeit Funk** | Duty-Cycle, Terrain, Batterie, Kollisionen — **keine Garantie**. |
| **Single Gateway** | Fällt die **einzige** IP-Brücke aus, endet der Pfad zur Chain — **Redundanz** (zweiter Node, mobiles LTE) ist Betriebsplanung. |
| **Komplexität** | Gateway muss **Format**, **Fehler**, **Idempotenz** beherrschen (**§ H.12** Sync-Spec mitlesen). |

---

## 7. Nächste Schritte (Priorität, aus der Diskussion)

| Stufe | Maßnahme |
|-------|----------|
| **Kurz** | Basis/Node **direkt** IOTA-RPC (oder lokaler Signer), wenn Internet da — **Abhängigkeit VPS** reduzieren (konfigurierbar; align **`BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**). |
| **Mittel** | Minimaler **Emergency-Typ** (extrem kompakt) + **Priorisierung** in Queue/Gateway; parallel **SMS/E-Mail/Webhook** an **definierte** Empfänger (Organisation), **nicht** als Ersatz für 112 ohne Vereinbarung. |
| **Lang** | „Smarter“ Gateway (dediziert Pi/Boss), fragmentierte **eigene** Protokolle nur mit **klarer** Dedup-/Retry-Semantik — **nicht** „volle TX splittern“. |

---

*Dieses Dokument **ersetzt** keine juristische Klärung zu Notrufpflichten oder Leitstellen-Schnittstellen; es **fixiert** die **technische** Grenze „**keine volle IOTA-TX über LoRa**“ und das **passende** Morgendrot-Muster (**Delayed Upload** + **kompakte** Funknutzlast).*
