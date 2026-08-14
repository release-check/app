# MusicBrainz positive seed research

Research question: which smallest official-data subset can support five hand-verified positive recording identities without making availability claims or redistributing restricted content?

## Policy findings

- MusicBrainz classifies core database data as CC0. The fixture therefore contains only entity identifiers, names, release linkage, dates/status, track duration, and ISRC where present: <https://musicbrainz.org/doc/About/Data_License> and <https://musicbrainz.org/doc/MusicBrainz_Database>.
- Cover art is not part of the MusicBrainz dataset and is excluded: <https://musicbrainz.org/doc/About/Data_License>.
- API lookup shape is `/ws/2/<entity>/<MBID>?inc=<INC>`: <https://musicbrainz.org/doc/MusicBrainz_API>.
- A future automated ingest must send a meaningful contactable User-Agent, remain at or below the documented average of one request per second per source IP, and avoid polling: <https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting>.
- MusicBrainz defines a recording as a distinct audio entity that can be linked from one or more release tracks; this fixture labels identity, not platform availability: <https://musicbrainz.org/doc/recording>.

## Hand verification ledger

All checks were performed against official MusicBrainz entity pages on 2026-07-17 UTC.

| Seed | Recording | Artist | Release | Release group | Track | Checked facts |
| --- | --- | --- | --- | --- | --- | --- |
| NewJeans - Ditto | `adf44a12-e5f4-48aa-9029-b9ef4b5f1d6d` | `49204a7a-ed85-407a-828f-6fd46f1d8126` | `4e9c7e78-568f-4643-b2a8-b5a59ee2ca87` | `f99c9e74-52e3-47cb-9286-ce0019a9b69a` | `4a5f8dd3-73e4-40e2-bf5e-882de8be55b1` | title, credit, 3:06, official release, 2022-12-19, ISRC `USA2P2254487` |
| Björk - Jóga | `83534ada-9f60-4093-bbf3-ca182a03cf8b` | `87c5dedd-371d-4a53-9f7f-80522fb7f3cb` | `bd9732db-27bf-4bc6-9df6-d0460ed62dab` | `ecb0a296-2813-36cb-9470-dae14b44fda3` | `8677d875-ab35-4c3e-8c05-938d72de7da5` | title, credit, 5:06, official release, 1997 |
| Yellow Magic Orchestra - Rydeen | `96d9565e-0772-4202-9b8a-c52a96582bae` | `ac5af671-1df0-4312-8b7b-e61992ecc883` | `8d3f2c3a-d96d-48fe-abd9-8c805c7ae5ca` | `f9997231-b7af-3ba4-a1d7-17128522cbb3` | `c1eeb15b-1db9-3634-9958-269b9fbc65d7` | title, credit, 4:28, official release, 1986-02-25 |
| Charli XCX - Vroom Vroom | `1c1d4379-4aef-4b6f-be69-b97c54db276f` | `260b6184-8828-48eb-945c-bc4cb6fc34ca` | `e2f1dc68-f821-472e-8819-c9661d00fe26` | `d4cc6eea-bf86-4c79-a5d9-2da07df19e0e` | `d585035c-9675-462f-9330-ef8cf72c38e5` | title, credit, 3:13, official release, 2024-06-05 |
| 竹内まりや - プラスティック・ラブ | `a5efcc7d-b28a-4917-bc4c-a23b6c59dee2` | `02bdc7ec-d102-4698-85e2-789a42d40b9c` | `b09a26e1-33f8-421f-9a72-d3d5feb0d3ce` | `956911dd-1831-457d-a57d-f5feb507baad` | `8d11cfe4-f74a-4645-b07c-4c036c88cf3e` | title, credit, 4:54, official release, 2014-11-19 |

## Limitations

- These are positive recording-identity seeds, not sealed holdouts and not platform-availability ground truth.
- Displayed durations are second-precision observations from MusicBrainz pages.
- ISRC is included only where the official recording page exposed one during verification.
- No live API response is required by the offline validation test.
