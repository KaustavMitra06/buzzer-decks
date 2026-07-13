import { describe, expect, it } from 'vitest'
import {
  extractTagsFromFields,
  pickUniqueSlug,
  upsertIndexEntry,
  buildDeckPr,
} from './buildDeckPr.js'

const SAMPLE_BODY = `### Deck name

BIO 101 — Cell Biology Midterm

### School

UMich

### Subject

Biology

### Course number

BIO101

### Professor

Dr. Widely Renowned

### Year

2026

### Prerequisite courses (comma-separated)

CHEM100, MATH105

### Cards (CSV)

\`\`\`csv
term,definition
photosynthesis,plants convert light into chemical energy
mitochondria,the cell's power plant
\`\`\`

### Source / attribution

Campbell Biology, 12th ed., ch. 6
`

describe('extractTagsFromFields', () => {
  it('maps form-field labels to app tag keys', () => {
    const fields = {
      'School': 'UMich',
      'Subject': 'Biology',
      'Course number': 'BIO101',
      'Professor': 'Dr. Smith',
      'Year': '2026',
      'Prerequisite courses (comma-separated)': 'CHEM100, MATH105',
    }
    expect(extractTagsFromFields(fields)).toEqual({
      school: 'UMich',
      subject: 'Biology',
      course: 'BIO101',
      professor: 'Dr. Smith',
      year: '2026',
      prereqs: ['CHEM100', 'MATH105'],
    })
  })

  it('omits empty values (no empty strings in output)', () => {
    const fields = { 'School': 'MIT', 'Subject': '', 'Year': '  ' }
    expect(extractTagsFromFields(fields)).toEqual({ school: 'MIT' })
  })

  it('splits prereqs on comma AND newline', () => {
    const fields = { 'Prerequisite courses (comma-separated)': 'CS61A, CS61B\nMATH54' }
    expect(extractTagsFromFields(fields).prereqs).toEqual(['CS61A', 'CS61B', 'MATH54'])
  })

  it('omits prereqs entirely when the string is empty after splitting', () => {
    const fields = { 'Prerequisite courses (comma-separated)': ' , , ' }
    expect(extractTagsFromFields(fields).prereqs).toBeUndefined()
  })

  it('accepts null / undefined fields', () => {
    expect(extractTagsFromFields(null)).toEqual({})
    expect(extractTagsFromFields(undefined)).toEqual({})
  })
})

describe('pickUniqueSlug', () => {
  it('returns the base slug when no collision', () => {
    expect(pickUniqueSlug('BIO 101 — Cell Biology', 42, [])).toBe('bio-101-cell-biology')
  })

  it('appends -2 on collision', () => {
    expect(pickUniqueSlug('BIO 101', 42, ['bio-101.csv'])).toBe('bio-101-2')
  })

  it('walks -2, -3, ... until free', () => {
    const existing = ['bio-101.csv', 'bio-101-2.csv', 'bio-101-3.csv']
    expect(pickUniqueSlug('BIO 101', 42, existing)).toBe('bio-101-4')
  })

  it('is case-insensitive on collision detection', () => {
    expect(pickUniqueSlug('BIO 101', 42, ['BIO-101.CSV'])).toBe('bio-101-2')
  })

  it('falls back to deck-<issue> when the name slugs to empty', () => {
    expect(pickUniqueSlug('!!!', 42, [])).toBe('deck-42')
  })

  it('throws after 100 collision attempts', () => {
    const existing = ['x.csv', ...Array.from({ length: 100 }, (_, i) => `x-${i + 2}.csv`)]
    expect(() => pickUniqueSlug('x', 1, existing)).toThrow(/Could not find a free filename/)
  })
})

