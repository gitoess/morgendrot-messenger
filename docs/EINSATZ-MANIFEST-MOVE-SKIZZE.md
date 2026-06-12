# Move-Skizze: `store_einsatz_manifest`

**Status:** Implementiert in **`move-test/sources/messaging.move`** (Teil von `deploy:move-package`); **Mainnet-Registry-Deploy** manuell — **`docs/DEPLOY-MOVE-H33-EINSATZ-MANIFEST.md`**.  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md` § H.33** (Betriebsmodi **A** Testnet+Anker, **B** Mainnet direkt, **C** Mainnet ohne Rollup)  
**Verwandt:** **`docs/PROTOCOL-ANCHOR-VERIFY-SPEC.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`**

---

## 0. Betriebsmodi vs. Move-Modul

| Modus | Braucht `store_einsatz_manifest`? | `source_network` | RPC im Handoff |
|-------|-----------------------------------|------------------|----------------|
| **B — Mainnet direkt** (Default) | **Optional** (Rollup) | `mainnet` (1) | Mainnet `RPC_URL` |
| **A — Testnet + Anker** | **Ja** (forensischer Kern) | `testnet` (0) | Testnet `RPC_URL`; Boss zusätzlich Mainnet für Anker |
| **C — Mainnet, kein Rollup** | **Nein** | — | Mainnet `RPC_URL` |

Das Move-Modul ist für **A** und **optionales B-Rollup** gedacht. **Modus C** nutzt **nur** bestehende Messenger-TXs — kein Registry-Call nötig.

---

## 1. Design-Entscheidungen

| Entscheidung | Festlegung |
|--------------|------------|
| **Registry-Typ** | Shared Object `EinsatzManifestRegistry` (wie `VaultRegistry` / `Mailbox`) — ein Registry pro **Mainnet-Package** |
| **Schlüssel** | `EinsatzManifestKey { einsatz_id: address, sequence: u64 }` — `einsatz_id` = Hash der stabilen Einsatz-UUID (32 B → address) oder Boss-definierte address |
| **On-chain Payload** | **Kompakt:** Merkle-Root, Manifest-Hash, Metadaten — **kein** volles `entries[]` in der TX |
| **Autorisierung** | Nur `authorized_anchorer` (Boss-Adresse aus `.env` / Handoff) oder Eintrag in `ManifestAnchoringPolicy` |
| **Netz** | Registry auf **Mainnet-Package**; `source_network` = Metadatum (**0** Testnet-Quell-TXs, **1** Mainnet-Quell-TXs) — kein Cross-Chain-Call |
| **Events** | `EinsatzManifestStored` für Indexer / Explorer |

---

## 2. Skizze (Move)

```move
module messaging::einsatz_manifest {
    use 0x2::event;
    use 0x2::object::{Self, ID, UID};
    use 0x2::transfer;
    use 0x2::tx_context::{Self, TxContext};
    use 0x2::dynamic_object_field as dof;
    use std::vector;

    // --- Errors ---
    const E_NOT_AUTHORIZED: u64 = 80;
    const E_BAD_MANIFEST_HASH_LEN: u64 = 81;
    const E_BAD_MERKLE_ROOT_LEN: u64 = 82;
    const E_SEQUENCE_NOT_NEXT: u64 = 83;

    /// 0 = testnet, 1 = mainnet (Quell-Netz der referenzierten Nachrichten)
    const SOURCE_NETWORK_TESTNET: u8 = 0;
    const SOURCE_NETWORK_MAINNET: u8 = 1;

    const MANIFEST_HASH_BYTES: u64 = 32;
    const MERKLE_ROOT_BYTES: u64 = 32;

    // --- Globals (bei create_globals mit anlegen oder separater Entry) ---

    /// Shared: alle Einsatz-Anker eines Deployments
    struct EinsatzManifestRegistry has key {
        id: UID,
        /// Boss / Einsatzleitung — darf store_einsatz_manifest aufrufen
        authorized_anchorer: address,
        /// Monoton pro einsatz_id (off-chain Index spiegelt sequence + 1)
        // optional: table einsatz_id -> next_sequence — hier via DOF pro Key
    }

