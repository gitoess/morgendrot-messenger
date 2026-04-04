# Offline-Fähigkeit (Edge Cache) – Lock

In der Industrie fällt WLAN oft aus. Das Schloss muss **OPEN** auch ohne Chain-Anbindung ausführen können, sofern der Key-Zustand zuvor bekannt war.

## Speichermodell (technisch 100 % stabil)

- **Quelle:** Beim **online**-Betrieb wird bei jeder erfolgreichen AccessKey-Prüfung (`hasValidAccessKey`) der Sender mit Ablaufzeit **im Speicher** gecacht: `sender → validUntil = now + OFFLINE_CACHE_TTL_MS`.
- **Offline:** Ist die Chain nicht erreichbar (`isChainReachable() === false`) und `OFFLINE_OPEN_ENABLED=true`, entscheidet das Schloss **nur** anhand dieses Caches: Eintrag vorhanden und `now < validUntil` → OPEN erlauben.
- **Kein persistenter Cache im Standard:** Der Cache lebt im Prozess (RAM). Nach Neustart ist er leer; das erste OPEN nach Ausfall erfordert daher, dass vor dem Ausfall mindestens ein erfolgreicher Check stattgefunden hat. Optional kann ein **persistenter** Cache (z. B. Datei mit TTL pro Sender) ergänzt werden – gleiche Semantik: nur „letzter bekannter gültiger Zustand“ innerhalb der TTL.

## Konfiguration (.env)

| Variable | Bedeutung |
|----------|-----------|
| **OFFLINE_OPEN_ENABLED** | `true` = OPEN aus Cache erlauben, wenn Chain unreachable. Default: `false`. |
| **OFFLINE_CACHE_TTL_MS** | Gültigkeit eines Cache-Eintrags in ms. Default: 86400000 (24 h). |
| **OFFLINE_QUEUE_FILE** | Optional: Datei für Befehle, die offline eingereiht und später abgearbeitet werden. |

## Sicherheit

- Es wird **kein** Key-Material gespeichert, nur die Aussage „Sender X hatte zum Zeitpunkt T einen gültigen Key“. Nach Ablauf der TTL wird nicht mehr aus dem Cache geöffnet.
- Für maximale Stabilität: TTL so wählen, dass bei typischer Offline-Dauer kein zu langes Zeitfenster entsteht (z. B. 24 h für Nacht-/Wochenend-Ausfall).

## Tests

- Unit/Integration: Chain unreachable mocken → OPEN nur möglich, wenn zuvor online ein gültiger Key geprüft wurde und TTL nicht abgelaufen ist.
- Manuell: `OFFLINE_OPEN_ENABLED=true`, RPC abschalten, vorher einmal OPEN mit gültigem Key → OPEN aus Cache muss funktionieren.
