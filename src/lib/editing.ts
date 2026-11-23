import { isCellChar } from './braille'

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
