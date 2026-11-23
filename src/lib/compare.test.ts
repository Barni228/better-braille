import { describe, expect, it } from 'vitest'
import { describeMistake, findMistakes, mistakeNear } from './compare'
import { guessPunctuation, toParagraphs } from './text'

describe('findMistakes', () => {
  const expected = '⠠⠮ ⠟⠅ ⠃⠗⠪⠝ ⠋⠕⠭'

  it('finds nothing wrong in a correct partial transcription', () => {
    const m = findMistakes('⠠⠮ ⠟⠅ ⠃⠗', expected)
    expect(m.runs).toEqual([])
    expect(m.remaining).toBe(2 + 3) // rest of ⠃⠗⠪⠝, then ⠋⠕⠭
  })

  it('ignores how words are split into lines and pages', () => {
    expect(findMistakes('⠠⠮\n⠟⠅\f\t⠃⠗⠪⠝   ⠋⠕⠭', expected).runs).toEqual([])
  })

  it('marks a wrong cell with what it should be', () => {
    const m = findMistakes('⠠⠮ ⠟⠅ ⠃⠗⠕⠝ ⠋⠕⠭', expected)
    expect([...m.wrong]).toEqual([[8, '⠪']])
    expect(m.runs).toEqual([{ start: 8, end: 9 }])
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

  it('describes each mistake and finds the one at the cursor', () => {
    const typed = '⠠⠮ ⠟⠅ ⠃⠗⠕⠝ ⠋⠭'
    const m = findMistakes(typed, expected)
    expect(m.runs).toEqual([{ start: 8, end: 9 }, { start: 12, end: 13 }])
    expect(describeMistake(m, typed, m.runs[0])).toEqual({ typed: '⠕', expected: '⠪' })
    expect(describeMistake(m, typed, m.runs[1])).toEqual({ typed: '', expected: '⠕' })
    expect(mistakeNear(m, 9)).toEqual(m.runs[0]) // caret right after the wrong cell
    expect(mistakeNear(m, 5)).toBeUndefined()
  })

  it('does not flag the word being typed as missing cells', () => {
    const m = findMistakes('⠠⠮ ⠟⠅ ⠃', expected)
    expect(m.runs).toEqual([])
  })
})

describe('toParagraphs', () => {
  it('joins lines, splits paragraphs and rejoins hyphenated words', () => {
    const ocr = 'The quick brown fox jum-\nped over\nthe dog.\n\n  Second   paragraph.\n'
    expect(toParagraphs(ocr, true)).toEqual(['The quick brown fox jumped over the dog.', 'Second paragraph.'])
    expect(toParagraphs(ocr, false)[0]).toBe('The quick brown fox jum- ped over the dog.')
  })
})

describe('guessPunctuation', () => {
  const curly = (t: string) => guessPunctuation(t, 'curly')

  it('turns OCR dashes into dashes and hyphens', () => {
    expect(curly('wait - what')).toBe('wait – what')
    expect(curly('wait--what -- now')).toBe('wait—what — now')
    expect(curly('a well–known fact')).toBe('a well-known fact')
    expect(curly('well-known, 1990-95, New York–London')).toBe('well-known, 1990-95, New York–London')
  })

  it('tells single quotes from apostrophes', () => {
    expect(curly("She said 'hi' and left.")).toBe('She said ‘hi’ and left.')
    expect(curly('"I said \'no.\'"')).toBe('"I said ‘no.’"')
    expect(curly("it's the dogs' bone, don’t")).toBe("it's the dogs' bone, don't")
    expect(curly("'tis the '90s, rock 'n' roll")).toBe("'tis the '90s, rock 'n' roll")
    expect(curly("'Hello' and 'bye'")).toBe('‘Hello’ and ‘bye’')
    expect(curly("an 'unclosed quote")).toBe("an 'unclosed quote")
  })

  it('uses straight quotes for codes whose table guesses them itself', () => {
    expect(guessPunctuation('‘hi’ it’s - ok', 'straight')).toBe("'hi' it's – ok")
  })
})
