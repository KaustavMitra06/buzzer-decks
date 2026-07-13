import { describe, expect, it } from 'vitest'
import { slugify, tagLabelsForFields } from './tagLabels.js'

describe('slugify', () => {
  it('lowercases + hyphenates spaces', () => {
    expect(slugify('University of Michigan')).toBe('university-of-michigan')
  })

  it('strips diacritics', () => {
    expect(slugify('Café Résumé')).toBe('cafe-resume')
  })

  it('collapses runs of non-alphanumerics', () => {
    expect(slugify('CS 106 —— A!!')).toBe('cs-106-a')
  })

  it('trims leading + trailing hyphens', () => {
    expect(slugify('  --hello--  ')).toBe('hello')
  })

  it('caps length at 40', () => {
    const long = 'a'.repeat(100)
    expect(slugify(long).length).toBe(40)
  })

  it('returns empty string for empty / null input', () => {
    expect(slugify('')).toBe('')
    expect(slugify(null)).toBe('')
    expect(slugify(undefined)).toBe('')
    expect(slugify('   ')).toBe('')
  })

  it('preserves already-clean slugs', () => {
    expect(slugify('umich-bio101')).toBe('umich-bio101')
  })
})

describe('tagLabelsForFields', () => {
  it('emits labels for each populated category in priority order', () => {
    const labels = tagLabelsForFields({
      'School': 'UMich',
      'Subject': 'Biology',
      'Course number': 'BIO101',
      'Year': '2026',
    })
    expect(labels.map((l) => l.name)).toEqual([
      'school:umich',
      'subject:biology',
      'course:bio101',
      'year:2026',
    ])
  })

  it('skips missing / empty categories', () => {
    const labels = tagLabelsForFields({
      'School': 'MIT',
      'Subject': '',
      'Year': '   ',
    })
    expect(labels.map((l) => l.name)).toEqual(['school:mit'])
  })

  it('ignores professor and prereqs (high-cardinality — sprawl risk)', () => {
    const labels = tagLabelsForFields({
      'School': 'Stanford',
      'Professor': 'Dr. Widely Renowned',
      'Prerequisite courses (comma-separated)': 'CHEM100, MATH105',
    })
    expect(labels.map((l) => l.name)).toEqual(['school:stanford'])
  })

  it('attaches a color and human-readable description to each label', () => {
    const [subject] = tagLabelsForFields({ 'Subject': 'Computer Science' })
    expect(subject).toMatchObject({
      name: 'subject:computer-science',
      color: '0e8a16',
      description: 'subject: Computer Science',
    })
  })

  it('drops values that slugify to empty (all-punctuation)', () => {
    const labels = tagLabelsForFields({ 'School': '...', 'Subject': 'Biology' })
    expect(labels.map((l) => l.name)).toEqual(['subject:biology'])
  })

  it('accepts a null / undefined fields object', () => {
    expect(tagLabelsForFields(null)).toEqual([])
    expect(tagLabelsForFields(undefined)).toEqual([])
    expect(tagLabelsForFields({})).toEqual([])
  })
})
