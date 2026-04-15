# `@morgendrot/core`

TypeScript-Kern für Messenger (Offline-Mailbox-Queue, direkter IOTA-Light-Client) — **ohne** React/Next, **ohne** feste `localStorage`/`fetch`-Bindung (Ports / injizierbares `fetch`).

- **Plan:** `docs/MORGENDROT-CORE-PACKAGE-PLAN.md`
- **Tests:** `npm run test:unit` in diesem Ordner

**Subpath-Exports**

| Pfad | Inhalt |
|------|--------|
| `@morgendrot/core` | Mailbox-Queue, Ports, Device-Time |
| `@morgendrot/core/iota` | Direkt-RPC-Client, `buildStorePlaintextMailboxTransaction`, `attachGasPaymentForOwner`, `signAndExecuteTransactionWithSigner` |
| `@morgendrot/core/attestation` | Manifest-Typen + **persistierte** Queue (`enqueueAttestationDraft`, `drainAttestationQueueOnce`) |
