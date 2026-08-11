import type { EditProposalV1, GuideEvent, GuidedProductionRunV1 } from '@visepanda/media-lab-domain';
import { z } from 'zod';

const IdSchema = z.string().trim().min(1).max(200);

export const ProjectCreateInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  language: z.enum(['en', 'zh', 'other'])
}).strict();
export const ProjectGetInputSchema = z.object({ id: IdSchema }).strict();
export const ChatProposeInputSchema = z.object({
  projectId: IdSchema,
  message: z.string().trim().min(1).max(2_000)
}).strict();
export const ChatConfirmInputSchema = z.object({
  projectId: IdSchema,
  proposalId: IdSchema,
  expectedRevision: z.number().int().nonnegative()
}).strict();
export const ChatDiscardInputSchema = ChatConfirmInputSchema;
export const RestoreVersionInputSchema = z.object({
  projectId: IdSchema,
  revision: z.number().int().nonnegative(),
  restoreId: IdSchema
}).strict();

export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>;
export type ProjectGetInput = z.infer<typeof ProjectGetInputSchema>;
export type ChatProposeInput = z.infer<typeof ChatProposeInputSchema>;
export type ChatConfirmInput = z.infer<typeof ChatConfirmInputSchema>;
export type ChatDiscardInput = z.infer<typeof ChatDiscardInputSchema>;
export type RestoreVersionInput = z.infer<typeof RestoreVersionInputSchema>;

export type AssetKind = 'owned' | 'reference';

export interface PublicSettings {
  libraryPath: string | null;
  aiKeyConfigured: boolean;
  monthlyBudgetCents: number;
  providerBaseUrl: string;
  providerRegion: string;
}

export interface ProviderConnectionTestResult {
  ok: boolean;
  model: string;
  latencyMs: number;
  errorCode: string | null;
}

export interface MediaAssetSummary {
  id: string;
  assetKind: AssetKind;
  name: string;
  path: string;
  contentHash: string;
  rightsStatus: string;
  createdAt: string;
}

export interface LocalJobSummary {
  id: string;
  kind: string;
  state: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
}

export interface ProjectStoryboard extends ProjectSummary {
  revision: number;
  storyboard: {
    schemaVersion: 1;
    id: string;
    projectId: string;
    language: 'en' | 'zh' | 'other';
    beats: Array<{ id: string; order: number; durationMs: number; purpose: string; onScreenText: string; selectedAssetId: string | null }>;
  };
}

export interface PendingEditProposalView {
  proposal: EditProposalV1;
  baseRevision: number;
}

export interface VpMediaApi {
  settings: {
    get(): Promise<PublicSettings>;
    chooseLibrary(): Promise<string | null>;
    saveApiKey(input: { value: string }): Promise<{ configured: boolean }>;
    deleteApiKey(): Promise<{ configured: false }>;
    saveProviderConfig(input: { baseUrl: string; region: string }): Promise<PublicSettings>;
    testConnection(): Promise<ProviderConnectionTestResult>;
  };
  assets: {
    chooseFiles(): Promise<string[]>;
    import(input: { paths: string[]; assetKind: AssetKind }): Promise<MediaAssetSummary[]>;
    list(input: { assetKind: AssetKind }): Promise<MediaAssetSummary[]>;
  };
  jobs: { list(): Promise<LocalJobSummary[]> };
  projects: {
    create(input: ProjectCreateInput): Promise<ProjectSummary>;
    list(): Promise<ProjectSummary[]>;
    get(input: ProjectGetInput): Promise<ProjectStoryboard | null>;
    restoreVersion(input: RestoreVersionInput): Promise<ProjectStoryboard>;
  };
  chat: {
    propose(input: ChatProposeInput): Promise<PendingEditProposalView>;
    confirm(input: ChatConfirmInput): Promise<ProjectStoryboard>;
    discard(input: ChatDiscardInput): Promise<{ discarded: true }>;
  };
  guide: {
    getForProject(input: ProjectGetInput): Promise<GuidedProductionRunV1 | null>;
    createForProject(input: ProjectGetInput): Promise<GuidedProductionRunV1>;
    transition(input: { runId: string; event: GuideEvent }): Promise<GuidedProductionRunV1>;
  };
}
