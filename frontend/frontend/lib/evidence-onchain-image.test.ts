import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_IMAGE_MAX_RAW_BYTES,
  classifyEvidenceObjectType,
  extractNftMediaUrlFromFields,
  fetchEvidenceImageByObjectId,
  fetchEvidenceImagesByOwner,
  isImageNftMoveType,
  isKnownImageNftPackageId,
  isPlausibleIotaObjectId,
  normalizeNftMediaUrl,
  packageIdFromMoveType,
  parseEvidenceImageFields,
  shouldAttemptEvidenceImageRender,
  KNOWN_IMAGE_NFT_PACKAGE_IDS,
} from '@/frontend/lib/evidence-onchain-image'

const KNOWN_PKG = KNOWN_IMAGE_NFT_PACKAGE_IDS[0]

describe('evidence-onchain-image', () => {
  it('Limit ~100 KB', () => {
    expect(EVIDENCE_IMAGE_MAX_RAW_BYTES).toBe(100_000)
  })

  it('erkennt bekannte Package-ID', () => {
    expect(isKnownImageNftPackageId(KNOWN_PKG)).toBe(true)
    expect(isKnownImageNftPackageId(`0x${'ab'.repeat(32)}`)).toBe(false)
  })

  it('validiert Object-ID', () => {
    expect(isPlausibleIotaObjectId(`0x${'ab'.repeat(32)}`)).toBe(true)
    expect(isPlausibleIotaObjectId('0x123')).toBe(false)
  })

  it('erkennt ImageNFT-Typ inkl. bekanntem Package', () => {
    const type = `${KNOWN_PKG}::image_nft::ImageNFT`
    expect(isImageNftMoveType(type)).toBe(true)
    expect(packageIdFromMoveType(type)).toBe(KNOWN_PKG.toLowerCase())
    const match = classifyEvidenceObjectType(type, { imageData: new Uint8Array([0xff, 0xd8, 0xff]) })
    expect(match.isImageNftType).toBe(true)
    expect(match.isKnownPackage).toBe(true)
    expect(shouldAttemptEvidenceImageRender(match)).toBe(true)
  })

  it('Package-Objekt nicht rendern', () => {
    const match = classifyEvidenceObjectType('package', {}, 'package')
    expect(match.isPackageObject).toBe(true)
    expect(shouldAttemptEvidenceImageRender(match)).toBe(false)
  })

  it('encrypted-Flag + PNG-Magic → trotzdem anzeigen', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const r = parseEvidenceImageFields({ imageData: png, encrypted: true, mime: 'image/png' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.encryptedFlag).toBe(true)
      expect(r.needsPassphrase).toBe(false)
    }
  })

  it('lehnt encrypted ohne Bildmagic und ohne MORGIMGE1 ab', () => {
    const r = parseEvidenceImageFields({
      imageData: new Uint8Array([1, 2, 3, 4, 5, 6]),
      encrypted: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.needsPassphrase).toBeFalsy()
  })

  it('cap bei Übergröße', () => {
    const big = new Uint8Array(EVIDENCE_IMAGE_MAX_RAW_BYTES + 1)
    big[0] = 0xff
    big[1] = 0xd8
    big[2] = 0xff
    const r = parseEvidenceImageFields({ imageData: big })
    expect(r.ok).toBe(false)
  })

  it('fetch: Package-ID → klarer Fehler', async () => {
    const client = {
      getObject: async () => ({
        data: { objectId: KNOWN_PKG, type: 'package', content: { dataType: 'package' } },
      }),
    }
    const r = await fetchEvidenceImageByObjectId(client, KNOWN_PKG)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Package-ID/i)
  })

  it('fetchEvidenceImageByObjectId: Auto-Erkennung', async () => {
    const jpeg = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]
    const objectId = `0x${'11'.repeat(32)}`
    const client = {
      getObject: async () => ({
        data: {
          objectId,
          type: `${KNOWN_PKG}::image_nft::ImageNFT`,
          content: {
            fields: {
              image_data: jpeg,
              content_type: 'image/jpeg',
              encrypted: true,
              name: 'Test',
            },
          },
        },
      }),
    }
    const r = await fetchEvidenceImageByObjectId(client, objectId)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.match.isKnownPackage).toBe(true)
      expect(r.parsed.mime).toBe('image/jpeg')
      expect(r.parsed.encryptedFlag).toBe(true)
      expect(r.name).toBe('Test')
    }
  })

  it('normalisiert IPFS auf Pinata-Pfad für img (nicht inbrowser HTML)', () => {
    expect(normalizeNftMediaUrl('ipfs://bafybeitestcid123456789012345678901')).toBe(
      'https://gateway.pinata.cloud/ipfs/bafybeitestcid123456789012345678901'
    )
    expect(
      extractNftMediaUrlFromFields({
        name: 'IOTA Rebased NFT',
        description: 'Text\nhttps://ipfs.io/ipfs/bafybeiejkquasj2mdw6zlxjg7oyivv3m2ugqxb5bhj3hv32hcvtpcq2yam',
      })
    ).toBe(
      'https://gateway.pinata.cloud/ipfs/bafybeiejkquasj2mdw6zlxjg7oyivv3m2ugqxb5bhj3hv32hcvtpcq2yam'
    )
    expect(
      extractNftMediaUrlFromFields({
        url: { url: 'https://ipfs.io/ipfs/bafybeiexamplecidabcdefghijklmnop' },
      })
    ).toBe('https://gateway.pinata.cloud/ipfs/bafybeiexamplecidabcdefghijklmnop')
  })

  it('fetchEvidenceImageByObjectId: SimpleNFT mit URL', async () => {
    const objectId = `0x${'44'.repeat(32)}`
    const pkg = `0x${'b8'.repeat(32)}`
    const client = {
      getObject: async () => ({
        data: {
          objectId,
          type: `${pkg}::nft::SimpleNFT`,
          content: {
            dataType: 'moveObject',
            fields: {
              name: 'IOTA Rebased NFT',
              description: 'NFT de prueba',
              url: 'https://ipfs.io/ipfs/bafybeiejkquasj2mdw6zlxjg7oyivv3m2ugqxb5bhj3hv32hcvtpcq2yam',
              creator: `0x${'aa'.repeat(32)}`,
            },
          },
        },
      }),
    }
    const r = await fetchEvidenceImageByObjectId(client, objectId)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.source).toBe('url')
      expect(r.displayUrl).toBe(
        'https://gateway.pinata.cloud/ipfs/bafybeiejkquasj2mdw6zlxjg7oyivv3m2ugqxb5bhj3hv32hcvtpcq2yam'
      )
      expect(r.name).toBe('IOTA Rebased NFT')
    }
  })

  it('fetchEvidenceImagesByOwner: MatchAny findet SimpleNFT ohne Coin-Scan', async () => {
    const owner = `0x${'22'.repeat(32)}`
    const simpleId = `0x${'44'.repeat(32)}`
    const simplePkg = '0xb800e7cf19a2d63d3f5f4e857d4cf20c685d4768c71b04a3d803b09b48ab53f8'
    const client = {
      getObject: async () => ({ data: null }),
      getOwnedObjects: async (input: {
        filter?: { StructType?: string; MatchAny?: Array<{ StructType: string }> }
      }) => {
        expect(input.filter?.MatchAny?.length).toBeGreaterThanOrEqual(2)
        expect(input.filter?.MatchAny?.some((x) => /SimpleNFT/i.test(x.StructType))).toBe(true)
        return {
          data: [
            {
              data: {
                objectId: simpleId,
                type: `${simplePkg}::nft::SimpleNFT`,
                content: {
                  fields: {
                    name: 'URL-NFT',
                    url: 'https://ipfs.io/ipfs/bafybeiejkquasj2mdw6zlxjg7oyivv3m2ugqxb5bhj3hv32hcvtpcq2yam',
                  },
                },
              },
            },
          ],
          nextCursor: null,
          hasNextPage: false,
        }
      },
    }
    const r = await fetchEvidenceImagesByOwner(client, owner)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.items).toHaveLength(1)
      expect(r.items[0]?.source).toBe('url')
      expect(r.items[0]?.displayUrl).toContain('pinata')
      expect(r.hasNextPage).toBe(false)
    }
  })
})
