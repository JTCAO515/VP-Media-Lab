# VP Media Lab: AI Content Director and Jianying Handoff Workspace

- Date: 2026-08-11
- Status: Approved product direction; awaiting written-spec review
- Decision: `docs/adr/0001-media-lab-editor-handoff-boundary.md`
- Owner: VisePanda operator

## 1. Product definition

VP Media Lab is a private, single-user Windows application for producing VisePanda's inbound-China-travel social content. It is an AI content director, a rights-aware local media library, a guided production coach, and a reliable handoff workspace for Jianying/CapCut.

It turns a topic or authorized reference into an original, evidence-aware content campaign; finds the best owned or licensed video scenes and images; creates video, static-image, carousel, and text deliverables; lets the operator refine them through structured conversation; validates outputs; and exports everything needed to finish video content in Jianying and publish all selected formats manually.

The product is not a general video editor. Its differentiated value is knowing:

- which real execution problem foreign visitors to China need solved;
- which hook and narrative pattern suits that problem and platform;
- which claims require evidence or conservative wording;
- which local footage is semantically and legally eligible;
- which exact source range should support each beat;
- how one approved angle should become a coherent video, cover, carousel, and written post;
- how to transfer the plan into a mature editor with minimal repeated work.

The primary success metrics are:

1. **A reviewed project can move from an approved storyboard to active editing in Jianying within five minutes, without searching the raw library again.**
2. **A first-time editor can complete one content project and manually publish it by following one confirmed action at a time, without relying on undocumented knowledge.**

## 2. User and operating assumptions

- One VisePanda operator uses the application on Windows.
- Source media is self-created, purchased, or explicitly licensed.
- References are supplied manually as files, screenshots, text, or saved metadata; the app does not scrape social platforms.
- Local storage owns originals, indexes, caches, projects, and handoff packages.
- Cloud services are used only for bounded AI inference through official provider APIs.
- No local model or local GPU is required.
- The operator manually completes and publishes the final content.
- Jianying is the default finishing tool, but canonical project data remains editor-neutral.

## 3. Scope and anti-goals

### 3.1 Included

- Local owned/reference libraries with strict separation.
- Campaign projects containing one or more deliverables: `video`, `image_post`, `carousel`, and `text_post`.
- Folder indexing or managed-copy ingest without modifying originals.
- Hashing, deduplication, missing-file detection, relinking, derivatives, and usage history.
- FFmpeg probing, thumbnails, proxies, waveforms, scene boundaries, keyframes, and deterministic source-range extraction.
- ASR, multimodal tagging, embeddings, natural-language search, and ranked scene retrieval.
- Reference Pattern Cards that capture abstract creative structure rather than reusable source media.
- VisePanda topic briefs, approved Evidence Packs, scripts, storyboards, captions, voiceover drafts, and platform copy.
- Brand-safe static covers, single-image posts, and multi-slide carousels built from owned/licensed media and constrained layouts.
- Platform-aware short captions, long-form posts, titles, hooks, CTAs, hashtags, disclosures, alt text, and Reddit variants.
- A conversational director that proposes validated, reviewable project changes.
- Beat-level source selection, alternatives, in/out ranges, ordering, duration, captions, and editorial notes.
- A low-resolution rough-cut preview for timing and content validation.
- A Jianying-ready handoff package and editor-neutral manifest.
- Direct PNG/JPEG export for static deliverables and Markdown/TXT export plus clipboard actions for written deliverables.
- A project-specific, resumable tutorial that covers Media Lab, Jianying, manual publishing, and project closeout.
- Final-output re-import, project archive, and optional manually entered performance notes.
- AI usage and estimated cost records.

### 3.2 Explicitly excluded

- A professional or complete nonlinear editor.
- A general photo, illustration, vector, desktop-publishing, or page-layout editor.
- Real-time multi-track compositing, freeform keyframes, color grading, advanced transitions, masks, effects, or a general audio mixer.
- Editing Jianying private draft files or automating its GUI.
- Automatic social login, scraping, publishing, scheduling, or analytics collection.
- Skipping required tutorial steps automatically or representing an external manual action as verified without operator confirmation.
- Generative video, digital humans, face replacement, voice cloning, or local models.
- Synthetic travel-scene image generation in the MVP; authentic destination and execution imagery must come from owned or licensed assets.
- Teams, organizations, billing, cloud media storage, and cloud rendering.
- Direct integration with VisePanda production databases, Trip data, payments, partners, or customer conversations.

