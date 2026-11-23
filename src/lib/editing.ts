import { isCellChar } from './braille'
import { type Line, locate, positionAtCol } from './layout'

// A "word" is a run of braille cells. Spaces and tabs separate words; line and page breaks
// are steps of their own, so word moves and deletes stop at them.

const isBreak = (ch: string | undefined) => ch === '\n' || ch === '\f'
const isGap = (ch: string | undefined) => ch !== undefined && !isBreak(ch) && !isCellChar(ch)

/** Where Ctrl+Backspace / Ctrl+Left goes: the start of the word before `pos`. */
export function wordStartBefore(doc: string, pos: number): number {
  if (pos > 0 && isBreak(doc[pos - 1])) return pos - 1
  let i = pos
  while (i > 0 && isGap(doc[i - 1])) i--
  while (i > 0 && isCellChar(doc[i - 1])) i--
  return i
}

/** Where Ctrl+Delete / Ctrl+Right goes: the end of the word after `pos`. */
export function wordEndAfter(doc: string, pos: number): number {
  if (pos < doc.length && isBreak(doc[pos])) return pos + 1
  let i = pos
  while (i < doc.length && isGap(doc[i])) i++
  while (i < doc.length && isCellChar(doc[i])) i++
  return i
}

/** The word around character `index`, as [start, end), for double-click. A blank selects itself. */
export function wordAt(doc: string, index: number): [number, number] {
  if (!isCellChar(doc[index] ?? '')) return [index, Math.min(index + 1, doc.length)]
  let start = index
  let end = index
  while (start > 0 && isCellChar(doc[start - 1])) start--
  while (end < doc.length && isCellChar(doc[end])) end++
  return [start, end]
}

/** Where the caret is, and what is selected. */
export interface Caret {
  cursor: number
  /** The other end of the selection; equal to `cursor` when nothing is selected. */
  anchor: number
  /** The column Up and Down aim for, so the caret doesn't drift left past short lines. */
  goalCol: number | null
}

/** The parts of a KeyboardEvent that caret moves look at. */
export interface KeyPress {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** The caret moved to `pos` in a text of `length` characters. With `extend`, the selection
 *  grows or shrinks instead of being dropped. */
export function placeCaret(caret: Caret, pos: number, length: number, extend = false, goalCol: number | null = null): Caret {
  const cursor = Math.max(0, Math.min(length, pos))
  return { cursor, anchor: extend ? caret.anchor : cursor, goalCol }
}

/**
 * Where an arrow key, Home or End takes the caret in `doc` (laid out as `lines`), or null for
 * any other key. Shift selects, Ctrl (Option on a Mac) moves by word, and on a Mac Cmd goes to
 * the start or end of the line or document.
 */
export function caretForKey(e: KeyPress, doc: string, lines: Line[], caret: Caret): Caret | null {
  const { cursor, anchor } = caret
  const primary = e.ctrlKey || e.metaKey // Ctrl, or Cmd on a Mac
  const byWord = e.ctrlKey || e.altKey // Ctrl, or Option on a Mac
  const to = (pos: number, goalCol: number | null = null) => placeCaret(caret, pos, doc.length, e.shiftKey, goalCol)
  const here = locate(lines, cursor)
  const line = lines[here.line]

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      const left = e.key === 'ArrowLeft'
      if (e.metaKey) return to(left ? line.start : line.end)
      if (byWord) return to(left ? wordStartBefore(doc, cursor) : wordEndAfter(doc, cursor))
      // Without Shift, a selection collapses to the side the arrow points to.
      if (cursor !== anchor && !e.shiftKey) return to(left ? Math.min(cursor, anchor) : Math.max(cursor, anchor))
      return to(cursor + (left ? -1 : 1))
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      const up = e.key === 'ArrowUp'
      if (e.metaKey) return to(up ? 0 : doc.length)
      const goalCol = caret.goalCol ?? here.col
      const target = here.line + (up ? -1 : 1)
      if (target < 0) return to(0, goalCol)
      if (target >= lines.length) return to(doc.length, goalCol)
      return to(positionAtCol(lines[target], goalCol), goalCol)
    }
    case 'Home':
      return to(primary ? 0 : line.start)
    case 'End':
      return to(primary ? doc.length : line.end)
    default:
      return null
  }
}
