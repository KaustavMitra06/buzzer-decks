// /accept command → PR-builder.
//
// Pure logic. Takes a submit-deck Issue body plus contextual metadata
// (issue number, existing index.json, existing filenames in decks/) and
// returns everything the workflow needs to build a PR that adds the deck
// to the catalog: slug, CSV content, updated index entry, branch name,
// commit message, PR title/body. The workflow layer just does the fs
// writes and gh calls.

import {
  extractFormFields,
  extractCsvFromSubmission,
  extractDeckName,
  validateCsv,
} from './validateSubmission.js'
import { slugify } from './tagLabels.js'

// Read the six tag categories out of the form. Returns a shape compatible
// with the app's deck-metadata tags object (single-value fields as strings,
// prereqs split on comma).
export function extractTagsFromFields(fields) {
  const tags = {}
  const map = {
    'School': 'school',
    'Subject': 'subject',
    'Course number': 'course',
    'Professor': 'professor',
    'Year': 'year',
  }
  for (const [label, key] of Object.entries(map)) {
    const value = String(fields?.[label] || '').trim()
    if (value) tags[key] = value
  }
  const prereqsRaw = String(fields?.['Prerequisite courses (comma-separated)'] || '').trim()
  if (prereqsRaw) {
    const arr = prereqsRaw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    if (arr.length) tags.prereqs = arr
  }
  return tags
}

// Pick a filename that doesn't collide with anything already in decks/.
// Preferred base is the deck name slug; falls back to `deck-<issue>` if the
// name doesn't slug into anything usable.
export function pickUniqueSlug(deckName, issueNumber, existingFilenames) {
  const existing = new Set((existingFilenames || []).map((f) => f.toLowerCase()))
  let base = slugify(deckName)
  if (!base) base = `deck-${issueNumber}`
  let candidate = `${base}.csv`
  if (!existing.has(candidate.toLowerCase())) return base
  for (let n = 2; n < 100; n++) {
    candidate = `${base}-${n}.csv`
    if (!existing.has(candidate.toLowerCase())) return `${base}-${n}`
  }
  throw new Error(`Could not find a free filename for base "${base}" after 100 attempts.`)
}

// Append the new entry to an existing index.json (an array of entries).
// Preserves 2-space indentation + trailing newline to match the existing
// file format. Returns the new full text of the file.
export function upsertIndexEntry(existingIndexText, entry) {
  let arr
  try {
    arr = JSON.parse(existingIndexText || '[]')
  } catch (e) {
    throw new Error(`decks/index.json is not valid JSON: ${e.message}`)
  }
  if (!Array.isArray(arr)) {
    throw new Error('decks/index.json must be a JSON array of deck entries.')
  }
  // Replace any existing entry with the same filename (should be rare since
  // we just picked a unique slug, but defends against stale state).
  const filtered = arr.filter((e) => e?.file !== entry.file)
  filtered.push(entry)
  return JSON.stringify(filtered, null, 2) + '\n'
}

// Top-level: build the whole PR shape from an Issue body + context.
// Throws if the Issue's CSV doesn't parse (caller should have gated on
// csv-valid label, but we defend anyway).
export function buildDeckPr({ issueBody, issueNumber, approvedBy, existingFilenames, existingIndexText }) {
  const fields = extractFormFields(issueBody)
  const deckName = extractDeckName(issueBody) || `Untitled deck (#${issueNumber})`
  const csvContent = extractCsvFromSubmission(issueBody)
  const validation = validateCsv(csvContent)
  if (!validation.ok) {
    throw new Error(`CSV validation failed: ${validation.error}`)
  }
  const slug = pickUniqueSlug(deckName, issueNumber, existingFilenames)
  const file = `${slug}.csv`
  const tags = extractTagsFromFields(fields)
  const indexEntry = { file, name: deckName, tags }
  const nextIndexText = upsertIndexEntry(existingIndexText || '[]', indexEntry)
  const tagSummary = summarizeTags(tags)
  const branchName = `accept/issue-${issueNumber}-${slug}`
  const commitMessage = `feat(decks): add "${deckName}" from #${issueNumber}`
  const prTitle = `[Deck] Add "${deckName}" (from #${issueNumber})`
  const prBody = [
    `Automated deck submission from #${issueNumber}, approved by @${approvedBy} via \`/accept\`.`,
    '',
    `- **Deck:** ${deckName}`,
    `- **File:** \`decks/${file}\``,
    `- **Cards:** ${validation.cardCount}`,
    tagSummary ? `- **Tags:** ${tagSummary}` : `- **Tags:** _(none provided)_`,
    '',
    `Closes #${issueNumber}.`,
  ].join('\n')
  return {
    slug,
    file,
    csvContent,
    tags,
    indexEntry,
    nextIndexText,
    branchName,
    commitMessage,
    prTitle,
    prBody,
    cardCount: validation.cardCount,
  }
}

function summarizeTags(tags) {
  const parts = []
  if (tags.school) parts.push(`school=${tags.school}`)
  if (tags.subject) parts.push(`subject=${tags.subject}`)
  if (tags.course) parts.push(`course=${tags.course}`)
  if (tags.professor) parts.push(`professor=${tags.professor}`)
  if (tags.year) parts.push(`year=${tags.year}`)
  if (tags.prereqs?.length) parts.push(`prereqs=${tags.prereqs.join(',')}`)
  return parts.join(' · ')
}
