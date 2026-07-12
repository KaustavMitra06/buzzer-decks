import { describe, expect, it } from 'vitest'
import {
  extractCsvFromSubmission,
  extractDeckName,
  extractFormFields,
  stripFencedCode,
  validateCsv,
  validateSubmissionIssue,
} from './validateSubmission.js'

// Structured Issue-form bodies render as markdown with each field under a
// `### <label>` heading. Emulate one for the tests.
function issueBody({ name = 'BIO 101', csv = 'term,definition\nfoo,bar' } = {}) {
  return `### Deck name

${name}

### School

UMich

### Subject

Biology

### Cards (CSV)

\`\`\`csv
${csv}
\`\`\`

### Source / attribution

_No response_
`
}

describe('extractFormFields', () => {
  it('parses labeled sections into { label: value }', () => {
    const body = '### Deck name\n\nBIO 101\n\n### Subject\n\nBiology\n'
    expect(extractFormFields(body)).toEqual({
      'Deck name': 'BIO 101',
      Subject: 'Biology',
    })
  })

  it('drops "_No response_" placeholders', () => {
    const body = '### Deck name\n\nBIO 101\n\n### Professor\n\n_No response_\n'
    expect(extractFormFields(body).Professor).toBe('')
  })

  it('handles empty / null input safely', () => {
    expect(extractFormFields('')).toEqual({})
    expect(extractFormFields(null)).toEqual({})
  })
})

describe('stripFencedCode', () => {
  it('extracts the body from a ```csv ... ``` fence', () => {
    const s = '```csv\nterm,definition\nfoo,bar\n```'
    expect(stripFencedCode(s)).toBe('term,definition\nfoo,bar')
  })

  it('passes plain text through unchanged', () => {
    expect(stripFencedCode('hello world')).toBe('hello world')
  })

  it('handles an unlabeled fence', () => {
    expect(stripFencedCode('```\nfoo\n```')).toBe('foo')
  })
})

describe('extractCsvFromSubmission / extractDeckName', () => {
  it('pulls the deck name and CSV body out of a well-formed submission', () => {
    const body = issueBody({ name: 'Chem 101', csv: 'term,definition\na,b\nc,d' })
    expect(extractDeckName(body)).toBe('Chem 101')
    expect(extractCsvFromSubmission(body)).toBe('term,definition\na,b\nc,d')
  })
})

describe('validateCsv', () => {
  it('accepts a valid deck', () => {
    const r = validateCsv('term,definition\nfoo,bar\nbaz,qux')
    expect(r.ok).toBe(true)
    expect(r.cardCount).toBe(2)
    expect(r.sample).toEqual([
      { term: 'foo', definition: 'bar' },
      { term: 'baz', definition: 'qux' },
    ])
  })

  it('rejects an empty CSV field', () => {
    const r = validateCsv('   ')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/empty/i)
  })

  it('surfaces parser errors verbatim', () => {
    const r = validateCsv('single\ncolumn\nonly')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/at least two columns/i)
  })

  it('rejects a deck with no usable rows', () => {
    const r = validateCsv('term,definition\n,\n,')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/no usable rows/i)
  })
})

describe('validateSubmissionIssue', () => {
  it('composes deck-name + validation into a single result', () => {
    const body = issueBody()
    const r = validateSubmissionIssue(body)
    expect(r.ok).toBe(true)
    expect(r.deckName).toBe('BIO 101')
    expect(r.cardCount).toBe(1)
  })

  it('surfaces parser errors while still returning the deck name', () => {
    const body = issueBody({ csv: 'term-only\nfoo\nbar' })
    const r = validateSubmissionIssue(body)
    expect(r.ok).toBe(false)
    expect(r.deckName).toBe('BIO 101')
    expect(r.error).toBeTruthy()
  })
})