## 4. End-to-end workflow

### 4.1 Build the owned media brain

The operator indexes an existing folder or copies selected media into a managed library. Media Lab records file identity and rights, then derives previews and searchable scene-level intelligence.

Each video scene records subject, action, location, travel scenario, shot type, camera motion, visual quality, mood, time of day, transcript, keyframes, start/end time, embedding, and prior usage. Human corrections override AI labels without discarding provenance.

### 4.2 Analyze a reference pattern

The operator adds a reference video, screenshot, image, text, or article excerpt. Media Lab creates an editable Pattern Card containing:

- audience, promise, hook type, and emotional trigger;
- narrative beats and approximate timing;
- shot categories and visual progression;
- pacing, caption density, audio energy, and CTA pattern;
- transfer ideas for inbound China travel;
- originality constraints and mandatory replacements.

Reference media remains ineligible for preview and handoff. A pattern is a creative hypothesis, not evidence for travel facts.

### 4.3 Create an evidence-aware content project

The operator chooses a topic, target platforms, selected deliverable types, language, duration or slide count, audience, content goal, narration preference, and optional Pattern Card. Media Lab uses a local Evidence Pack for factual claims and produces two or three original campaign angles.

After the operator selects an angle, Media Lab creates a shared `ContentPlan` and format-specific deliverables:

- a timed video Storyboard with ranked eligible source scenes for each beat;
- an image Composition for a cover or single-image post;
- a slide-by-slide Carousel with visual hierarchy and concise copy;
- a Copy Deck containing platform-specific text, CTA, hashtags, disclosure, and alt text.

Every visual match includes the source file or scene, crop/focal guidance, visual rationale, rights status, and alternatives. All deliverables share evidence and campaign claims but may adapt hook length, wording, information density, and CTA to their platform.

### 4.3.1 Static image creation

Static output is template-based and intentionally constrained. The operator selects a VisePanda brand template, eligible hero image, aspect ratio, headline, supporting text, badge, and CTA. Media Lab provides safe crop/focal controls, text editing, palette and approved font choices, alignment, and template variants.

The image engine validates overflow, contrast, safe areas, resolution, rights, and evidence-linked claims before deterministic PNG/JPEG export. It does not expose arbitrary layers, paths, brushes, masks, filters, or freeform effects.

Supported MVP static formats are:

- cover/thumbnail;
- single social image;
- 2–10 slide carousel;
- practical China-travel checklist or comparison card;
- quote/stat card only when the quoted or numeric claim has approved evidence.

Layout generation produces a versioned `ImageComposition`, not pixels from an AI image model. Rendering uses reusable SVG/HTML-style templates with bundled fonts and a deterministic rasterization boundary.

### 4.3.2 Written content creation

The Copy workspace produces editable, evidence-aware variants from the shared campaign angle:

- hook/headline options;
- short platform caption;
- longer Facebook or Instagram body;
- Reddit title and substantive post body;
- carousel slide text;
- CTA and comment prompt;
- hashtags or topic labels;
- accessibility alt text;
- partnership/affiliate disclosure when applicable.

The operator can compare variants, accept individual fields, ask the Chatbot for a structured rewrite, and see which claims depend on evidence. Character count, forbidden unsupported claims, reference similarity, disclosure, link, and platform-field checks run before export. Copy is never published automatically.

### 4.4 Direct the content through conversation

The Chatbot behaves as an editing director, not an unrestricted agent. Example instructions include:

- "Put the payment failure in the first three seconds."
- "Keep this under 25 seconds."
- "Replace beat three with a metro entrance at night."
- "Make the English sound native to TikTok, not like a tourism brochure."
- "Use a more urgent hook without exaggerating the facts."
- "Turn this video angle into a six-slide payment checklist."
- "Make the cover headline shorter and keep the foreign card image visible."
- "Write a useful Reddit version without hashtags or promotional tone."

The provider returns a versioned `EditProposal`. Main process validation checks project revision, beat IDs, timing, asset rights, evidence, and allowed operation types. The renderer displays a human-readable diff. Only an explicit confirmation creates a new immutable Storyboard revision.

Supported project operations are intentionally constrained:

