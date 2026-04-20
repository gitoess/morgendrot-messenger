'use client'

import type { ReactNode } from 'react'

/**
 * Sehr kleiner Markdown-Renderer für Handbuch-.md (ohne extra Dependency).
 * Unterstützt: # / ## / ###, ---, **fett**, `code`, Absätze.
 *
 * ## / ### erhalten stabile `id` (für `href="#…"` aus der Messenger-UI).
 */
export function handbookHeadingIdFromPlainTitle(raw: string): string {
  const de = raw
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .replace(/ß/g, 'ss')
  return de
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function HandbookMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let i = 0
  let key = 0
  let inCode = false
  const codeBuf: string[] = []

  const flushCode = () => {
    if (codeBuf.length) {
      out.push(
        <pre
          key={key++}
          className="mb-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono text-muted-foreground"
        >
          {codeBuf.join('\n')}
        </pre>
      )
      codeBuf.length = 0
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      if (inCode) {
        inCode = false
        flushCode()
      } else {
        inCode = true
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      i++
      continue
    }

    if (line.startsWith('### ')) {
      const plain = line.slice(4).trim()
      const hid = handbookHeadingIdFromPlainTitle(plain)
      out.push(
        <h3
          key={key++}
          id={hid}
          className="mb-2 mt-4 scroll-mt-20 text-base font-semibold text-foreground"
        >
          {renderInline(plain)}
        </h3>
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      const plain = line.slice(3).trim()
      const hid = handbookHeadingIdFromPlainTitle(plain)
      out.push(
        <h2
          key={key++}
          id={hid}
          className="mb-2 mt-6 scroll-mt-20 text-lg font-semibold text-foreground"
        >
          {renderInline(plain)}
        </h2>
      )
      i++
      continue
    }
    if (line.startsWith('# ')) {
      const plain = line.slice(2).trim()
      const hid = handbookHeadingIdFromPlainTitle(plain)
      out.push(
        <h1 key={key++} id={hid} className="mb-3 mt-2 scroll-mt-20 text-xl font-bold text-foreground">
          {renderInline(plain)}
        </h1>
      )
      i++
      continue
    }
    if (line.trim() === '---') {
      out.push(<hr key={key++} className="my-6 border-border" />)
      i++
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }

    out.push(
      <p key={key++} className="mb-3 text-muted-foreground [&_strong]:text-foreground">
        {renderInline(line)}
      </p>
    )
    i++
  }
  if (inCode && codeBuf.length) flushCode()

  return <div className="handbook-md">{out}</div>
}

function renderInline(s: string): ReactNode {
  const segments = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return segments.map((seg, idx) => {
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {seg.slice(2, -2)}
        </strong>
      )
    }
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
        >
          {seg.slice(1, -1)}
        </code>
      )
    }
    return seg
  })
}
