# ReleaseCheck PRD

## 문서 관계

- 이 문서는 **제품 요구사항**의 단일 진실 공급원이다.
- "이 프로젝트가 무엇인지"는 `app/docs/application.md`를 기준으로 한다.
- 실행 일정과 단계별 산출물은 `ROADMAP.md`(workspace/app/core)가 담당한다.
- 검증 기준과 성능 목표는 `app/docs/performance.md`와 일치한다.

## 1. 프로젝트 정의

ReleaseCheck는 국내외 음악 플랫폼에 흩어진 음원과 앨범 정보를 한 번에 확인하는 오픈소스 검색 API다.

단순히 검색 결과를 나열하지 않고, 아티스트명, 곡명, 발매일, 재생시간, 외부 식별자 등을 비교해 동일한 음원 또는 앨범 여부를 판단하고 신뢰도 점수와 매칭 근거를 함께 제공한다.

ReleaseCheck는 음악 플레이어가 아니다. "이 트랙/릴리스가 어디에 존재하는가"를 신뢰도와 근거와 함께 답하는 **가용성 인덱스**다.

## 2. 문제

언더그라운드·소규모·마이너 음악은 플랫폼마다 등록 정보가 다르거나 일부 플랫폼에만 존재한다. 리스너는 같은 곡을 찾기 위해 플랫폼을 옮겨 다니며, 메타데이터가 불일치하고, 이름이 바뀌고, 릴리스가 사라지고, 지역 서비스는 놓치기 쉽다.

현재 대안은 전부 불완전하다:

- 플랫폼 자체 검색: 해당 플랫폼 존재만 확인, 교차 확인 불가.
- AOTY/RYM 등 큐레이션 사이트: 사용자 주도 카탈로그·리뷰 표면이지 완전한 가용성 DB가 아님.
- 웹 검색: Bandcamp/SoundCloud의 SEO가 깨끗한 결과를 잘 노출하지 못함.

## 3. 핵심 원칙

1. 음악은 플랫폼이 정리하기 전에 존재한다.
2. 검색은 강제된 단일 정답이 아니라 **후보**를 보여준다.
3. `unknown`은 확신 있는 거짓말보다 낫다.
4. 강한 거짓 긍정(false positive)은 결과 누락보다 심각한 실패다.
5. 속도는 제품의 일부다. 나중에 최적화할 항목이 아니다.
6. 모든 신뢰도 점수에는 사람이 검토할 수 있는 근거가 있어야 한다.
7. 플랫폼 연동은 어댑터 형태 + 정책 인지(policy-aware)로 한다. 스크레이핑을 무조건 허용하지 않는다.

## 4. 대상 사용자

1. 리뷰, AOTY, RYM, 포럼, 리스트, 추천 스레드를 읽는 음악 덕후.
2. 언더그라운드·마이너 음악을 파는 디거(digger).
3. DJ, 큐레이터, 플레이리스트 제작자, 블로거, 아카이브 운영자.
4. 통합 음악 검색이 필요한 개발자.
5. 일반 스트리밍 사용자는 핵심 타겟이 아니다.

## 5. 제품 범위

### v0 플랫폼 (실제 조회 대상 6종)

Spotify, YouTube Music, Apple Music, SoundCloud, Bandcamp, Melon

MusicBrainz와 Discogs는 메타데이터·검증 참조로만 사용한다. v0 조회 대상 6종에 포함하지 않는다.

### 플랫폼 상태

각 플랫폼은 다음 중 하나로 표현한다:

- `available`
- `missing`
- `unknown`
- `region_locked`
- `removed`
- `duplicate_candidate`

`unknown`은 유효한 제품 상태다. `missing`으로 숨기거나 합치지 않는다.

### 제공 표면

- HTTP API: `search` / `availability` / `resolve` / `batch`
- 웹 UI: 플랫폼별 결과, 후보, 신뢰도, 근거를 한 화면에서 확인
- CLI: API를 재사용하는 래퍼
- JavaScript SDK: 개발자용 클라이언트

### 시스템 원칙

- 요청 경로에서 매 플랫폼에 라이브 팬아웃하지 않는다. 캐시·로컬 인덱스 우선.
- 느린 소스는 백그라운드에서 갱신한다.
- 매칭 엔진은 플랫폼별 응답 객체에 의존하지 않는다.
- 모든 어댑터는 동일한 내부 후보 형태(플랫폼, 아티스트, 제목, 앨범, 재생시간, 발매일, ISRC 등 식별자, URL, 상태)를 만든다.

## 6. MVP 범위

### 포함

- 트랙/릴리스 검색 → 후보 반환 (단일 정답 강제 금지)
- 후보의 동일 음원 판단 (정규화, 퍼지 매칭, 신뢰도 점수, 근거 생성)
- 플랫폼 가용성 판정 (`available`/`missing`/`unknown` 구분)
- 동명 트랙, 리믹스, 라이브, 데모, 리마스터, 대체 버전을 후보로 분리
- 음악 제공 여부 + 링크 + 신뢰도 + 근거를 API/CLI/웹/SDK로 제공
- 골든 셋/평가 셋 기반 정확도·거짓 긍정 추적

