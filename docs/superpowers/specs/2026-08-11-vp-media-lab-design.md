# VP Media Lab — Product Design

Date: 2026-08-11
Status: Superseded by `2026-08-11-vp-media-lab-jianying-handoff-design.md`

> This document records the original standalone-editor direction. It is retained for decision history and must not be used as the active implementation baseline.

## 1. Product definition

VP Media Lab is a private, single-user Windows desktop content production workspace for VisePanda. It helps the operator study successful social content, extract reusable creative patterns, match those patterns to an owned/licensed China-travel media library, and produce original export-ready content for TikTok, Instagram, Facebook, and Reddit.

The product is not a general-purpose nonlinear video editor and is not a social publishing platform. Its core advantage is the connection between two accumulating knowledge bases:

1. A reference library that remembers successful hooks, structures, pacing, visual grammar, copy patterns, and calls to action.
2. An owned asset library that understands available footage, images, audio, rights, locations, subjects, moods, and prior usage.

The system copies abstract creative patterns, not source media or wording. Reference assets are excluded from final renders unless the user explicitly marks them as owned or licensed.

## 2. User and operating assumptions

- One primary user; no teams, organizations, billing, or role management.
- A basic desktop GUI is sufficient; Windows is the first supported platform.
- Media storage, indexing, preview generation, and rendering run locally on the user's computer.
- The runtime must not depend on local AI models or a local GPU. All model inference uses official cloud APIs.
- AI inference uses official paid APIs. The default provider is Alibaba Cloud Model Studio.
- Publishing remains manual. VP Media Lab exports media and copy bundles only.
- The user supplies purchased, licensed, or self-created production assets.
- Reference content may be uploaded as video, image, screenshot, pasted text, or URL metadata. Automated social scraping and account automation are out of scope for the MVP.

## 3. Core workflow

### 3.1 Ingest owned assets

The user selects videos, images, audio files, or an existing media folder. The system can index files in place or copy them into a user-selected managed library. It generates local proxies and thumbnails, extracts metadata, and analyzes the assets without uploading the complete library to a cloud storage service.

Generated metadata includes:

- Media type, duration, dimensions, orientation, codec, and file size.
- Location, scene, subject, activity, objects, time of day, mood, color, shot size, and camera movement.
- Transcript and word/segment timestamps when speech exists.
- Scene boundaries and representative keyframes.
- Rights source, permitted platforms, territory, expiry, and notes.
- Prior project usage and reuse count.
- Search embedding and human-editable tags.

### 3.2 Ingest reference content

The user uploads or pastes a reference item. The system analyzes it into a reusable Pattern Card without making the source media eligible for rendering.

A Pattern Card contains:

- Platform and content format.
- Audience, topic, promise, and emotional trigger.
- Hook type and opening beat.
- Narrative beats with approximate timing.
- Shot taxonomy and visual progression.
- Pace, cut density, transitions, pauses, and audio energy.
- Caption layout, density, emphasis, and animation descriptors.
- Copy structure, CTA, and comment prompt.
- Transfer ideas for inbound China travel.
- Originality constraints and elements that must be replaced.

### 3.3 Create a project

The user selects a Pattern Card, target platform, topic, duration, language, voiceover preference, caption preset, and music mood. The system:

1. Generates several original content angles.
2. Produces a script and timed storyboard.
3. Searches the owned asset library for candidate shots.
4. Builds two or three edit candidates.
5. Adds subtitles, music, transitions, overlays, and optional voiceover.
6. Presents an editable preview.

### 3.4 Review and export

The editor supports only the controls required to correct an automated result:

- Trim a clip.
- Reorder beats.
- Replace a shot from ranked alternatives.
- Edit captions and on-screen text.
- Change music, volume, and caption preset.
- Regenerate a script beat or shot recommendation.
- Preview safe areas for each platform.

Exports include:

- Rendered MP4.
- Cover image.
- Caption or subtitle file when requested.
- Platform-specific title, body, CTA, and hashtags.
- Reddit title/body variant.
- Asset usage and rights manifest.

## 4. Information architecture

The MVP has four primary areas:

1. **Library** — tabs for Owned Assets and References, with upload, search, filters, preview, tags, and rights.
2. **Pattern Analysis** — reference preview beside the generated Pattern Card and a “Create from this pattern” action.
3. **Create** — a short setup form followed by candidate storyboards and renders.
4. **Review & Export** — a lightweight timeline, replacement suggestions, copy variants, and export controls.

## 5. Technical architecture

### 5.1 Application shape

- Renderer UI: React, TypeScript, and Vite inside Electron. Next.js is not required.
- UI: Tailwind CSS and a restrained component system such as shadcn/ui.
- Application layer: Electron main process plus focused local worker processes; keep domain logic framework-independent.
- Database: local SQLite, including migrations, full-text search, job state, and vector search through a suitable SQLite extension or application-level index.
- Media storage: user-selected local library folders plus an application-managed cache for thumbnails, proxies, waveforms, and temporary render files.
- Jobs: a persistent local job queue backed by SQLite. Long-running FFmpeg and AI jobs execute outside the renderer process and resume safely after an application restart.
- Video pipeline: FFmpeg for probing, proxies, audio mixing, scene cuts, thumbnails, and final encoding.
- Template rendering: Remotion for reusable layouts, animated captions, overlays, and aspect-ratio variants.
- Desktop shell: Electron with strict renderer isolation, a narrow preload bridge, and typed IPC contracts.
- Authentication: none in the MVP. Access is controlled by the Windows user account.
- Secrets: official API keys are stored through the operating system credential facility and are never exposed to the renderer process or written to project files.
- Distribution: signed Windows installer with an in-app update path. Development may run from source, but the delivered product must not require Docker, Python, a database server, or manual FFmpeg installation.

