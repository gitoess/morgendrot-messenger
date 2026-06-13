import { describe, expect, it } from 'vitest'
import { parseGlobalsCreatedFromCliOutput } from './move-package-deploy.js'

describe('parseGlobalsCreatedFromCliOutput', () => {
    it('parst GlobalsCreated aus CLI-JSON', () => {
        const stdout = JSON.stringify({
            events: [
                {
                    type: '0xabc::messaging::GlobalsCreated',
                    parsedJson: {
                        vault_registry_id: '0x' + 'a'.repeat(64),
                        mailbox_id: '0x' + 'b'.repeat(64),
                        command_registry_id: '0x' + 'c'.repeat(64),
                    },
                },
            ],
        })
        const out = parseGlobalsCreatedFromCliOutput(stdout)
        expect(out.vaultRegistryId).toBe('0x' + 'a'.repeat(64))
        expect(out.mailboxId).toBe('0x' + 'b'.repeat(64))
        expect(out.commandRegistryId).toBe('0x' + 'c'.repeat(64))
    })

    it('wirft bei fehlendem Event', () => {
        expect(() => parseGlobalsCreatedFromCliOutput('{}')).toThrow(/GlobalsCreated/)
    })
})
