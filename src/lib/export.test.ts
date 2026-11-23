import { describe, expect, it } from 'vitest'
import { exportText, importText } from './export'
import { layout } from './layout'

const opts = { cellsPerLine: 10, linesPerPage: 3, pageBreaks: true, tabWidth: 4 }
const doc = '⠠⠁⠁⠁ ⠃⠃⠃⠃ ⠉⠉⠉\n⠙\f\t⠼⠁⠃'
const formats = ['unicode', 'ascii'] as const

describe('importText', () => {
  it('pastes back text copied without layout exactly', () => {
    for (const format of formats) {
      expect(importText(exportText(doc, layout(doc, opts), format, false))).toEqual({ doc, format, skipped: 0 })
    }
  })

  it('pastes back text copied with layout so it looks the same', () => {
    const shown = exportText(doc, layout(doc, opts), 'unicode', true)
    for (const format of formats) {
      const pasted = importText(exportText(doc, layout(doc, opts), format, true)).doc
      expect(exportText(pasted, layout(pasted, opts), 'unicode', true)).toBe(shown)
    }
  })

  it('reads lowercase Braille ASCII and NABCC', () => {
    expect(importText('hello `{|}~').doc).toBe('⠓⠑⠇⠇⠕ ⠈⠪⠳⠻⠘')
  })

  it('reads Windows line breaks and blank cells', () => {
    expect(importText('⠁⠀⠃\r\n⠉').doc).toBe('⠁ ⠃\n⠉')
  })

  it('skips characters that are not braille', () => {
    expect(importText('Page 1: ⠁⠃ ✓')).toEqual({ doc: '  ⠁⠃ ', format: 'unicode', skipped: 7 })
    expect(importText('ab✓').skipped).toBe(1)
  })
})
