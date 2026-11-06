/**
 * Neueste Messaging-Upgrade-Version mit Zusatzmodulen
 * (nft_time_lease, nft_guarded_purse, nft_bearer_treasury, nft_gate_seal).
 * Chat-Stamm PACKAGE_ID / Mailbox bleiben 0x06e099… — siehe docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md.
 */
export const MESSAGING_MODULES_PACKAGE_ID =
  '0x1fb0e9b723328a8c3b99be717958d5da6aff8ace5cc94a37d1da060c038595c7'

/** Bearer-Treasury Upgrade-Version. */
export const MESSAGING_MODULES_PACKAGE_ID_S3 =
  '0x10b16597085b8a546555a659d1bd20002cee2bfd74ec2e59696826edb1b324c0'

/** Guarded-Purse Upgrade-Version. */
export const MESSAGING_MODULES_PACKAGE_ID_S1 =
  '0x0c94e8889748e41f5a90c267f1691dafceaf68183365292111dd92eec723b3d7'

/** Vorherige Lease-only Upgrade-Version (bestehende Escrows). */
export const MESSAGING_MODULES_PACKAGE_ID_P5 =
  '0x42b10c99f81ecaa885d4a8f05eb933fe9862ca1bdececb2d5b97c628e31de623'
