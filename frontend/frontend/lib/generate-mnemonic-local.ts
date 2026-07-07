/**
 * Clientseitige Mnemonic/Keypair-Erzeugung (Boss-APK ohne API, Weg A Scheibe 2).
 * Entspricht POST /api/generate-mnemonic auf dem Node-Server.
 */
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519'

const ADDR_64 = /^0x[a-fA-F0-9]{64}$/

export type GenerateMnemonicOk = {
  ok: true
  address: string
  /** Mnemonic oder Bech32-Secret — nur einmalig anzeigen */
  secretKey: string
}

export type GenerateMnemonicResult = GenerateMnemonicOk | { ok: false; error: string }

export function generateMnemonicKeypairLocally(): GenerateMnemonicResult {
  try {
    const keypair = new Ed25519Keypair()
    let address = String(keypair.getPublicKey().toIotaAddress() || '').trim()
    if (address && !/^0x/i.test(address)) address = `0x${address}`
    const secretKey = String(keypair.getSecretKey() || '').trim()
    if (!ADDR_64.test(address) || !secretKey) {
      return { ok: false, error: 'Keypair-Erzeugung fehlgeschlagen (leere Adresse oder Secret).' }
    }
    return { ok: true, address, secretKey }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
