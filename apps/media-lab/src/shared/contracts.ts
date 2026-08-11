export type AssetKind = 'owned' | 'reference';

export interface PublicSettings {
  libraryPath: string | null;
  aiKeyConfigured: boolean;
  monthlyBudgetCents: number;
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
  storyboard: {
    schemaVersion: 1;
    id: string;
    projectId: string;
    language: 'en' | 'zh' | 'other';
    beats: Array<{ id: string; order: number; durationMs: number; purpose: string; onScreenText: string; selectedAssetId: string | null }>;
  };
}

export interface VpMediaApi {
  settings: {
    get(): Promise<PublicSettings>;
    chooseLibrary(): Promise<string | null>;
    saveApiKey(input: { value: string }): Promise<{ configured: boolean }>;
  };
  assets: {
    chooseFiles(): Promise<string[]>;
    import(input: { paths: string[]; assetKind: AssetKind }): Promise<MediaAssetSummary[]>;
    list(input: { assetKind: AssetKind }): Promise<MediaAssetSummary[]>;
  };
  jobs: { list(): Promise<LocalJobSummary[]> };
  projects: {
    create(input: { title: string; language: 'en' | 'zh' | 'other' }): Promise<ProjectSummary>;
    list(): Promise<ProjectSummary[]>;
    get(input: { id: string }): Promise<ProjectStoryboard | null>;
  };
}
