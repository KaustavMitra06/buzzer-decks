// Deck-submission validator.
//
// GitHub renders structured Issue-form templates as markdown with each
// field under a `### <label>` heading. This module extracts named
// fields out of that rendered body and runs the "Cards (CSV)" field
// through the same parser the app uses at upload time (`parseDeckText`),
// so the validation contract matches what a moderator would see if
// they saved the CSV and dragged it into Buzzer directly.
//
// Pure logic: takes strings, returns structured results. The workflow
// wraps this with fs + octokit to comment back on the issue.

import { parseDeckText } from './csv.js'

// Split an issue body written by a structured Issue form into a map
// of { <label>: <value> }. Labels come from lines starting with `### `.
// Values are the text (including code fences) up to the next `### ` or
// end of body. Empty-value placeholders ("_No response_") are dropped.
export function extractFormFields(body) {
  const text = String(body || '')
  const out = {}
  const parts = text.split(/^###\s+/m)
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i]
    const newlineIdx = chunk.indexOf('\n')
    if (newlineIdx === -1) continue
    const label = chunk.slice(0, newlineIdx).trim()
    let value = chunk.slice(newlineIdx + 1).trim()
    if (value === '_No response_' || value === '_No response._') value = ''
    out[label] = value
  }
  return out
}

// Strip a leading fenced code block off a value. Structured-form
// `render: csv` fields come back as ```csv\n...content...\n``` — we
// want just the content.
export function stripFencedCode(value) {
  const s = String(value || '').trim()
  const fenced = /^```[a-z0-9_-]*\n([\s\S]*?)\n```$/i.exec(s)
  return fenced ? fenced[1] : s
}

// Extract the CSV body from a deck-submission issue.
export function extractCsvFromSubmission(issueBody) {
  const fields = extractFormFields(issueBody)
  const raw = fields['Cards (CSV)'] || fields['cards'] || ''
  return stripFencedCode(raw)
}

// Extract the deck name (used to title the comment).
export function extractDeckName(issueBody) {
  return extractFormFields(issueBody)['Deck name'] || ''
}

// Validate a CSV blob. Returns { ok, cardCount?, error?, sample? }.
// `sample` is a small preview (first few cards) so moderators can spot
// obvious corpus mistakes without leaving the Issue.
export function validateCsv(csvText) {
  if (!String(csvText || '').trim()) {
    return { ok: false, error: 'Cards (CSV) field is empty.' }
  }
  try {
    const deck = parseDeckText(csvText, 'submission.csv')
    return {
      ok: true,
      cardCount: deck.cards.length,
      sample: deck.cards.slice(0, 3),
    }
  } catch (err) {
    return { ok: false, error: err?.message || 'Parser threw an unknown error.' }
  }
}

// Top-level entry point used by the workflow.
export function validateSubmissionIssue(issueBody) {
  const csv = extractCsvFromSubmission(issueBody)
  const result = validateCsv(csv)
  return {
    ...result,
    deckName: extractDeckName(issueBody),
  }
}
