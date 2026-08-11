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
}
