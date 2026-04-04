/**
 * CLI: Liest ein Bild, kodiert mit VaultImagePipeline (Luma+Chroma), gibt Größen aus.
 * Ohne laufendes API/Wallet – reiner Pipeline-Test.
 *
 *   npx tsx scripts/test-compact-image-file.ts "C:\path\to\hopium.png"
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { VaultImagePipeline } from '../src/vault-image-pipeline.js'

const defaultWinPath = String.raw`C:\Users\damast\Desktop\bilder\Telegram Desktop\hopium.png`

async function main() {
  const arg = process.argv[2]
  const path = resolve(arg || defaultWinPath)
  const buf = await readFile(path)
  const fit = await VaultImagePipeline.encodeToPlaintextBlobFitChain(buf)
  const b64 = fit.plaintext.toString('base64')
  const wire = '[[MORG_COMPACT_IMG_V1:' + b64 + ']]'
  console.log('file:', path)
  console.log('input bytes:', buf.length)
  console.log('luma webp:', fit.lumaWebpBytes)
  console.log('chroma png:', fit.chromaPngBytes)
  console.log('plaintext blob:', fit.plaintext.length)
  console.log('used webp quality:', fit.usedQuality, 'dim:', fit.usedMaxDim, 'chroma:', fit.chromaW + 'x' + fit.chromaH)
  console.log('blob base64 length (chars):', b64.length)
  console.log('wire UTF-8 bytes (approx):', Buffer.byteLength(wire, 'utf8'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
