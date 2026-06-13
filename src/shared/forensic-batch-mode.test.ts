import { describe, expect, it, afterEach } from 'vitest'
import { forensicBatchModeFromEnv, parseForensicBatchModeInput } from './forensic-batch-mode.js'

describe('forensic-batch-mode', () => {
    const prev = process.env.FORENSIC_BATCH_MODE

    afterEach(() => {
        if (prev === undefined) delete process.env.FORENSIC_BATCH_MODE
        else process.env.FORENSIC_BATCH_MODE = prev
    })

    it('defaults to plaintext', () => {
        delete process.env.FORENSIC_BATCH_MODE
        expect(forensicBatchModeFromEnv()).toBe('plaintext')
    })

    it('reads encrypted from env', () => {
        process.env.FORENSIC_BATCH_MODE = 'encrypted'
        expect(forensicBatchModeFromEnv()).toBe('encrypted')
    })

    it('parseForensicBatchModeInput', () => {
        expect(parseForensicBatchModeInput('encrypted')).toBe('encrypted')
        expect(parseForensicBatchModeInput('bogus')).toBeUndefined()
    })
})
