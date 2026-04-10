import { executeCommand } from '@/frontend/lib/api/execute-command'

/** Package-ID in `.morgendrot-package-id` schreiben (wie Terminal `/set-package-id`). */
export const setPackageIdCommand = (packageId0x: string) =>
  executeCommand('/set-package-id', [packageId0x.trim()])

export const startHandshake = (partner: string) => executeCommand('/handshake', [partner])

export const connect = (address?: string) =>
  executeCommand('/connect', address ? [address] : [])
