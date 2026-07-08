#!/usr/bin/env node
/**
 * Packt Hobby-Release-Artefakte: PC-Standalone-ZIP + optional APK + SHA256SUMS.txt
 * Voraussetzung: npm run bundle:messenger:standalone (bzw. --skip-bundle)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO, 'dist', 'hobby-release');
const STANDALONE_DIR = path.join(REPO, 'exports', 'Morgendrot-Messenger-standalone');
const PC_ZIP = 'morgendrot-messenger-pc-standalone.zip';
const APK_NAME = 'morgendrot-messenger-android-debug.apk';
const APK_CANDIDATES = [
  path.join(REPO, 'frontend', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function zipDir(sourceDir, destZip) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destZip);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function sha256(filePath) {
  const hash = createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
  return `${hash}  ${path.basename(filePath)}`;
}

const LEGAL_FILES = ['LICENSE', 'DISCLAIMER.md', 'COMMERCIAL-LICENSING.md'];

async function main() {
  const skipBundle = process.argv.includes('--skip-bundle');
  const apkOnly = process.argv.includes('--apk-only');
  const pcOnly = process.argv.includes('--pc-only');
  const requireApk = process.argv.includes('--require-apk');

  if (!skipBundle && !apkOnly) {
    console.log('→ bundle:messenger:standalone');
    execSync('npm run bundle:messenger:standalone', { cwd: REPO, stdio: 'inherit' });
  }

  if (!fs.existsSync(STANDALONE_DIR) && !apkOnly) {
    throw new Error('Standalone-Bundle fehlt: ' + STANDALONE_DIR);
  }

  rmrf(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const artifacts = [];

  if (!apkOnly) {
    const pcZipPath = path.join(OUT_DIR, PC_ZIP);
    console.log('→ ZIP', pcZipPath);
    await zipDir(STANDALONE_DIR, pcZipPath);
    artifacts.push(pcZipPath);
  }

  if (!pcOnly) {
    const apkSrc = APK_CANDIDATES.find((p) => fs.existsSync(p));
    if (!apkSrc) {
      const msg = 'APK nicht gefunden: ' + APK_CANDIDATES[0];
      if (requireApk) throw new Error(msg);
      console.warn('Warnung:', msg, '— nur PC-ZIP wird gepackt.');
    } else {
      const apkDest = path.join(OUT_DIR, APK_NAME);
      fs.copyFileSync(apkSrc, apkDest);
      console.log('→ APK', apkDest);
      artifacts.push(apkDest);
    }
  }

  if (artifacts.length === 0) {
    throw new Error('Keine Artefakte erzeugt.');
  }

  for (const name of LEGAL_FILES) {
    const src = path.join(REPO, name);
    if (!fs.existsSync(src)) {
      throw new Error('Pflichtdatei fehlt: ' + name);
    }
    const dest = path.join(OUT_DIR, name);
    fs.copyFileSync(src, dest);
    artifacts.push(dest);
    console.log('→', dest);
  }

  const sumsPath = path.join(OUT_DIR, 'SHA256SUMS.txt');
  const releaseArtifacts = artifacts.filter((f) => path.basename(f) !== 'SHA256SUMS.txt');
  const lines = releaseArtifacts.map((f) => sha256(f));
  fs.writeFileSync(sumsPath, lines.join('\n') + '\n', 'utf8');
  console.log('→', sumsPath);
  console.log('Fertig:', OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
