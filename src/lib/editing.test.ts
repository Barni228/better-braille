import { describe, expect, it } from 'vitest'
import { type Caret, type KeyPress, caretForKey, wordAt, wordEndAfter, wordStartBefore } from './editing'
import { layout } from './layout'

//           0 1 2 3 4 5 6 7 8 9 10
const doc = '⠁⠃ ⠉⠙  ⠑\n⠋⠛'

describe('word moves', () => {
  it('goes back over spaces and then one word', () => {
    expect(wordStartBefore(doc, 5)).toBe(3) // end of ⠉⠙ → its start
    expect(wordStartBefore(doc, 7)).toBe(3) // spaces, then ⠉⠙
    expect(wordStartBefore(doc, 3)).toBe(0)
    expect(wordStartBefore(doc, 0)).toBe(0)
  })

  it('stops at line breaks', () => {
    expect(wordStartBefore(doc, 9)).toBe(8) // just the line break
    expect(wordEndAfter(doc, 8)).toBe(9)
  })

  it('goes forward over spaces and then one word', () => {
    expect(wordEndAfter(doc, 0)).toBe(2)
    expect(wordEndAfter(doc, 2)).toBe(5)
    expect(wordEndAfter(doc, 5)).toBe(8)
    expect(wordEndAfter(doc, 11)).toBe(11)
  })

  it('finds the word around a cell', () => {
    expect(wordAt(doc, 4)).toEqual([3, 5])
    expect(wordAt(doc, 5)).toEqual([5, 6]) // a space selects itself
  })
})

describe('caret keys', () => {
  //            0 1 2 3 4 5 6 7
  const text = '⠁⠃⠉ ⠙⠑\n⠋'
  const lines = layout(text, { cellsPerLine: 10, linesPerPage: 25, pageBreaks: false, tabWidth: 2 }).flatMap((p) => p.lines)
  const at = (cursor: number, anchor = cursor, goalCol: number | null = null): Caret => ({ cursor, anchor, goalCol })
  const press = (key: string, mods: Partial<KeyPress> = {}): KeyPress => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  })
  const move = (key: KeyPress, caret: Caret) => caretForKey(key, text, lines, caret)

  it('moves one cell, and selects with Shift', () => {
    expect(move(press('ArrowRight'), at(1))).toEqual(at(2))
    expect(move(press('ArrowRight', { shiftKey: true }), at(1))).toEqual(at(2, 1))
    expect(move(press('ArrowLeft'), at(0))).toEqual(at(0))
  })

  it('collapses a selection to the side the arrow points to', () => {
    expect(move(press('ArrowLeft'), at(4, 1))).toEqual(at(1))
    expect(move(press('ArrowRight'), at(1, 4))).toEqual(at(4))
  })

  it('keeps its column going up and down past a short line', () => {
    const down = move(press('ArrowDown'), at(5))!
    expect(down).toEqual(at(8, 8, 5))
    expect(move(press('ArrowUp'), down)).toEqual(at(5, 5, 5))
  })

  it('goes to the ends of the line, or of the document with Ctrl', () => {
    expect(move(press('Home'), at(4))).toEqual(at(0))
    expect(move(press('End'), at(4))).toEqual(at(6))
    expect(move(press('End', { ctrlKey: true, shiftKey: true }), at(4))).toEqual(at(8, 4))
  })

  it('moves by word with Ctrl', () => {
    expect(move(press('ArrowRight', { ctrlKey: true }), at(0))).toEqual(at(3))
    expect(move(press('ArrowLeft', { ctrlKey: true }), at(6))).toEqual(at(4))
  })

  it('ignores other keys', () => {
    expect(move(press('a'), at(0))).toBeNull()
  })
})
