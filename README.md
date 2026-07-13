# buzzer-decks

Community deck catalog + moderation pipeline for the [Buzzer](https://github.com/KaustavMitra06/Buzzer) study app.

Buzzer's app source is proprietary and not published. This repo is the public front door: submit decks here, report card mistakes here, file bugs here. Maintainers review submissions, and approved decks ship in the next Buzzer release.

## What this repo is

| Path | What it does |
|---|---|
| `decks/*.csv` | The curated deck catalog. Two-column CSV (term, definition) with a header row. |
| `decks/index.json` | Manifest that joins each CSV to its display name + tags. |
| `.github/ISSUE_TEMPLATE/` | Structured forms for deck submissions, deck corrections, and bug reports. |
| `.github/workflows/validate-submission.yml` | Auto-parses submitted CSVs through Buzzer's parser, comments back with results, labels `csv-valid` / `csv-invalid`. |
| `.github/workflows/moderate-content.yml` | Wordlist-based profanity/spam filter on non-collaborator issue + comment traffic. |
| `.github/moderation-wordlist.txt` | Maintainer-editable wordlist that drives the moderator. |
| `scripts/moderation/` | Pure-JS moderation logic (tested with vitest). |

## How to contribute

- **Submit a deck** — [open a submission Issue](https://github.com/KaustavMitra06/buzzer-decks/issues/new?template=submit-deck.yml). The form asks for a deck name, the six Buzzer tag categories (school / subject / course / professor / year / prereqs), and the CSV. The auto-validator will parse it and comment back within a minute or two.
- **Report a card** — [open a correction Issue](https://github.com/KaustavMitra06/buzzer-decks/issues/new?template=deck-correction.yml). In-app "Report card" buttons pre-fill the deck + card fields for you.
- **File a bug** — [open a bug report](https://github.com/KaustavMitra06/buzzer-decks/issues/new?template=bug-report.yml).

Maintainers merge approved submissions into `decks/` on a rolling basis. The Buzzer app fetches this repo at build time, so the next release automatically picks up whatever's on `main`.

## Adding a curated deck (maintainer flow)

**Preferred:** comment `/accept` on the submission Issue. The [Accept deck submission](.github/workflows/accept-submission.yml) workflow will:

1. Extract the CSV + tags from the Issue body
2. Write `decks/<slug>.csv` and append the entry to `decks/index.json`
3. Open a PR titled `[Deck] Add "<deck name>" (from #<issue>)`
4. Label the Issue `accepted` and comment back with the PR link

You then review the PR (auto-runs `Test moderation scripts` + `validate-pr-decks`), squash-merge it, and the Issue closes automatically via `Closes #N` in the PR body.

Guards on `/accept`:
- Comment author must be OWNER / MEMBER / COLLABORATOR
- Issue must have both `deck-submission` and `csv-valid` labels
- Issue must NOT already have the `accepted` label (idempotency)

**Manual fallback** if the auto-PR misbehaves:

1. Drop the CSV in `decks/<slug>.csv`
2. Append one object to `decks/index.json`:
   ```json
   { "file": "<slug>.csv", "name": "Human-readable name", "tags": { "school": "…", "subject": "…" } }
   ```

The Buzzer app's `starterDecks.js` joins the manifest to the CSVs by filename — the join is verified in Buzzer's own CI, so a drop-file-without-manifest-entry (or vice versa) will fail there.

## Auto-labeling

When a submit-deck Issue lands, [Validate deck submission](.github/workflows/validate-submission.yml) applies structured labels based on the tag fields:

| Field | Label prefix | Example |
|---|---|---|
| School | `school:` | `school:umich` |
| Subject | `subject:` | `subject:biology` |
| Course number | `course:` | `course:bio101` |
| Year | `year:` | `year:2026` |

Professor and prereqs are intentionally NOT labeled — too high-cardinality, would create label sprawl. Labels are lazy-created (first submission from a new school auto-creates the label).

## License

Decks and moderation scripts: [CC BY 4.0](./LICENSE). The Buzzer study app is a separate project under a different license.
