import { describe, expect, it } from 'vitest'
import { wordAt, wordEndAfter, wordStartBefore } from './editing'

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
