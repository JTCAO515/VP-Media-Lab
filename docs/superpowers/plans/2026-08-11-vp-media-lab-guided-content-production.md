# VP Media Lab Guided Content Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, local-first Windows application that turns VisePanda topics and authorized references into evidence-aware video, image, carousel, and text deliverables, guides a novice through every action, hands video work to Jianying, and records manual publication outcomes.

**Architecture:** Electron renderer remains sandboxed behind a frozen typed preload API. Main process owns a durable SQLite database, OS-protected secrets, authorized paths, provider calls, and persistent jobs; focused workers own FFmpeg and static rendering. The framework-independent domain package owns versioned Zod schemas, rights/evidence rules, deterministic edit application, workflow state machines, and format validators.

**Tech Stack:** Electron 43, React 18, TypeScript strict, Vite/electron-vite, Zod 3, Node built-in `node:sqlite`, FFmpeg/ffprobe, Sharp with SVG templates, Alibaba Cloud Model Studio through native `fetch`, Vitest, Testing Library, Playwright, electron-builder.

## Global Constraints

- Windows single-user desktop application; no web service, Docker, Redis, PostgreSQL, cloud object storage, or local model runtime.
- Renderer uses `contextIsolation: true`, `nodeIntegration: false`, sandboxing, local CSP, blocked navigation, and a minimal frozen preload API.
- Filesystem, SQLite, FFmpeg, API credentials, network calls, and workers are main-owned or worker-owned; every IPC input is Zod-validated.
- Original media is immutable. All caches, previews, extracted ranges, renders, and exports use separate roots and atomic staging.
- Owned and reference assets stay separate at storage, cache, search, selection, render, and export boundaries.
- AI produces schema-validated proposals and content drafts. Operator confirmation is required before project state changes and before every tutorial step completes.
- Every new project instantiates a fresh full beginner workflow through manual platform publication; no prior confirmations are reused.
- No Jianying draft manipulation, GUI automation, platform login, upload automation, publication automation, scraping, generative video, synthetic travel-scene imagery, voice cloning, or digital humans.
- Travel claims use reviewed Evidence Packs; references and model output are not evidence.
- Token Plan credentials are not application backend credentials. Only an eligible Model Studio service key is accepted through the OS-protected main-process settings flow.
- All provider calls are mockable, cost-recorded, bounded, cancellable where practical, and cached by content and analysis versions.
- Static graphics are constrained, versioned templates rather than a general graphics editor.
- Each task follows red-green-refactor, runs focused tests before broad checks, updates mapped documentation, and makes one focused commit.

## Current State and Reconciliation Rule

The repository already contains a secure Electron shell, sql.js migrations, basic asset import/deduplication, FFmpeg thumbnail generation, Pattern Card and Storyboard schemas, local draft projects, and a constrained Qwen edit provider. Four uncommitted files contain aligned experimental work for deterministic edit application and Storyboard versions. Task 1 owns those files and must finish them; no other task may discard, overwrite, or commit them first.

Rollback for every append-only migration is application-code rollback with the new tables/columns retained. Generated caches and staging outputs may be removed through application cleanup; originals, accepted Storyboard versions, handoff packages, and final outputs are never automatically deleted.

## Frozen File Structure

```text
apps/media-lab/src/
  main/
    index.ts                         lifecycle only after Task 4
    ipc/                             one channel module per feature
    providers/                       provider implementations and usage accounting
    security/                        paths and OS-protected secret store
    services/                        application orchestration
    storage/                         database, migrations, focused repositories
    worker/                          process adapters and task runners
  preload/index.ts                   frozen typed bridge
  renderer/
    app/                             shell, routes, providers
    features/                        library, pattern, create, review, guide, settings
    components/                      reusable presentation only
  shared/                            IPC schemas and serializable contracts
packages/media-lab-domain/src/
  ai/ assets/ evidence/ guide/ jobs/ rights/ schema/ validation/
apps/media-lab/tests/
  fixtures/                          small owned/reference/evidence/media fixtures
  e2e/                               Electron user-flow tests
docs/media-lab/
  architecture.md tutorials.md runbook.md acceptance.md
```

### Task 1: Durable SQLite and immutable confirmed Storyboard revisions

**Files:**
- Modify: `apps/media-lab/package.json`
- Modify: `apps/media-lab/src/main/storage/database.ts`
- Modify: `apps/media-lab/src/main/storage/migrations.ts`
- Modify: `apps/media-lab/src/main/storage/project-repository.ts`
- Modify: `packages/media-lab-domain/src/schema/content.ts`
- Modify: `packages/media-lab-domain/src/schema/edit-proposal.ts`
- Modify: `apps/media-lab/tests/database.test.ts`
- Modify: `apps/media-lab/tests/edit-proposal.test.ts`
- Modify: `apps/media-lab/src/shared/contracts.ts`
- Modify: `apps/media-lab/src/preload/index.ts`
- Modify: `apps/media-lab/src/main/index.ts`

**Interfaces:**
- Produces: `MediaLabDatabase.transaction<T>(work: () => T): T`, `applyConfirmedEditProposal(database, input)`, `restoreStoryboardVersion(database, input)`, and IPC methods `chat.confirm` and `projects.restoreVersion`.
- Guarantees: committed writes survive process termination; every confirmed proposal creates a version; previous versions remain readable; applying a proposal is idempotent by proposal ID.

- [x] **Step 1: Run the existing red tests and record the intended failure**

Run: `npm.cmd --prefix apps\media-lab run test -- edit-proposal database`

Expected: edit-proposal cases pass; database suite fails because `004_storyboard_versions` and `applyConfirmedEditProposal` do not exist.

- [x] **Step 2: Add a failing restart/idempotency test**

Add to `apps/media-lab/tests/database.test.ts`:

```ts
it('does not apply one proposal twice and keeps the accepted revision after restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vp-revision-'));
  temporaryDirectories.push(directory);
  const filePath = join(directory, 'media-lab.sqlite');
  const database = await openDatabase({ filePath, migrations: mediaLabMigrations });
  createProjectWithStoryboard(database, projectFixture('Before landing'));
  const input = confirmedCaptionFixture('proposal-once', 'Set up Alipay before landing');
  expect(applyConfirmedEditProposal(database, input).revision).toBe(1);
  expect(() => applyConfirmedEditProposal(database, input)).toThrow('PROPOSAL_ALREADY_APPLIED');
  database.close();
  const reopened = await openDatabase({ filePath, migrations: mediaLabMigrations });
  expect(getProjectWithStoryboard(reopened, 'project-1')?.storyboard.beats[0].onScreenText)
    .toBe('Set up Alipay before landing');
  reopened.close();
});
```

Keep `projectFixture` and `confirmedCaptionFixture` as file-local test builders returning the exact existing project/proposal shapes.

- [x] **Step 3: Verify the new test fails for missing durable/version behavior**

