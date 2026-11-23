import { describe, expect, it } from 'vitest'
import { exportText } from './export'
import { layout, locate, positionAtCol, type Page } from './layout'

const opts = { cellsPerLine: 10, linesPerPage: 3, pageBreaks: true, tabWidth: 4 }
const text = (pages: Page[]) =>
  pages.map((p) => p.lines.map((l) => l.items.map((i) => (i.kind === 'cell' ? i.char : i.kind === 'space' ? '_' : '')).join('')))

describe('layout', () => {
  it('wraps whole words at the line width', () => {
    const pages = layout('⠁⠁⠁⠁ ⠃⠃⠃⠃ ⠉⠉⠉', opts)
    expect(text(pages)).toEqual([['⠁⠁⠁⠁_⠃⠃⠃⠃_', '⠉⠉⠉']])
  })

  it('splits words longer than a line', () => {
    const pages = layout('⠁'.repeat(12), opts)
    expect(text(pages)[0].map((l) => l.length)).toEqual([10, 2])
  })

  it('starts a new page after linesPerPage lines and at manual page breaks', () => {
    const pages = layout('⠁\n⠃\n⠉\n⠙\f⠑', opts)
    expect(pages.map((p) => p.lines.length)).toEqual([3, 1, 1])
    expect(layout('⠁\n⠃\n⠉\n⠙', { ...opts, pageBreaks: false })).toHaveLength(1)
  })

  it('expands tabs to the next tab stop', () => {
    const [page] = layout('⠁\t⠃', opts)
    const items = page.lines[0].items
    expect(items[1]).toMatchObject({ kind: 'tab', col: 1, width: 3 })
    expect(items[2]).toMatchObject({ kind: 'cell', col: 4 })
  })

  it('locates the caret and moves between lines', () => {
    const lines = layout('⠁⠁⠁\n⠃⠃⠃⠃⠃', opts).flatMap((p) => p.lines)
    expect(locate(lines, 2)).toEqual({ line: 0, col: 2 })
    expect(locate(lines, 3)).toEqual({ line: 0, col: 3 }) // before the newline
    expect(locate(lines, 9)).toEqual({ line: 1, col: 5 }) // end of document
    expect(positionAtCol(lines[1], 2)).toBe(6)
    expect(positionAtCol(lines[0], 8)).toBe(3)
  })
})

describe('exportText', () => {
  it('keeps the page layout with form feeds between pages', () => {
    const doc = '⠁⠁⠁⠁ ⠃⠃⠃⠃ ⠉⠉⠉\f\t⠙'
    const pages = layout(doc, opts)
    expect(exportText(doc, pages, 'ascii', true)).toBe('AAAA BBBB\nCCC\n\f    D\n')
    expect(exportText(doc, pages, 'unicode', true)).toBe('⠁⠁⠁⠁⠀⠃⠃⠃⠃\n⠉⠉⠉\n\f⠀⠀⠀⠀⠙\n')
    expect(exportText(doc, pages, 'ascii', false)).toBe('AAAA BBBB CCC\f\tD')
  })
})
