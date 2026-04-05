# Meshtastic: Hop-Limit, TTL und Reichweiten-Strategien (kritische Einordnung)

**Kontext:** Höhle, Laser-Trichter, viele Relais — irgendwann endet jedes Paket. **Leitlinie:** **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** (Meshtastic-First).

---

## 1. Was das Hop-Limit technisch macht

- Pro Paket gibt es ein **Hop-Budget** (häufig konfigurierbar bis **7** in aktuellen Clients — **Firmware/Version prüfen**, Werte können sich ändern).
- **Jeder** weiterleitende Knoten **verringert** das Budget (vereinfacht: „ein Hop verbraucht eins“).
- Ist das Budget **0**, wird das Paket **lokal** noch **empfangen und angezeigt**, aber **nicht mehr** als Mesh-Weiterleitung ausgesendet — es „stirbt“ für die **Flooding-Kette** an dieser Stelle.

Das ist **kein Bug**, sondern **Schutz vor Netzüberlast** und Endlosschleifen im Flood-Mesh.

---

## 2. Handy / PC „dazwischen“ (manuelles Relay)

**Idee:** Am letzten Knoten der Kette empfangen und die Nutzlast **als neue Nachricht** erneut senden → Hop-Zähler startet wieder „frisch“.

| Pro | Contra |
|-----|--------|
| Kein Firmware-Eingriff | **Latenz** (Wartezeit bis Mensch/Gerät neu sendet) |
| Kontrolle im Morgendrot-/Client-Flow | **Doppelte Funklast** (altes Paket evtl. noch im Netz, neues zusätzlich) |
| | Ohne **Dedup** an der App: **doppelte** Anzeige derselben logischen Nachricht |

**Fazit:** Für **gelegentliche** Notfall-Brücken **denkbar**; als Dauerlösung für viele Nutzer **teuer** in Airtime und UX.

---

## 3. „7. Heltec austricksen“: blind Re-Broadcast (Firmware/Plugin)

**Idee:** Jeder Empfang wird mit **vollem Hop-Limit** **sofort** wieder ausgesendet.

**Kritik:** Das ist in der Regel **untragbar**:

- Ohne **strikte** Deduplizierung (Paket-ID / Sequenz / kurzes TTL-Fenster) entsteht ein **Broadcast-Storm**: Pakete kreisen, **Airtime kollabiert**, kleine Nutzlasten (z. B. 3-KB-Bild-Fragmente) **blockieren** das Mesh.
- Meshtastic hat **eigene** Schutzmechanismen; ein naives „immer weiter“ **unterläuft** die ökonomische Balance des Netzes.

**Fazit:** **Nicht** als Standard-Pattern empfehlen. Wenn überhaupt: **forspezifizierte** Experimente mit klaren **Stopp-Bedingungen** und **Messung** der Kanalbelegung — nicht „für Produktion“ ohne Review.

---

## 4. Konfiguration: ROUTER / REPEATER, Kanal, Leistung

**Sinnvoll und meshtastic-nah:**

- **ROUTER / REPEATER** (wo unterstützt): bessere **Bereitschaft** zum Weiterleiten, oft stabilere Timings — **kein** magisches „über 7 Hops hinaus“ im **gleichen** Flood; das Limit bleibt pro **einer** Funkübertragungskette.
- **Hop-Limit** in den **Experten-Einstellungen** sinnvoll setzen (oft **Max. 7** als Obergrenze — **Doku zur installierten Version** lesen).
- **Kanal / Leistung / Antenne** so wählen, dass sich das Mesh **auf die Höhle / den Trichter** konzentriert und weniger **Seitenstörungen** vom Umfeld mitnimmt („weniger Geplapper“) — das ist **Koexistenz- und SNR-Optimierung**, kein Ersatz für unbegrenzte Hops.

**Kritik am Narrativ „fast wie MeshCore“:** Meshtastic bleibt **Flood-basiert** mit festen Regeln; **strukturiertes Routing** wie in anderen Systemen ist **nicht** 1:1 nachstellbar — ihr optimiert **Parameter und Rollen**, nicht das fundamentale Mesh-Modell.

---

## 5. Zwei Heltecs „Rücken an Rücken“ (Store-and-Forward-Brücke)

**Idee:** Erster Heltec = Ende der ersten **7-Hop-Welt**; Payload geht **seriell / I2C / Kabel** zum zweiten Heltec; der startet eine **neue** Aussendung — oft auf **leicht versetztem** Kanal/Frequenzblock, damit sich die beiden Segmente **nicht gegenseitig stören**.

| Pro | Contra |
|-----|--------|
| **Neues** Paket = **neues** Hop-Budget → effektiv **7 + 7** Hops über zwei Segmente | **Zwei** Geräte, **Verkabelung**, **Strom**, **Montage** |
| Kein endloser Flood-Storm wie bei naivem Re-Broadcast | Trotzdem: **logische** Nachricht kann an der Brücke **doppelt** zählen, wenn die **App** nicht dedupliziert |
| Kontrolle über Übergabe (optional Buffer, Filter) | Regulatorik: **zwei** Funkpfade beachten (Kanalwahl, ERP) |

**Fazit:** Für **Morgendrot** (kleine Nutzlasten, kontrollierte Kette) oft die **stabilste** reine Funk-Lösung, **wenn** ihr die Brücke **bewusst** plant — passt zu **Delayed Upload** und **Gateway-Denken** in **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**.

---

## 6. Kurzfassung für „3-KB-Strategie“ in der Höhle

1. **Erst** Topologie und **Router/Repeater** + saubere **Kanal-/Leistungsplanung**.  
2. **Brücke** (zwei Heltecs + serielle Übergabe) wenn **eine** Mesh-Welt nicht reicht — **ohne** blinden Dauer-Rebroadcast.  
3. **Handy als Relay** nur **bewusst** (Latenz, Last, Dedup).  
4. **IOTA/Puffer** für „wenn wir mal Internet haben“ bleibt **parallel** sinnvoll — siehe Projektphasen **B** / **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**.

---

*Firmware-Zahlen (max. Hops, Rollennamen) vor dem Einsatz mit der **installierten** Meshtastic-Version abgleichen.*
