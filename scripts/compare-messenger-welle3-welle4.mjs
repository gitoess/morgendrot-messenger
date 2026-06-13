#!/usr/bin/env node
/**
 * Bundle-Vergleich Lazy Welle 3 vs. Welle 4 (Peering-QR + Morg-Pkg).
 * Baut zweimal nacheinander: zuerst Welle-3-Stand (ohne W4-Patches), dann Welle 4 (Ist).
 *
 * Usage: node scripts/compare-messenger-welle3-welle4.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const frontend = path.join(root, 'frontend')
const outDir = path.join(root, '.bundle-compare')

const FILES = {
  scopeB: path.join(frontend, 'frontend/components/lazy/messenger-scope-b.ts'),
  partner: path.join(frontend, 'frontend/components/chat-view-encrypted-partner-panel.tsx'),
  handshakeBar: path.join(frontend, 'frontend/components/chat-view-encrypted-recipient-handshake-bar.tsx'),
  mainContent: path.join(frontend, 'frontend/components/chat-view-main-content.tsx'),
}

function read(p) {
  return fs.readFileSync(p, 'utf8')
}

function write(p, content) {
  fs.writeFileSync(p, content, 'utf8')
}

function backup() {
  const b = {}
  for (const [k, p] of Object.entries(FILES)) {
    b[k] = read(p)
  }
  return b
}

function restore(b) {
  for (const [k, p] of Object.entries(FILES)) {
    write(p, b[k])
  }
}

/** Welle 3: Peering-QR + Morg-Pkg noch eager im Hot-Path */
function applyWelle3(backups) {
  let scopeB = backups.scopeB
  scopeB = scopeB.replace(
    /\r?\n\r?\n\/\*\* B2 — Peering-QR[\s\S]*$/,
    '\n'
  )
  write(FILES.scopeB, scopeB)

  let partner = backups.partner
  partner = partner.replace(
    "import { useMemo, useState } from 'react'",
    "import { useMemo } from 'react'"
  )
  partner = partner.replace(
    "import { LazyPeeringQrActions } from '@/frontend/components/lazy/messenger-scope-b'",
    "import { PeeringQrActions } from '@/frontend/components/peering-qr-actions'"
  )
  partner = partner.replace(/\r?\n  const \[peeringQrMounted, setPeeringQrMounted\] = useState\(false\)\r?\n/, '\n')
  partner = partner.replace(
    /<details[\s\S]*?<\/details>/,
    `<PeeringQrActions
            myAddress={myAddress}
            disabled={sending}
            onStatus={onPeeringStatus}
            onImported={({ address }) => onPartnerChange(address)}
          />`
  )
  write(FILES.partner, partner)

  let bar = backups.handshakeBar
  bar = bar.replace(
    "import { LazyPeeringQrActions } from '@/frontend/components/lazy/messenger-scope-b'",
    "import { PeeringQrActions } from '@/frontend/components/peering-qr-actions'"
  )
  bar = bar.replace(/LazyPeeringQrActions/g, 'PeeringQrActions')
  write(FILES.handshakeBar, bar)

  let main = backups.mainContent
  if (!main.includes('ChatViewMorgPkgImportsSheet')) {
    main = main.replace(
      "import {\n  LazyChatViewMorgPkgImportsSheet,\n  LazyChatViewRelaySubmitButton,\n} from '@/frontend/components/lazy/messenger-scope-b'",
      "import { ChatViewMorgPkgImportsSheet } from '@/frontend/components/chat-view-morg-pkg-imports-sheet'\nimport { LazyChatViewRelaySubmitButton } from '@/frontend/components/lazy/messenger-scope-b'"
    )
  }
  main = main.replace(
    /\{morgPkgImportsOpen \? \(\s*<LazyChatViewMorgPkgImportsSheet[\s\S]*?\) : null\}/,
    `<ChatViewMorgPkgImportsSheet
        open={morgPkgImportsOpen}
        onOpenChange={setMorgPkgImportsOpen}
        records={morgPkgImports}
        contactDirectory={directory}
        onRemove={removeMorgPkgImport}
        onForwardItem={onForwardMorgPkgItem}
      />`
  )
  write(FILES.mainContent, main)
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function copyDir(src, dest) {
  rmDir(dest)
  fs.cpSync(src, dest, { recursive: true })
}

function build(label) {
  const logPath = path.join(frontend, '.bundle-compare-build.log')
  console.log(`\n>>> build:messenger (${label}) …`)
  execSync('npm run build:messenger', {
    cwd: frontend,
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_MORG_PRODUCT: 'messenger' },
  })
  const nextDir = path.join(frontend, '.next')
  if (!fs.existsSync(nextDir)) throw new Error('Build ohne .next')
  const destFrontend = path.join(outDir, `${label}-frontend`)
  rmDir(destFrontend)
  fs.mkdirSync(destFrontend, { recursive: true })
  copyDir(nextDir, path.join(destFrontend, '.next'))
  if (fs.existsSync(logPath)) {
    fs.copyFileSync(logPath, path.join(destFrontend, '.bundle-compare-build.log'))
  }
}

function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const backups = backup()

  try {
    applyWelle3(backups)
    build('welle3')

    restore(backups)
    build('welle4')

    execSync(
      `node "${path.join(__dirname, 'compare-messenger-bundle-size.mjs')}" "${path.join(outDir, 'welle3-frontend')}" "${path.join(outDir, 'welle4-frontend')}"`,
      { cwd: root, stdio: 'inherit' }
    )

    console.log('\nArtefakte:', outDir)
    console.log('  welle3-frontend/.next  — Lazy Welle 1–3')
    console.log('  welle4-frontend/.next  — + Welle 4 (Peering-QR, Morg-Pkg Sheet)')
  } finally {
    restore(backups)
    console.log('\nQuellfiles auf Welle-4-Stand zurückgesetzt.')
  }
}

main()
