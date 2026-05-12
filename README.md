# 코스피 재무 이상징후 탐지 AI 에이전트

한국 상장사 재무자료를 업로드하면 **멀티 LLM 에이전트**가 비율·이상징후·Beneish/Altman 등을 계산하고, 감사형 요약·히트맵·PDF 리포트까지 제공하는 **MVP 웹앱**입니다. 배포는 **Vercel**, 데이터는 **Neon(PostgreSQL)**·**Vercel Blob**을 전제로 설계했습니다.

## 주요 기능

- **파일 업로드**: 사업보고서 PDF, 재무제표 XLSX, DART CSV, IR PDF → Blob 저장, Neon에 메타데이터 기록
- **결정론적 분석**: 재무비율(YoY, 마진, DSO, 재고회전, 부채비율, CFO/NI, FCF 등), 규칙 기반 이상징후, Beneish M-Score, Altman Z-Score
- **멀티 에이전트**: GPT(정량 해석·JSON), Claude(장문), Gemini(PDF 멀티모달), Perplexity(외부 검색) — API 키가 없으면 해당 에이전트는 건너뜀
- **오케스트레이션**: LangGraph로 Specialist → Evaluator → Synthesizer 흐름
- **RAG**: PDF 텍스트 청크 + OpenAI 임베딩, JSON 저장 후 코사인 유사도로 상위 청크를 컨텍스트에 주입(`pgvector` 확장 없이 동작)
- **업종 비교**: `industry_benchmarks` 시드(반도체·조선·2차전지·바이오·일반)와 분석 파이프라인 연동
- **UI**: 세션 생성, 업로드, 데모 재무팩트 주입, 분석 실행, Risk Score·히트맵·이상 리스트·차트(Recharts), PDF 생성
- **작업 큐**: Inngest 키가 있으면 분석을 이벤트 큐로 실행, 없으면 API에서 동기 실행

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| API | Route Handlers (Node 런타임) |
| DB | Neon + Drizzle ORM + `@neondatabase/serverless` |
| 파일 | Vercel Blob |
| 차트·상태 | Recharts, Zustand |
| PDF | `@react-pdf/renderer` |
| 에이전트·워크플로 | LangGraph, OpenAI / Anthropic / Google AI / Perplexity API |
| 백그라운드(선택) | Inngest (`/api/inngest`) |

## 디렉터리 구조(요약)

```
src/app/              # 페이지·API 라우트
src/agents/           # gpt, claude, gemini, perplexity, orchestrator(LangGraph)
src/audit/            # ratios, anomaly, scoring, reports(PDF)
src/components/       # UploadDashboard, RunDetailView
src/db/               # Drizzle 스키마·DB 클라이언트
src/lib/              # 파서, 파이프라인, RAG, 히트맵
src/inngest/          # Inngest 클라이언트·함수
drizzle/              # SQL 마이그레이션
scripts/seed-industry.ts
```

## 사전 준비

1. [Neon](https://console.neon.tech/)에서 DB 생성 → 연결 문자열을 `DATABASE_URL`에 설정  
2. [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) 토큰 → `BLOB_READ_WRITE_TOKEN`  
3. 사용할 LLM 키만 설정(미설정 시 해당 에이전트 스킵)  
4. (선택) [Inngest](https://www.inngest.com/) 연동 시 `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`  

변수 목록은 [`.env.example`](.env.example)을 참고하세요.

## DB 반영 및 시드

```bash
# 스키마를 Neon에 반영 (또는 npm run db:migrate)
npm run db:push

# 업종 벤치마크 시드(멱등)
npm run db:seed
```

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버(기본 포트 3000) |
| `npm run dev:5181` | 개발 서버 **5181 포트** |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버(빌드 후) |
| `npm run lint` | ESLint |
| `npm run db:push` / `db:migrate` / `db:studio` | Drizzle |

## 로컬에서 5181 포트로 실행

```bash
npm run dev:5181
```

(`next dev -p 5181`과 동일합니다.)

브라우저에서 **http://localhost:5181** 을 열면 됩니다.

## 사용 흐름

1. 홈에서 기업명·종목코드·업종을 넣고 **분석 세션 만들기**  
2. 상세 페이지에서 파일 업로드 또는 **데모 재무팩트 주입**  
3. **AI 분석 실행** → 완료 후 Risk Score, 히트맵, 이상징후, AI 메모 확인  
4. **PDF 리포트 생성** → Blob에 저장된 PDF URL로 열기  

## 배포(Vercel)

- 프로젝트를 Vercel에 연결하고 위 환경 변수를 등록  
- Inngest 사용 시 앱 URL의 `/api/inngest`를 Inngest 대시보드에 등록  
- Serverless 시간 제한이 있는 플랜에서는 긴 분석에 Inngest 사용을 권장합니다.

## 원격 저장소

- GitHub: [junsang-dong/goorm-260512-audit-agent-orchestration](https://github.com/junsang-dong/goorm-260512-audit-agent-orchestration)

## 오류 수정·빌드 시 유의사항 (1차 구현 요약)

프로덕션 빌드(`npm run build`)를 통과시키기 위해 반영한 내용입니다.

| 이슈 | 조치 |
|------|------|
| `generate-pdf.ts`에서 JSX 사용 시 Turbopack 파싱 오류 (`Expected '>', got …`) | PDF 생성 시 `React.createElement(AuditPdfDocument, …)` 사용, `renderToBuffer` 인자는 `@react-pdf/renderer` 기대 타입에 맞게 단언 |
| Inngest v4 `createFunction` 타입 오류 (인자 3개) | 단일 옵션 객체에 `triggers: [{ event: "audit/run.requested" }]` 형태로 통합 ([`src/inngest/functions/auditPipeline.ts`](src/inngest/functions/auditPipeline.ts)) |
| Drizzle `agent_outputs.payload` 삽입 타입 불일치 | `Record<string, unknown>`으로 맞추고 에이전트 결과는 스프레드 후 저장 ([`src/lib/pipeline.ts`](src/lib/pipeline.ts)) |
| `pdf-parse` 네이티브/번들 이슈 가능성 | [`next.config.ts`](next.config.ts)에 `serverExternalPackages: ["pdf-parse"]` |
| ESLint | `parse-csv.ts` 미사용 변수 제거, `RunDetailView` 폴링 `useEffect` 의존성 정리 |
| `.gitignore`의 `.env*`가 `.env.example`까지 제외 | `!.env.example` 예외 추가, `.cursor/` 제외 |

### 로컬 개발 서버

일부 샌드박스/CI 환경에서 `next dev`가 `uv_interface_addresses` 오류로 종료될 수 있습니다. 로컬 Mac/Windows 터미널에서는 보통 `npm run dev` 또는 `npm run dev:5181`로 정상 기동합니다.

## 라이선스·면책

이 저장소는 교육·MVP 목적의 예시입니다. 실제 감사·투자 판단에는 공인된 절차와 전문가 검토가 필요합니다.