- update script, caption, CTA, or editorial note;
- update a text field, image headline, slide copy, alt text, or disclosure;
- change beat duration or source in/out range;
- reorder, add, duplicate, or remove a beat within duration limits;
- replace a selected source with an eligible candidate;
- change narration, music direction, or target duration;
- replace an image, change a constrained layout variant, reorder carousel slides, or change slide count within template limits;
- regenerate one beat as a complete proposed replacement;
- undo by activating a prior revision.

The Chatbot never edits files, executes FFmpeg, exports, opens Jianying, or publishes content directly.

### 4.5 Review a rough cut

The Review area shows a storyboard strip, source preview, captions, duration totals, evidence status, rights warnings, and candidate alternatives. It does not expose a freeform NLE timeline.

The operator can preview individual source ranges and request a low-resolution rough cut. FFmpeg assembles selected ranges, narration or guide audio, and simple subtitle overlays. The preview exists to detect poor ordering, wrong timing, missing media, and subtitle problems; it is not the polished final output.

### 4.6 Export the editor handoff

Media Lab creates an atomic, self-contained handoff folder:

```text
Project_Name/
  README.html
  rough-cut.mp4
  edit-sheet.csv
  storyboard.json
  captions/
    en.srt
    zh.srt                 optional
  audio/
    voiceover.wav          optional
    music-notes.txt
  media/
    001_hook_<asset-id>.mp4
    002_problem_<asset-id>.mp4
    003_solution_<asset-id>.mp4
  graphics/
    cover.png
    image-post.png
    carousel/
      01-cover.png
      02-problem.png
      03-solution.png
    brand-insert.mp4       optional
  copy/
    tiktok.txt
    instagram.txt
    facebook.txt
    reddit.txt
    campaign-copy.md
  provenance/
    rights-manifest.csv
    handoff-manifest.json
    checksums.sha256
```

The numbered video files are deterministic, already trimmed to approved source ranges, and retain a manifest mapping back to immutable originals. SRT files use the rough-cut timeline. Static deliverables are final-resolution exports with composition manifests. Copy files preserve field names and evidence status. `README.html` provides a human-readable assembly and publication checklist with links to local files.

The app offers **Open handoff folder** and **Copy Jianying checklist**. It does not claim one-click project creation.

### 4.7 Close the learning loop

After finishing in Jianying, the operator may re-import the final MP4. Media Lab associates it with the project, checks file integrity, stores the final hash, and records which creative angle and assets were used. The operator may manually enter platform, publication date, views, completion rate, saves, comments, and lessons.

Performance notes inform future recommendations only as labelled operator observations. They do not automatically retrain a model or turn correlation into a factual rule.

### 4.8 Follow a Guided Production Run

Every new project creates a fresh `GuidedProductionRun` from a versioned workflow template. Completion from a previous project is never copied into the new run. The MVP always uses the full beginner workflow; a compact or expert mode is deferred until the full workflow has been validated repeatedly.

The guide is the default project entry point and remains available as a persistent side panel. It shows one actionable step at a time. Each step contains:

- the tool being used: Media Lab, Windows Explorer, Jianying, TikTok, Instagram, Facebook, or Reddit;
- one concrete action using plain language;
- why the action matters;
- project-specific values such as the exact folder, filename, aspect ratio, caption file, or copy variant;
- the expected visible result;
- completion evidence and whether it can be checked locally;
- common mistakes and a short recovery path;
- optional local screenshot or note for troubleshooting;
- `Confirm complete`, `I have a problem`, and `Continue later` actions.

Automatic checks never silently complete a step. They change it from `active` to `ready_for_confirmation`; the operator still confirms completion. A required step cannot be skipped. An optional step can be skipped only with an explicit reason retained in the run history.

The run is persisted after every state change and resumes at the same step after restart. The operator can review completed steps, but changing an earlier answer invalidates dependent confirmations and clearly explains what must be checked again.

#### Beginner workflow phases

