# VP Media Lab 实施计划

> **Status: Superseded.** This plan implements the former standalone editing direction. Do not execute it. The active product baseline is `docs/superpowers/specs/2026-08-11-vp-media-lab-jianying-handoff-design.md`; a replacement implementation plan will be written only after that specification is reviewed.

> **供实施代理使用：** 必须逐任务执行、记录验证证据。此计划先于代码实施；任何涉及 VisePanda 对外事实、商业承诺、第三方账户、发布或密钥的变更，都须得到操作者另行授权。

**目标：** 构建一个仅供 VisePanda 运营者使用的 Windows 本地桌面工作台，用自有/已授权素材和抽象创作模式，生成可人工核验的来华旅行原创内容及导出版权清单。

**架构：** 新增独立 Electron 应用 `apps/media-lab`，保留 VisePanda Web、Server、Ops 和现有旅行用户数据的边界。Renderer 只负责 React 界面；main process 管理文件、SQLite、OS 安全存储、受控网络与任务调度；FFmpeg/Remotion/AI 工作在由 main 调度的受控 worker 中。核心领域逻辑位于独立 `packages/media-lab-domain`，通过 Zod schema、SQLite migration 和类型化 IPC 固化边界。

**技术栈：** Electron、React、TypeScript strict、Vite、Tailwind、shadcn/ui、SQLite、FFmpeg、Remotion、Zod、Vitest、Playwright；云端仅经可替换的 AI provider 调用阿里云百炼官方 API。

## 全局约束

- Media Lab 是内部生产工具，不是 VisePanda 对外功能、SaaS、OTA、社媒发布器或专业 NLE；不接入现有用户、Trip、Copilot 对话、伙伴、支付、遥测或生产数据库。
- 只支持 Windows 单用户。用户在 Windows 文件系统中拥有和控制原始素材；不复制“索引模式”原文件，也不修改任何原始文件。
- `owned` 与 `reference` 素材库、缓存命名空间、渲染资格和检索过滤必须分离；reference 只有在操作者明确标注为已拥有或已授权后才可作为成片资产。
- 所有旅行事实、签证/支付/医疗/紧急提示、价格、可用性与合作表述必须来自人工确认的本地 Evidence Pack；模型输出和参考内容只能生成草稿，不能成为事实来源。
- 参考内容只可提取抽象模式。最终脚本必须保留来源排除、改写约束和人工事实核验状态；不自动抓取、登录、发布、排期或访问社媒账户。
- Renderer 必须启用 `contextIsolation`、禁用 `nodeIntegration`，仅使用最小、冻结、类型安全的 preload API；所有 IPC 输入、文件路径和 job payload 在 main process 以 Zod 验证。
- API key 仅由 main 使用系统安全存储保存；不得进入 renderer、SQLite、日志、导出包、环境示例之外的项目文件或错误消息。
- SQLite schema 只经编号 migration 前进；任务与导出写入使用原子文件替换；AI、FFmpeg、渲染任务均支持取消、有限重试和重启恢复。
- 默认低成本模型、关键帧/压缩音频优先、按内容哈希和分析版本缓存、项目成本可见；MVP 不调用生成式视频、声音克隆、数字人或本地模型。
- 本计划不授权 Git、部署、数据库实例、云控制台、签名证书、API key 配置或社媒发布操作。

## 当前事实、范围调整与验收口径

本地工作区目前只有 `docs/superpowers/specs/2026-08-11-vp-media-lab-design.md`，未检出应用代码；现有 VisePanda 主线的公开交接快照是 Web Phase 0 的生产加固和商业安全。因此本计划把 Media Lab 作为隔离的内部运营能力：它帮助生产经人工审核的、面向“外国人在中国真实执行旅行”的内容，不改变 Web MVP 的产品承诺或 Phase 触发条件。

首次实施前，负责人必须重新核验 main 的 workspace 清单、包管理器版本、现有 `packages/domain` 依赖规则和文档 manifest。若 `apps/media-lab` 与现有 workspace 约定冲突，停止在接口边界，提交架构决定；不得为方便而改写 Web/Server/Ops 的现有契约。

