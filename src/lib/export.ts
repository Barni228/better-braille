import { BLANK_CELL, brailleAsciiDots, cellChar, cellDots, toBrailleAscii } from './braille'
import type { Page } from './layout'

export type ExportFormat = 'unicode' | 'ascii'

/**
 * Text for copying or saving. With `keepLayout`, lines are broken exactly as shown, tabs
 * become blank cells and pages are separated by a form feed (like a .brf file). Without it,
 * the text is exported as typed.
 */
export function exportText(doc: string, pages: Page[], format: ExportFormat, keepLayout: boolean): string {
  const text = keepLayout ? pagesToText(pages, format === 'unicode' ? BLANK_CELL : ' ') : doc
  return format === 'ascii' ? toBrailleAscii(text) : text
}

function pagesToText(pages: Page[], blank: string): string {
  return pages
    .map((page) =>
      page.lines
        .map((line) => {
          let s = ''
          for (const item of line.items) {
            if (item.kind === 'cell') s += item.char
            else if (item.kind === 'space' || item.kind === 'tab') s += blank.repeat(item.width)
          }
          return s.replace(/[ \u2800]+$/, '') + '\n'
        })
        .join(''),
    )
    .join('\f')
}

/**
 * Turns pasted text (for example something copied from this app earlier) back into a
 * document. Text containing Unicode braille is read as that; anything else is read as
 * Braille ASCII. Characters that are neither are skipped and counted.
 */
export function importText(text: string): { doc: string; format: ExportFormat; skipped: number } {
  const t = text.replace(/\r\n?/g, '\n').replace(/\u2800/g, ' ')
  const format: ExportFormat = /[\u2801-\u28ff]/.test(t) ? 'unicode' : 'ascii'
  let doc = ''
  let skipped = 0
  for (const ch of t) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\f') {
      doc += ch
      continue
    }
    // Only 6-dot braille: dots 7 and 8 are dropped.
    const dots = format === 'unicode' ? cellDots(ch) : (brailleAsciiDots(ch) ?? -1)
    if (dots < 0) skipped++
    else doc += dots & 0x3f ? cellChar(dots & 0x3f) : ' '
  }
  // Text copied with its layout has a line break before each page break and one at the end;
  // drop those so it lays out exactly as it was copied.
  doc = doc.replace(/\n\f/g, '\f').replace(/\n$/, '')
  return { doc, format, skipped }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // The async clipboard API needs a secure context; fall back for http:// and file://.
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