Run: `npm.cmd --prefix apps\media-lab run test -- database`

Expected: FAIL before the idempotency/restart assertions complete.

- [x] **Step 4: Replace sql.js with real durable SQLite and implement revision storage**

Use Electron's bundled Node runtime and its built-in `node:sqlite` adapter; remove `sql.js` and `@types/sql.js` after the adapter tests pass. This avoids a native add-on build dependency while retaining a real file-backed SQLite connection.

Expose this database contract in `database.ts`:

```ts
export interface MediaLabDatabase {
  appliedMigrationIds(): string[];
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
  all(statement: string, parameters?: readonly SqlValue[]): DatabaseRow[];
  run(statement: string, parameters?: readonly SqlValue[]): void;
  transaction<T>(work: () => T): T;
  close(): void;
}
```

Open `node:sqlite` with `foreign_keys = ON`, `journal_mode = WAL`, and `synchronous = FULL`. Migration `004_storyboard_versions` adds `revision INTEGER NOT NULL DEFAULT 0` to `storyboards` and creates:

```sql
CREATE TABLE storyboard_versions (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  proposal_id TEXT NULL,
  schema_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, revision)
);
```

`applyConfirmedEditProposal` must validate first, insert revision zero if absent, reject an existing proposal ID, insert the resulting version, and update `storyboards` inside one transaction. `restoreStoryboardVersion` creates a new head revision containing the selected historical payload; it never deletes later history.

Migration `004b_global_proposal_ids` preserves any duplicate legacy ID in `legacy_proposal_id` and clears the duplicate active ID before the global partial unique index is created. Migration `005_pending_edit_proposals` persists the exact main-owned proposal payload, SHA-256 hash, source revision, and confirmation state. Migration `006_discarded_edit_proposals` adds terminal discard state. A proposal that finishes after its source revision changed is rejected; confirmation and discard accept only project ID, proposal ID, and expected revision. Pending and settled proposal records expire after 30 days; project switching explicitly discards the proposal currently under review.

- [x] **Step 5: Add validated confirmation IPC and renderer-facing contracts**

Add Zod IPC input schemas for proposal confirmation and restore. Preload exposes only:

```ts
chat: {
  propose(input: ChatProposeInput): Promise<PendingEditProposalView>;
  confirm(input: ChatConfirmInput): Promise<ProjectStoryboard>;
  discard(input: ChatDiscardInput): Promise<{ discarded: true }>;
};
projects: {
  create(input: ProjectCreateInput): Promise<ProjectSummary>;
  list(): Promise<ProjectSummary[]>;
  get(input: ProjectGetInput): Promise<ProjectStoryboard | null>;
  restoreVersion(input: RestoreVersionInput): Promise<ProjectStoryboard>;
};
```

- [x] **Step 6: Run focused and broad verification**

Run: `npm.cmd --prefix apps\media-lab run test -- edit-proposal database`

Expected: PASS.

Run: `npm.cmd --prefix apps\media-lab run test && npm.cmd --prefix apps\media-lab run typecheck && npm.cmd --prefix apps\media-lab run build`

Expected: all commands exit 0.

- [x] **Step 7: Commit the reconciled slice**

```powershell
git add apps/media-lab/package.json apps/media-lab/package-lock.json apps/media-lab/src/main apps/media-lab/src/preload apps/media-lab/src/shared apps/media-lab/tests/database.test.ts apps/media-lab/tests/edit-proposal.test.ts packages/media-lab-domain/src/schema
git commit -m "feat: persist confirmed storyboard revisions"
```

### Task 2: OS-protected provider configuration and truthful connection testing

**Files:**
- Create: `apps/media-lab/src/main/security/secret-store.ts`
- Create: `apps/media-lab/src/main/providers/provider-config.ts`
- Create: `apps/media-lab/src/main/ipc/settings-ipc.ts`
- Create: `apps/media-lab/tests/secret-store.test.ts`
- Create: `apps/media-lab/tests/provider-config.test.ts`
- Modify: `apps/media-lab/src/main/providers/qwen-edit-provider.ts`
- Modify: `apps/media-lab/src/main/index.ts`
- Modify: `apps/media-lab/src/shared/contracts.ts`
- Modify: `apps/media-lab/src/preload/index.ts`

**Interfaces:**
- Produces: `SecretStore.save/delete/withSecret`, `ProviderConfigSchema`, and `settings.testConnection()`.
- Guarantees: renderer never reads a secret; ciphertext is stored outside SQLite; endpoints must be HTTPS Alibaba Cloud hosts; a test call is explicit and usage-recorded.

- [ ] **Step 1: Write failing secret and endpoint tests**

```ts
it('never returns plaintext and rejects a non-Alibaba endpoint', async () => {
  const store = createMemoryBackedSecretStore(fakeSafeStorage());
  await store.save('model-studio', 'test-secret-value');
  await expect(store.withSecret('model-studio', async (value) => value.length)).resolves.toBe(17);
  expect(JSON.stringify(store.debugMetadata())).not.toContain('test-secret-value');
  expect(() => ProviderConfigSchema.parse({
    baseUrl: 'https://example.com/compatible-mode/v1', region: 'cn-beijing'
  })).toThrow();
});
```

- [ ] **Step 2: Run the tests to verify red**

Run: `npm.cmd --prefix apps\media-lab run test -- secret-store provider-config`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the bounded contracts**

Use Electron `safeStorage` through dependency injection. Store base64 ciphertext in `userData/secrets.json` using a `.partial` file and atomic rename. `withSecret` decrypts only for the callback and does not return the raw value through IPC. Validate `baseUrl` with `new URL()`, protocol `https:`, and hostname equal to `dashscope.aliyuncs.com` or ending `.maas.aliyuncs.com`.

The connection test sends one bounded `qwen-flash` request containing no project data, returns `{ ok, model, latencyMs, errorCode }`, and writes an `AiUsageEvent`; it never echoes provider response headers or request authorization.

- [ ] **Step 4: Verify focused and broad checks**

Run: `npm.cmd --prefix apps\media-lab run test -- secret-store provider-config qwen-edit-provider`

Expected: PASS.

