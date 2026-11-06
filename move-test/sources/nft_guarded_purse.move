/// B2-S1 — NFT-gesicherte Guarded Purse (Token-2FA, Modus A).
/// Spec: docs/NFT-GUARDED-SPEND-SPEC.md
/// Nur Coins in der Purse sind geschützt; lose Coins außerhalb bleiben ungeschützt.
module messaging::nft_guarded_purse {
    use 0x2::balance::{Self, Balance};
    use 0x2::coin::{Self, Coin};
    use 0x2::event;
    use 0x2::object::{Self, ID, UID};
    use 0x2::transfer;
    use 0x2::tx_context::{Self, TxContext};

    const E_NOT_OWNER: u64 = 1;
    const E_WRONG_NFT: u64 = 2;
    const E_ZERO_AMOUNT: u64 = 3;
    const E_NOT_EMPTY: u64 = 4;
    const E_ZERO_DEPOSIT: u64 = 5;

    /// Owned by `owner` (Wallet X). `spend` braucht Sender=X und gebundenes NFT bei X.
    struct GuardedPurse<phantom C> has key {
        id: UID,
        owner: address,
        required_nft_id: ID,
        balance: Balance<C>,
    }

    struct PurseCreated has copy, drop {
        purse_id: ID,
        owner: address,
        required_nft_id: ID,
        amount: u64,
    }

    struct PurseDeposited has copy, drop {
        purse_id: ID,
        owner: address,
        amount: u64,
        balance_after: u64,
    }

    struct PurseSpent has copy, drop {
        purse_id: ID,
        owner: address,
        required_nft_id: ID,
        amount: u64,
        recipient: address,
        balance_after: u64,
    }

    struct PurseDestroyed has copy, drop {
        purse_id: ID,
        owner: address,
    }

    /// X legt Coin in neue Purse; NFT-Ref beweist Besitz zum Bindungszeitpunkt.
    public entry fun create_purse<C, T: key + store>(
        nft: &T,
        coin: Coin<C>,
        ctx: &mut TxContext,
    ) {
        let owner = tx_context::sender(ctx);
        let amount = coin::value(&coin);
        assert!(amount > 0, E_ZERO_DEPOSIT);
        let required_nft_id = object::id(nft);
        let purse = GuardedPurse<C> {
            id: object::new(ctx),
            owner,
            required_nft_id,
            balance: coin::into_balance(coin),
        };
        let purse_id = object::id(&purse);
        event::emit(PurseCreated {
            purse_id,
            owner,
            required_nft_id,
            amount,
        });
        transfer::transfer(purse, owner);
    }

    /// Nur Owner darf nachlegen (ohne NFT — Einzahlung, kein Spend).
    public entry fun deposit<C>(
        purse: &mut GuardedPurse<C>,
        coin: Coin<C>,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == purse.owner, E_NOT_OWNER);
        let amount = coin::value(&coin);
        assert!(amount > 0, E_ZERO_DEPOSIT);
        balance::join(&mut purse.balance, coin::into_balance(coin));
        event::emit(PurseDeposited {
            purse_id: object::id(purse),
            owner: purse.owner,
            amount,
            balance_after: balance::value(&purse.balance),
        });
    }

    /// Spend nur wenn Sender=Owner und vorgelegtes NFT-ID == required_nft_id
    /// (Objekt-Arg erzwingt Besitz bei Sender).
    public entry fun spend<C, T: key + store>(
        purse: &mut GuardedPurse<C>,
        nft: &T,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == purse.owner, E_NOT_OWNER);
        assert!(object::id(nft) == purse.required_nft_id, E_WRONG_NFT);
        assert!(amount > 0, E_ZERO_AMOUNT);
        let paid = balance::split(&mut purse.balance, amount);
        let coin = coin::from_balance(paid, ctx);
        transfer::public_transfer(coin, recipient);
        event::emit(PurseSpent {
            purse_id: object::id(purse),
            owner: purse.owner,
            required_nft_id: purse.required_nft_id,
            amount,
            recipient,
            balance_after: balance::value(&purse.balance),
        });
    }

    /// Leere Purse zerstören (Speicher); nur Owner.
    public entry fun destroy_empty<C>(purse: GuardedPurse<C>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == purse.owner, E_NOT_OWNER);
        assert!(balance::value(&purse.balance) == 0, E_NOT_EMPTY);
        let GuardedPurse { id, owner, required_nft_id: _, balance } = purse;
        balance::destroy_zero(balance);
        let purse_id = object::uid_to_inner(&id);
        object::delete(id);
        event::emit(PurseDestroyed { purse_id, owner });
    }

    public fun balance_value<C>(purse: &GuardedPurse<C>): u64 {
        balance::value(&purse.balance)
    }

    public fun owner<C>(purse: &GuardedPurse<C>): address {
        purse.owner
    }

    public fun required_nft_id<C>(purse: &GuardedPurse<C>): ID {
        purse.required_nft_id
    }
}
