# ADR-0001: Use an editor-handoff boundary

- Date: 2026-08-11
- Status: Accepted
- Decider: VisePanda operator
- Scope: VP Media Lab product boundary and media pipeline

## Context

VP Media Lab was initially designed to generate and refine complete social videos inside a custom Electron application. The existing foundation already contains secure Electron isolation, local SQLite persistence, asset hashing, FFmpeg derivatives, versioned Pattern Card and Storyboard schemas, and a constrained AI editing proposal interface. It does not yet contain a production-grade timeline, real-time playback engine, effects system, audio mixer, color pipeline, or complete renderer.

Building those capabilities would consume most of the project effort while duplicating mature desktop editors. They are also not the differentiated part of VisePanda's China-travel content workflow.

## Decision

VP Media Lab will be a local AI content-directing, rights-aware asset-intelligence, and editor-handoff application for video, image, carousel, and text deliverables. It will decide what to say, which owned or licensed media to use, how each content format expresses the shared angle, where video source ranges start and end, and what captions, layout, voiceover, and editorial notes accompany them.

Jianying/CapCut will be the default final video-finishing tool. Static social graphics use constrained Media Lab templates and export directly to common image formats. Text deliverables are completed inside Media Lab. The external integration boundary is a documented local handoff package using public, durable formats such as media files, WAV, SRT, JSON, CSV, HTML, Markdown, and images.

VP Media Lab may render a low-resolution rough cut and self-contained branded inserts. It will not build or claim a complete nonlinear editing experience.

Because the operator is a novice editor, every content project will also instantiate a versioned Guided Production Run. The guide covers Media Lab, Jianying finishing, manual platform publishing, and final-output/post record capture. It teaches and verifies one action at a time but never controls an external editor or social account.

## Consequences

### Positive

- Development concentrates on reference-pattern analysis, China-travel editorial quality, local semantic retrieval, rights controls, structured storyboards, and conversational direction.
- The operator retains the familiar effects, caption styling, timing, audio, and final export workflow of Jianying.
- One evidence-backed angle can produce a coherent video, cover, carousel, and platform-specific copy set without repeating research.
- Handoff files remain usable if the preferred final editor changes.
- Renderer and codec maintenance becomes bounded and testable.

### Negative

- The operator performs a final manual import and finishing pass.
- A Jianying project cannot be created reliably in one click without a stable official desktop project API.
- Static graphics remain deliberately template-based rather than offering unrestricted photo or vector editing.
- Some visual decisions made in Jianying are not automatically reflected in Media Lab unless the final output is re-imported.

## Rejected alternatives

1. **Build a complete custom editor.** Rejected because implementation and maintenance cost are disproportionate to the product's differentiated value.
2. **Modify Jianying private draft files.** Rejected as a core dependency because the format and compatibility contract are not public or stable.
3. **Depend on third-party Jianying automation services.** Rejected for the MVP because they introduce external execution, privacy, availability, and licensing risk.
4. **Remove all rendering.** Rejected because a rough-cut preview is necessary to validate timing, source ranges, subtitles, and missing media before handoff.

## Invariants

- Reference media is never included in a rough cut or handoff package unless explicitly reclassified with owned or licensed rights provenance.
- Original media is immutable.
- AI proposes structured changes; the operator confirms them before project state changes.
- Every new project starts a fresh full tutorial checklist; automatic evidence may mark a step ready, but the operator confirms each completion.
- No social publishing, scheduling, account automation, or Jianying GUI automation is included.
- Editor-specific adapters remain optional boundaries; the canonical project and handoff schemas are editor-neutral.
- Static image output uses owned/licensed photography and deterministic layouts in the MVP; synthetic travel-scene generation is excluded.

## Rollback

If Jianying becomes unsuitable, retain the canonical Storyboard and Handoff Package and add a different adapter. DaVinci Resolve or Adobe Premiere can be targeted without changing asset, rights, reference, or creative-domain data.