    struct EinsatzManifestKey has copy, drop, store {
        einsatz_id: address,
        sequence: u64,
    }

    struct EinsatzManifestAnchor has key, store {
        id: UID,
        einsatz_id: address,
        sequence: u64,
        /// SHA-256 über kanonisches JSON (MORG_EINSATZ_MANIFEST_V1)
        manifest_hash: vector<u8>,
        /// Merkle-Root über entries[].entry_hash
        merkle_root: vector<u8>,
        source_network: u8,
        /// Package auf dem Quell-Netz (Testnet o.ä.) — 32 B raw
        source_package_id: vector<u8>,
        period_start_ms: u64,
        period_end_ms: u64,
        message_count: u64,
        /// Optional: IPFS CID / Export-URI-Hash (32 B), sonst leer
        manifest_uri_hash: vector<u8>,
        anchored_by: address,
        anchored_at_ms: u64,
    }

    struct EinsatzManifestStored has copy, drop {
        registry_id: ID,
        einsatz_id: address,
        sequence: u64,
        manifest_hash: vector<u8>,
        merkle_root: vector<u8>,
        source_network: u8,
        message_count: u64,
        anchored_by: address,
        anchored_at_ms: u64,
    }

    struct EinsatzManifestRegistryCreated has copy, drop {
        registry_id: ID,
        authorized_anchorer: address,
    }

    // --- Init (einmal pro Package auf Mainnet) ---

    public entry fun create_einsatz_manifest_registry(
        authorized_anchorer: address,
        ctx: &mut TxContext,
    ) {
        let reg = EinsatzManifestRegistry {
            id: object::new(ctx),
            authorized_anchorer,
        };
        let rid = object::id(&reg);
        event::emit(EinsatzManifestRegistryCreated {
            registry_id: rid,
            authorized_anchorer,
        });
        transfer::share_object(reg);
    }

    fun assert_manifest_bytes(hash: &vector<u8>, root: &vector<u8>) {
        assert!(vector::length(hash) == MANIFEST_HASH_BYTES, E_BAD_MANIFEST_HASH_LEN);
        assert!(vector::length(root) == MERKLE_ROOT_BYTES, E_BAD_MERKLE_ROOT_LEN);
    }

    fun next_sequence(registry_uid: &UID, einsatz_id: address): u64 {
        // MVP: zähle existierende DOF-Keys mit gleicher einsatz_id — production: counter table
        // Skizze: Caller übergibt sequence explizit; Contract prüft Monotonie via LastAnchor-DF
        0
    }

    /// Haupt-Entry: **eine** Anker-TX pro Batch (Boss / Einsatzleitung).
    ///
    /// `einsatz_id` — stabile 32-Byte-ID (Hash der Einsatz-UUID), als address encoded.
    /// `manifest_hash` / `merkle_root` — je 32 Bytes.
    /// `source_package_id` — 32 Bytes raw (Move package address bytes).
    public entry fun store_einsatz_manifest(
        registry: &mut EinsatzManifestRegistry,
        einsatz_id: address,
        sequence: u64,
        manifest_hash: vector<u8>,
        merkle_root: vector<u8>,
        source_network: u8,
        source_package_id: vector<u8>,
        period_start_ms: u64,
        period_end_ms: u64,
        message_count: u64,
        manifest_uri_hash: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == registry.authorized_anchorer, E_NOT_AUTHORIZED);
        assert!(
            source_network == SOURCE_NETWORK_TESTNET || source_network == SOURCE_NETWORK_MAINNET,
            E_NOT_AUTHORIZED,
        );
        assert_manifest_bytes(&manifest_hash, &merkle_root);

        let key = EinsatzManifestKey { einsatz_id, sequence };
        // Optional: assert sequence == expected_next(einsatz_id)
        assert!(!dof::exists_<EinsatzManifestKey>(&registry.id, key), E_SEQUENCE_NOT_NEXT);

