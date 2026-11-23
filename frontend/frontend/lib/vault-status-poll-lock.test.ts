import { describe, expect, it } from 'vitest'
import { decideVaultUiLockFromStatusPoll } from '@/frontend/lib/vault-status-poll-lock'

describe('decideVaultUiLockFromStatusPoll', () => {
  it('kein Stay-Hint → nicht sperren, Streak reset', () => {
    expect(
      decideVaultUiLockFromStatusPoll({
        stayLockedHint: false,
        apiLocked: false,
        sessionWasStable: true,
        streak: 3,
      })
    ).toEqual({ lockUi: false, nextStreak: 0, clearStable: false })
  })

  it('API hard-locked → sofort', () => {
    expect(
      decideVaultUiLockFromStatusPoll({
        stayLockedHint: true,
        apiLocked: true,
        sessionWasStable: true,
        streak: 0,
      })
    ).toEqual({ lockUi: true, nextStreak: 0, clearStable: true })
  })

  it('hasKeys-Flap: erste Runde behält UI offen', () => {
    expect(
      decideVaultUiLockFromStatusPoll({
        stayLockedHint: true,
        apiLocked: false,
        sessionWasStable: true,
        streak: 0,
      })
    ).toEqual({ lockUi: false, nextStreak: 1, clearStable: false })
  })

  it('hasKeys-Flap: zweite Runde sperrt', () => {
    expect(
      decideVaultUiLockFromStatusPoll({
        stayLockedHint: true,
        apiLocked: false,
        sessionWasStable: true,
        streak: 1,
      })
    ).toEqual({ lockUi: true, nextStreak: 2, clearStable: true })
  })

  it('ohne stabile Sitzung → sofort sperren', () => {
    expect(
      decideVaultUiLockFromStatusPoll({
        stayLockedHint: true,
        apiLocked: false,
        sessionWasStable: false,
        streak: 0,
      })
    ).toEqual({ lockUi: true, nextStreak: 0, clearStable: true })
  })
})
