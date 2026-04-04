/**
 * Kammer „Session“: ein gemeinsames Passwort für Signer (CLI/SDK) und Vault.
 * Bewusst minimal – kein Vault-Format, keine Chain-Calls.
 */
let _walletPassword: string | undefined;
/** Nur RAM: optional für SIGNER=sdk, damit „Lokal sichern“ die Phrase verschlüsselt in .morgendrot-vault legen kann. */
let _sessionIotaMnemonic: string | undefined;

export function setWalletPassword(p: string): void {
    _walletPassword = p;
}

export function clearWalletPassword(): void {
    _walletPassword = undefined;
}

export function getWalletPassword(): string | undefined {
    return _walletPassword;
}

export function setSessionIotaMnemonic(m: string | undefined): void {
    _sessionIotaMnemonic = m?.trim() ? m.trim() : undefined;
}

export function getSessionIotaMnemonic(): string | undefined {
    return _sessionIotaMnemonic;
}

export function clearSessionIotaMnemonic(): void {
    _sessionIotaMnemonic = undefined;
}