**本计划成功的证明：** 每阶段有可启动的应用或 CLI 验收路径、对应 Vitest/Playwright 测试、实际命令输出、无原文件写入证据，以及清楚说明的未运行外部验证。最终 MVP 还须逐条满足设计规格的八项验收标准。

**回滚：** 每个阶段独立开关或独立迁移；失效时禁用对应 IPC 命令和 worker，并保留原始素材与数据库。缓存、代理、临时输出可清理；已导出的文件和 append-only migration 不被自动删除或回写。

## 冻结目录与进程边界

```text
apps/media-lab/
  package.json                     Electron/Vite/Remotion scripts
  electron-builder.yml             Windows installer and updater configuration
  src/main/
    bootstrap.ts                   BrowserWindow and lifecycle only
    ipc.ts                         channel registration and Zod parsing only
    services/                      file, library, jobs, exports, settings services
    storage/                       SQLite connection, migrations, repositories
    security/                      safeStorage, CSP, path allowlists, audit-safe errors
    providers/                     Qwen implementation and mock provider
  src/preload/index.ts             frozen `window.vpMedia` bridge only
  src/worker/
    runner.ts                      process entry and cancellation protocol
    ffmpeg.ts                      probe, derivative and validation operations
    remotion.ts                    preview and final render operations
  src/renderer/
    app/                           routes: Library, Pattern, Create, ReviewExport, Settings
    features/                      UI adapters only; no Node or database imports
    lib/ipc-client.ts              typed bridge client
  tests/                           main, preload, renderer and end-to-end fixtures
packages/media-lab-domain/
  src/schema/                      Zod entities and version migrations
  src/rights/                      render-eligibility and provenance rules
  src/jobs/                        state machine and retry classification
  src/ai/                          provider-neutral request/response contracts
  src/index.ts                     public domain exports
  tests/                           pure unit tests
docs/media-lab/
  architecture.md                  approved process, storage, IPC and security contract
  evidence-pack-format.md          editorial evidence input and content-review rules
```

Do not import `apps/web`, `apps/server`, `apps/ops`, or VisePanda travel `packages/domain` from Media Lab. The only permitted future cross-boundary input is a manually exported, versioned Evidence Pack whose schema lives in `packages/media-lab-domain`; it contains source URL/issuer, capture time, confidence, expiry, owner approval and allowed claims, never credentials or user data.

### Renderer preload surface

```ts
export interface VpMediaApi {
  settings: { get(): Promise<PublicSettings>; setLibrary(input: LibraryRootInput): Promise<LibraryRoot> };
  assets: { import(input: ImportAssetsInput): Promise<LocalJob>; search(input: AssetSearchInput): Promise<AssetSearchPage>; relink(input: RelinkAssetInput): Promise<MediaAsset> };
  references: { create(input: CreateReferenceInput): Promise<ReferenceItem>; analyze(input: AnalyzeReferenceInput): Promise<LocalJob> };
  projects: { create(input: CreateProjectInput): Promise<Project>; generate(input: GenerateStoryboardInput): Promise<LocalJob> };
  jobs: { get(input: JobIdInput): Promise<LocalJob>; list(input: JobListInput): Promise<LocalJob[]>; cancel(input: JobIdInput): Promise<LocalJob>; retry(input: JobIdInput): Promise<LocalJob> };
  exports: { render(input: RenderRequestInput): Promise<RenderJob>; bundle(input: ExportBundleInput): Promise<ExportBundle> };
  events: { subscribe(listener: (event: JobProgressEvent) => void): () => void };
}
```

Each method maps to one allowlisted `vp-media:*` IPC channel. `ipc.ts` parses the matching input schema, derives allowed library/cache/output paths from stored settings, authorizes only that Windows user context, and returns a `Result<T, PublicError>` with error codes `INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN_PATH`, `REFERENCE_NOT_RENDERABLE`, `SOURCE_OFFLINE`, `BUDGET_WARNING`, `CANCELED`, `RETRYABLE_FAILURE`, or `INTERNAL`.

### Core schema and state-machine contracts

