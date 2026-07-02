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
export {
  DEFAULT_SESSION_KEY_EPOCH,
  SESSION_CIPHER_SUITE_P256_AES_GCM,
  buildSessionEnvelope,
  encryptIotaPeerSessionMessage,
  decryptIotaPeerSessionMessage,
  isSessionWireV2Ciphertext,
} from './shared/morgendrot-crypto-session-wire.js';
export {
  type PeerSessionArchiveEntry,
  type SessionKeysArchiveFile,
  getSendKeyEpoch,
  resolvePeerPubForEpoch,
  listPeerPubsForEpochDecrypt,
  rotatePeerSessionEpoch,
} from './shared/morgendrot-session-keys-archive.js';
