/**
 * Repo-Skeleton: Erstellt die Landkarte für die KI (welche Funktion wo liegt).
 * Ausgabe: ai-training/FILE_TREE.json – wird vom AI-Copilot als Kontext geladen (immer, da klein).
 * Aufruf: npm run build:file-tree
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'build', '.next']);

type FileEntry = { path: string; functions: string[] };

/** Move: public/entry fun name, fun name */
const MOVE_FUN_RE = /(?:public\s+)?(?:entry\s+)?fun\s+(\w+)/g;
/** TS: export function name, export async function name */
const TS_FUN_RE = /export\s+(?:async\s+)?function\s+(\w+)/g;

function extractMoveFunctions(content: string): string[] {
    const names = new Set<string>();
    let m: RegExpExecArray | null;
    MOVE_FUN_RE.lastIndex = 0;
    while ((m = MOVE_FUN_RE.exec(content)) !== null) names.add(m[1]);
    return [...names].sort();
}

function extractTsFunctions(content: string): string[] {
    const names = new Set<string>();
    let m: RegExpExecArray | null;
    TS_FUN_RE.lastIndex = 0;
    while ((m = TS_FUN_RE.exec(content)) !== null) names.add(m[1]);
    return [...names].sort();
}

function scanRepo(dir: string, filelist: FileEntry[] = []): FileEntry[] {
    let files: string[];
    try {
        files = readdirSync(dir);
    } catch {
        return filelist;
    }
    for (const file of files) {
        const filePath = join(dir, file);
        let stat;
        try {
            stat = statSync(filePath);
        } catch {
            continue;
        }
        if (stat.isDirectory()) {
            if (!SKIP_DIRS.has(file)) scanRepo(filePath, filelist);
            continue;
        }
        if (file.endsWith('.move')) {
            try {
                const content = readFileSync(filePath, 'utf8');
                filelist.push({ path: relative(ROOT, filePath).replace(/\\/g, '/'), functions: extractMoveFunctions(content) });
            } catch {
                // skip
            }
            continue;
        }
        if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
            try {
                const content = readFileSync(filePath, 'utf8');
                filelist.push({ path: relative(ROOT, filePath).replace(/\\/g, '/'), functions: extractTsFunctions(content) });
            } catch {
                // skip
            }
        }
    }
    return filelist;
}

const tree = scanRepo(ROOT);
const outDir = join(ROOT, 'ai-training');
const outPath = join(outDir, 'FILE_TREE.json');
try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, JSON.stringify(tree, null, 2), 'utf8');
    console.log('✅ FILE_TREE.json erstellt (Kontext-Landkarte bereit).');
} catch (e) {
    console.error('Fehler beim Schreiben:', e);
    process.exit(1);
}
