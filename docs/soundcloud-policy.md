# SoundCloud API 정책 조사

결정용 조사 문서 (I9-1 산출물). 조사일: 2026-08-14. 이 문서는 결정(I9-2) 전까지 참고 자료이며, 어댑터 정책 변경은 G2 승인 후에만 반영한다.

> 주의: 조사는 공식 문서·Help Center·ToS 위주 웹 검색으로 수행됐고, 출처 URL은 세션 핸드오프에서 유실됐다. I9-2 결정 전에 아래 수치(요금·rate limit)를 공식 페이지에서 재확인할 것.

## 현재 상태

- `apps/api/src/adapters.ts`: soundcloud `mode: public_index`, `liveLookupAllowed: false`.
- 공식 API 미연결, 자격증명 없음.

## 공식 API 개요 (2026-08-14 조사 기준)

- **자격증명**: SoundCloud Artist Pro 구독 필요 → 앱 등록 → `client_id` / `client_secret` 발급 (브라우저 또는 공식 CLI).
- **인증**: OAuth 2.1 — Client Credentials (공개 리소스) / Auth Code + PKCE (사용자 권한 필요 리소스).
- **Rate limit**: 스트림 15,000/24h per client_id, 토큰 발급 50/12h per app 및 30/h per IP. 전역 aggregate limit은 조사 시점에 미적용.
- **요금**: 별도 API 과금 문서 없음. 진입 비용은 Artist Pro 구독 약 $99/년.
- **ToS**: 스크래핑·비공식 엔드포인트 사용 금지, 영구 복사/스트림 리핑 금지, 앱 검토·철회 가능. ReleaseCheck 유형(타 플랫폼 가용성 조회·집계)은 약관 제한과 충돌 여지가 있음 — 공식 API 사용이어도 상업/집계 용도 승인 필요할 수 있음.

## 옵션 비교

| 옵션 | 비용 | 노력 | 정책 리스크 | 비고 |
|---|---|---|---|---|
| (a) 공식 API | Artist Pro ~$99/년 | 중 (자격증명, OAuth, rate limit 관리) | 낮~중 — 앱 검토·철회 가능, 집계 용도 승인 여부 확인 필요 | 메타데이터/검색 조회는 Client Credentials로 가능. 스트림 15,000/24h는 데모 규모에 충분 |
| (b) public_index 유지 (현행) | 무료 | 낮 (이미 구성) | 낮 — 공개 인덱스 결과만, 라이브 호출 없음 | 요청 경로 팬아웃 없음, 정확도는 인덱스 품질에 의존 |
| (c) manual_seed | 무료 (수작업) | 높 (수동 검증) | 낮 | 골든/평가 셋 규모 확장에 비효율 |

## Open Questions (결정용, 권고 없음)

1. ReleaseCheck의 "타 플랫폼 가용성 조회·집계" 용도가 SoundCloud 앱 검토/ToS상 허용되는가 — 공식 문의 필요?
2. $99/년 Artist Pro 비용이 v0 데모 컷라인(8/27) 대비 정당한가, 아니면 public_index로 데모 후 공식 API는 Phase 3?
3. 공식 API 도입 시 client credentials를 어디에 보관하고 갱신할 것인가 (G2 — 사용자 승인 gate)?
4. 검색 정확도가 public_index 유지로 실측 게이트(I3) 기준을 충족하는가 — 결정 전 평가 셋 기준 측정 필요?

## 결정 후 조치 (I9-2, I9-3)

- 결정: PRD §8 갱신.
- 반영: `adapters.ts` soundcloud policy + note 변경 → `bun run check`, `bun test`.
- 공식 API 도입 시: G2 사용자 승인 후 자격증명 경로 구현 (I4 어댑터 캐시 레이어 재사용 가능).
