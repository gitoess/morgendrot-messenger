/**
 * SIGNER=sdk: Mnemonic, IOTA-Bech32-Secret (encodeIotaPrivateKey) oder 32-Byte-Hex → Ed25519Keypair.
 */
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { CFG } from '../config.js';
import { setSdkSigner } from '../chain-access.js';
import { setSessionIotaMnemonic } from './messenger-session-password.js';

export function countMnemonicWords(s: string): number {
    return String(s || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

/** Genug für Unlock/Import (Mnemonic ≥12 Wörter, Bech32-Secret oder 64 Hex). */
export function isPlausibleSdkImport(s: string): boolean {
    const t = String(s || '').trim();
    if (!t) return false;
    if (countMnemonicWords(t) >= 12) return true;
    const hex = t.replace(/^0x/i, '').replace(/\s+/g, '');
    if (/^[a-fA-F0-9]{64}$/i.test(hex)) return true;
    if (!/\s/.test(t) && t.length >= 60 && /^[a-z]{2,30}1[02-9ac-hj-np-z]+$/i.test(t)) return true;
    return false;
}

export function applySdkSignerFromImport(raw: string): void {
    const t = String(raw).trim();
    if (!t) throw new Error('Signer-Import leer.');
    let keypair: Ed25519Keypair;
    if (countMnemonicWords(t) >= 12) {
        keypair = Ed25519Keypair.deriveKeypair(t, CFG.WALLET_DERIVATION_PATH || undefined);
    } else {
        try {
            keypair = Ed25519Keypair.fromSecretKey(t);
        } catch {
            const hex = t.replace(/^0x/i, '').replace(/\s+/g, '');
            if (/^[a-fA-F0-9]{64}$/.test(hex)) {
                keypair = Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(hex, 'hex')));
            } else {
                throw new Error(
                    'Ungültiger Signer-Import: Mnemonic (12+ Wörter), oder IOTA-Bech32-Secret (Ausgabe von generate-mnemonic / getSecretKey), oder 64 Hex-Zeichen (32 Bytes).',
                );
            }
        }
    }
    setSdkSigner(keypair);
    let addr = String(keypair.toIotaAddress() || '').trim();
    if (addr && !/^0x/i.test(addr)) addr = '0x' + addr;
    (CFG as { MY_ADDRESS: string }).MY_ADDRESS = addr;
    process.env.MY_ADDRESS = addr;
    setSessionIotaMnemonic(t);
}