1. **Prepare** — choose topic, platforms, deliverable types, audience, language, video duration or carousel length, and owned/reference inputs.
2. **Understand** — finish local analysis, review reference Pattern Card, and verify rights/evidence warnings.
3. **Create** — choose an original campaign angle; approve relevant script, Copy Deck, image composition, carousel slides, and owned visual matches.
4. **Review** — use the Chatbot, confirm structured changes, preview source ranges, and approve the rough cut.
5. **Handoff** — generate and validate the package, open its folder, and identify the files needed in Jianying.
6. **Finish video in Jianying** — when a video deliverable is selected, create the correct project, import numbered clips, assemble the main track, import SRT, check subtitle timing and safe areas, add or adjust narration/music, perform a full preview, and export with the project preset.
7. **Validate image and text deliverables** — inspect every final-resolution image, swipe the carousel in order, verify text fit and contrast, proofread platform copy and alt text, and confirm evidence/disclosure status.
8. **Publish manually** — select the target platform, sign in independently, upload the selected video/image/carousel, add the provided cover/copy/disclosure/alt text, review the platform preview and settings, and manually press the platform's publish control.
9. **Close out** — confirm the public result, optionally record its URL or post identifier, re-import final video/image files, save operator notes, and archive the project.

The application provides instructions but never reads credentials, performs login, uploads a file, changes a platform setting, or presses Publish. The final publish step must display a last review checklist for rights, facts, affiliate disclosure, privacy, subtitles, cover, and platform choice.

#### Tutorial content and versioning

Tutorials are data, not hard-coded UI branches. A signed application release bundles versioned `WorkflowTemplate`, `GuideStep`, `TroubleshootingBranch`, and `TutorialAsset` records. Conditional steps are selected from project facts such as platform, language, narration, editor, aspect ratio, and whether a Pattern Card is used.

External interfaces change frequently. Each external step records the supported tool, tutorial revision, observation date, and applicable desktop/web version where known. Instructions rely on visible labels and expected outcomes rather than screen coordinates. If the operator selects `My screen is different`, the run records a blocked step, preserves progress, and presents a generic outcome-based fallback. Updating a tutorial template affects new runs; active runs retain their original version unless the operator explicitly migrates them.

Screenshots supplied for troubleshooting remain local and are never sent to an AI provider by default. Before attaching one, the UI warns the operator to exclude accounts, private messages, personal data, and credentials.

## 5. Information architecture

The application has four primary workspaces, a persistent Production Guide, and a Settings surface:

1. **Library** — Owned Assets and References tabs; import/index, search, filters, preview, video scenes and still images, tags, file status, rights, and prior usage.
2. **Pattern Analysis** — reference preview beside an editable Pattern Card, originality constraints, and `Create from pattern`.
3. **Create** — creative brief, evidence status, angle selection, deliverable tabs for Video, Images/Carousel, and Copy, ranked asset matches, and the conversational director.
4. **Review & Handoff** — cross-format campaign review, storyboard strip, image/slide previews, copy proofing, rough-cut validation, review gates, video editor handoff, static/text export, final-output re-import, and archive.
5. **Production Guide** — the default project view and persistent step panel spanning all internal and external phases; current instruction, expected result, confirmation, problem branch, progress, and resume state.
6. **Settings** — local roots, cache policy, eligible AI service key, endpoint/region, budget, model-quality preference, FFmpeg status, tutorial/tool versions, and privacy controls.

## 6. Canonical domain model

The domain package owns versioned Zod schemas and pure validation/migration functions.

### 6.1 Library and rights

- `MediaAsset`: immutable content identity and media metadata.
- `AssetLocation`: one or more observed local paths, availability, and relink history.
- `AssetRights`: owned/reference classification, license source, scope, platforms, territory, expiry, and notes.
- `DerivedAsset`: thumbnail, proxy, waveform, keyframe, or extracted source range with version and hash.
- `Scene`: time range and human/AI searchable description.
- `TranscriptSegment`: timestamped speech and language.
- `AssetUsage`: project, beat, source range, export, and final-output linkage.

### 6.2 Reference and editorial intelligence

- `ReferenceItem`
- `PatternCard`
- `EvidencePack`
- `EvidenceClaim`
- `CreativeBrief`
- `CreativeAngle`
- `ContentPlan`
- `ContentDeliverable`
- `CopyDeck`
- `CopyField`
- `ImageComposition`
- `ImageElement`
- `Carousel`
- `CarouselSlide`
- `BrandTemplate`

### 6.3 Project and handoff

