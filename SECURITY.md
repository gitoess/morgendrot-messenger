# Security policy — Morgendrot Messenger

**Stand:** 2026-07-08

## Scope

This policy covers security issues in the **Morgendrot Messenger** repository (backend, Next/Capacitor client, shared crypto/transport code).

## Supported versions

Only the **latest tag** on the default branch and the latest **experimental** GitHub Release (`v*-experimental`) receive best-effort review. Older hobby builds are unsupported.

## Reporting a vulnerability

1. **Preferred:** [GitHub Security Advisories](https://github.com/gitoess/morgendrot-messenger/security/advisories/new) (private report).
2. **Alternative:** Open an issue with the **security** label only if the issue is not exploitable in production (documentation, hardening ideas).

Please include:

- Affected component (APK, PWA, API, Handoff, LoRa bridge, …)
- Steps to reproduce
- Impact assessment (confidentiality / integrity / availability)

## What to expect

- This is a **hobby project** — no bug bounty, no paid SLA.
- We aim to acknowledge reports within **14 days** when possible.
- Fixes may land on `main` first; experimental releases follow manually.

## Out of scope

- Lost seeds / mnemonics / Handoff ZIPs on user devices
- Misconfiguration of `.env`, RPC endpoints, or Boss exports
- Third-party services (IOTA network, Meshtastic firmware, Telegram API)

## Safe harbor

Good-faith research that avoids privacy violations and service disruption is welcome. Do not test against third parties without permission.
