/**
 * Crypto Layer – Re-Export der isomorphen Implementierung unter `shared/morgendrot-crypto.ts`.
 * ECDH (P-256) + AES-GCM; kein direkter node:crypto-Import mehr.
 */
export {
  CURVE,
  type KeyPair,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesGcmKey,
  encryptMessage,
  decryptMessage,
} from './shared/morgendrot-crypto.js';
export {
  type MorgMsgEnvelopeV2,
  buildSessionKeyInfo,
  deriveSessionAesGcmKey,
  serializeMorgMsgAad,
  encryptSessionMessage,
  decryptSessionMessage,
} from './shared/morgendrot-crypto-session.js';
