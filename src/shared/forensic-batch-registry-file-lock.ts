/**
 * § H.33e — Registry-Datei: serialisierte Ops + atomares Schreiben.
 */
import fs from 'node:fs'
import path from 'node:path'

let opChain: Promise<unknown> = Promise.resolve()

/** Serialisiert alle Registry-Datei-Operationen (verhindert RMW-Races). */
export function enqueueForensicBatchRegistryOp<T>(fn: () => T | Promise<T>): Promise<T> {
  const result = opChain.then(() => fn())
  opChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

/** Atomares Schreiben (tmp + rename). */
export function atomicWriteFileSync(targetPath: string, content: string): void {
  const dir = path.dirname(targetPath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, content, 'utf8')
  fs.renameSync(tmp, targetPath)
}
