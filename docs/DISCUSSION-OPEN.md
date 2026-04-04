# Offene Produkt- / Sicherheitsdiskussionen

Diese Datei sammelt Themen, die **bewusst später** vertieft werden sollen – damit sie nicht untergehen.

## 1. Zentrale Signatur, Vault und SPOF (Hub vs. Verteilung)

**Kontext:** Bei einem **Kommandanten-Hub** oder einer **einzigen dauerhaft laufenden App für viele Endgeräte** stellt sich die Frage:

- Sollen **alle** Transaktionssignaturen (oder ein Großteil) **nur** auf diesem Hub laufen?
- Sollen **Vault / Messaging-Keys / Seeds** dort **gebündelt** werden?

**Risiko:** Der Hub wird zum **großen Single Point of Failure** und zum **attraktiven Angriffsziel**.  
**Alternative:** Hub nur für **Steuerung, Status, Weiterleitung**; kryptografisch Heikles **verteilt** (Endgerät, Boss-Signer, bestehendes Modell aus **`docs/BOSS-MODUS.md`**).

**Status:** Noch nicht final entschieden. Bei Arbeit an Hierarchie, Kommandanten-Raspi oder „einer App für alle“ dieses Dokument mit einbeziehen.

### Erinnerung im Chat (Hinweis)

Eine KI kann **keinen zuverlässigen Timer** „alle X Nachrichten“ ausführen. Stattdessen: bei relevanten Sessions **`DISCUSSION-OPEN.md`** öffnen oder explizit nach „**zentrale Signatur / SPOF**“ fragen.

---

*Weitere offene Punkte können hier als Abschnitt 2, 3, … ergänzt werden.*
