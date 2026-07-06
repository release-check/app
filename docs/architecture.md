# Architecture

ReleaseCheck should not call every external platform on every user search.

The search path is:

```text
query
  -> normalization
  -> local search index
  -> matching engine
  -> cached availability result
  -> response
```

The ingestion path is:

```text
platform adapters
  -> raw metadata store
  -> normalization
  -> candidate matching
  -> canonical release index
  -> availability cache
```

## Components

- `api`: search, availability, resolve, batch endpoints
- `web`: search UI and evidence display
- `sdk-js`: developer client

The matching engine and worker live in the sibling `core` repository.

## Adapter Boundary

Every platform adapter should produce the same internal candidate shape:

- platform
- artist
- title
- album
- duration
- release date
- identifiers such as ISRC where available
- canonical URL
- availability state

The matching engine should not depend on platform-specific response objects.