describe('upsertIndexEntry', () => {
  it('appends to an empty array', () => {
    const out = upsertIndexEntry('[]', { file: 'a.csv', name: 'A', tags: {} })
    expect(JSON.parse(out)).toEqual([{ file: 'a.csv', name: 'A', tags: {} }])
  })

  it('appends to a populated array preserving prior order', () => {
    const prior = JSON.stringify([{ file: 'a.csv', name: 'A', tags: {} }], null, 2)
    const out = upsertIndexEntry(prior, { file: 'b.csv', name: 'B', tags: {} })
    expect(JSON.parse(out)).toEqual([
      { file: 'a.csv', name: 'A', tags: {} },
      { file: 'b.csv', name: 'B', tags: {} },
    ])
  })

  it('replaces an existing entry with the same filename', () => {
    const prior = JSON.stringify([{ file: 'a.csv', name: 'Old', tags: {} }], null, 2)
    const out = upsertIndexEntry(prior, { file: 'a.csv', name: 'New', tags: { subject: 'X' } })
    expect(JSON.parse(out)).toEqual([{ file: 'a.csv', name: 'New', tags: { subject: 'X' } }])
  })

  it('ends with a trailing newline (matches existing file format)', () => {
    const out = upsertIndexEntry('[]', { file: 'a.csv', name: 'A', tags: {} })
    expect(out.endsWith('\n')).toBe(true)
  })

  it('errors on non-JSON input', () => {
    expect(() => upsertIndexEntry('not json', { file: 'a.csv' })).toThrow(/not valid JSON/)
  })

  it('errors when index is not an array', () => {
    expect(() => upsertIndexEntry('{}', { file: 'a.csv' })).toThrow(/array/)
  })
})

describe('buildDeckPr', () => {
  it('produces the full PR shape from a valid submission', () => {
    const out = buildDeckPr({
      issueBody: SAMPLE_BODY,
      issueNumber: 42,
      approvedBy: 'kaustavmitra06',
      existingFilenames: [],
      existingIndexText: '[]',
    })
    expect(out.slug).toBe('bio-101-cell-biology-midterm')
    expect(out.file).toBe('bio-101-cell-biology-midterm.csv')
    expect(out.cardCount).toBe(2)
    expect(out.branchName).toBe('accept/issue-42-bio-101-cell-biology-midterm')
    expect(out.commitMessage).toContain('BIO 101')
    expect(out.commitMessage).toContain('#42')
    expect(out.prTitle).toContain('BIO 101')
    expect(out.prBody).toContain('@kaustavmitra06')
    expect(out.prBody).toContain('Closes #42.')
    expect(out.prBody).toContain('school=UMich')
    expect(out.indexEntry).toEqual({
      file: 'bio-101-cell-biology-midterm.csv',
      name: 'BIO 101 — Cell Biology Midterm',
      tags: {
        school: 'UMich',
        subject: 'Biology',
        course: 'BIO101',
        professor: 'Dr. Widely Renowned',
        year: '2026',
        prereqs: ['CHEM100', 'MATH105'],
      },
    })
    expect(out.csvContent).toMatch(/^term,definition\nphotosynthesis,/)
    expect(JSON.parse(out.nextIndexText)).toHaveLength(1)
  })

  it('renumbers on filename collision', () => {
    const out = buildDeckPr({
      issueBody: SAMPLE_BODY,
      issueNumber: 42,
      approvedBy: 'user',
      existingFilenames: ['bio-101-cell-biology-midterm.csv'],
      existingIndexText: '[]',
    })
    expect(out.file).toBe('bio-101-cell-biology-midterm-2.csv')
  })

  it('throws on invalid CSV', () => {
    const body = SAMPLE_BODY.replace(/```csv\n[\s\S]*?```/, '```csv\n_No response_\n```')
    expect(() =>
      buildDeckPr({
        issueBody: body,
        issueNumber: 42,
        approvedBy: 'user',
        existingFilenames: [],
        existingIndexText: '[]',
      })
    ).toThrow(/CSV validation failed/)
  })

  it('renders "(none)" for tag summary when no tags are provided', () => {
    const bare = `### Deck name

Minimal

### Cards (CSV)

\`\`\`csv
term,definition
a,b
\`\`\`
`
    const out = buildDeckPr({
      issueBody: bare,
      issueNumber: 7,
      approvedBy: 'user',
      existingFilenames: [],
      existingIndexText: '[]',
    })
    expect(out.prBody).toContain('_(none provided)_')
    expect(out.indexEntry.tags).toEqual({})
  })
})
