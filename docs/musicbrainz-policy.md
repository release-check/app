# MusicBrainz data policy

ReleaseCheck uses MusicBrainz as a **metadata and identity reference**, not as a platform availability source. This document defines how the project may call the MusicBrainz API and which fields may be stored or redistributed locally.

The canonical policy block lives in [`data/musicbrainz/positive-recording-seeds.v1.json`](../data/musicbrainz/positive-recording-seeds.v1.json) under `policy`. Ingest scripts, seed writers, and provenance checks must stay aligned with that block.

## Scope

- **In scope**: CC0 MusicBrainz core metadata needed to identify a recording and link it to official release entities.
- **Out of scope**: platform availability, cover art, audio, community annotations, edit history, ratings, tags, and any polling workflow that watches MusicBrainz for changes.

## API usage rules

These rules mirror `policy.api_usage` in the seed file:

| Rule | Requirement |
| --- | --- |
| User-Agent | Every request must send a **meaningful, contactable User-Agent** string. Generic library defaults are not acceptable. |
| Rate limit | Stay at or below **one request per second on average per source IP**. Bursting above that risks throttling or blocking. |
| Change polling | **Do not poll** MusicBrainz for changes. Lookups are point-in-time identity fetches for offline fixtures or manual verification, not live sync. |

Official references:

- API docs: <https://musicbrainz.org/doc/MusicBrainz_API>
- Rate limiting: <https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting>

## License and redistribution

From `policy` in the seed file:

- **License**: CC0-1.0 for MusicBrainz core database content.
- **Redistributed fields**: `musicbrainz_core_metadata_only`
- **Permitted use**: `offline_positive_recording_identity_fixture`

Reference links recorded in the seed policy block:

- Data license: <https://musicbrainz.org/doc/About/Data_License>
- Database scope: <https://musicbrainz.org/doc/MusicBrainz_Database>

## Field whitelist

Only the following categories may be copied into ReleaseCheck fixtures or ingest output:

- Recording, track, release, release-group, and artist **MBIDs**
- Recording **title**, **artist credit**, **duration**, and **ISRCs** when present
- Release **title**, **status**, and **release date**
- Source URLs and API lookup URLs for auditability
- Retrieval timestamps and verification metadata describing how the row was produced

## Excluded fields

The seed policy block explicitly excludes these fields from redistribution and automated ingest output:

```json
"excluded_fields": [
  "annotations",
  "audio",
  "cover_art",
  "edit_history",
  "ratings",
  "tags"
]
```

Do not request, store, or infer content from those areas. Cover art is not part of the MusicBrainz CC0 database and must never be bundled with seed data.

## Ingest implementation

`scripts/ingest-musicbrainz.ts` is the reference implementation for recording identity lookup:

1. `GET /ws/2/recording/{mbid}?inc=artists+releases+release-groups+isrcs&fmt=json`
2. Select an official release (optionally guided by CLI `--artist` / `--title` hints).
3. `GET /ws/2/release/{release_mbid}?inc=recordings&fmt=json` to resolve the track MBID linked to the recording.
4. Emit a seed-shaped JSON object with `identity`, `metadata`, `source`, `label`, `verification`, and `policy_provenance`.
5. Enforce the User-Agent header, **1 request/second** spacing, and retry on `429` or `5xx` responses before giving up.

Automated ingest rows are **API-retrieved identity fixtures**. They still require human review before being promoted into the hand-verified positive seed dataset.

## Testing constraint

Unit tests must **mock HTTP** and must **never** call the live MusicBrainz API. This keeps CI deterministic and avoids consuming the public rate limit during development.
