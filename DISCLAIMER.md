# Disclaimer — Morgendrot Messenger (Hobby / Experimental)

**Stand:** 2026-07-10

## Kurzfassung

Dieses Projekt ist ein **experimentelles Hobby-Projekt**. Es ist **kein fertiges Produkt**.

- **Keine Sicherheitsgarantien** — keine Zusage auf E2EE-Niveau wie Signal, keine Audit-Zertifizierung.
- **Kein Support** — Community auf best-effort-Basis; keine SLA.
- **Nicht für lebenskritische oder behördliche Einsätze** — keine Garantie für Rettungsdienst, Polizei, Militär oder vergleichbare Missionen.
- **Nutzen auf eigene Gefahr** — du bist selbst verantwortlich für Keys, Seeds, Handoff-Dateien und Betrieb.
- **LAN-Betrieb:** Wenn die Boss-API im WLAN erreichbar ist (`API_BIND_HOST=0.0.0.0`), setze **`API_AUTH_TOKEN`** und verteile es nur über Handoff — sonst sind Schreib-Operationen für jedes Gerät im WLAN offen. Details: **`SECURITY.md`**.

## Binär-Downloads (GitHub Releases)

- **Unsigned Debug-APK** — nur **Sideload** (nicht Google Play / Apple App Store).
- **PC-Standalone-ZIP** — enthält **keine** fertige `.env`, **keine** Seeds; `npm install` und Konfiguration sind nötig.
- **Kein Handoff mit Secrets** — Einsatz-Handoff kommt vom Boss / aus eigener Vorbereitung, nicht aus dem Release.

## EU-Nutzer — Chat Control / Scanning

Dieses Projekt ist **nicht** auf EU-Vorgaben zu clientseitigem Scanning („Chat Control“ o. Ä.) ausgelegt. Wer in der EU Messenger-Software betreibt oder verbreitet, kann **erhöhtes rechtliches Risiko** tragen. **Informiere dich selbst**; der Autor übernimmt keine Rechtsberatung.

## Open Source & kommerzielle Nutzung

Quellcode: **AGPL-3.0** (siehe `LICENSE`). **Kommerzielle Nutzung** ohne separate Erlaubnis ist **nicht** vorgesehen — siehe `COMMERCIAL-LICENSING.md`.

## Was wir bewusst nicht versprechen

- „Der sicherste Messenger der Welt“
- Produktreife, Compliance-Zertifikate oder Store-Freigaben
- Dauerhafte API-Stabilität in Experimental-Releases

## Sicherheitsmeldungen

Verantwortliche Offenlegung: `SECURITY.md` (GitHub Security Advisories oder Issues mit Sicherheitslabel).
