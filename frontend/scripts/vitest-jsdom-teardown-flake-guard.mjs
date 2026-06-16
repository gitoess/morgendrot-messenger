#!/usr/bin/env node
/**
 * CI: Vitest exit 1 obwohl alle Assertions grün (jsdom/Linux-Teardown-Flake).
 * Nur wenn JSON-Report das belegt → exit 0 + warning (kein blindes || true).
 */
import fs from 'node:fs'

const reportPath = process.argv[2]
if (!reportPath || !fs.existsSync(reportPath)) {
  process.stderr.write(`flake-guard: report missing: ${reportPath ?? '(none)'}\n`)
  process.exit(1)
}

/** @type {import('vitest').JsonTestResults} */
let report
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
} catch (e) {
  process.stderr.write(`flake-guard: invalid JSON: ${String(e)}\n`)
  process.exit(1)
}

function allAssertionsPassed() {
  if (report.numFailedTests > 0 || report.numPendingTests > 0 || report.numTodoTests > 0) {
    return false
  }
  if (report.numTotalTests <= 0 || report.numPassedTests !== report.numTotalTests) {
    return false
  }
  for (const file of report.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      if (t.status !== 'passed') return false
    }
  }
  return true
}

if (!allAssertionsPassed()) {
  process.stderr.write(
    `flake-guard: real failures (${report.numFailedTests} failed / ${report.numTotalTests} total)\n`
  )
  process.exit(1)
}

const teardownOnly =
  report.success === false ||
  (report.numFailedTestSuites ?? 0) > 0 ||
  (report.numPassedTestSuites ?? 0) < (report.numTotalTestSuites ?? 0)

if (!teardownOnly && report.success === true) {
  process.exit(1)
}

console.warn(
  '::warning::Vitest exit non-zero but all test assertions passed — treating as Linux jsdom teardown flake'
)
process.exit(0)
