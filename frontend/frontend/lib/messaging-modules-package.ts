/**
 * Neueste Messaging-Upgrade-Version mit Zusatzmodulen
 * (nft_time_lease, nft_guarded_purse, nft_bearer_treasury).
 * Chat-Stamm PACKAGE_ID / Mailbox bleiben 0x06e099… — siehe docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md.
 */
export const MESSAGING_MODULES_PACKAGE_ID =
  '0x10b16597085b8a546555a659d1bd20002cee2bfd74ec2e59696826edb1b324c0'

/** Guarded-Purse Upgrade-Version (vor Bearer). */
export const MESSAGING_MODULES_PACKAGE_ID_S1 =
  '0x0c94e8889748e41f5a90c267f1691dafceaf68183365292111dd92eec723b3d7'

/** Vorherige Lease-only Upgrade-Version (bestehende Escrows). */
export const MESSAGING_MODULES_PACKAGE_ID_P5 =
  '0x42b10c99f81ecaa885d4a8f05eb933fe9862ca1bdececb2d5b97c628e31de623'
