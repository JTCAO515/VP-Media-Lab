export interface CatalogAsset {
  id: string;
  contentHash: string;
  locations: string[];
  missing: boolean;
}

export interface ObservedLocation {
  path: string | null;
  contentHash: string;
}

export function reconcileAssetLocation(asset: CatalogAsset, observed: ObservedLocation): CatalogAsset {
  if (asset.contentHash !== observed.contentHash) throw new Error('Content hash mismatch');
  if (observed.path === null) return { ...asset, missing: true };
  return {
    ...asset,
    locations: asset.locations.includes(observed.path) ? asset.locations : [...asset.locations, observed.path],
    missing: false
  };
}
