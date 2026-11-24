# 우리의 이야기 — 커플 기념 앱

두 사람이 아이폰 홈 화면에 올려 두고 같이 쓰는 웹앱(PWA)입니다. 1주년 선물로 만들었습니다.
화면은 React + TypeScript(Vite), 데이터·사진·로그인·알림은 Supabase, 호스팅은 Cloudflare Pages이며
모두 무료 플랜으로 운영합니다.

## 기능

- **홈** — D-day 우표 카드, 💗 보고 싶어 버튼, 다가오는 일정, N년 전 오늘,
  오늘의 질문(365개)과 답 채팅(내가 답해야 상대 답이 보임), 오늘의 밸런스 게임
- **지도** — 전국 161개 시·군 칸 지도. 장소를 기록한 지역이 색칠되고 많이 갈수록 진해짐. 장소마다 사진·일기·반응·댓글
- **낙서·한마디** — 캔버스 그림(펜·지우개)과 짧은 글
- **달력** — 둘이 같이 쓰는 일정(여러 날 일정, ❤️ 👍 💪 반응), 아이폰 캘린더 구독(iCalendar 피드)
- **더보기** — 버킷리스트(여행지·맛집·영화, 완료하면 후기로), 감정 온도계, 후기, 여행지 투표, 월간 돌아보기, 우표 쌓기 게임
- **푸시 알림** — 상대가 무언가를 남기면 알림, D+100 단위·주년 아침 알림

## 구조

```
폰 홈 화면 앱(PWA) ──> Cloudflare Pages   (정적 파일)
        └───────────> Supabase           (Postgres + RLS · Storage · Auth · Edge Functions · Web Push)
```

- 기록은 `items` 테이블 한 곳에 `컬렉션 + JSON` 행으로 저장하고, 3초 폴링으로 두 폰을 맞춥니다.
  같은 컬렉션을 여러 화면이 써도 요청은 한 번만 갑니다(`useSyncExternalStore` 기반 공유 저장소).
- 접근 규칙(RLS): 로그인한 공용 계정만 읽고 쓸 수 있고, 로그인 전에는 아무것도 보이지 않습니다.
  사진은 비공개 버킷에 두고 서명 URL로만 보여 줍니다.
- 알림은 DB insert 트리거 → Edge Function(`notify`) → Web Push(VAPID)로 갑니다.
  함수는 공유 비밀 헤더 없이는 403을 돌려줍니다.
- 지도 경계: 통계청 통계지리정보서비스(SGIS) 2018년 시군구 경계(공공누리 제1유형)를
  `scripts/build-korea-regions.cjs`로 합치고 단순화해 SVG로 그렸습니다.

```
src/
  features/   화면 (home, map, doodle, record, more, onboarding)
  hooks/      데이터 훅 (useCollection + 기능별 훅)
  lib/        규칙과 계산 (날짜, 달력, 질문, 지도 지역 등 — 화면과 분리해 테스트)
supabase/
  migrations/ 스키마 · RLS · 트리거
  functions/  notify, anniversary, calendar (Deno)
scripts/      관리·배포·점검 스크립트
server/       옛 버전(노트북 Express + SQLite 서버) — 참고용, 지금 앱은 쓰지 않음
```

## 직접 돌려 보기

```bash
npm install          # Node 24 이상
cp .env.example .env # 내 Supabase 프로젝트 값으로 채우기 (.env는 커밋하지 않기)
npm run dev
npm test             # Vitest, 580여 개
```

Supabase 준비: `supabase/migrations/`의 SQL을 순서대로 적용하고,
`npm run sb:admin -- create-lock-user`로 공용 계정을 만듭니다. `npm run smoke`로 접근 규칙을 점검할 수 있습니다.

## 만들면서 정한 것

- 비용 0원: 무료 플랜만 쓰고 카드를 등록하지 않았습니다. 그래서 스토어 앱 대신 홈 화면 웹앱으로 만들었습니다.
- 사용자 구분: 공용 비밀번호로 잠그고, 폰마다 "누구세요?"에서 한 번 고릅니다(표시용이며 신원 증명은 아님).
- 날짜는 항상 기기 로컬 시간 기준(UTC로 계산하면 한국 시간 자정~오전 9시에 전날로 찍히는 문제)으로 계산합니다.
