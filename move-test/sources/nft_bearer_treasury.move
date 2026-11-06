/// B2-S3 — Bearer Treasury (Modus B): wer das gebundene NFT besitzt, darf abheben.
/// Spec: docs/NFT-GUARDED-SPEND-SPEC.md §3
/// Shared Vault — Senderecht wandert mit NFT. Admin kann einfrieren / Rest reclaimen.
module messaging::nft_bearer_treasury {
    use 0x2::balance::{Self, Balance};
    use 0x2::coin::{Self, Coin};
    use 0x2::event;
    use 0x2::object::{Self, ID, UID};
    use 0x2::transfer;
    use 0x2::tx_context::{Self, TxContext};

    const E_WRONG_NFT: u64 = 1;
    const E_ZERO_AMOUNT: u64 = 2;
    const E_ZERO_DEPOSIT: u64 = 3;
    const E_FROZEN: u64 = 4;
    const E_NOT_ADMIN: u64 = 5;
    const E_NOT_EMPTY: u64 = 6;
    const E_NOT_FROZEN: u64 = 7;

    /// Shared. `withdraw` nur mit gebundenem NFT beim Signer (kein sender==admin).
    struct NftGuardedTreasury<phantom C> has key {
        id: UID,
        admin: address,
        required_nft_id: ID,
        balance: Balance<C>,
        frozen: bool,
    }

    struct TreasuryCreated has copy, drop {
        treasury_id: ID,
        admin: address,
        required_nft_id: ID,
        amount: u64,
    }

    struct TreasuryDeposited has copy, drop {
        treasury_id: ID,
        by: address,
        amount: u64,
        balance_after: u64,
    }

    struct TreasuryWithdrawn has copy, drop {
        treasury_id: ID,
        by: address,
        required_nft_id: ID,
        amount: u64,
        recipient: address,
        balance_after: u64,
    }

    struct TreasuryFrozen has copy, drop {
        treasury_id: ID,
        by: address,
        frozen: bool,
    }

    struct TreasuryAdminReclaimed has copy, drop {
        treasury_id: ID,
        admin: address,
        amount: u64,
    }

    struct TreasuryDestroyed has copy, drop {
        treasury_id: ID,
        admin: address,
    }

    /// Admin legt Coin + NFT-Bindung an; Treasury wird shared.
    public entry fun create_treasury<C, T: key + store>(
        nft: &T,
        coin: Coin<C>,
        ctx: &mut TxContext,
    ) {
        let admin = tx_context::sender(ctx);
        let amount = coin::value(&coin);
        assert!(amount > 0, E_ZERO_DEPOSIT);
        let required_nft_id = object::id(nft);
        let treasury = NftGuardedTreasury<C> {
            id: object::new(ctx),
            admin,
            required_nft_id,
            balance: coin::into_balance(coin),
            frozen: false,
        };
        let treasury_id = object::id(&treasury);
        event::emit(TreasuryCreated {
            treasury_id,
            admin,
            required_nft_id,
            amount,
        });
        transfer::share_object(treasury);
    }

    /// Jeder darf einzahlen (Funding); Freeze blockiert nicht Deposit.
    public entry fun deposit<C>(
        treasury: &mut NftGuardedTreasury<C>,
        coin: Coin<C>,
        ctx: &mut TxContext,
    ) {
        let amount = coin::value(&coin);
        assert!(amount > 0, E_ZERO_DEPOSIT);
        balance::join(&mut treasury.balance, coin::into_balance(coin));
        event::emit(TreasuryDeposited {
            treasury_id: object::id(treasury),
            by: tx_context::sender(ctx),
            amount,
            balance_after: balance::value(&treasury.balance),
        });
    }

    /// NFT-Owner (beliebiger Signer mit NFT) hebt ab — nicht an admin gebunden.
    public entry fun withdraw<C, T: key + store>(
        treasury: &mut NftGuardedTreasury<C>,
        nft: &T,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(!treasury.frozen, E_FROZEN);
        assert!(object::id(nft) == treasury.required_nft_id, E_WRONG_NFT);
        assert!(amount > 0, E_ZERO_AMOUNT);
        let by = tx_context::sender(ctx);
        let paid = balance::split(&mut treasury.balance, amount);
        let coin = coin::from_balance(paid, ctx);
        transfer::public_transfer(coin, recipient);
        event::emit(TreasuryWithdrawn {
            treasury_id: object::id(treasury),
            by,
            required_nft_id: treasury.required_nft_id,
            amount,
            recipient,
            balance_after: balance::value(&treasury.balance),
        });
    }

    public entry fun admin_set_frozen<C>(
        treasury: &mut NftGuardedTreasury<C>,
        frozen: bool,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == treasury.admin, E_NOT_ADMIN);
        treasury.frozen = frozen;
        event::emit(TreasuryFrozen {
            treasury_id: object::id(treasury),
            by: sender,
            frozen,
        });
    }

    /// Nur wenn eingefroren: Admin holt Restguthaben zurück.
    public entry fun admin_reclaim<C>(
        treasury: &mut NftGuardedTreasury<C>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == treasury.admin, E_NOT_ADMIN);
        assert!(treasury.frozen, E_NOT_FROZEN);
        let amount = balance::value(&treasury.balance);
        assert!(amount > 0, E_ZERO_AMOUNT);
        let paid = balance::withdraw_all(&mut treasury.balance);
        let coin = coin::from_balance(paid, ctx);
        transfer::public_transfer(coin, sender);
        event::emit(TreasuryAdminReclaimed {
            treasury_id: object::id(treasury),
            admin: sender,
            amount,
        });
    }

    public entry fun destroy_empty<C>(treasury: NftGuardedTreasury<C>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == treasury.admin, E_NOT_ADMIN);
        assert!(balance::value(&treasury.balance) == 0, E_NOT_EMPTY);
        let NftGuardedTreasury {
            id,
            admin,
            required_nft_id: _,
            balance,
            frozen: _,
        } = treasury;
        balance::destroy_zero(balance);
        let treasury_id = object::uid_to_inner(&id);
        object::delete(id);
        event::emit(TreasuryDestroyed { treasury_id, admin });
    }

    public fun balance_value<C>(treasury: &NftGuardedTreasury<C>): u64 {
        balance::value(&treasury.balance)
    }

    public fun admin<C>(treasury: &NftGuardedTreasury<C>): address {
        treasury.admin
    }

    public fun required_nft_id<C>(treasury: &NftGuardedTreasury<C>): ID {
        treasury.required_nft_id
    }

    public fun is_frozen<C>(treasury: &NftGuardedTreasury<C>): bool {
        treasury.frozen
    }
}