        let now = tx_context::epoch_timestamp_ms(ctx);
        let anchor = EinsatzManifestAnchor {
            id: object::new(ctx),
            einsatz_id,
            sequence,
            manifest_hash,
            merkle_root,
            source_network,
            source_package_id,
            period_start_ms,
            period_end_ms,
            message_count,
            manifest_uri_hash,
            anchored_by: sender,
            anchored_at_ms: now,
        };

        dof::add(&mut registry.id, key, anchor);

        event::emit(EinsatzManifestStored {
            registry_id: object::id(registry),
            einsatz_id,
            sequence,
            manifest_hash: *&anchor.manifest_hash,
            merkle_root: *&anchor.merkle_root,
            source_network,
            message_count,
            anchored_by: sender,
            anchored_at_ms: now,
        });
    }

    /// Optional: Boss wechselt (Handoff-Rotation)
    public entry fun set_manifest_authorized_anchorer(
        registry: &mut EinsatzManifestRegistry,
        new_anchorer: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == registry.authorized_anchorer, E_NOT_AUTHORIZED);
        registry.authorized_anchorer = new_anchorer;
    }

    // --- Read helpers (view / RPC) ---

    public fun manifest_exists(
        registry: &EinsatzManifestRegistry,
        einsatz_id: address,
        sequence: u64,
    ): bool {
        let key = EinsatzManifestKey { einsatz_id, sequence };
        dof::exists_<EinsatzManifestKey>(&registry.id, key)
    }
}
```

---

## 3. PTB-Ablauf (TypeScript / `@morgendrot/core`)

### 3a — Modus A (Testnet-Betrieb → Mainnet-Anker)

```typescript
// Pseudocode — Mainnet-Client für Anker, Betrieb lief auf Testnet
const manifest = buildEinsatzManifestV1({
  entries, // source_tx_digest = Testnet digests
  einsatzId,
  period,
  sourceNetwork: 'testnet',
})
// … manifestHash, merkleRoot …
await signAndExecute(mainnetClient, txWithStoreEinsatzManifest(..., SOURCE_NETWORK_TESTNET), bossSigner)
```

### 3b — Modus B (Mainnet direkt, optionales Rollup)

```typescript
// Betrieb: normaler Mainnet-Client (gleicher RPC wie Handoff)
// Rollup optional am Einsatz-Ende:
const manifest = buildEinsatzManifestV1({
  entries, // source_tx_digest = Mainnet digests (dieselben wie Posteingang)
  einsatzId,
  period,
  sourceNetwork: 'mainnet',
})
await signAndExecute(mainnetClient, txWithStoreEinsatzManifest(..., SOURCE_NETWORK_MAINNET), bossSigner)
```

**Modus C:** Kein Aufruf — Nachweis = `entries[].source_tx_digest` direkt im Explorer.

```typescript
// Gemeinsame TX-Struktur (A oder B):
const tx = new Transaction()
tx.moveCall({
  target: `${MAINNET_PACKAGE}::einsatz_manifest::store_einsatz_manifest`,
  arguments: [
    tx.object(EINSATZ_MANIFEST_REGISTRY_ID),
    tx.pure.address(einsatzIdAsAddress),
    tx.pure.u64(sequence),
    tx.pure.vector('u8', manifestHash),
    tx.pure.vector('u8', merkleRoot),
    tx.pure.u8(sourceNetworkU8), // 0 oder 1
    tx.pure.vector('u8', hexToBytes(sourcePackageId)), // Testnet- oder Mainnet-PACKAGE_ID
    tx.pure.u64(periodStartMs),
    tx.pure.u64(periodEndMs),
    tx.pure.u64(manifest.entries.length),
    tx.pure.vector('u8', uriHashOrEmpty),
  ],
})
```

**Batching mehrerer Einsätze:** Theoretisch mehrere `store_einsatz_manifest`-Calls in **einer PTB** (bis Gas/128 KiB); praktisch **ein Einsatz pro TX** (klarere Explorer-Darstellung).

---

## 4. Integration in `create_globals` (später)

Option A — eigenes Modul `einsatz_manifest.move` + separater Entry nach Deploy.  
Option B — Felder in bestehendem `GlobalsCreated`-Event:

```move
// messaging.move — Erweiterung GlobalsCreated (Skizze)
struct GlobalsCreated has copy, drop {
    // ... vault_registry_id, mailbox_id, ...
    einsatz_manifest_registry_id: ID,
}
```

Boss-`.env` / Handoff (Beispiele):

```env
# Modus B — Mainnet direkt (Helfer-Handoff)
EINSATZ_CHAIN_MODE=mainnet-direct
RPC_URL=https://api.mainnet.iota.cafe
PACKAGE_ID=0x…                    # Mainnet-Deploy

