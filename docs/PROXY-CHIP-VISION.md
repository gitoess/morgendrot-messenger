# Vision: Proxy-Chip (Heimnetzwerk-Firewall mit Chain-Berechtigung)

*Nur als Idee festgehalten – kein aktueller Code-Bestandteil.*

## Idee

Ein Gerät (z. B. Raspberry Pi) sitzt **nach dem Router** oder **als Hotspot** und fängt den Datenverkehr zu/von IoT-Geräten ab:

- Saugroboter, Smart-Lampen, Kameras, Thermostate, Steckdosen usw.

**Morgendrot-Code** (oder ein darauf aufbauendes Gateway) prüft jeden Befehl (HTTP, MQTT, TCP, UDP) gegen Regeln:

| Prüfung | Bedeutung |
|--------|-----------|
| **Sender autorisiert?** | Whitelist, AccessKey-NFT (Chain) |
| **Nonce ok?** | Replay-Schutz |
| **Befehl plausibel?** | optional LLM / Heuristik |
| **Keine verbotenen Aktionen** | z. B. Kamera-Stream hochladen, Firmware-Update |

- **Erlaubt** → durchlassen  
- **Verweigert** → droppen oder modifizieren  

→ De facto ein **dezentraler, krypto-basierter Heimnetzwerk-Firewall** mit Chain-gestützter Berechtigung.

## Einordnung ins Projekt

- **Berechtigung (Whitelist, AccessKey, Identität)** passt zu Morgendrot – könnte als Auth-Schicht genutzt werden.
- **Traffic-Interception, Protokolle (HTTP/MQTT/TCP/UDP), Regel-Engine** wären ein **eigenes Modul oder separates Projekt** (Proxy-Gateway), das Morgendrot für Auth anbindet.
- Kein kleines Feature im bestehenden Repo, sondern eine mögliche **Erweiterung oder Schwesterprojekt**.

## Status

Reine Vision – keine Implementierung geplant. Bei Interesse: eigenes Modul `proxy-gateway` oder separates Repo, das Morgendrot-APIs für Autorisierung nutzt.
