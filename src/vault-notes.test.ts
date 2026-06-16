/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { sanitizeVaultNoteAttachments } from './vault-note-attachments.js'
import { sanitizeVaultNotes, vaultNotesToLegacyString } from './vault-local.js'

const TINY_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('sanitizeVaultNotes', () => {
    it('migriert Legacy-Freitext zu einer Allgemein-Notiz', () => {
        const out = sanitizeVaultNotes([], 'Hallo Welt')
        expect(out).toHaveLength(1)
        expect(out[0]?.title).toBe('Allgemein')
        expect(out[0]?.body).toBe('Hallo Welt')
    })

    it('normalisiert strukturierte Einträge mit Ordner', () => {
        const out = sanitizeVaultNotes([
            { id: 'a1', title: ' Checkliste ', folder: ' Einsatz ', body: 'Item 1' },
        ])
        expect(out[0]?.title).toBe('Checkliste')
        expect(out[0]?.folder).toBe('Einsatz')
        expect(out[0]?.body).toBe('Item 1')
    })

    it('vaultNotesToLegacyString fasst mehrere Notizen zusammen', () => {
        const legacy = vaultNotesToLegacyString([
            { id: '1', title: 'A', folder: 'X', body: 'Text A' },
            { id: '2', title: 'B', body: 'Text B' },
        ])
        expect(legacy).toContain('[X] A')
        expect(legacy).toContain('# B')
    })

    it('behält gültige Anhänge (PNG) in strukturierten Notizen', () => {
        const att = sanitizeVaultNoteAttachments([
            {
                id: 'img1',
                name: 'dot.png',
                mime: 'image/png',
                kind: 'image',
                dataBase64: TINY_PNG_B64,
            },
        ])
        expect(att).toHaveLength(1)
        const out = sanitizeVaultNotes([
            { id: 'n1', title: 'Mit Bild', body: 'Siehe Anhang', attachments: att },
        ])
        expect(out[0]?.attachments).toHaveLength(1)
        expect(out[0]?.attachments?.[0]?.kind).toBe('image')
    })

    it('filtert ungültige Anhangstypen', () => {
        const out = sanitizeVaultNoteAttachments([
            { id: 'x', name: 'doc.pdf', mime: 'application/pdf', kind: 'text', dataBase64: 'YWJj' },
        ])
        expect(out).toHaveLength(0)
    })
})
