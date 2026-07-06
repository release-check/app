# Matching

ReleaseCheck should explain its decisions.

Instead of returning only:

```json
{ "confidence": 0.97 }
```

it should return evidence:

```json
{
  "confidence": 0.97,
  "evidence": [
    { "field": "artist", "score": 0.95, "note": "alias match" },
    { "field": "title", "score": 0.98, "note": "normalized title match" },
    { "field": "duration", "score": 0.91, "note": "duration differs by 2s" },
    { "field": "isrc", "score": 1.0, "note": "exact ISRC match" }
  ]
}
```

## Early Signals

- artist name
- artist aliases
- track title
- album title
- release date
- duration
- ISRC
- platform URL
- explicit version markers such as remix, live, demo, sped up, remaster

## Availability States

- `available`
- `missing`
- `unknown`
- `region_locked`
- `removed`
- `duplicate_candidate`
