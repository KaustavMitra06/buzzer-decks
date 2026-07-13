// Tag-based auto-labeling.
//
// Takes the form fields extracted from a submit-deck Issue body and returns
// the list of label names to apply, plus the color+description each label
// should get if it needs to be lazy-created (labels don't exist until
// something applies them).
//
// Only labels categories that are useful for maintainer triage — school,
// subject, course, year. Skips professor + prereqs on purpose: those are
// high-cardinality (mostly unique per submission) and would create label
// sprawl without helping anyone filter.

// Slug-ify free-text tag values for use in label names. GitHub label names
// allow most characters, but keeping them lowercase-kebab makes them
// predictable and easier to filter with `label:school:umich`.
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// Field-label → { category, color } table. Order determines label priority
// in the returned list (matches how a moderator scans the label strip
// left-to-right).
const CATEGORIES = [
  { field: 'School', prefix: 'school', color: '1d76db' },
  { field: 'Subject', prefix: 'subject', color: '0e8a16' },
  { field: 'Course number', prefix: 'course', color: '6f42c1' },
  { field: 'Year', prefix: 'year', color: 'bfd4f2' },
]

// Return the labels this Issue should have applied.
// `fields` is the map returned by extractFormFields (from validateSubmission.js).
export function tagLabelsForFields(fields) {
  const labels = []
  for (const { field, prefix, color } of CATEGORIES) {
    const raw = String(fields?.[field] || '').trim()
    if (!raw) continue
    const value = slugify(raw)
    if (!value) continue
    labels.push({
      name: `${prefix}:${value}`,
      color,
      description: `${prefix}: ${raw}`,
    })
  }
  return labels
}
