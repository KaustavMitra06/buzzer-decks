import { describe, expect, it } from 'vitest'
import {
  findFlagged,
  isTrustedAuthor,
  moderate,
  parseWordlist,
} from './checkContent.js'

describe('parseWordlist', () => {
  it('strips comments + blank lines + trims + lowercases', () => {
    const raw = '# header\nFuck\n\nshit  \n# another comment\nBUY NOW\n'
    expect(parseWordlist(raw)).toEqual(['fuck', 'shit', 'buy now'])
  })

  it('handles CRLF line endings from Windows editors', () => {
    expect(parseWordlist('foo\r\nbar\r\n')).toEqual(['foo', 'bar'])
  })

  it('is safe on empty / null input', () => {
    expect(parseWordlist('')).toEqual([])
    expect(parseWordlist(null)).toEqual([])
  })
})

describe('findFlagged', () => {
  const list = ['fuck', 'shit', 'buy now']

  it('flags whole-word matches case-insensitively', () => {
    expect(findFlagged('what the FUCK is this', list)).toEqual(['fuck'])
  })

  it('does NOT flag substrings of longer words', () => {
    // "class" isn't a flag word; "classic" shouldn't trip anything.
    // Use a proxy: "hit" is a substring of "shit" — make sure it doesn't fire.
    expect(findFlagged('a fine hit song', list)).toEqual([])
  })

  it('does flag multi-word phrases as substrings', () => {
    expect(findFlagged('you should buy now — limited time!', list)).toEqual(['buy now'])
  })

  it('returns [] on empty text', () => {
    expect(findFlagged('', list)).toEqual([])
    expect(findFlagged(null, list)).toEqual([])
  })

  it('returns every match when multiple hit', () => {
    const matches = findFlagged('shit fuck damn', ['fuck', 'shit', 'damn'])
    expect(matches.sort()).toEqual(['damn', 'fuck', 'shit'])
  })

  it('is regex-safe against special characters in the wordlist', () => {
    // A pathological wordlist entry with regex metacharacters shouldn't blow up.
    expect(findFlagged('reg.exp', ['reg.exp'])).toEqual(['reg.exp'])
    expect(findFlagged('regular', ['reg.exp'])).toEqual([])
  })
})

describe('isTrustedAuthor', () => {
  it('is true for OWNER / MEMBER / COLLABORATOR', () => {
    expect(isTrustedAuthor('OWNER')).toBe(true)
    expect(isTrustedAuthor('MEMBER')).toBe(true)
    expect(isTrustedAuthor('COLLABORATOR')).toBe(true)
  })
  it('is case-insensitive', () => {
    expect(isTrustedAuthor('collaborator')).toBe(true)
  })
  it('is false for outside contributors', () => {
    expect(isTrustedAuthor('NONE')).toBe(false)
    expect(isTrustedAuthor('CONTRIBUTOR')).toBe(false)
    expect(isTrustedAuthor('FIRST_TIMER')).toBe(false)
    expect(isTrustedAuthor('')).toBe(false)
    expect(isTrustedAuthor(null)).toBe(false)
  })
})

describe('moderate', () => {
  const wordlist = ['fuck', 'buy now']

  it('flags text from a non-trusted author', () => {
    const decision = moderate({
      text: 'what the fuck?',
      wordlist,
      authorAssociation: 'NONE',
    })
    expect(decision.flagged).toBe(true)
    expect(decision.matches).toEqual(['fuck'])
    expect(decision.skipped).toBeUndefined()
  })

  it('exempts trusted authors regardless of content', () => {
    const decision = moderate({
      text: 'what the fuck?',
      wordlist,
      authorAssociation: 'COLLABORATOR',
    })
    expect(decision.flagged).toBe(false)
    expect(decision.matches).toEqual([])
    expect(decision.skipped).toBe('trusted')
  })

  it('returns no flags on clean text', () => {
    const decision = moderate({
      text: 'this is a great deck',
      wordlist,
      authorAssociation: 'NONE',
    })
    expect(decision.flagged).toBe(false)
    expect(decision.matches).toEqual([])
  })
})
