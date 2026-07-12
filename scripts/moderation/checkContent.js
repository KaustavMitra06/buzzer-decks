// Content moderation — pure logic.
//
// Takes a wordlist + a body of text and returns which terms matched.
// Word matching is case-insensitive with word-boundary sensitivity so
// "class" doesn't flag "classic", but multi-word patterns ("buy now")
// are also allowed and treated as a substring match on normalized text.
//
// Loading the wordlist file is the caller's job (the workflow reads it
// from `.github/moderation-wordlist.txt`); this module is fs-free so
// vitest can drive it without touching disk.

// Parse a wordlist buffer: strip comments, blank lines, trim.
export function parseWordlist(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

// Escape a string for use inside a RegExp source.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Return the list of forbidden terms found in `text` (case-insensitive,
// word-boundary aware for single tokens, substring for multi-word phrases).
export function findFlagged(text, wordlist) {
  const t = String(text || '').toLowerCase()
  if (!t.trim()) return []
  const flagged = []
  for (const term of wordlist) {
    const escaped = escapeRegex(term)
    const isMultiWord = /\s/.test(term)
    const re = isMultiWord
      ? new RegExp(escaped, 'i')
      : new RegExp(`\\b${escaped}\\b`, 'i')
    if (re.test(t)) flagged.push(term)
  }
  return flagged
}

// Author associations from the GitHub event payload that we exempt from
// moderation. A maintainer commenting freely shouldn't be pinged by the
// bot.
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

export function isTrustedAuthor(association) {
  return TRUSTED_ASSOCIATIONS.has(String(association || '').toUpperCase())
}

// Compose the top-level moderation decision.
// Returns { flagged: boolean, matches: string[], skipped: 'trusted' | undefined }.
export function moderate({ text, wordlist, authorAssociation }) {
  if (isTrustedAuthor(authorAssociation)) {
    return { flagged: false, matches: [], skipped: 'trusted' }
  }
  const matches = findFlagged(text, wordlist)
  return { flagged: matches.length > 0, matches }
}
