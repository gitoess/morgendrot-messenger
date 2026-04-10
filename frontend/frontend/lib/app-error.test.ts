import { describe, it, expect } from 'vitest'
import { appError, isAppError, toAppError } from './app-error'

describe('AppError', () => {
  it('isAppError erkennt Struktur', () => {
    expect(isAppError(appError('E', 'm'))).toBe(true)
    expect(isAppError(new Error('x'))).toBe(false)
  })
  it('toAppError mapped Error', () => {
    const e = toAppError(new Error('fail'), 'X')
    expect(e.code).toBe('X')
    expect(e.message).toBe('fail')
  })
})
