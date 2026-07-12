// Minimal CSV/TSV parser copied from the Buzzer app's src/lib/csv.js so this
// repo can validate submissions without depending on the private app source.
// If the app's parser evolves (new delimiters, new fence rules) mirror the
// change here — the validator's job is to match the app's tolerance exactly.

export function parseDeckText(text, fileName = 'Untitled deck') {
  const trimmed = (text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text).trim()
  if (!trimmed) throw new Error('File is empty.')

  const firstLine = trimmed.split(/\r?\n/, 1)[0]
  const delimiter = firstLine.includes('\t') ? '\t' : ','

  const rows = parseRows(trimmed, delimiter)
  if (rows.length < 2) {
    throw new Error('Need a header row and at least one card.')
  }

  const [header, ...body] = rows
  if (header.length < 2) {
    throw new Error('Header must have at least two columns (term, definition).')
  }

  const cards = body
    .map((row) => ({
      term: (row[0] ?? '').trim(),
      definition: (row[1] ?? '').trim(),
    }))
    .filter((c) => c.term && c.definition)

  if (!cards.length) throw new Error('No usable rows found.')

  const name = fileName.replace(/\.[^.]+$/, '') || 'Untitled deck'
  return { name, cards }
}

function parseRows(text, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // ignore; \n handles the break
    } else {
      field += ch
    }
  }

  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}
