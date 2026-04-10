import { executeCommand } from '@/frontend/lib/api/execute-command'

export const setBossRole = (address: string, role: 'boss' | 'commander' | 'worker') =>
  executeCommand('/set-role', [address, role])

export const sendBossCommand = (targets: string[], command: string) =>
  executeCommand('/boss-command', [JSON.stringify(targets), command])

export const transferCoins = (recipient: string, amount: number) =>
  executeCommand('/transfer-coins', [recipient, amount])