`PatternCard` and `Storyboard` have `schemaVersion` fields. Zod migrations are pure functions from the last accepted version to the current version; repository reads run migration then validate, while writes validate the current version. The current initial contracts are:

```ts
type AssetKind = 'owned' | 'reference';
type RightsStatus = 'unknown' | 'owned' | 'licensed' | 'expired' | 'restricted';
type LocalJobState = 'queued' | 'running' | 'retry_wait' | 'cancel_requested' | 'succeeded' | 'failed' | 'canceled';

interface PatternCardV1 {
  schemaVersion: 1;
  id: string; referenceItemId: string; platform: 'tiktok' | 'instagram' | 'facebook' | 'reddit' | 'other';
  audience: string; promise: string; emotionalTrigger: string; hook: { type: string; summary: string; durationMs: number };
  beats: Array<{ id: string; startMs: number; endMs: number; purpose: string; shotCategory: string; pace: 'slow' | 'medium' | 'fast' }>;
  captions: { layout: string; density: 'low' | 'medium' | 'high'; emphasis: string[] };
  cta: string; chinaTravelTransfer: string[]; replaceRequirements: string[]; originalityNotes: string[];
}
interface StoryboardV1 {
  schemaVersion: 1;
  id: string; projectId: string; evidencePackId: string | null; language: 'en' | 'zh' | 'other';
  beats: Array<{ id: string; order: number; durationMs: number; purpose: string; originalScript: string; onScreenText: string;
    sourceFactIds: string[]; candidateAssetIds: string[]; selectedAssetId: string | null; renderStatus: 'draft' | 'review_required' | 'approved' }>;
  factualReview: 'not_required' | 'required' | 'approved'; originalityReview: 'required' | 'approved' | 'rejected';
}
```

Allowed LocalJob transitions are `queued → running`, `running → succeeded|failed|retry_wait|cancel_requested`, `retry_wait → queued`, `cancel_requested → canceled`, and `failed → queued` only via explicit retry with a bounded `attempt < maxAttempts`. A completed output is first written to `<cache>/staging/<jobId>.partial`, probed/validated, then atomically renamed into its output directory. Restart recovery changes an orphaned `running` job to `retry_wait` only when its job type is idempotent; an active render with an ambiguous output is `failed` and retains diagnostics without publishing the partial file.

### SQLite migration baseline

| Migration | Tables / invariant |
| --- | --- |
| `001_core.sql` | `schema_migrations`, `library_roots`, `media_assets`, `asset_rights`, `derived_assets`, `asset_locations`; `media_assets.content_hash` is unique per library root and originals are never written. |
| `002_analysis.sql` | `scenes`, `transcript_segments`, `asset_tags`, `asset_embeddings`, `reference_items`, `pattern_cards`; reference rows have a separate cache namespace and `render_eligible=0` by default. |
| `003_projects.sql` | `evidence_packs`, `evidence_facts`, `projects`, `creative_briefs`, `storyboards`, `storyboard_beats`, `asset_candidates`, `asset_usage_history`; a public claim links to zero or more approved evidence facts. |
| `004_jobs_costs.sql` | `local_jobs`, `job_attempts`, `render_jobs`, `export_bundles`, `ai_usage_events`, `budget_settings`; every provider request has model, timing, usage, estimated cost, status and retry count. |
| `005_search.sql` | FTS tables/triggers for editable metadata and a compatible local vector index abstraction; search remains available as metadata/FTS when embedding is unavailable. |

## Delivery stages

### Stage 0 — VisePanda alignment and implementation gate

**Files:** create `docs/media-lab/architecture.md`, `docs/media-lab/evidence-pack-format.md`; register both in the repository documentation manifest if the checked-out main requires registration.

**Action:** record Media Lab as an internal, single-user content-operations application; freeze the no-integration boundary and Evidence Pack import format. The Evidence Pack must distinguish `approved_fact`, `editorial_angle`, and `claim_prohibited`; each approved fact carries source identity, observed date, expiry/review date, and human reviewer. Project generation requires an explicit `factualReview` state when copy contains factual claims.

