# Sponsoring & Credits: „Doppelter Boden“ (Netzwerk vs. Anwendung)

**Zweck:** Eure Architekturidee (**Gas absichern** + **Nutzungskontingent**) sauber von **Marketing-Blog** und **Repo-Code** trennen — damit keine falsche Erwartung entsteht („die Gas Station macht alles allein“).

**Verknüpfung:** **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** §2, **`docs/INDUSTRY-FEATURES.md`**, **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`**.

---

## 0. Begriff: „Gas Station“ — zwei verschiedene Dinge

| Begriff | Bedeutung |
|--------|-----------|
| **IOTA / Rebed „Gas Station“ (Infrastruktur)** | Netzwerk- oder Dienst-Konzept: **regelte** Sponsoring-Zahlungen für Transaktionen (z. B. **Package-Filter**, Begrenzung der **PTB-Komplexität**, **Rate-Limits** pro Adresse). Die **exakten** Parameter und Namen (`count-by` o. Ä.) **immer** in der **aktuellen** offiziellen IOTA-Rebed-Dokumentation zum Zielnetz nachlesen — APIs ändern sich. |
| **`src/gas-station.ts` (Morgendrot)** | **Anwendung:** Boss füllt **Worker-Adressen** auf (`WORKER_ADDRESSES`, `GAS_STATION_*`). Das ist **kein** globales Package-Filtering — nur **Coin-Transfer**-Nachfüllen. Siehe **`docs/INDUSTRY-FEATURES.md`** §1. |

**Wichtig:** Im Folgenden bezeichnet **„Gas Station (Schicht 1)“** die **infrastrukturelle** Idee aus Blog/Doku — **nicht** automatisch den Inhalt von `gas-station.ts`.

---

## 1. Schicht 1 — Netzwerk / Protokoll (Sponsor-Budget schützen)

**Ziel:** Niemand soll mit **eurem** Sponsor-Gas **fremde** Apps oder **unbegrenzt** teure PTBs bezahlen.

| Maßnahme | Was sie leisten soll | Kritik / Realität |
|----------|----------------------|-------------------|
| **Package- / Modul-Filter** | Nur Aufrufe in **eurem** `PACKAGE_ID` / erlaubten Modulen werden gesponsort | **Wenn** euer Betrieb einen **dedizierten** Sponsoring-Dienst oder **netzwerkseitige** Regeln nutzt: sinnvoll. Im **Morgendrot-Node** entstehen gesponserte TX typischerweise nur über **euren** Codepfad — der baut **nur** die euch bekannten `moveCall`s. Trotzdem: **offenes** API ohne Prüfung = Risiko (**`MESSENGER-OPERATIONAL`** §2). |
| **PTB-/Kommando-Begrenzung** | Keine „Riesen-Transaktionen“ auf eure Kosten | **Validator-/Protokoll-Limits** existieren unabhängig; zusätzlich: **`GAS_BUDGET`**, **`size_check`**, kleine PTBs in **eurer** App (**`MESSENGER-OPERATIONAL`** §1). |
| **Rate-Limiting (z. B. pro Adresse)** | Eine Adresse kann nicht das ganze Treasury leeren | **Muss** in der **Praxis** oft **in der Anwendung** (Relay: IP / Nutzer-ID / Credits-Objekt) ergänzt werden — Blog-Felder sind **kein** Ersatz für **Missbrauchsschutz** im eigenen Backend. |

**Ist-Code (Morgendrot):** Sponsoring läuft über **`signAndExecute`** in **`chain-access.ts`**: Sponsor als **Gas Owner**, Nutzer als **Sender** — **kein** automatisches „nur Package X“ im SDK-Snippet, sondern **Vertrauen**, dass **nur eure** gebauten Transaktionen diesen Weg nehmen. Zusätzlich: **`MESSENGER_AUTO_SPONSOR`** + Lizenz-NFT-Logik (`resolveMessengerAutoSponsorOptions`) — **App-Policy**, nicht Netzwerk-Magie.

---

## 2. Schicht 2 — Anwendung / Produkt (Credits im Move-Vertrag)

**Ziel:** Die Gas Station (welche auch immer) weiß **nicht**, ob der Nutzer **noch Tarif** hat — das ist **eure Geschäftslogik**.

| Element | Rolle |
|--------|--------|
| **Credits-Objekt** | Kontingent („Stempelkarte“) — siehe **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** §8 (Credits ≠ MIST). |
| **Abzug in `send_message` (o. Ä.)** | **Wenn** im Vertrag so modelliert: **ein** atomarer Schritt mit Speichern der Nachricht — schlägt der Abzug fehl (**0 Credits**), schlägt die **gesamte** TX fehl → **kein** Gas-Verbrauch für eine „halbe“ erfolgreiche Aktion (klassisches Move-Muster; **genau** euer Entry-Design muss das garantieren). |
| **Ohne** sauberes Move-Design | Nur **Off-Chain**-Zähler → **Doppelbuchung** und **Sponsor** zahlt trotzdem — **nicht** akzeptabel für das Zielbild. |

**Kurz:** Schicht 1 schützt **euer Sponsoring-Budget technisch** (richtig konfiguriert). Schicht 2 stellt sicher, dass Nutzer **nicht mehr** verbrauchen, als bezahlt/abgebildet — **nur** der **Vertrag** + atomare TX kann das **hart** machen.

---

## 3. Zusammenfassung: „Doppelter Boden“

| Komponente | Ebene | Verhindert typisch … |
|------------|--------|----------------------|
| **Gas Station / Sponsor-Regeln** (Netz + Betrieb) | Netzwerk / Infrastruktur + **euer** Relay | … dass **beliebige** Programme oder **ungebundene** PTBs mit **eurem** Gas laufen — **wenn** ihr Filter + Limits **aktiv** habt und **kein** offener Endpunkt alles sponsort. |
| **Credits (Move)** | Anwendung / Produkt | … dass Nutzer **mehr** Nachrichten-Logik auslösen, als **Guthaben** da ist — **wenn** Abzug und Nachricht **atomar** im Vertrag gekoppelt sind. |

**Fazit:** **Credits** bleiben euer **Produkt**. **Package-/Kommando-Filter** und **Rate-Limits** (wo das Netz/Dienst sie hergibt) sind der **technische Zaun** um das Sponsoring — **zusätzlich** immer **Relay-Policies** und **Monitoring** planen.

---

## 4. Checkliste vor Produktversprechen

- [ ] Konkrete **IOTA-Rebed**-Version: Welche **Sponsor-/Gas-Station**-Features sind **offiziell** verfügbar?
- [ ] **Move-Package:** Sind **Credit-Abzug** und **Nachricht** in **einer** TX ohne Umweg?
- [ ] **API:** Nur **signierte**, **validierte** Pfade; **Rate-Limits**; **kein** generisches `moveCall` mit Sponsor-Gas.
- [ ] **Begriff:** Nicht **`gas-station.ts`** mit **Netzwerk-Gas-Station** verwechseln (siehe §0).

---

*Blog-Zitate zu „count-by“ oder Feldnamen: bei Release **gegen Primärquelle** prüfen.*