- `Project`
- `Storyboard`
- `StoryboardBeat`
- `AssetCandidate`
- `EditProposal`
- `StoryboardRevision`
- `PreviewJob`
- `HandoffJob`
- `HandoffPackage`
- `FinalOutput`
- `PerformanceObservation`
- `WorkflowTemplate`
- `GuideStep`
- `GuidedProductionRun`
- `GuideStepState`
- `StepEvidence`
- `TroubleshootingBranch`
- `TutorialAsset`
- `ExternalToolProfile`
- `AiUsageEvent`
- `LocalJob`

Every `StoryboardBeat` contains purpose, script, on-screen text, duration, selected scene, source start/end, alternatives, source fact IDs, render/review status, and editorial notes. A selected scene is renderable only if its rights are valid at export time.

Every `CopyField`, `ImageElement`, and `CarouselSlide` identifies its platform role, character/layout constraints, source fact IDs, originality status, and review state. Text-bearing image elements are validated as content claims, not treated as decoration.

A `GuidedProductionRun` snapshots its template version and project-specific resolved parameters. Step state is one of `pending`, `active`, `ready_for_confirmation`, `completed`, `blocked`, or `skipped_optional`. Transitions are append-only events so restart, invalidation, and audit history are deterministic.

## 7. Process and security boundaries

### 7.1 Electron renderer

- React UI and local previews only.
- No Node.js, filesystem, SQLite, child process, API key, or provider access.
- `contextIsolation: true`, `nodeIntegration: false`, sandbox enabled, local CSP, and blocked navigation/new windows.
- Frozen, minimal, typed preload API.

### 7.2 Electron main process

- Validates every IPC payload with Zod.
- Owns settings, path authorization, repositories, OS secret storage, provider requests, and job scheduling.
- Returns redacted typed errors and never logs credentials or raw sensitive payloads.

### 7.3 Controlled workers

- FFmpeg/ffprobe receive argument arrays without shell interpolation.
- Workers access only authorized source and staging paths.
- Long jobs are cancellable, retryable, restart-recoverable, and persisted.
- Outputs are probed, hashed, and atomically moved from staging only after validation.

### 7.4 Original-file invariant

Original files are read-only. Thumbnails, proxies, keyframes, waveforms, extracted clips, previews, and handoffs use separate cache/output roots. Before-and-after hashes are part of media-pipeline acceptance fixtures.

## 8. AI provider and model routing

All calls pass through a single provider contract with mockable methods for structured text, vision, transcription, embedding, and optional TTS. Model IDs and endpoint configuration are centralized.

Default routing intent:

- `qwen3-vl-flash`: compressed keyframes and reference/scene understanding.
- `qwen-flash`: hooks, scripts, captions, Pattern Cards, Edit Proposals, and platform copy.
- `qwen3-asr-flash`: timestamped transcription.
- official Qwen embedding: semantic scene retrieval.
- official Qwen TTS: optional guide narration only.

Token Plan credentials are not treated as application backend credentials. The user configures an eligible Model Studio service key through the OS-protected Settings flow. No supplied key value is committed, logged, displayed, or embedded in the renderer.

Cost controls include derivative-first analysis, scene sampling, compressed uploads, hash/version caches, bounded structured output, low-cost defaults, explicit high-quality retry, per-project estimates, and monthly warnings. Generative video is prohibited.

## 9. Rights, originality, and factual trust

- Owned assets and references use separate roots, database classifications, caches, search filters, and preview/handoff eligibility gates.
- Reclassification requires an explicit operator action and provenance note.
- Pattern Cards may describe abstract hooks, pacing, and visual grammar but cannot supply final wording, footage, or factual evidence.
- Travel facts come only from a reviewed Evidence Pack; model output and reference content are never factual sources.
- Claims involving visas, health, emergencies, payments, prices, inventory, or regulations remain conservative, dated, and linked to an approved source.
- Commercial calls to action and affiliate relationships must be disclosed and are included only when relevant to the content brief.
- Rights are revalidated when selecting a scene, rendering a preview, and creating a handoff.

## 10. Failure and degraded behavior

- Without an AI key, local import, metadata, manual tags, projects, and handoff from manually authored storyboards remain available.
- Without embeddings, retrieval falls back to metadata, transcript, tags, and SQLite full-text search.
- Without TTS, the package contains a narration script and recording checklist.
- Without FFmpeg, analysis and handoff actions requiring derivatives are disabled with a diagnostic; originals remain accessible.
- If an external tutorial no longer matches the visible interface, the guide records the step as blocked, preserves all completed work, and provides an outcome-based fallback instead of guessing a click path.
- A missing source blocks only dependent beats and offers relink or replacement.
- Provider errors leave a retryable job record and no partial domain result.
- Budget warnings stop automatic follow-on calls but allow explicit operator confirmation.
- Failed handoffs remain in staging and are never presented as complete packages.