**Tests and acceptance:** validate one Evidence Pack fixture with three approved facts and one prohibited claim; assert that prohibited claims cannot enter `StoryboardV1.sourceFactIds`. Review the plan against current Phase 0 constraints; record any cross-boundary conflict as a D2 decision rather than changing the travel product. No media, API or renderer work begins until this gate is accepted.

### Stage 1 — Secure Electron foundation, local ownership and durable jobs

**Files:** create `apps/media-lab/{package.json,electron-builder.yml}`, `src/main/{bootstrap.ts,ipc.ts}`, `src/preload/index.ts`, `src/renderer/{main.tsx,app/App.tsx,app/SettingsPage.tsx}`, `src/main/storage/{database.ts,migrations.ts,repositories.ts}`, `src/main/services/{library-service.ts,job-service.ts,settings-service.ts}`, `src/main/security/{secrets.ts,paths.ts}`, `src/worker/runner.ts`, `packages/media-lab-domain/src/{index.ts,jobs/state-machine.ts,schema/settings.ts}`, and corresponding Vitest/Playwright tests.

**Implementation steps:**

- [ ] Write failing domain tests for every allowed and prohibited LocalJob transition, including retry bound and cancel terminal state.
- [ ] Implement `transitionJob(job, event, now)` as a pure function returning a validated job or a typed transition error; run the focused Vitest suite and require it to pass.
- [ ] Create migration runner which starts an immediate SQLite transaction, records each applied numeric migration, and rejects a changed checksum for an existing migration.
- [ ] Implement a main-owned `Database` service in WAL mode with foreign keys enabled and repositories for library roots and jobs; run a temp-directory restart test that proves migrations apply once and queued jobs persist.
- [ ] Create `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, a preload-only bridge, local CSP, and navigation/window-open deny handlers; test that renderer bundle has no `fs`, `child_process`, SQLite or provider imports.
- [ ] Implement `safeStorage` backed `SecretStore`; Settings UI can report `configured: boolean` and request a main-owned save/delete action but never read the key value. Test preload API has no secret getter and SQLite/log fixtures contain no supplied key text.
- [ ] Implement library root selection, write permission probe, managed-copy root selection, deterministic cache root, and an append-only job repository. A selected source root must be canonicalized and rejected if it is inside cache or output roots.
- [ ] Implement worker launch, cooperative cancellation message, job progress event, bounded retry classification, and startup reconciliation according to the frozen state machine.

**Stage acceptance:** `pnpm --filter @visepanda/media-lab test`, `pnpm --filter @visepanda/media-lab typecheck`, and `pnpm --filter @visepanda/media-lab build` pass. Playwright launches the Windows dev application, selects a fixture folder, queues a no-op index job, restarts the app, observes the job and cancels it. A before/after SHA-256 of a fixture source file is equal.

### Stage 2 — Media ingest, derivatives and asset library

**Files:** create `src/worker/{ffmpeg.ts,hash.ts,derivatives.ts,indexer.ts}`, `src/main/services/asset-service.ts`, renderer `LibraryPage.tsx`, and migrations `001_core.sql`; add domain asset/rights schemas and fixtures for video, image, audio, duplicate and missing files.

**Implementation steps:**

- [ ] Define `MediaAsset`, `AssetRights`, `Scene`, `TranscriptSegment`, derived-asset and file-location Zod schemas; test invalid type, expired rights and malformed local paths are rejected.
- [ ] Implement streaming SHA-256 hashing and idempotent asset upsert keyed by root and content hash; test duplicate import gives one asset with two observed locations, not two owned assets.
- [ ] Wrap bundled FFmpeg/ffprobe in an argument-array API without shell interpolation; implement probe, thumbnail, proxy, waveform and representative-keyframe jobs that only write to cache staging paths.
- [ ] Validate media derivative output with ffprobe before atomic move. Test failed ffmpeg exits leave no publishable cache artifact and emit a retryable/non-retryable diagnostic correctly.
- [ ] Implement moved/offline detection on explicit scan and `relink` by hash plus operator-selected path; test relinking preserves tags, rights, analysis and usage history.
- [ ] Implement Library tabs with hard filters `assetKind=owned|reference`, preview, search, tags and rights display. The render-candidate query must require `assetKind=owned` and an unexpired `owned|licensed` rights status.

**Stage acceptance:** importing a fixture folder creates metadata and derivatives; a duplicate is detected; deleting then relinking a source retains its ID; image/audio/video previews work; no fixture original has a changed SHA-256; renderer tests prove a reference asset cannot appear in the owned candidate results.

### Stage 3 — Provider boundary, cost ledger and owned-asset analysis

**Files:** create `packages/media-lab-domain/src/ai/{contracts.ts,usage.ts}`, `apps/media-lab/src/main/providers/{provider.ts,qwen-provider.ts,mock-provider.ts,costing.ts}`, analysis workers, migration `004_jobs_costs.sql`, and Settings cost UI.

**Implementation steps:**

- [ ] Define `AiProvider` methods `analyzeFrames`, `generateStructured`, `transcribe`, `embed`, and `synthesizeSpeech`, each accepting validated, bounded local derivative inputs and returning typed results plus usage metadata.
- [ ] Create `MockAiProvider` deterministic fixtures; all renderer/main integration tests use it and make no network call.
- [ ] Implement Qwen provider only in main process: `qwen3-vl-flash` for compressed keyframes, `qwen-flash` for structured text, `qwen3-asr-flash` for segmented speech, provider-selected official embedding, optional official TTS. Model IDs, limits and endpoint configuration live in one validated config module.
- [ ] Record an `AiUsageEvent` in the same transaction as its terminal analysis result, including provider/model, project or asset linkage, latency, input/output units, estimated cost, status and retry count; redact all request payloads and credentials.
- [ ] Cache analysis by `content_hash + derivative_version + analysis_schema_version + provider_config_version`; test a repeat analysis produces no new provider call or cost event.
- [ ] Enforce per-job output limits, project total cost aggregation and a monthly warning. A warning blocks automatic follow-on generation but allows the operator’s explicit high-quality retry after confirmation.

**Stage acceptance:** mock analysis creates scenes/tags/transcript plus usage records; repeat is a cache hit; error, timeout and cancellation create truthful terminal states; cost UI shows project total and monthly warning; a repository scan proves no provider SDK import exists outside `src/main/providers`.

### Stage 4 — Reference intelligence and editable Pattern Cards

**Files:** create Pattern Card schema/migrations in `packages/media-lab-domain`, `src/main/services/reference-service.ts`, `src/renderer/app/PatternAnalysisPage.tsx`, migration `002_analysis.sql`, Pattern Card fixtures and provider structured-output tests.

**Implementation steps:**

- [ ] Implement `PatternCardV1Schema` and pure migration registry; test current validation, unknown version rejection and a defined v1 persistence round-trip.
- [ ] Ingest reference videos/images/screenshots/text/URL metadata as `ReferenceItem`; URL metadata is descriptive input only and never triggers browser navigation or retrieval.
- [ ] Analyze a bounded set of reference keyframes/transcript/text into hook, audience, promise, beats, shot taxonomy, pacing, caption traits, CTA, China-travel transfer ideas and explicit replacement requirements.
- [ ] Store raw reference files and derived data in reference-only namespaces. On every render candidate query, enforce that source ID cannot be a reference unless explicit `rightsStatus` changed by the operator to `owned|licensed` with provenance note.
- [ ] Implement Pattern Analysis UI with editable values, source labels, originality constraints and “Create from this pattern” action. Add a textual-similarity warning that marks output for review rather than declaring infringement or clearance.

**Stage acceptance:** a fixture reference yields a valid editable Pattern Card; a reference identifier is rejected by final-render validation; editing then reopening preserves schema version and replacement requirements; no automated scrape, remote page load or social account action exists.

### Stage 5 — Evidence-aware creation, semantic retrieval and storyboard

**Files:** create `CreativeBrief`, `Storyboard`, `StoryboardBeat`, `AssetCandidate`, Evidence Pack schemas; services `project-service.ts`, `retrieval-service.ts`, `storyboard-service.ts`; Create UI; migrations `003_projects.sql` and `005_search.sql`.

**Implementation steps:**

- [ ] Implement current `StoryboardV1Schema`, pure version migration registry, and rights/originality/factual-review validators; tests must reject selected reference assets, claims without approved evidence and a beat without a valid duration/order.
- [ ] Import local Evidence Packs; surface source, review status and expiry in Create. Expired or prohibited facts are unavailable to generation and export.
- [ ] Generate 2–3 original angles using a Pattern Card’s abstract fields plus the selected Evidence Pack. The provider prompt includes replacement requirements and prohibits copying source wording, named examples, images and facts not supplied as approved evidence.
- [ ] Generate a timed storyboard, rank only render-eligible owned assets using metadata/FTS/embedding retrieval, and store candidates with rationale and search version. Provide deterministic metadata/FTS fallback if embeddings are unavailable.
- [ ] Implement Create UI for platform, duration, language, narration, caption preset and music mood; display every beat’s factual/originality review state and ranked asset candidates.

**Stage acceptance:** natural-language query finds a fixture “metro entrance at night” shot; each generated beat has candidates from owned assets only; factual claims show evidence links/review status; creation with no Evidence Pack yields a clearly labelled non-factual editorial draft and cannot export as fact-checked content.

### Stage 6 — Remotion preview, FFmpeg render and validation

**Files:** create `src/renderer/remotion/*`, `src/worker/{remotion.ts,render-validation.ts}`, `src/main/services/render-service.ts`, `RenderJob` schemas/repositories and vertical fixture compositions.

**Implementation steps:**

- [ ] Define platform presets for TikTok, Instagram, Facebook and Reddit with explicit dimensions, safe areas and copy-bundle requirements; test every composition receives a known preset.
- [ ] Build a constrained Remotion composition from approved Storyboard beats, captions, licensed music assets, simple transitions and optional provider TTS; reject TTS if operator has not enabled it.
- [ ] Render preview and final jobs through the persistent queue; use FFmpeg for mix/encode and validate dimensions, duration, codec, audio presence, source availability and subtitle safe-area bounds before atomic publish.
- [ ] Use the same rights validator at preview and final-render entry points. A missing, offline, expired or reference-only selected asset returns a truthful failure and no final output.
- [ ] Persist RenderJob inputs, output hash, validation summary and selected asset usage history.

**Stage acceptance:** a fixture Storyboard produces one playable vertical MP4 with captions and licensed fixture music; validation rejects subtitle overflow and a reference selection; job cancellation removes staged output; rerender with unchanged inputs reuses safe cache when available.

### Stage 7 — Lightweight review and export bundle

**Files:** create `ReviewExportPage.tsx`, timeline feature components, `export-service.ts`, `ExportBundle` schemas/repository, export manifest generator and rights/copy fixtures.

**Implementation steps:**

- [ ] Implement only trim, reorder, replace, caption/text edit, music/volume change, caption preset swap and single-beat regeneration. Represent every edit as a validated Storyboard revision; do not add freeform tracks, keyframes or professional-editor controls.
- [ ] Require review acknowledgement before export: rights are current, factual claims are reviewed, originality warning resolved or explicitly accepted, and all selected assets remain render-eligible.
- [ ] Export MP4, cover image, optional subtitle/caption file, platform-specific title/body/CTA/hashtags, Reddit title/body, and a rights manifest that lists every asset ID, original path/reference, rights status, territory, platform permission, expiry and project use.
- [ ] Label all generated copy as operator-reviewed draft until acknowledgement; prevent external URLs/partner claims unless contained in an approved Evidence Pack and manually reviewed.

**Stage acceptance:** operator replaces a shot and edits caption text, renders a corrected version, exports a complete bundle, and verifies the manifest exactly matches stored asset usage. A stale rights expiry or unreviewed factual beat blocks export with a specific remediation message.

### Stage 8 — Windows packaging, update boundary and full acceptance

**Files:** finalize `electron-builder.yml`, installer/update modules, release checklist, `docs/media-lab/architecture.md`, and Playwright Windows smoke tests.

**Implementation steps:**

- [ ] Package a Windows installer with bundled FFmpeg and no Docker, Python, database server or manual ffmpeg prerequisite. Test installed application startup on a clean Windows test account.
- [ ] Configure an in-app update interface that only checks an operator-approved signed update channel; do not enable automatic download/install without separately authorized signing, hosting and rollback evidence.
- [ ] Run a final end-to-end fixture: owned folder ingest → natural-language search → reference Pattern Card → evidence-backed original storyboard → owned-asset matching → vertical preview → edit → export bundle → rights/cost review.
- [ ] Complete a requirement-to-evidence matrix covering all global constraints and the eight design acceptance criteria; retain command outputs, fixture hashes and known limitations in the release record.

**Stage acceptance:** installer smoke passes; the full workflow succeeds using mock provider and separately succeeds against an authorized official provider account without exposing a key; generated bundle passes validation; no original fixture hashes changed; all external actions remain operator-evidenced.

## First-stage test matrix and commands

| Check | Proof |
| --- | --- |
| Domain state machine | `pnpm --filter @visepanda/media-lab test -- state-machine` passes allowed/prohibited transition cases. |
| Migration durability | `pnpm --filter @visepanda/media-lab test -- database` passes first-start, restart and changed-checksum cases. |
| Electron isolation | `pnpm --filter @visepanda/media-lab test -- preload security` proves the bridge is frozen and does not expose Node/secrets. |
| IPC validation | `pnpm --filter @visepanda/media-lab test -- ipc` rejects malformed payload and forbidden path. |
| Durable jobs | `pnpm --filter @visepanda/media-lab test -- jobs` proves queue, cancel, retry and restart reconciliation. |
| User-visible slice | `pnpm --filter @visepanda/media-lab e2e -- --project=windows` launches Settings, selects fixture root, observes persistent job state. |
| Build quality | `pnpm --filter @visepanda/media-lab typecheck && pnpm --filter @visepanda/media-lab lint && pnpm --filter @visepanda/media-lab build` exits 0. |

The first stage is accepted only when every listed command has been run on Windows with captured result, the no-op fixture source hash is unchanged, and there are no unreviewed IPC/security failures. Failure to run a command is recorded as unverified, not treated as a pass.

## Dependencies, risks and decisions requiring operator approval

- Confirm workspace placement (`apps/media-lab` versus a separate repository) after main is checked out; the plan assumes `apps/media-lab` because this tool serves VisePanda operations, but it must remain build and runtime isolated.
- Choose and verify the official Qwen embedding model, actual pricing source, and model availability through an operator-controlled account; code contains no guessed price or live-capability claim.
- Decide signed installer/update hosting and the Windows identity under which Media Lab stores secrets and caches. These are operator-only deployment decisions.
- Approve the Evidence Pack editorial workflow and named reviewer before external-facing content exports are treated as fact-checked.
- Validate Remotion/Electron licensing and the bundled FFmpeg redistribution configuration before commercial distribution.

## Out of scope through MVP completion

No automatic scraping, platform login, publishing, scheduling, analytics ingestion, organization/accounts, billing, cloud object storage, cloud rendering, local models, generative video, face/voice cloning, digital humans, or full nonlinear editing. No modification to VisePanda Web product, Copilot contracts, Trip data, Human Task system, partner state, payment flow or production databases.

## Plan self-review

Coverage is complete for the supplied Media Lab specification: local libraries and rights (Stages 1–2), secure Electron and local jobs (Stage 1), FFmpeg/keyframes/proxies (Stage 2), provider/costs (Stage 3), Pattern Cards (Stage 4), semantic retrieval/script/storyboard (Stage 5), Remotion render (Stage 6), light review/export (Stage 7), and Windows delivery (Stage 8). The VisePanda-specific additions are the internal-tool boundary, Evidence Pack, explicit factual review, no production-data integration, and retained commercial trust constraints. The plan intentionally contains no secrets, guessed Qwen prices, unverified partner details, or external-operation instructions.

## Execution handoff

Begin only after operator confirmation. The first implementation action is Stage 0, followed by a fresh main/workspace verification and one independent review of the Electron security and VisePanda-boundary contracts before Stage 1.