### 제외

- 전체 플랫폼 크롤러
- 프로덕션 인증·API 키·과금·관리 도구
- ML/벡터 랭킹 (결정적 매칭이 강해지기 전까지)
- 분산 워커 시스템·전체 공개 메타데이터 그래프
- 불확실성을 숨기거나 근거를 약화하는 어떤 것

## 7. 성공 지표

### v0 데모 컷라인

- v0 플랫폼 6종 표현.
- 500+ 대표 샘플 트랙/릴리스, 100+ 지저분한 케이스.
- Top-3 정답 후보율 >= 90%.
- 데모 쿼리 p95 응답 <= 3초.
- 모든 결과에 출처, 신뢰도, 근거 포함.

### 내부 공격 목표

- 10,000+ 대표 샘플, 1,000+ 지저분한 케이스.
- Top-3 정답 후보율 >= 95%.
- 일반 인덱스/캐시 케이스 p95 <= 1초.
- 정답이 알려진 샘플 기준 `unknown` 비율 <= 10%.
- 강한 플랫폼 거짓 긍정 2–5% 이하.
- 근거를 이해할 수 없는 결과는 좋은 결과로 집계하지 않음.

### 성능 지표 (app/docs/performance.md 기준)

- 캐시 히트: p95 50ms 미만
- 인덱스 검색: p95 150ms 미만
- 제한적 라이브 폴백 포함 콜드 쿼리: 가능 시 1.5초 미만
- 배치 검색은 트랙별 네트워크 팬아웃 반복 금지

## 8. 오픈 이슈

### 결정됨 (2026-08-14)

1. **첫 scene 버킷**: 한국·일본·인터넷 3신 병행. 첫 실데이터 골든 셋이 3신을 동시에 커버한다 (`data/golden-set.json`, MB 시드 기준).
2. **첫 골든 셋**: MusicBrainz positive-recording 시드 5건에 플랫폼 URL·가용성 라벨을 부착한 실데이터 v1. 데모 셋 4건은 negative 케이스(동명 분리, live/demo 미병합)로 유지. (`data/golden-set.json`, `apps/api/src/verified-index.ts`)
3. **v0 플랫폼 소스 모드**: spotify/apple `official_api`(캐시), youtube_music/soundcloud `public_index`, bandcamp/melon `manual_seed`. 전부 `liveLookupAllowed: false`. SoundCloud 공식 API 자격증명은 정책 문서화 후 차후 도입. (`apps/api/src/adapters.ts`)
4. **resolve 타이밍**: 후보 기반으로 ship. 자유 텍스트 검색 안정화를 기다리지 않으며, 골든 셋의 정확한 URL → 후보 검증에 사용한다. 단일 정답으로 위장하지 않는다.
5. **core↔app 경계**: CLI JSON 서브프로세스 유지 (`core-bridge.ts`). 확장 경로는 napi-rs 바인딩, 프로세스 오버헤드가 실측 문제가 될 때만.
6. **레포 구조**: app+core 단일 레포 전환 확정 (2026-08-14). crate/패키지 경계는 유지, git 경계만 제거. core 이슈는 app으로 이관 완료, 실행은 이슈 #app-10에서 추적.

### 결정됨 (2026-08-19)

7. **SoundCloud 소스 모드 (I9-2)**: ~~공식 API 도입 확정~~ → 2026-08-19 재검토: Artist Pro $99/년이 v0에 불필요하다고 판단, **`public_index` 유지로 회귀**. `SoundCloudAdapter` 코드는 유지 (미래 도입 시 재사용), 자격증명 발급 보류. (`docs/soundcloud-policy.md`)
8. **Spotify 자격증명 (G1, I4-5)**: 발급·설정 진행 확정. `.env`에 `SPOTIFY_CLIENT_ID/SECRET` 주입 후 `bun run ingest-platform`으로 실데이터 교체 시작. 어댑터·캐시·ingest 파이프라인 준비 완료. → **2026-08-19 실측: Web API가 Spotify Premium 없이는 403** (앱 생성 완료, Client ID/Secret은 `app/.env`에 기록됨, token 발급은 동작). Premium 구독 여부는 사용자 결정 대기.

### 남은 항목

- 평가 셋 확장 (scene당 20–50 케이스) 및 top-3 정확도 실측.
- SoundCloud 공식 API 도입 여부와 자격증명 경로.
- 골든 셋 확장 (scene당 5–10 케이스) — 현재 5건, 전부 original_studio 버전.

## 참조

- `app/docs/application.md` — 프로젝트 정체성(대회 지원서)
- `ROADMAP.md` — 방향, 샘플 전략, 단계 일정
- `app/docs/architecture.md` — 구성 요소와 어댑터 경계
- `app/docs/performance.md` — 성능 목표와 측정
- `app/rfc/0001-mvp.md` — MVP 스코프 노트
