# MeshSleepyChannel — Offline-Zahlung über Mesh (Spec-Stub / Backlog)

**Stand:** 2026-11-06  
**Status:** **Backlog Phase C** — **nicht Ist**, **kein** aktueller Bau. Bewertung 2026-11-06: Produktfit Mesh ja; Entwurf unreif (LoRa-Payload, Justice/Close, Expiry).  
**Nicht parallel** zu Privacy-Tranche / Zeitkapsel (B2-P5).

## Ziel (kurz)

Bilaterale, mesh-taugliche Offline-Zahlungen mit Collateral, ohne dauerhaften Watchtower. Online einmal `open`, danach Updates über Meshtastic; bei Internet optional Settlement/`extend`.

## Bewusste Nicht-Ziele

Multi-Hop-Routing · Auto-Open ohne Online · Watchtower-Service.

## Vor Bau (Härten)

1. Payload-Budget (Signaturen/Hash vs. LoRa-MTU)  
2. Kanonischer State + ACK-Atomarität (kein Fork)  
3. `close_with_state` + `challenge_with_newer` (Justice)  
4. Permissionless `expire` (wie Zeitkapsel-`reclaim` — kein Daemon)  
5. UI-Ehrlichkeit: Kapitalbindung bis Expiry  

## Verweis

Ausführliche Kritik/Verbesserungen: Chat 2026-11-06 (Review). Roadmap-Nachtrag in **`docs/ROADMAP-FAHRPLAN.md`**.  
Zeitkapsel (Leserecht, **kein** Payment): **`docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md`**.
