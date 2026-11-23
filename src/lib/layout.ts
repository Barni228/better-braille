import { isCellChar } from './braille'

export interface LayoutOptions {
  cellsPerLine: number
  linesPerPage: number
  pageBreaks: boolean
  tabWidth: number
}

export type ItemKind = 'cell' | 'space' | 'tab' | 'newline' | 'pagebreak'

/** One character of the document, placed on the page. */
export interface Item {
  index: number
  kind: ItemKind
  char: string
  col: number
  /** Width in cells. Zero for line ends, and for spaces that hang past the right margin. */
  width: number
}

export interface Line {
  items: Item[]
  /** Caret position at the start of the line. */
  start: number
  /** Caret position at the visual end of the line (used by End, clicks and up/down). */
  end: number
}

export interface Page {
  number: number
  lines: Line[]
}

const toInt = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback

/**
 * Lays the document out on braille pages: words wrap at `cellsPerLine`, words longer than a
 * line are split, tabs jump to the next multiple of `tabWidth`, and a new page starts every
 * `linesPerPage` lines (if page breaks are on) or at a manual page break (\f).
 */
export function layout(doc: string, options: LayoutOptions): Page[] {
  const width = toInt(options.cellsPerLine, 1, 1000, 40)
  const height = options.pageBreaks ? toInt(options.linesPerPage, 1, 1000, 25) : Infinity
  const tab = toInt(options.tabWidth, 1, 100, 2)

  const pages: Page[] = [{ number: 1, lines: [] }]
  let line: Line = { items: [], start: 0, end: 0 }
  let col = 0
  let forceNewPage = false

  const finishLine = (nextStart: number) => {
    let page = pages[pages.length - 1]
    if (forceNewPage || page.lines.length >= height) {
      page = { number: pages.length + 1, lines: [] }
      pages.push(page)
      forceNewPage = false
    }
    page.lines.push(line)
    line = { items: [], start: nextStart, end: nextStart }
    col = 0
  }

  const softWrap = (nextStart: number) => {
    line.end = line.items[line.items.length - 1].index
    finishLine(nextStart)
  }

  const place = (index: number, kind: ItemKind, itemWidth: number) => {
    line.items.push({ index, kind, char: doc[index], col, width: itemWidth })
    col += itemWidth
  }

  for (let i = 0; i < doc.length; i++) {
    const ch = doc[i]
    if (ch === '\n' || ch === '\f') {
      place(i, ch === '\n' ? 'newline' : 'pagebreak', 0)
      line.end = i
      finishLine(i + 1)
      if (ch === '\f') forceNewPage = true
    } else if (ch === '\t') {
      place(i, 'tab', Math.max(0, Math.min(tab - (col % tab), width - col)))
    } else if (!isCellChar(ch)) {
      place(i, 'space', col < width ? 1 : 0)
    } else {
      // At the start of a word, move the whole word down if it doesn't fit on this line.
      if (i === 0 || !isCellChar(doc[i - 1])) {
        let end = i
        while (end < doc.length && isCellChar(doc[end])) end++
        if (col > 0 && col + (end - i) > width) softWrap(i)
      }
      if (col >= width) softWrap(i)
      place(i, 'cell', 1)
    }
  }
  line.end = doc.length
  finishLine(doc.length)
  return pages
}

/** Line (index into the flat list of lines) and column of a caret position. */
export function locate(lines: Line[], pos: number): { line: number; col: number } {
  let lo = 0
  let hi = lines.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (lines[mid].start <= pos) lo = mid
    else hi = mid - 1
  }
  const items = lines[lo].items
  for (const item of items) if (item.index === pos) return { line: lo, col: item.col }
  const last = items[items.length - 1]
  return { line: lo, col: last ? last.col + last.width : 0 }
}

/** Caret position on `line` closest to column `col`. */
export function positionAtCol(line: Line, col: number): number {
  for (const item of line.items) {
    if (item.kind === 'newline' || item.kind === 'pagebreak') break
    if (item.col + item.width / 2 > col) return item.index
  }
  return line.end
}
