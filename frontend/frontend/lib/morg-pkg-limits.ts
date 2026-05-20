/**
 * Sneakernet .morg-pkg — höheres Klartext-Budget als eine On-Chain-Nachricht (~16 KiB).
 * Muss mit Backend `MORG_PKG_MAX_PLAINTEXT_UTF8_BYTES` in `src/morg-pkg-wire.ts` übereinstimmen (Default 512 KiB).
 */
export const MORG_PKG_BUNDLE_MAX_UTF8_BYTES = 524_288

/** Hinweis in der UI, wenn Nutzer später dieselben Inhalte per /send schicken will. */
export const MESSAGING_ONLINE_WIRE_UTF8_MAX = 16_000
