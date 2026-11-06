/// B2-P5a — NFT-Zeitkapsel / Timelock-Lease (kein stiller Cron).
/// Spec: docs/NFT-SCHLUESSELKARTE-PUBLIC-VAULT-TIMELOCK.md
module messaging::nft_time_lease {
    use 0x2::clock::{Self, Clock};
    use 0x2::dynamic_object_field as dof;
    use 0x2::event;
    use 0x2::object::{Self, ID, UID};
    use 0x2::transfer;
    use 0x2::tx_context::{Self, TxContext};

    const E_NOT_BORROWER: u64 = 2;
    const E_TOO_EARLY: u64 = 3;
    const E_RECLAIM_CANCELLED: u64 = 4;
    const E_BAD_DURATION: u64 = 5;
    const E_BAD_BORROWER: u64 = 6;
    const E_NO_NFT: u64 = 7;

    struct EscrowedNft has copy, drop, store {}

    struct NftTimeLease has key {
        id: UID,
        nft_id: ID,
        lender: address,
        borrower: address,
        unlock_ms: u64,
        reclaim_cancelled: bool,
    }

    struct LeaseCreated has copy, drop {
        lease_id: ID,
        nft_id: ID,
        lender: address,
        borrower: address,
        unlock_ms: u64,
    }

    struct LeaseCancelled has copy, drop {
        lease_id: ID,
        by: address,
    }

    struct LeaseReturnedEarly has copy, drop {
        lease_id: ID,
        nft_id: ID,
        to_lender: address,
        by: address,
    }

    struct LeaseReclaimed has copy, drop {
        lease_id: ID,
        nft_id: ID,
        to_lender: address,
        by: address,
    }

    /// W1 legt NFT in Escrow; `duration_ms` ab jetzt → `unlock_ms`.
    public entry fun create_lease<T: key + store>(
        nft: T,
        borrower: address,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let lender = tx_context::sender(ctx);
        assert!(borrower != @0x0, E_BAD_BORROWER);
        assert!(borrower != lender, E_BAD_BORROWER);
        assert!(duration_ms > 0, E_BAD_DURATION);

        let nft_id = object::id(&nft);
        let now = clock::timestamp_ms(clock);
        let unlock_ms = now + duration_ms;

        let lease = NftTimeLease {
            id: object::new(ctx),
            nft_id,
            lender,
            borrower,
            unlock_ms,
            reclaim_cancelled: false,
        };
        dof::add(&mut lease.id, EscrowedNft {}, nft);
        let lease_id = object::id(&lease);
        event::emit(LeaseCreated {
            lease_id,
            nft_id,
            lender,
            borrower,
            unlock_ms,
        });
        transfer::share_object(lease);
    }

