/// B2-P4b — Seal-kompatible On-Chain-Policy für NFT-Besitz-Gate.
/// Spec: docs/NFT-GATE-SEAL-P4B-SPEC.md
///
/// Key-Server / Broker rufen `seal_approve*` per dry_run auf (bzw. prüfen analog off-chain).
/// Abort = kein Key-Release. Erfolg allein gibt keine Bytes frei — nur Policy-OK.
module messaging::nft_gate_seal {
    use 0x2::object::{Self, ID};
    use 0x2::tx_context::{Self, TxContext};

    const E_WRONG_ID: u64 = 1;
    const E_WRONG_WALLET: u64 = 2;
    const E_BAD_ID_LEN: u64 = 3;

    /// Identity = `object::id_to_bytes(nft)` (32 Byte).
    public entry fun seal_approve_nft_owner<T: key + store>(id: vector<u8>, nft: &T) {
        assert!(std::vector::length(&id) == 32, E_BAD_ID_LEN);
        let expected = object::id_to_bytes(&object::id(nft));
        assert!(id == expected, E_WRONG_ID);
    }

    /// Wie Owner-Policy, zusätzlich `sender == required_wallet`.
    public entry fun seal_approve_nft_and_wallet<T: key + store>(
        id: vector<u8>,
        nft: &T,
        required_wallet: address,
        ctx: &TxContext,
    ) {
        assert!(std::vector::length(&id) == 32, E_BAD_ID_LEN);
        let expected = object::id_to_bytes(&object::id(nft));
        assert!(id == expected, E_WRONG_ID);
        assert!(tx_context::sender(ctx) == required_wallet, E_WRONG_WALLET);
    }

    /// Hilfs-View für Tests / Off-Chain: Object-ID-Bytes.
    public fun nft_identity_bytes<T: key + store>(nft: &T): vector<u8> {
        object::id_to_bytes(&object::id(nft))
    }

    public fun id_bytes(oid: &ID): vector<u8> {
        object::id_to_bytes(oid)
    }
}