## 11. Rendering boundary

FFmpeg is the primary media tool for probing, deterministic source extraction, concatenated rough cuts, guide-audio mixing, validation, and encoding.

Remotion is optional and bounded to cover art, branded intro/outro segments, simple reusable overlays, and caption-style previews. It is not the project timeline and is not required for the first useful handoff.

Static image output uses a deterministic template renderer based on versioned SVG/HTML-style composition schemas and bundled fonts. A mature rasterization library may be used behind the worker boundary, but renderer code must not become a general graphics editor. Template previews and final exports must use the same composition input.

The canonical Storyboard and Handoff Package must remain valid without Remotion.

## 12. Implementation transition from the current repository

### Keep and extend

- Electron security isolation and typed preload boundary.
- Local SQLite migration runner.
- Content hashing, multiple observed locations, deduplication, and relinking direction.
- Bundled FFmpeg worker boundary and atomic derivative writes.
- Qwen provider abstraction and structured response validation.
- Pattern Card, Storyboard, rights, job, and model-routing domain schemas.
- Constrained Chatbot proposal approach.
- Existing image asset support as the base for static deliverables.

### Correct before feature expansion

- Persist database mutations durably during runtime rather than relying on application shutdown.
- Store secrets through the Windows/OS credential facility without putting encrypted secret material in the project database.
- Add immutable Storyboard revisions and confirmation IPC before any AI edit can change project state.
- Add versioned workflow templates, append-only guide runs, confirmation/invalidation rules, and the full beginner Production Guide before representing the app as usable by a novice.
- Add provider endpoint/region configuration and a truthful connection test without exposing credentials.
- Replace the incomplete standalone-editor terminology in UI and contracts.
- Generalize projects from a video-only Storyboard shell to campaign-level deliverables without weakening format-specific schemas.

### Remove or defer

- Freeform timeline UI.
- Complete Remotion final-render pipeline.
- Transition, effects, grading, and general audio-mixing systems.
- Direct Jianying project/draft manipulation.
- Tutorial modes that omit repeated required steps based on prior project completion.

The uncommitted experimental edit-application work present when this specification was approved is not acceptance evidence. It must be reconciled against the replacement implementation plan and either completed under tests or removed safely.

## 13. Acceptance criteria

The product is accepted only when all of the following are demonstrated with real Windows fixtures and reproducible evidence:

1. Index an owned folder without changing any original file hash; detect duplicates, missing files, and relinked locations.
2. Find a specific scene using natural language, such as "foreign visitor entering a metro station at night," with a truthful non-embedding fallback.
3. Add a reference and receive an editable, schema-valid Pattern Card while the reference remains ineligible for output.
4. Generate one original, evidence-aware inbound-China-travel campaign containing a video Storyboard, static cover or post, 2–10 slide carousel, and platform Copy Deck from a shared angle, with eligible owned visuals.
5. Use the Chatbot to propose at least caption, source-range, ordering, and asset-replacement changes; review the diff, confirm it, and undo through immutable revisions.
6. Produce a playable rough cut whose duration, source ranges, captions, rights, and missing-media checks match the Storyboard.
7. Create an atomic handoff folder containing ordered trimmed clips, SRT, edit sheet, Storyboard JSON, platform copy, rights manifest, and checksums.
8. Import the SRT and ordered media into the current Jianying desktop application and begin manual finishing within five minutes. This is a human-observed Windows acceptance test, not an automated claim.
9. Re-import finished video and image deliverables and associate them with the originating campaign and asset usage history.
10. Show project-level AI usage and estimated cost; repeat analysis of unchanged content is a verified cache hit.
11. Build and install the Windows package on a clean test account with no Docker, Python, database server, local model, or separately installed FFmpeg requirement.
12. Verify the renderer has no Node/provider/secret access, IPC rejects invalid inputs, originals are unchanged, reference media cannot enter output, and no credential text appears in repository, logs, database fixtures, or bundles.
13. Create two separate projects and prove each receives a new full beginner checklist with no inherited confirmations; stop and restart during a run and resume at the exact active step.
14. Prove locally verifiable steps become `ready_for_confirmation` rather than auto-completed, required steps cannot be skipped, optional skips retain a reason, and changing an earlier answer invalidates dependent confirmations.
15. Have the novice operator complete the full guide from project creation through Jianying export and one manual platform publication, confirming every step and recording any mismatched external instruction as a tutorial defect rather than silently working around it.
16. Export a static image and carousel at exact platform dimensions with no text overflow, missing font, low-contrast failure, reference media, or unsupported factual claim; export platform copy with field limits, alt text, and required disclosure validated.