    /// W2 (Borrower): Timelock widerrufen — kein permissionless reclaim mehr.
    public entry fun cancel_reclaim(lease: &mut NftTimeLease, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == lease.borrower, E_NOT_BORROWER);
        lease.reclaim_cancelled = true;
        event::emit(LeaseCancelled {
            lease_id: object::id(lease),
            by: sender,
        });
    }

    /// W2: NFT sofort zurück an W1; Lease wird zerstört.
    public entry fun return_early<T: key + store>(lease: NftTimeLease, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == lease.borrower, E_NOT_BORROWER);
        finish_lease_to_lender<T>(lease, sender, true);
    }

    /// Jeder: nach unlock_ms und wenn nicht cancelled → NFT an Lender.
    public entry fun reclaim<T: key + store>(
        lease: NftTimeLease,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(!lease.reclaim_cancelled, E_RECLAIM_CANCELLED);
        let now = clock::timestamp_ms(clock);
        assert!(now >= lease.unlock_ms, E_TOO_EARLY);
        let by = tx_context::sender(ctx);
        finish_lease_to_lender<T>(lease, by, false);
    }

    fun finish_lease_to_lender<T: key + store>(
        lease: NftTimeLease,
        by: address,
        early: bool,
    ) {
        let NftTimeLease {
            id,
            nft_id,
            lender,
            borrower: _,
            unlock_ms: _,
            reclaim_cancelled: _,
        } = lease;
        assert!(dof::exists_<EscrowedNft>(&id, EscrowedNft {}), E_NO_NFT);
        let nft = dof::remove<EscrowedNft, T>(&mut id, EscrowedNft {});
        let lease_id = object::uid_to_inner(&id);
        if (early) {
            event::emit(LeaseReturnedEarly {
                lease_id,
                nft_id,
                to_lender: lender,
                by,
            });
        } else {
            event::emit(LeaseReclaimed {
                lease_id,
                nft_id,
                to_lender: lender,
                by,
            });
        };
        transfer::public_transfer(nft, lender);
        object::delete(id);
    }

    public fun lender(lease: &NftTimeLease): address { lease.lender }
    public fun borrower(lease: &NftTimeLease): address { lease.borrower }
    public fun unlock_ms(lease: &NftTimeLease): u64 { lease.unlock_ms }
    public fun reclaim_cancelled(lease: &NftTimeLease): bool { lease.reclaim_cancelled }
    public fun nft_id(lease: &NftTimeLease): ID { lease.nft_id }
    public fun has_escrowed_nft(lease: &NftTimeLease): bool {
        dof::exists_<EscrowedNft>(&lease.id, EscrowedNft {})
    }

    #[test_only]
    struct TestKeyNft has key, store {
        id: UID,
    }

    #[test_only]
    public fun mint_test_key_nft(ctx: &mut TxContext): TestKeyNft {
        TestKeyNft { id: object::new(ctx) }
    }

    #[test_only]
    use 0x2::test_scenario as ts;

    #[test]
    fun test_create_cancel() {
        let lender = @0xA;
        let borrower = @0xB;
        let scenario = ts::begin(lender);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000);

        ts::next_tx(&mut scenario, lender);
        {
            let nft = mint_test_key_nft(ts::ctx(&mut scenario));
            create_lease(nft, borrower, 5000, &clock, ts::ctx(&mut scenario));
        };

        ts::next_tx(&mut scenario, borrower);
        {
            let lease = ts::take_shared<NftTimeLease>(&scenario);
            cancel_reclaim(&mut lease, ts::ctx(&mut scenario));
            assert!(reclaim_cancelled(&lease), 0);
            ts::return_shared(lease);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_RECLAIM_CANCELLED)]
    fun test_reclaim_after_cancel_aborts() {
        let lender = @0xA;
        let borrower = @0xB;
        let scenario = ts::begin(lender);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000);

        ts::next_tx(&mut scenario, lender);
        {
            let nft = mint_test_key_nft(ts::ctx(&mut scenario));
            create_lease(nft, borrower, 1000, &clock, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, borrower);
        {
            let lease = ts::take_shared<NftTimeLease>(&scenario);
            cancel_reclaim(&mut lease, ts::ctx(&mut scenario));
            ts::return_shared(lease);
        };
        clock::set_for_testing(&mut clock, 9000);
        ts::next_tx(&mut scenario, @0xC);
        {
            let lease = ts::take_shared<NftTimeLease>(&scenario);
            reclaim<TestKeyNft>(lease, &clock, ts::ctx(&mut scenario));
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_return_early_and_reclaim_happy() {
        let lender = @0xA;
        let borrower = @0xB;
        let scenario = ts::begin(lender);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000);

        ts::next_tx(&mut scenario, lender);
        {
            let nft = mint_test_key_nft(ts::ctx(&mut scenario));
            create_lease(nft, borrower, 60000, &clock, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, borrower);
        {
            let lease = ts::take_shared<NftTimeLease>(&scenario);
            return_early<TestKeyNft>(lease, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, lender);
        {
            let nft = ts::take_from_sender<TestKeyNft>(&scenario);
            ts::return_to_sender(&scenario, nft);
        };

        ts::next_tx(&mut scenario, lender);
        {
            let nft = mint_test_key_nft(ts::ctx(&mut scenario));
            create_lease(nft, borrower, 2000, &clock, ts::ctx(&mut scenario));
        };
        clock::set_for_testing(&mut clock, 5000);
        ts::next_tx(&mut scenario, @0xD);
        {
            let lease = ts::take_shared<NftTimeLease>(&scenario);
            reclaim<TestKeyNft>(lease, &clock, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, lender);
        {
            let nft = ts::take_from_sender<TestKeyNft>(&scenario);
            ts::return_to_sender(&scenario, nft);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = E_TOO_EARLY)]
    fun test_reclaim_too_early() {
        let lender = @0xA;
        let borrower = @0xB;
        let scenario = ts::begin(lender);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));
        clock::set_for_testing(&mut clock, 1000);

        ts::next_tx(&mut scenario, lender);
        {
            let nft = mint_test_key_nft(ts::ctx(&mut scenario));
            create_lease(nft, borrower, 9000, &clock, ts::ctx(&mut scenario));
        };
        ts::next_tx(&mut scenario, @0xC);
        {
            let lease = ts::take_shared<NftTimeLease>(&scenario);
            reclaim<TestKeyNft>(lease, &clock, ts::ctx(&mut scenario));
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