Run: `npm.cmd --prefix apps\media-lab run typecheck && npm.cmd --prefix apps\media-lab run build`

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/media-lab/src/main/security apps/media-lab/src/main/providers apps/media-lab/src/main/ipc apps/media-lab/src/main/index.ts apps/media-lab/src/shared apps/media-lab/src/preload apps/media-lab/tests
git commit -m "feat: protect Model Studio configuration"
```

### Task 3: Versioned Guided Production Run domain and persistence

**Files:**
- Create: `packages/media-lab-domain/src/guide/schemas.ts`
- Create: `packages/media-lab-domain/src/guide/state-machine.ts`
- Create: `packages/media-lab-domain/src/guide/resolve-template.ts`
- Create: `apps/media-lab/src/main/storage/guide-repository.ts`
- Create: `apps/media-lab/tests/guide-state-machine.test.ts`
- Create: `apps/media-lab/tests/guide-repository.test.ts`
- Modify: `packages/media-lab-domain/src/index.ts`
- Modify: `apps/media-lab/src/main/storage/migrations.ts`

**Interfaces:**
- Produces: `WorkflowTemplateV1Schema`, `GuidedProductionRunV1Schema`, `transitionGuideRun(run, event)`, `resolveWorkflow(template, projectFacts)`, and `GuideRepository`.
- Guarantees: fresh run per project, one active step, automatic evidence only reaches `ready_for_confirmation`, required steps cannot skip, earlier changes invalidate descendants.

- [ ] **Step 1: Write the failing state-machine tests**

```ts
it('requires operator confirmation after automatic evidence and invalidates descendants', () => {
  const run = guideRunFixture(['brief', 'handoff', 'publish']);
  const ready = transitionGuideRun(run, { type: 'evidence_passed', stepId: 'brief', at: NOW });
  expect(ready.steps[0].state).toBe('ready_for_confirmation');
  const confirmed = transitionGuideRun(ready, { type: 'confirm', stepId: 'brief', at: NOW });
  expect(confirmed.steps[1].state).toBe('active');
  const invalidated = transitionGuideRun(confirmed, { type: 'invalidate', stepId: 'brief', at: NOW, reason: 'platform changed' });
  expect(invalidated.steps.map((step) => step.state)).toEqual(['active', 'pending', 'pending']);
});
```

Also test a second project receives a distinct run ID with all confirmations empty, a required step rejects `skip`, an optional step stores a non-empty reason, and blocked state resumes.

- [ ] **Step 2: Verify red**

Run: `npm.cmd --prefix apps\media-lab run test -- guide-state-machine guide-repository`

Expected: FAIL because guide contracts do not exist.

- [ ] **Step 3: Implement schemas and pure transitions**

Use these exact states and events:

```ts
export const GuideStepStateSchema = z.enum([
  'pending', 'active', 'ready_for_confirmation', 'completed', 'blocked', 'skipped_optional'
]);
export const GuideEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('evidence_passed'), stepId: z.string().min(1), at: IsoDateSchema }),
  z.object({ type: z.literal('confirm'), stepId: z.string().min(1), at: IsoDateSchema }),
  z.object({ type: z.literal('block'), stepId: z.string().min(1), at: IsoDateSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal('resume'), stepId: z.string().min(1), at: IsoDateSchema }),
  z.object({ type: z.literal('skip_optional'), stepId: z.string().min(1), at: IsoDateSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal('invalidate'), stepId: z.string().min(1), at: IsoDateSchema, reason: z.string().min(1) })
]);
```

Migration `005_guided_production` creates templates, runs, and append-only events. Repository transition loads the current run, applies the pure function, inserts the event, and updates the snapshot in one transaction.

- [ ] **Step 4: Verify persistence across restart**

Run: `npm.cmd --prefix apps\media-lab run test -- guide-state-machine guide-repository database`

Expected: PASS, including restart at the exact active step.

- [ ] **Step 5: Commit**

```powershell
git add packages/media-lab-domain/src/guide packages/media-lab-domain/src/index.ts apps/media-lab/src/main/storage apps/media-lab/tests/guide-*.test.ts
git commit -m "feat: add resumable production guide runs"
```

### Task 4: Split the Electron application shell and expose the persistent guide

**Files:**
- Create: `apps/media-lab/src/renderer/app/AppShell.tsx`
- Create: `apps/media-lab/src/renderer/app/navigation.ts`
- Create: `apps/media-lab/src/renderer/features/guide/GuidePanel.tsx`
- Create: `apps/media-lab/src/renderer/features/guide/GuideStepView.tsx`
- Create: `apps/media-lab/src/renderer/features/guide/GuideProgress.tsx`
- Create: `apps/media-lab/src/main/ipc/guide-ipc.ts`
- Create: `apps/media-lab/tests/guide-ui.test.tsx`
- Modify: `apps/media-lab/src/renderer/app/App.tsx`
- Modify: `apps/media-lab/src/renderer/styles.css`
- Modify: `apps/media-lab/src/shared/contracts.ts`
- Modify: `apps/media-lab/src/preload/index.ts`

**Interfaces:**
- Consumes: Task 3 guide repository and transition events.
- Produces: persistent project guide UI and `guide.getRun`, `guide.transition`, `guide.createForProject` preload methods.

- [ ] **Step 1: Add Testing Library and write a failing one-action guide test**

Install: `npm.cmd --prefix apps\media-lab install -D @testing-library/react@^16.3.0 @testing-library/user-event@^14.6.1`

```tsx
it('shows one action and requires confirmation before the next action', async () => {
  render(<GuideStepView run={twoStepRunFixture()} onEvent={onEvent} />);
  expect(screen.getByRole('heading', { name: 'Choose the target platform' })).toBeVisible();
  expect(screen.queryByText('Import clips into Jianying')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Confirm complete' }));
  expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'confirm', stepId: 'choose-platform' }));
});
```

- [ ] **Step 2: Verify red**

Run: `npm.cmd --prefix apps\media-lab run test -- guide-ui`

Expected: FAIL because the feature components do not exist.

- [ ] **Step 3: Implement the shell and guide semantics**

Split the current monolithic `App.tsx` into shell/navigation and feature entry components without changing current Library/Create behavior. Guide displays tool, instruction, why, project-specific value, expected result, recovery choices, and exactly these actions: `Confirm complete`, `I have a problem`, `Continue later`, plus `Skip optional` only for optional steps. Disable confirmation until automatic evidence is ready when a step declares `evidenceMode: automatic`.

- [ ] **Step 4: Verify UI, typecheck, and build**

Run: `npm.cmd --prefix apps\media-lab run test -- guide-ui && npm.cmd --prefix apps\media-lab run typecheck && npm.cmd --prefix apps\media-lab run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/media-lab/package.json apps/media-lab/package-lock.json apps/media-lab/src/renderer apps/media-lab/src/main/ipc apps/media-lab/src/shared apps/media-lab/src/preload apps/media-lab/tests/guide-ui.test.tsx
git commit -m "feat: add persistent beginner production guide"
```

### Task 5: Recoverable local job queue

**Files:**
- Create: `apps/media-lab/src/main/storage/job-repository.ts`
- Create: `apps/media-lab/src/main/services/job-service.ts`
- Create: `apps/media-lab/src/main/worker/runner.ts`
- Create: `apps/media-lab/tests/job-repository.test.ts`
- Modify: `packages/media-lab-domain/src/jobs/state-machine.ts`
- Modify: `apps/media-lab/src/main/storage/migrations.ts`

**Interfaces:**
- Produces: `JobService.enqueue/cancel/retry/reconcile/subscribe` and registered handlers receiving `{ signal, reportProgress }`.
- Guarantees: bounded retries, cooperative cancellation, atomic claim, restart reconciliation, terminal diagnostics.

- [ ] **Step 1: Write a failing restart/cancel test**

```ts
it('recovers processing jobs and honors cancellation without publishing output', () => {
  const repository = openJobFixtureDatabase();
  repository.insert(jobFixture({ state: 'processing', attempt: 1 }));
  reconcileInterruptedJobs(repository, NOW);
  expect(repository.get('job-1')?.state).toBe('queued');
  expect(transitionJob(repository.get('job-1')!, { type: 'cancel', at: NOW }).state).toBe('canceled');
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- job-repository state-machine`

Implement migration `006_local_jobs_v2` with payload, progress, attempt, max attempts, timestamps, cancel flag, error code, and unique dedupe key. Use a single main-process polling scheduler; workers never mutate SQLite.

Run green: `npm.cmd --prefix apps\media-lab run test -- job-repository state-machine`

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add apps/media-lab/src/main/storage apps/media-lab/src/main/services apps/media-lab/src/main/worker/runner.ts apps/media-lab/tests/job-repository.test.ts packages/media-lab-domain/src/jobs
git commit -m "feat: add recoverable local job queue"
```

### Task 6: Rights-aware library, folder indexing, and relinking

**Files:**
- Create: `packages/media-lab-domain/src/assets/schemas.ts`
- Create: `packages/media-lab-domain/src/rights/schemas.ts`
- Create: `apps/media-lab/src/main/services/library-service.ts`
- Create: `apps/media-lab/src/main/ipc/library-ipc.ts`
- Create: `apps/media-lab/src/renderer/features/library/LibraryPage.tsx`
- Create: `apps/media-lab/tests/library-service.test.ts`
- Modify: `apps/media-lab/src/main/storage/asset-repository.ts`
- Modify: `apps/media-lab/src/main/storage/migrations.ts`

**Interfaces:**
- Produces: `MediaAsset`, `AssetLocation`, `AssetRights`, `LibraryService.indexRoot/reconcile/relink/searchMetadata`.
- Guarantees: content hash identity, multiple locations, no original writes, owned/reference query separation, explicit reclassification provenance.

- [ ] **Step 1: Write failing folder reconciliation tests**

```ts
it('marks a moved file missing and relinks it by hash without losing rights', async () => {
  const fixture = await createOwnedMediaFixture();
  const asset = await service.indexFile(fixture.originalPath, ownedRightsFixture());
  await fixture.moveTo(fixture.movedPath);
  await service.reconcile(asset.id);
  expect(service.get(asset.id).availability).toBe('missing');
  await service.relink(asset.id, fixture.movedPath);
  expect(service.get(asset.id)).toMatchObject({ availability: 'available', rightsStatus: 'owned' });
  expect(await fixture.originalHash()).toBe(fixture.currentHash);
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- library-service asset-catalog path-boundary`

Implement migrations for library roots, asset locations, full rights fields, tags, usage, and reclassification audit. Canonicalize every selected path and reject source roots inside cache/output roots. Index streaming hashes and never call write APIs on a source path.

Run green: `npm.cmd --prefix apps\media-lab run test -- library-service asset-catalog path-boundary`

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add packages/media-lab-domain/src/assets packages/media-lab-domain/src/rights packages/media-lab-domain/src/index.ts apps/media-lab/src/main/services/library-service.ts apps/media-lab/src/main/ipc/library-ipc.ts apps/media-lab/src/main/storage apps/media-lab/src/renderer/features/library apps/media-lab/tests/library-service.test.ts
git commit -m "feat: complete rights-aware local library"
```

### Task 7: FFmpeg media derivatives, scene ranges, and immutable source proof

**Files:**
- Create: `apps/media-lab/src/main/worker/ffprobe.ts`
- Create: `apps/media-lab/src/main/worker/derivatives.ts`
- Create: `apps/media-lab/src/main/worker/scene-detection.ts`
- Create: `apps/media-lab/src/main/storage/scene-repository.ts`
- Create: `apps/media-lab/tests/derivatives.test.ts`
- Modify: `apps/media-lab/src/main/worker/ffmpeg.ts`

**Interfaces:**
- Produces: `probeMedia`, `createThumbnail`, `createProxy`, `createWaveform`, `extractKeyframes`, `detectScenes`, and `extractSourceRange`.
- Guarantees: argument-array spawn, abort signal, staged output, ffprobe validation, atomic publish, unchanged source hash.

- [ ] **Step 1: Write failing real-media tests**

```ts
it('creates validated derivatives and leaves the source byte-identical', async () => {
  const source = await createFiveSecondVideoFixture();
  const before = await sha256File(source.path);
  const result = await createDerivatives({ sourcePath: source.path, cacheRoot: source.cacheRoot, signal: AbortSignal.timeout(30_000) });
  expect(result.keyframes.length).toBeGreaterThan(1);
  expect((await probeMedia(result.proxyPath)).durationMs).toBeGreaterThan(4_000);
  expect(await sha256File(source.path)).toBe(before);
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- derivatives ffmpeg`

Implement deterministic cache keys from source hash plus derivative version. Scene detection uses FFmpeg scene scores and always includes a bounded fallback scene when no cut exceeds the threshold. Validate every derived file before rename; cancellation removes only staging files.

Run green: `npm.cmd --prefix apps\media-lab run test -- derivatives ffmpeg`

Expected: PASS with real bundled FFmpeg execution.

- [ ] **Step 3: Commit**

```powershell
git add apps/media-lab/src/main/worker apps/media-lab/src/main/storage/scene-repository.ts apps/media-lab/tests/derivatives.test.ts apps/media-lab/tests/ffmpeg.test.ts
git commit -m "feat: derive searchable media scenes"
```

### Task 8: Unified AI provider, usage ledger, caching, and degraded modes

**Files:**
- Create: `packages/media-lab-domain/src/ai/contracts.ts`
- Create: `packages/media-lab-domain/src/ai/usage.ts`
- Create: `apps/media-lab/src/main/providers/ai-provider.ts`
- Create: `apps/media-lab/src/main/providers/qwen-provider.ts`
- Create: `apps/media-lab/src/main/providers/mock-provider.ts`
- Create: `apps/media-lab/src/main/storage/ai-repository.ts`
- Create: `apps/media-lab/tests/ai-provider.test.ts`
- Modify: `apps/media-lab/src/main/providers/qwen-edit-provider.ts`

**Interfaces:**
- Produces: `AiProvider.generateStructured/analyzeFrames/transcribe/embed/synthesizeGuideVoice`, `AiCallResult<T>`, usage events, and analysis cache.
- Guarantees: main-only network, bounded inputs/outputs, no full-video default upload, exact cache key, truthful failure/cost state.

- [ ] **Step 1: Write a failing cache/usage test**

```ts
it('records one provider call and reuses it for the same versioned cache key', async () => {
  const provider = new MockAiProvider();
  const first = await service.analyzeScene(sceneAnalysisFixture());
  const second = await service.analyzeScene(sceneAnalysisFixture());
  expect(second).toEqual(first);
  expect(provider.calls).toHaveLength(1);
  expect(repository.listUsage()).toHaveLength(1);
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- ai-provider model-routing qwen-edit-provider`

Implement one provider interface and fold edit proposals into `qwen-provider.ts`. Use injected `fetch`, Zod parsing, explicit timeouts, concise JSON output, and centralized model routing. Usage rows include operation, model, latency, units, estimated cost, status, retry, project/asset linkage, and cache key; raw prompts and secrets are not stored.

Run green: `npm.cmd --prefix apps\media-lab run test -- ai-provider model-routing qwen-edit-provider`

Expected: PASS without live network calls.

- [ ] **Step 3: Commit**

```powershell
git add packages/media-lab-domain/src/ai packages/media-lab-domain/src/index.ts apps/media-lab/src/main/providers apps/media-lab/src/main/storage/ai-repository.ts apps/media-lab/tests/ai-provider.test.ts apps/media-lab/tests/qwen-edit-provider.test.ts
git commit -m "feat: unify AI routing and cost accounting"
```

### Task 9: Scene analysis and semantic retrieval with truthful fallback

**Files:**
- Create: `apps/media-lab/src/main/services/analysis-service.ts`
- Create: `apps/media-lab/src/main/services/retrieval-service.ts`
- Create: `apps/media-lab/src/main/storage/search-repository.ts`
- Create: `apps/media-lab/tests/retrieval-service.test.ts`
- Modify: `apps/media-lab/src/main/storage/migrations.ts`

**Interfaces:**
- Produces: `AnalysisService.analyzeAsset`, `RetrievalService.search(query, filters)`, and ranked `AssetCandidate` records.
- Guarantees: compressed derivative inputs, eligible-asset filtering before ranking, metadata/FTS fallback, ranking mode disclosed.

- [ ] **Step 1: Write the failing retrieval acceptance test**

```ts
it('finds an owned metro entrance scene and never returns the similar reference scene', async () => {
  await fixtures.insertOwnedScene('owned-metro', 'foreign visitor entering a metro station at night');
  await fixtures.insertReferenceScene('reference-metro', 'foreign visitor entering a metro station at night');
  const result = await service.search('foreign visitor entering a metro station at night', { renderEligibleOnly: true });
  expect(result.items[0].sceneId).toBe('owned-metro');
  expect(result.items.some((item) => item.sceneId === 'reference-metro')).toBe(false);
  expect(['embedding', 'fts']).toContain(result.mode);
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- retrieval-service`

Implement normalized metadata, transcript FTS5, embeddings stored as versioned float arrays, cosine ranking in the application layer for the single-user MVP, and FTS fallback when embeddings/provider are unavailable. Apply rights/availability filters in SQL before semantic ranking.

Run green: `npm.cmd --prefix apps\media-lab run test -- retrieval-service`

Expected: PASS for both embedding and forced-fallback cases.

- [ ] **Step 3: Commit**

```powershell
git add apps/media-lab/src/main/services/analysis-service.ts apps/media-lab/src/main/services/retrieval-service.ts apps/media-lab/src/main/storage/search-repository.ts apps/media-lab/src/main/storage/migrations.ts apps/media-lab/tests/retrieval-service.test.ts
git commit -m "feat: add scene-level semantic retrieval"
```

### Task 10: Reference Patterns and reviewed Evidence Packs

**Files:**
- Create: `packages/media-lab-domain/src/evidence/schemas.ts`
- Create: `packages/media-lab-domain/src/evidence/validation.ts`
- Create: `apps/media-lab/src/main/services/reference-service.ts`
- Create: `apps/media-lab/src/main/services/evidence-service.ts`
- Create: `apps/media-lab/src/renderer/features/pattern/PatternAnalysisPage.tsx`
- Create: `apps/media-lab/tests/reference-evidence.test.ts`
- Modify: `packages/media-lab-domain/src/schema/content.ts`

**Interfaces:**
- Produces: cross-format `PatternCardV2`, `EvidencePackV1`, and `validateClaimsAgainstEvidence`.
- Guarantees: references remain output-ineligible; prohibited/expired claims cannot enter approved content; Pattern Card contains replacement/originality requirements.

- [ ] **Step 1: Write failing rights/evidence tests**

```ts
it('accepts an abstract reference pattern but rejects its unsupported payment claim', () => {
  const pattern = PatternCardV2Schema.parse(patternFixture());
  expect(pattern.replaceRequirements.length).toBeGreaterThan(0);
  expect(() => validateClaimsAgainstEvidence([
    { id: 'claim-1', text: 'Every foreign card always works', evidenceId: null }
  ], evidencePackFixture())).toThrow('UNSUPPORTED_CLAIM');
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- reference-evidence content-schema`

Pattern V2 adds applicable deliverable types, visual hierarchy, text-density, carousel progression, and copy traits while retaining video beats. Evidence claims contain status, source title/URL, observed/review/expiry dates, reviewer, and risk category. Provide explicit V1-to-V2 migration.

Run green: `npm.cmd --prefix apps\media-lab run test -- reference-evidence content-schema`

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add packages/media-lab-domain/src/evidence packages/media-lab-domain/src/schema/content.ts packages/media-lab-domain/src/index.ts apps/media-lab/src/main/services/reference-service.ts apps/media-lab/src/main/services/evidence-service.ts apps/media-lab/src/renderer/features/pattern apps/media-lab/tests/reference-evidence.test.ts
git commit -m "feat: add evidence-aware reference patterns"
```

### Task 11: Campaign, Copy Deck, Image Composition, Carousel, and Storyboard schemas

**Files:**
- Create: `packages/media-lab-domain/src/schema/campaign.ts`
- Create: `packages/media-lab-domain/src/schema/copy-deck.ts`
- Create: `packages/media-lab-domain/src/schema/image-composition.ts`
- Create: `packages/media-lab-domain/src/validation/platform-presets.ts`
- Create: `apps/media-lab/tests/campaign-schema.test.ts`
- Modify: `packages/media-lab-domain/src/schema/content.ts`

**Interfaces:**
- Produces: `CampaignV1`, `ContentPlanV1`, `ContentDeliverableV1`, `CopyDeckV1`, `ImageCompositionV1`, `CarouselV1`, and exact platform presets.
- Guarantees: one shared claim set; format-specific validation; 2–10 carousel slides; image elements reference eligible assets; text fields carry evidence/review status.

- [ ] **Step 1: Write failing cross-format schema tests**

```ts
it('validates one campaign with video, image, carousel, and copy deliverables', () => {
  const campaign = CampaignV1Schema.parse(fullCampaignFixture());
  expect(campaign.deliverables.map((item) => item.type)).toEqual([
    'video', 'image_post', 'carousel', 'text_post'
  ]);
});

it('rejects a carousel with eleven slides and unsupported text on an image', () => {
  expect(() => CampaignV1Schema.parse(overlongCarouselFixture())).toThrow();
  expect(() => validateCampaignClaims(unsupportedImageClaimFixture(), evidencePackFixture()))
    .toThrow('UNSUPPORTED_CLAIM');
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- campaign-schema content-schema`

Use discriminated unions for deliverable types. Platform presets define exact dimensions, max text fields, safe-area percentages, image count, and required alt/disclosure fields. Keep Storyboard video-specific under the campaign rather than weakening it into a generic document.

Run green: `npm.cmd --prefix apps\media-lab run test -- campaign-schema content-schema`

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add packages/media-lab-domain/src/schema packages/media-lab-domain/src/validation packages/media-lab-domain/src/index.ts apps/media-lab/tests/campaign-schema.test.ts apps/media-lab/tests/content-schema.test.ts
git commit -m "feat: define cross-format campaign schemas"
```

### Task 12: Evidence-aware campaign generation and cross-format Chatbot revisions

**Files:**
- Create: `apps/media-lab/src/main/services/campaign-service.ts`
- Create: `packages/media-lab-domain/src/schema/campaign-edit-proposal.ts`
- Create: `apps/media-lab/src/main/storage/campaign-repository.ts`
- Create: `apps/media-lab/src/main/ipc/campaign-ipc.ts`
- Create: `apps/media-lab/tests/campaign-service.test.ts`
- Modify: `apps/media-lab/src/main/providers/qwen-provider.ts`

**Interfaces:**
- Produces: `CampaignService.createAngles/generate/proposeEdit/confirmEdit/restoreRevision`.
- Guarantees: two or three original angles, eligible visual candidates, generated replacement patches for regeneration, immutable campaign revisions, no direct AI mutation.

- [ ] **Step 1: Write a failing deterministic mock-provider flow**

```ts
it('generates four coherent deliverables and applies a confirmed carousel rewrite only once', async () => {
  const campaign = await service.generate(fullBriefFixture(), new MockAiProvider());
  expect(campaign.deliverables).toHaveLength(4);
  const proposal = await service.proposeEdit(campaign.id, 'Make this a six-slide payment checklist');
  expect(proposal.operations[0]).toMatchObject({ type: 'replace_carousel', slideCount: 6 });
  const revised = service.confirmEdit(campaign.id, proposal.id);
  expect(revised.revision).toBe(1);
  expect(() => service.confirmEdit(campaign.id, proposal.id)).toThrow('PROPOSAL_ALREADY_APPLIED');
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- campaign-service`

Generate angles first, then generate the selected campaign as separate bounded structured calls for Content Plan, format deliverables, and retrieval queries. A regenerate operation contains the complete replacement object; instructions without a replacement patch remain non-applicable. Validate rights/evidence before storing any proposal.

Run green: `npm.cmd --prefix apps\media-lab run test -- campaign-service edit-proposal ai-provider`

Expected: PASS using only the mock provider.

- [ ] **Step 3: Commit**

```powershell
git add apps/media-lab/src/main/services/campaign-service.ts apps/media-lab/src/main/storage/campaign-repository.ts apps/media-lab/src/main/ipc/campaign-ipc.ts apps/media-lab/src/main/providers/qwen-provider.ts packages/media-lab-domain/src/schema/campaign-edit-proposal.ts packages/media-lab-domain/src/index.ts apps/media-lab/tests/campaign-service.test.ts
git commit -m "feat: generate revisioned content campaigns"
```

### Task 13: Deterministic static image and carousel rendering plus copy validation

**Files:**
- Create: `apps/media-lab/src/main/worker/static-renderer.ts`
- Create: `apps/media-lab/src/main/worker/templates/visepanda-red-gold.ts`
- Create: `packages/media-lab-domain/src/validation/copy-validation.ts`
- Create: `apps/media-lab/src/renderer/features/create/ImageComposer.tsx`
- Create: `apps/media-lab/src/renderer/features/create/CopyEditor.tsx`
- Create: `apps/media-lab/tests/static-renderer.test.ts`
- Create: `apps/media-lab/tests/copy-validation.test.ts`
- Modify: `apps/media-lab/package.json`

**Interfaces:**
- Produces: `renderImageComposition`, `renderCarousel`, `validateCopyDeck`, and matching preview/final composition inputs.
- Guarantees: exact dimensions, bundled fonts, no overflow, contrast gate, atomic PNG/JPEG output, no reference imagery.

- [ ] **Step 1: Install Sharp and write failing output tests**

Install: `npm.cmd --prefix apps\media-lab install sharp@^0.34.3`

```ts
it('renders a 1080x1350 owned-image post and rejects overflowing copy', async () => {
  const output = await renderImageComposition(imageCompositionFixture(), renderContextFixture());
  const metadata = await sharp(output.path).metadata();
  expect([metadata.width, metadata.height]).toEqual([1080, 1350]);
  await expect(renderImageComposition(overflowCompositionFixture(), renderContextFixture()))
    .rejects.toThrow('TEXT_OVERFLOW');
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- static-renderer copy-validation`

Render a versioned SVG template with escaped text and bundled fonts, composite owned/licensed images through Sharp, measure text against template boxes before rasterization, calculate WCAG-style contrast, write to staging, reopen/validate metadata, hash, and rename. Copy validation returns field-specific errors for length, missing alt text/disclosure, unsupported claims, and reference similarity review.

Run green: `npm.cmd --prefix apps\media-lab run test -- static-renderer copy-validation`

Expected: PASS and fixture PNGs have exact dimensions.

- [ ] **Step 3: Commit**

```powershell
git add apps/media-lab/package.json apps/media-lab/package-lock.json apps/media-lab/src/main/worker/static-renderer.ts apps/media-lab/src/main/worker/templates apps/media-lab/src/renderer/features/create packages/media-lab-domain/src/validation apps/media-lab/tests/static-renderer.test.ts apps/media-lab/tests/copy-validation.test.ts
git commit -m "feat: render branded static content"
```

### Task 14: Rough cut and atomic editor-neutral handoff package

**Files:**
- Create: `packages/media-lab-domain/src/schema/handoff.ts`
- Create: `apps/media-lab/src/main/services/preview-service.ts`
- Create: `apps/media-lab/src/main/services/handoff-service.ts`
- Create: `apps/media-lab/src/main/worker/srt.ts`
- Create: `apps/media-lab/tests/handoff-service.test.ts`
- Create: `apps/media-lab/tests/srt.test.ts`

**Interfaces:**
- Produces: `PreviewService.renderRoughCut`, `HandoffService.create`, `HandoffPackageV1`, and deterministic file naming.
- Guarantees: ordered trimmed clips, timeline-correct SRT, static/text outputs, rights manifest, checksums, readable README, staging/atomic publish.

- [ ] **Step 1: Write a failing package-content test**

```ts
it('creates a complete package whose checksums and SRT match the storyboard', async () => {
  const handoff = await service.create(approvedCampaignFixture());
  expect(await listRelativeFiles(handoff.path)).toEqual(expect.arrayContaining([
    'rough-cut.mp4', 'storyboard.json', 'edit-sheet.csv', 'captions/en.srt',
    'graphics/cover.png', 'copy/campaign-copy.md',
    'provenance/rights-manifest.csv', 'provenance/handoff-manifest.json',
    'provenance/checksums.sha256', 'README.html'
  ]));
  expect(await verifyChecksumFile(handoff.path)).toBe(true);
  expect(await readSrtEndMs(join(handoff.path, 'captions/en.srt'))).toBe(totalStoryboardDurationMs(approvedCampaignFixture().storyboard));
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- handoff-service srt`

Extract each selected source range into numbered H.264/AAC files, concatenate a low-resolution rough cut, generate SRT from cumulative beat times, copy final static outputs, write CSV/JSON/Markdown/HTML through escaped serializers, then hash every published file. Rights/evidence/missing-media validation runs before staging and again before final rename.

Run green: `npm.cmd --prefix apps\media-lab run test -- handoff-service srt`

Expected: PASS; no `.partial` folder remains.

- [ ] **Step 3: Commit**

```powershell
git add packages/media-lab-domain/src/schema/handoff.ts packages/media-lab-domain/src/index.ts apps/media-lab/src/main/services/preview-service.ts apps/media-lab/src/main/services/handoff-service.ts apps/media-lab/src/main/worker/srt.ts apps/media-lab/tests/handoff-service.test.ts apps/media-lab/tests/srt.test.ts
git commit -m "feat: export Jianying-ready content handoffs"
```

### Task 15: Full beginner tutorial templates for Media Lab, Jianying, and manual publishing

**Files:**
- Create: `apps/media-lab/src/main/tutorials/media-lab-v1.ts`
- Create: `apps/media-lab/src/main/tutorials/jianying-windows-v1.ts`
- Create: `apps/media-lab/src/main/tutorials/tiktok-web-v1.ts`
- Create: `apps/media-lab/src/main/tutorials/instagram-web-v1.ts`
- Create: `apps/media-lab/src/main/tutorials/facebook-web-v1.ts`
- Create: `apps/media-lab/src/main/tutorials/reddit-web-v1.ts`
- Create: `apps/media-lab/src/main/tutorials/registry.ts`
- Create: `apps/media-lab/tests/tutorial-templates.test.ts`
- Create: `docs/media-lab/tutorials.md`

**Interfaces:**
- Produces: versioned workflow templates resolved by platform, deliverable type, language, narration, aspect ratio, and Jianying usage.
- Guarantees: one action per step, visible-label instructions, expected result, recovery branch, observation date/version, no credentials or external automation.

- [ ] **Step 1: Write failing template completeness tests**

```ts
it.each(['tiktok', 'instagram', 'facebook', 'reddit'] as const)(
  'creates a fresh complete beginner run through manual %s publication',
  (platform) => {
    const run = resolveWorkflow(workflowRegistry(), projectFactsFixture({ platform }));
    expect(run.steps[0].tool).toBe('media_lab');
    expect(run.steps.at(-1)?.id).toBe('archive-project');
    expect(run.steps.some((step) => step.tool === platform && step.title === 'Manually publish the post')).toBe(true);
    expect(run.steps.every((step) => step.instruction.split(/[.!?]/).filter(Boolean).length <= 2)).toBe(true);
  }
);
```

Also assert every step has `why`, `expectedResult`, `troubleshooting`, `observedAt`, and no screen coordinates or credential request.

- [ ] **Step 2: Verify red, implement templates, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- tutorial-templates guide-state-machine`

Implement complete beginner phases from the approved specification. Jianying steps include project preset, numbered media import, main-track ordering, SRT import, subtitle sync/safe-area review, guide audio/music adjustment, full preview, and export. Platform steps include manual sign-in, upload/select deliverable, cover/copy/alt/disclosure, preview/settings review, manual Publish, visible result confirmation, and optional post identifier. Instructions describe outcomes and visible labels, never private coordinates.

Run green: `npm.cmd --prefix apps\media-lab run test -- tutorial-templates guide-state-machine`

Expected: PASS for video-only, image-only, carousel-only, text-only, and mixed campaigns.

- [ ] **Step 3: Commit**

```powershell
git add apps/media-lab/src/main/tutorials apps/media-lab/tests/tutorial-templates.test.ts docs/media-lab/tutorials.md
git commit -m "feat: add full beginner production tutorials"
```

### Task 16: Final-output re-import and performance observations

**Files:**
- Create: `packages/media-lab-domain/src/schema/outcome.ts`
- Create: `apps/media-lab/src/main/services/outcome-service.ts`
- Create: `apps/media-lab/src/main/storage/outcome-repository.ts`
- Create: `apps/media-lab/src/main/ipc/outcome-ipc.ts`
- Create: `apps/media-lab/tests/outcome-service.test.ts`

**Interfaces:**
- Produces: `FinalOutputV1`, `PerformanceObservationV1`, `OutcomeService.importFinal/recordPublication/recordObservation`.
- Guarantees: hash-linked local result, manually labelled platform data, no automatic causal claims or analytics retrieval.

- [ ] **Step 1: Write the failing outcome test**

```ts
it('links a final file and stores publication metrics as operator observations', async () => {
  const output = await service.importFinal({ campaignId: 'campaign-1', path: fixtureFinalVideo });
  const publication = service.recordPublication({
    campaignId: 'campaign-1', platform: 'tiktok', publishedAt: NOW,
    externalId: 'manual-post-id', confirmedByOperator: true
  });
  const observation = service.recordObservation({
    publicationId: publication.id, observedAt: NOW, views: 1200, completionRate: 0.42,
    note: 'Operator-entered after 24 hours'
  });
  expect(output.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(observation.source).toBe('operator');
});
```

- [ ] **Step 2: Verify red, implement, and verify green**

Run red: `npm.cmd --prefix apps\media-lab run test -- outcome-service`

Validate local path authorization, hash and probe final outputs, preserve the source file, store publication records only after explicit confirmation, and label all metrics `operator`. Do not add network clients for platform analytics.

Run green: `npm.cmd --prefix apps\media-lab run test -- outcome-service`

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add packages/media-lab-domain/src/schema/outcome.ts packages/media-lab-domain/src/index.ts apps/media-lab/src/main/services/outcome-service.ts apps/media-lab/src/main/storage/outcome-repository.ts apps/media-lab/src/main/ipc/outcome-ipc.ts apps/media-lab/tests/outcome-service.test.ts
git commit -m "feat: retain manual publication outcomes"
```

### Task 17: Complete user-facing workflow and Electron end-to-end acceptance

**Files:**
- Create: `apps/media-lab/src/renderer/features/create/CreateCampaignPage.tsx`
- Create: `apps/media-lab/src/renderer/features/create/StoryboardEditor.tsx`
- Create: `apps/media-lab/src/renderer/features/review/ReviewHandoffPage.tsx`
- Create: `apps/media-lab/src/renderer/features/settings/SettingsPage.tsx`
- Create: `apps/media-lab/tests/e2e/novice-production.spec.ts`
- Create: `apps/media-lab/tests/e2e/security.spec.ts`
- Modify: `apps/media-lab/src/renderer/app/AppShell.tsx`
- Modify: `apps/media-lab/src/renderer/styles.css`

**Interfaces:**
- Consumes: Tasks 1–16 preload APIs.
- Produces: complete Library → Pattern → Create → Review/Handoff → Guide → Outcome UI.

- [ ] **Step 1: Write failing Electron E2E tests with mock provider**

```ts
test('novice completes a mixed campaign without renderer Node access', async () => {
  const app = await launchMediaLab({ fixtureProfile: 'mixed-campaign' });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Create guided project' }).click();
  await completeGuideUntil(page, 'Open the handoff folder');
  await expect(page.getByText('Ready for Jianying')).toBeVisible();
  expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
  await app.close();
});
```

Add a restart test proving the exact active guide step resumes and a UI test proving references never appear in selectable output candidates.

- [ ] **Step 2: Verify red, implement pages, and verify green**

Run red: `npm.cmd --prefix apps\media-lab exec playwright test tests/e2e`

Implement accessible labels, keyboard operation, loading/error/empty/degraded states, visible AI cost and evidence/rights status, project-specific guide values, and confirmation diffs. Use no provider/file/database imports in renderer.

Run green: `npm.cmd --prefix apps\media-lab exec playwright test tests/e2e`

Expected: PASS using the deterministic mock provider and fixture files.

- [ ] **Step 3: Run full application checks**

Run: `npm.cmd --prefix apps\media-lab run lint && npm.cmd --prefix apps\media-lab run test && npm.cmd --prefix apps\media-lab run typecheck && npm.cmd --prefix apps\media-lab run build`

Expected: every command exits 0 with no warnings promoted by lint.

- [ ] **Step 4: Commit**

```powershell
git add apps/media-lab/src/renderer apps/media-lab/tests/e2e
git commit -m "feat: complete guided content production workflow"
```

### Task 18: Windows installer, clean-account smoke, real Jianying tutorial observation, and release evidence

**Files:**
- Create: `apps/media-lab/electron-builder.yml`
- Create: `apps/media-lab/src/main/services/update-service.ts`
- Create: `docs/media-lab/architecture.md`
- Create: `docs/media-lab/runbook.md`
- Create: `docs/media-lab/acceptance.md`
- Create: `docs/handoff.json`
- Create: `HANDOFF.md`
- Create: `CONTEXT.md`
- Modify: `apps/media-lab/package.json`
- Modify: `.github/workflows/ci.yml` if the repository already contains GitHub Actions; otherwise create it with Windows test/build jobs only.

**Interfaces:**
- Produces: installable Windows artifact, disabled-by-default signed-update boundary, requirement-to-evidence matrix, and takeover documentation.
- Guarantees: bundled FFmpeg/fonts/templates, no external runtime dependencies, no unsigned automatic update, no secret in artifact/log/repository.

- [ ] **Step 1: Add packaging and artifact security tests**

Create a PowerShell smoke script invoked by CI that installs into a temporary test profile, launches the app, verifies the main window and bundled FFmpeg, closes it, and checks the install/artifact strings for known fixture secrets. The script exits nonzero on any missing binary, failed launch, or secret match.

- [ ] **Step 2: Configure electron-builder and run the full automated gate**

Package x64 Windows NSIS with ASAR, bundled FFmpeg, Sharp native resources, bundled fonts, and application templates. The update service may check only an operator-configured signed channel and must not download or install automatically.

Run:

```powershell
npm.cmd --prefix apps\media-lab run lint
npm.cmd --prefix apps\media-lab run test
npm.cmd --prefix apps\media-lab run typecheck
npm.cmd --prefix apps\media-lab run build
npm.cmd --prefix apps\media-lab run dist
npm.cmd --prefix apps\media-lab exec playwright test tests/e2e
```

Expected: all commands exit 0 and the installer smoke script passes on Windows.

- [ ] **Step 3: Perform the human-observed novice acceptance**

Use one small owned-media fixture set and the mock provider first, then an explicitly authorized eligible Model Studio account. Record in `docs/media-lab/acceptance.md`:

- original before/after SHA-256 values;
- project types and generated deliverables;
- every tutorial step confirmation;
- time from approved Storyboard to active Jianying editing;
- current Jianying version and whether SRT/numbered clips imported as instructed;
- one manually published test post or a clearly recorded operator decision not to make an external test publication;
- final-output re-import and manually entered observation;
- actual test/build/package commands and outputs;
- unrun checks, residual risks, rollback, and exactly one next action.

The application is not accepted if any required external step was silently skipped or if a tutorial mismatch was worked around without recording a defect.

- [ ] **Step 4: Update handoff and commit release evidence**

`docs/handoff.json` is the source for `HANDOFF.md` and `CONTEXT.md` and records objective, spec/ADR, changed files, verification, unrun checks, blockers, risks, rollback, reading order, and one next action. Ensure the repository contains no credential value with an exact secret-pattern scan that reports only file paths and redacted match categories.

```powershell
git add apps/media-lab .github docs HANDOFF.md CONTEXT.md
git commit -m "build: package VP Media Lab for Windows"
git push origin HEAD:main
```

## Plan Self-Review

- Spec coverage maps to Tasks 1–18: durable revisions and secrets (1–2), repeated guide (3–4, 15, 17), jobs/library/media intelligence (5–9), reference/evidence (10), cross-format content (11–13), rough cut/handoff (14), outcomes (16), full UI (17), and Windows/real-editor acceptance (18).
- The current four-file experiment has one owner and an executable first red/green loop.
- Public signatures used by later tasks are introduced in earlier task interface blocks.
- Video, image, carousel, and text remain distinct schemas under one Campaign.
- External tools remain manual; acceptance distinguishes automated evidence, readiness, operator confirmation, and human observation.
- No production task uses a live provider; the only live check is explicitly authorized release acceptance.
- No step weakens rights, evidence, secret, original-file, or reference-isolation invariants.
