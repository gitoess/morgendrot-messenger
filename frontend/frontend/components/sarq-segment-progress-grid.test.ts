import { describe, expect, it } from 'vitest'
import { parseLoraMeshProgressLine, sentIndicesUpTo } from './sarq-segment-progress-grid'

describe('parseLoraMeshProgressLine', () => {
  it('parst Luma k/n', () => {
    expect(parseLoraMeshProgressLine('Luma 3/20')).toEqual({ phase: 'luma', done: 3, total: 20 })
  })
  it('parst Chroma', () => {
    expect(parseLoraMeshProgressLine('Chroma 0/5')).toEqual({ phase: 'chroma', done: 0, total: 5 })
  })
  it('lehnt Müll ab', () => {
    expect(parseLoraMeshProgressLine('kurze NAK-Pause')).toBeNull()
  })
})

describe('sentIndicesUpTo', () => {
  it('0..done-1', () => {
    expect([...sentIndicesUpTo(3)].sort()).toEqual([0, 1, 2])
    expect(sentIndicesUpTo(0).size).toBe(0)
  })
})
