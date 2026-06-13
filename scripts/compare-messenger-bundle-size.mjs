#!/usr/bin/env node
/**
 * Vergleicht build:messenger — Baseline (eager) vs. Lazy (Scope B dynamic).
 * Nutzung: node scripts/compare-messenger-bundle-size.mjs <baseline-frontend> <lazy-frontend>
 * Beide Verzeichnisse müssen jeweils einen fertigen `.next/`-Build enthalten.
 */
import fs from 'node:fs'
import path from 'node:path'

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listJsFiles(full))
    else if (ent.name.endsWith('.js')) out.push(full)
  }
  return out
}

function analyzeFrontend(frontendDir, label) {
  const nextDir = path.join(frontendDir, '.next')
  if (!fs.existsSync(nextDir)) {
    throw new Error(`Kein .next in ${frontendDir} — zuerst npm run build:messenger`)
  }

  const chunkFiles = listJsFiles(path.join(nextDir, 'static', 'chunks'))
  const chunkSizes = chunkFiles.map((f) => ({ file: path.basename(f), bytes: fs.statSync(f).size }))
  chunkSizes.sort((a, b) => b.bytes - a.bytes)

  const totalChunks = chunkSizes.reduce((s, c) => s + c.bytes, 0)

  let sharedFirstLoad = null
  let pageFirstLoad = null
  const buildManifest = path.join(nextDir, 'build-manifest.json')
  if (fs.existsSync(buildManifest)) {
    const manifest = readJson(buildManifest)
    const pages = manifest.pages || {}
    const root = pages['/'] || pages['/_app'] || Object.values(pages)[0]
    if (root) {
      const files = root.filter((f) => f.endsWith('.js'))
      pageFirstLoad = files.reduce((sum, rel) => {
        const abs = path.join(nextDir, rel.startsWith('/') ? rel.slice(1) : rel)
        const alt = path.join(nextDir, 'static', rel.replace(/^static\//, ''))
        const hit = [abs, alt].find((p) => fs.existsSync(p))
        return sum + (hit ? fs.statSync(hit).size : 0)
      }, 0)
    }
  }

  const appManifest = path.join(nextDir, 'app-build-manifest.json')
  let appPageChunks = []
  if (fs.existsSync(appManifest)) {
    const am = readJson(appManifest)
    for (const entry of am.pages?.['/page'] || am.pages?.['/'] || []) {
      if (entry.endsWith('.js')) appPageChunks.push(entry)
    }
  }

  const buildLog = path.join(frontendDir, '.bundle-compare-build.log')
  let routeTable = []
  if (fs.existsSync(buildLog)) {
    const lines = fs.readFileSync(buildLog, 'utf8').split('\n')
    routeTable = lines.filter((l) => /^\s*[○ƒ]/.test(l) || /First Load JS shared/.test(l))
  }

  const asyncChunks = chunkSizes.filter((c) => /^\d+-/.test(c.file) || c.file.includes('.dynamic'))

  return {
    label,
    totalChunks,
    chunkCount: chunkSizes.length,
    asyncChunkCount: asyncChunks.length,
    asyncChunkBytes: asyncChunks.reduce((s, c) => s + c.bytes, 0),
    top10: chunkSizes.slice(0, 10),
    pageFirstLoad,
    routeTable,
    appPageChunks,
  }
}

function printReport(baseline, lazy) {
  console.log('\n=== Morgendrot Messenger — Bundle-Vergleich (build:messenger) ===\n')
  console.log(`Baseline (eager):  ${baseline.label}`)
  console.log(`Lazy (Scope B):    ${lazy.label}`)
  console.log('')

  const rows = [
    ['Gesamt JS (alle Chunks)', baseline.totalChunks, lazy.totalChunks],
    ['Anzahl Chunks', baseline.chunkCount, lazy.chunkCount],
    ['Async/Dynamic Chunks (Anzahl)', baseline.asyncChunkCount, lazy.asyncChunkCount],
    ['Async/Dynamic Chunks (Größe)', baseline.asyncChunkBytes, lazy.asyncChunkBytes],
  ]

  if (baseline.pageFirstLoad != null && lazy.pageFirstLoad != null) {
    rows.push(['Manifest /-Route JS (Summe)', baseline.pageFirstLoad, lazy.pageFirstLoad])
  }

  console.log('Metrik'.padEnd(34) + 'Baseline'.padStart(12) + 'Lazy'.padStart(12) + 'Δ'.padStart(12))
  console.log('-'.repeat(70))
  for (const [name, b, l] of rows) {
    const delta = l - b
    const sign = delta > 0 ? '+' : ''
    console.log(
      name.padEnd(34) +
        fmtKb(b).padStart(12) +
        fmtKb(l).padStart(12) +
        `${sign}${fmtKb(delta)}`.padStart(12)
    )
  }

  const saved = baseline.totalChunks - lazy.totalChunks
  const pct = baseline.totalChunks ? ((saved / baseline.totalChunks) * 100).toFixed(1) : '0'
  console.log('')
  console.log(
    saved > 0
      ? `→ Initial-Bundle gesamt: ${fmtKb(saved)} weniger (${pct} %), ${lazy.asyncChunkCount - baseline.asyncChunkCount} zusätzliche Lazy-Chunks`
      : saved < 0
        ? `→ Gesamt-Chunk-Volumen +${fmtKb(-saved)} (Lazy-Chunks separat: +${fmtKb(lazy.asyncChunkBytes - baseline.asyncChunkBytes)})`
        : '→ Keine Gesamt-Differenz; prüfe Async-Chunks unten'
  )

  if (baseline.routeTable.length || lazy.routeTable.length) {
    console.log('\n--- Next.js Route-Tabelle (Baseline) ---')
    baseline.routeTable.forEach((l) => console.log(l))
    if (lazy.routeTable.length) {
      console.log('\n--- Next.js Route-Tabelle (Lazy) ---')
      lazy.routeTable.forEach((l) => console.log(l))
    }
  }

  console.log('\n--- Top-10 Chunks Baseline ---')
  baseline.top10.forEach((c, i) => console.log(`${String(i + 1).padStart(2)}. ${fmtKb(c.bytes).padStart(10)}  ${c.file}`))

  console.log('\n--- Top-10 Chunks Lazy ---')
  lazy.top10.forEach((c, i) => console.log(`${String(i + 1).padStart(2)}. ${fmtKb(c.bytes).padStart(10)}  ${c.file}`))

  const lazyOnly = lazy.top10.filter((lc) => !baseline.top10.some((bc) => bc.file === lc.file))
  if (lazyOnly.length) {
    console.log('\n--- Neue/größere Lazy-only Top-Chunks ---')
    lazyOnly.forEach((c) => console.log(`  ${fmtKb(c.bytes).padStart(10)}  ${c.file}`))
  }
}

const baselineDir = process.argv[2]
const lazyDir = process.argv[3]
if (!baselineDir || !lazyDir) {
  console.error('Usage: node scripts/compare-messenger-bundle-size.mjs <baseline-frontend> <lazy-frontend>')
  process.exit(1)
}

printReport(analyzeFrontend(path.resolve(baselineDir), baselineDir), analyzeFrontend(path.resolve(lazyDir), lazyDir))
