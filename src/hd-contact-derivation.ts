/**
 * Phase 2: deterministische Kontakt-Adressen (HD) – Vorbereitung ohne Chain-Anbindung.
 * Wenn ENABLE_HD_CONTACT_ADDRESSES=true, soll künftig z. B. ein abgeleiteter Pfad pro Kontaktindex genutzt werden.
 */
import { CFG } from './config.js';

export function assertHdContactFeatureEnabled(): void {
    if (!CFG.ENABLE_HD_CONTACT_ADDRESSES) {
        throw new Error('HD-Kontakt-Adressen sind aus (ENABLE_HD_CONTACT_ADDRESSES=false).');
    }
}

/** Reserviert: später Ableitung aus Vault-Stamm + Kontaktindex. */
export function deriveContactAddressPlaceholder(_contactIndex: number): never {
    assertHdContactFeatureEnabled();
    throw new Error('HD-Kontakt-Ableitung ist noch nicht implementiert (nur Flag + Stub).');
}
