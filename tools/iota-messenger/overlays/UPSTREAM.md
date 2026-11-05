# Upstream-Herkunft

Dieses Projekt wurde aus **Morgendrot Messenger** abgeleitet (einmaliger Export).

- **Upstream-Repo:** `morgendrot-messenger` (lokal: `Desktop/morgendrot`)
- **Bootstrap-Tool:** `tools/iota-messenger/bootstrap-desktop.mjs` im Upstream-Repo
- **Produkt-Spec:** `docs/IOTA-MESSENGER-EDITION-V1.md` (Upstream)

## Re-Sync (optional)

Wenn du Code aus Morgendrot übernehmen willst:

```bash
node scripts/bootstrap-from-morgendrot.mjs "C:\Users\damast\Desktop\morgendrot"
```

Danach erneut Patches anwenden:

```bash
node scripts/apply-product-patches.mjs
```

**Hinweis:** Re-Sync überschreibt `src/`, `frontend/`, `packages/` — eigene Änderungen vorher sichern.

## Abgrenzung

| Morgendrot | IOTA Messenger |
|------------|----------------|
| Einsatz-Organisation, Boss, Handoff | Jeder Nutzer eigenständig |
| Multi-Transport | Nur IOTA |
| Volle Plattform | Chat + Gruppen + Wallet |
