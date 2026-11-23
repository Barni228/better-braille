import { describe, expect, it } from 'vitest'
import { findMistakes } from './compare'
import { toParagraphs } from './text'

describe('findMistakes', () => {
  const expected = '⠠⠮ ⠟⠅ ⠃⠗⠪⠝ ⠋⠕⠭'

  it('finds nothing wrong in a correct partial transcription', () => {
    const m = findMistakes('⠠⠮ ⠟⠅ ⠃⠗', expected)
    expect(m.spots).toEqual([])
    expect(m.remaining).toBe(2 + 3) // rest of ⠃⠗⠪⠝, then ⠋⠕⠭
  })

  it('ignores how words are split into lines and pages', () => {
    expect(findMistakes('⠠⠮\n⠟⠅\f\t⠃⠗⠪⠝   ⠋⠕⠭', expected).spots).toEqual([])
  })

  it('marks a wrong cell with what it should be', () => {
    const m = findMistakes('⠠⠮ ⠟⠅ ⠃⠗⠕⠝ ⠋⠕⠭', expected)
    expect([...m.wrong]).toEqual([[8, '⠪']])
    expect(m.spots).toEqual([8])
  })

  it('marks missing cells and missing words', () => {
    const m = findMistakes('⠠⠮ ⠟⠅ ⠃⠗⠝ ⠋⠕⠭', expected)
    expect([...m.missing]).toEqual([[8, '⠪']])
    const words = findMistakes('⠠⠮ ⠃⠗⠪⠝ ⠋⠕⠭', expected)
    expect([...words.missing]).toEqual([[3, '⠟⠅']])
  })

  it('marks extra cells and extra words', () => {
    const m = findMistakes('⠠⠮ ⠟⠅⠅ ⠃⠗⠪⠝ ⠋⠕⠭', expected)
    expect([...m.wrong]).toEqual([[5, '']])
    const words = findMistakes('⠠⠮ ⠮ ⠟⠅ ⠃⠗⠪⠝ ⠋⠕⠭', expected)
    expect([...words.wrong]).toEqual([[3, '']])
  })

  it('does not flag the word being typed as missing cells', () => {
    const m = findMistakes('⠠⠮ ⠟⠅ ⠃', expected)
    expect(m.spots).toEqual([])
  })
})

describe('toParagraphs', () => {
  it('joins lines, splits paragraphs and rejoins hyphenated words', () => {
    const ocr = 'The quick brown fox jum-\nped over\nthe dog.\n\n  Second   paragraph.\n'
    expect(toParagraphs(ocr, true)).toEqual(['The quick brown fox jumped over the dog.', 'Second paragraph.'])
    expect(toParagraphs(ocr, false)[0]).toBe('The quick brown fox jum- ped over the dog.')
  })
})
