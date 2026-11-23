/**
 * Status-Poll → UI-Lock.
 * API `locked=true` → sofort.
 * Nur `hasKeys=false` bei schon stabiler Sitzung → Streak (transienter Poll), nicht sofort Dialog.
 */

export function decideVaultUiLockFromStatusPoll(input: {
  /** messengerVaultUiShouldStayLocked(...) */
  stayLockedHint: boolean
  apiLocked: boolean
  sessionWasStable: boolean
  streak: number
  /** Nach wie vielen hasKeys-Flaps erst sperren */
  flapStreakLimit?: number
}): { lockUi: boolean; nextStreak: number; clearStable: boolean } {
  const limit = input.flapStreakLimit ?? 2
  if (!input.stayLockedHint) {
    return { lockUi: false, nextStreak: 0, clearStable: false }
  }
  if (input.apiLocked) {
    return { lockUi: true, nextStreak: 0, clearStable: true }
  }
  if (input.sessionWasStable) {
    const nextStreak = input.streak + 1
    if (nextStreak >= limit) {
      return { lockUi: true, nextStreak, clearStable: true }
    }
    return { lockUi: false, nextStreak, clearStable: false }
  }
  return { lockUi: true, nextStreak: 0, clearStable: true }
}
