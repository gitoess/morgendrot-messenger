/**
 * Öffentliches Produktverzeichnis (ohne Stripe-Geheimnisse).
 * Preise kommen aus dem Stripe-Dashboard (Price IDs über Env).
 */
export type ShopProduct = {
    id: string;
    title: string;
    description: string;
    /** Nur Anzeige-Hinweis — faktischer Betrag liegt in Stripe. */
    priceHint: string;
    /** Name der Env-Variable für `price_…` aus dem Stripe-Dashboard. */
    stripePriceIdEnv: string;
};

export function getShopCatalog(): ShopProduct[] {
    return [
        {
            id: 'messenger-messages-500',
            title: '500 Nachrichten (Paket)',
            description:
                'Nach erfolgreicher Zahlung: Einlöse-Code für den Messenger-Claim-Flow (siehe /api/voucher-claim). On-Chain-Schritt: Konfiguration/Treasury.',
            priceHint: 'Betrag im Stripe-Dashboard hinterlegt (Test/Live Price).',
            stripePriceIdEnv: 'SHOP_STRIPE_PRICE_MESSAGES_500',
        },
    ];
}

export function getShopProductById(id: string): ShopProduct | undefined {
    return getShopCatalog().find((p) => p.id === String(id || '').trim());
}

export function resolveStripePriceId(product: ShopProduct): string {
    const v = process.env[product.stripePriceIdEnv]?.trim();
    return v || '';
}

/** Für GET /api/shop/products — keine internen Felder. */
export function getPublicShopProducts(): Array<{
    id: string;
    title: string;
    description: string;
    priceHint: string;
    configured: boolean;
}> {
    return getShopCatalog().map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        priceHint: p.priceHint,
        configured: Boolean(resolveStripePriceId(p)),
    }));
}