# Modus A — Testnet + Anker (Helfer-Handoff)
EINSATZ_CHAIN_MODE=testnet-with-mainnet-anchor
RPC_URL=https://api.testnet.iota.cafe
PACKAGE_ID=0x…                    # Testnet-Deploy

# Nur Boss (Modus A) — nicht im Helfer-ZIP
MAINNET_RPC_URL=https://api.mainnet.iota.cafe
EINSATZ_MANIFEST_REGISTRY_ID=0x…
MAINNET_PACKAGE_ID=0x…
```

**Modus C:** `EINSATZ_CHAIN_MODE=mainnet-direct-no-rollup` — wie B, ohne `EINSATZ_MANIFEST_REGISTRY_ID`.

---

## 5. RPC / Indexer (Frontend)

| Endpoint (Vorschlag) | Zweck |
|----------------------|--------|
| `fetchEinsatzManifestAnchors(einsatzId)` | Dynamic Fields unter Registry filtern |
| `verifyMessageInEinsatzAnchor(msgRef, manifestFile, proof)` | Off-chain Merkle-Proof — **`einsatz-manifest-merkle-proof.ts`**, eingebunden in **Verifizieren** |

Core-Helfer analog `fetchTeamPlainBroadcastRpcRows` — **`fetchEinsatzManifestAnchorsForEinsatz`** (`packages/morgendrot-core`); UI **Mainnet-Anker auflisten**.

---

## 6. Offene Punkte (vor Implementierung)

1. **`einsatz_id`-Encoding:** UUID → `address` (erste 32 B Hash) vs. dedizierte `vector<u8>` im Struct.
2. **Sequenz-Enforcement:** Strikte `sequence == last + 1` vs. Lücken erlauben (Re-Anchor nach Fehlschlag).
3. **TTL / Purge:** Anker **unveränderlich** (empfohlen) — kein `purge_einsatz_manifest` in v1.
4. **Gleiches Modul auf Testnet:** Nur für Integrationstests; Produktion: Registry **nur Mainnet**.
5. **Abgleich mit `PROTOCOL-ANCHOR-VERIFY`:** Ein gemeinsames `manifest_version` oder zwei parallele Schemas — in Implementierung festziehen.
6. **`EINSATZ_CHAIN_MODE`:** Export-Assistent schreibt Modus in Handoff; App blendet Anker-UI bei **C** aus.

---

## 7. Minimaler Test (Move unit / Devnet)

1. `create_einsatz_manifest_registry(boss)`
2. `store_einsatz_manifest(..., sequence=0, ..., source_network=1, ...)` — Mainnet-direkt-Rollup
3. `store_einsatz_manifest(..., source_network=0, ...)` — Testnet-Quell-TXs
4. `manifest_exists(reg, einsatz_id, 0) == true`
5. Zweiter Call gleiche `sequence` → `E_SEQUENCE_NOT_NEXT`
6. Falscher `sender` → `E_NOT_AUTHORIZED`

---

*Stand: 2026-06-02 — Move im Repo; Registry einmalig per `npm run print:create-einsatz-manifest-registry` → `apply:einsatz-manifest-registry-from-tx`.*