### 5.2 AI provider boundary

All AI calls go through a provider interface so model IDs and providers can be changed without rewriting product logic.

Default Alibaba Cloud Model Studio models:

- `qwen3-vl-flash`: image/video understanding, reference decomposition, keyframe classification, and structured Pattern Card output.
- `qwen-flash`: scripts, hooks, platform variants, metadata normalization, and copy generation.
- `qwen3-asr-flash`: cloud speech-to-text when transcripts are required.
- An official Qwen text or multimodal embedding model for semantic retrieval, selected behind the same provider interface.
- Official Qwen TTS only if voiceover is enabled; voiceover is optional in the MVP.

Every inference request records provider, model, latency, input/output usage, estimated cost, project, status, and retry count in the local database. The GUI shows per-project estimated API cost.

### 5.3 Cost controls

- Generate keyframes and low-resolution proxies before multimodal analysis.
- Analyze scene representatives rather than repeatedly uploading full source videos.
- Cache analysis by file content hash and analysis-version hash.
- Use structured JSON output with concise schemas.
- Use the lowest-cost model by default and allow a manual “high quality retry.”
- Apply hard per-job token/output limits and a configurable monthly budget warning.
- Never call generative video APIs in the MVP.

## 6. Core data entities

- `MediaAsset`
- `AssetRights`
- `Scene`
- `TranscriptSegment`
- `ReferenceItem`
- `PatternCard`
- `Project`
- `CreativeBrief`
- `Storyboard`
- `StoryboardBeat`
- `AssetCandidate`
- `RenderJob`
- `ExportBundle`
- `AiUsageEvent`

Owned assets and reference items must remain separate entity types with separate local library roots, cache namespaces, and render-eligibility rules.

## 7. Reliability and safety

- Imported assets use content hashes and idempotent processing. The user can either index files in place or copy them into a managed library folder.
- Jobs expose queued, processing, succeeded, failed, and canceled states.
- Retries are bounded and distinguish provider errors from invalid media.
- Original files are immutable; transformations create derived assets.
- Missing, moved, renamed, or offline source files are detected and can be relinked without losing analysis metadata.
- Partial render and cache files are written atomically and can be safely cleaned up.
- Final render validation checks dimensions, duration, codec, audio presence, missing media, and subtitle overflow.
- Reference media cannot enter a render unless an explicit owned/licensed flag is present.
- Pattern generation must rewrite wording, examples, facts, shot choices, and visual assets.
- The UI warns when generated copy is too textually similar to a supplied reference.
- Secrets remain in the Electron main process, are protected by the operating system credential facility, and are never embedded in the renderer bundle.

## 8. MVP scope

### Included

- Single-user Windows desktop application.
- Owned asset and reference libraries.
- Video, image, audio, screenshot, and text upload.
- Automatic metadata, transcription, keyframes, tags, embeddings, and Pattern Cards.
- Semantic asset search.
- Pattern-driven script, storyboard, and asset matching.
- Two or three candidate edits.
- Basic correction timeline.
- Captions, purchased music matching, simple transitions, and optional voiceover.
- TikTok, Instagram, Facebook, and Reddit export presets.
- Copy bundle, cover image, and rights manifest.
- AI cost tracking.

### Excluded

- Automated social publishing or scheduling.
- Automated scraping of social accounts or feeds.
- Multi-user collaboration, billing, subscriptions, organizations, and web authentication.
- Local AI inference and local model management.
- Cloud storage of the complete raw media library and cloud rendering infrastructure.
- Digital humans, face cloning, voice cloning, and generative video.
- Full professional nonlinear editing.
- Performance analytics and automatic optimization based on platform data.

## 9. Acceptance criteria

The MVP is successful when the user can:

1. Upload an owned media folder and find a specific type of shot using natural-language search.
2. Upload a reference video or screenshot and receive a useful, editable Pattern Card.
3. Select a Pattern Card and generate an original inbound-China-travel script and timed storyboard.
4. Receive ranked owned-asset matches for every storyboard beat.
5. Generate at least one playable vertical preview with captions and licensed music.
6. Replace a shot, edit text, and render a corrected version without using a professional editor.
7. Export a platform-ready video and accompanying copy/rights bundle.
8. See the estimated official API cost for each analysis and project.

## 10. Delivery order

1. Foundation: Electron shell, secure IPC, SQLite database, library-folder selection, API-key settings, persistent local job queue, bundled FFmpeg, and media probing.
2. Owned asset intelligence: keyframes, transcription, tagging, and semantic search.
3. Reference intelligence: Pattern Card schema, visual analysis, and editable results.
4. Creation engine: creative brief, script, storyboard, and asset retrieval.
5. Rendering: caption templates, audio mixing, preview, and final output.
6. Review/export: lightweight corrections, platform presets, copy bundle, rights manifest, and cost display.

Each phase must be usable and tested before proceeding to the next.