## 14. Delivery sequence

The replacement implementation plan will decompose work into independently runnable stages in this order:

1. Reconcile current work, durable local persistence, OS secret storage, settings, recoverable jobs, and the versioned Guided Production Run state machine.
2. Complete media indexing, derivatives, rights, scene extraction, and searchable local library.
3. Complete provider routing, usage ledger, caches, ASR/vision/embedding analysis, and degraded modes.
4. Complete Reference Items, cross-format Pattern Cards, Evidence Packs, brand templates, and editorial trust gates.
5. Complete campaign briefs, angles, scripts, Storyboards, Copy Decks, Image Compositions, carousels, visual matching, and immutable Chatbot revisions.
6. Complete source-range review, FFmpeg rough cut, validation, and optional bounded brand rendering.
7. Complete Jianying handoff packages, static/text exports, full beginner Jianying tutorial, format-aware platform publishing tutorials, final-output re-import, and performance observations.
8. Complete Windows packaging, clean-account smoke tests, real novice-guided publication acceptance, documentation, and GitHub release evidence.

Each stage must pass focused tests, full typecheck/build, a Windows user-visible smoke test, and source-file immutability checks before the next stage is represented as complete.

## 15. Risks and controls

| Risk | Control |
| --- | --- |
| Jianying changes its UI or project format | Depend only on public file formats and a human-readable checklist. |
| Manual handoff still takes too long | Measure the five-minute acceptance flow; optimize naming, ordering, trimmed clips, and local links before adding automation. |
| AI chooses visually plausible but unusable scenes | Keep ranked alternatives, human override, usage feedback, and scene-level source previews. |
| Reference influence becomes copying | Enforce abstract Pattern Cards, mandatory replacements, similarity warnings, and output-source exclusion. |
| Travel content contains unsafe or stale claims | Require reviewed, dated Evidence Packs and explicit factual status. |
| API cost grows with the library | Sample locally, cache by hash/version, batch scenes, cap output, and expose project/month estimates. |
| Handoff duplicates large files | Extract only selected source ranges by default; allow an explicit copy-originals option with size estimate. |
| Editor lock-in | Keep canonical Storyboard/Handoff schemas editor-neutral and add adapters outside the core domain. |
| Static creation grows into another general editor | Freeze template-based operations and judge completeness by social deliverables, not unrestricted graphic controls. |
| Cross-format copy drifts or contradicts itself | Use one versioned Content Plan and evidence set, then validate each deliverable against shared approved claims. |
| External tutorials become stale | Version templates, record observation dates/tool versions, avoid coordinates, and provide a visible mismatch/report flow. |
| A checklist becomes busywork | Keep one action per step, resolve project-specific values automatically, and require repetition only for the beginner MVP as explicitly approved. |
| Manual completion is falsely represented as verified | Distinguish automatic evidence, ready-for-confirmation, operator confirmation, and optional notes in the state machine. |

## 16. Specification self-review

- No TBD or placeholder requirement remains.
- The product boundary, process ownership, editor integration, and anti-goals are explicit.
- The four primary workspaces match the end-to-end workflow.
- The Production Guide covers every project from preparation through manual publication and closeout, and confirmation semantics are explicit.
- Video, static image, carousel, and written deliverables share one campaign/evidence layer while retaining format-specific schemas and validation.
- Canonical data remains editor-neutral while Jianying is the default operational target.
- Rough-cut rendering is retained only where it materially validates handoff quality.
- Rights, originality, factual provenance, secrets, and original-file immutability are enforced at multiple boundaries.
- Implemented, incomplete, and planned behavior are distinguished in Section 12.
- Acceptance includes a real Jianying import observation and does not infer interoperability from file generation alone.
