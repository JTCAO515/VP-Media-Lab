export type AssetKind = 'owned' | 'reference';
export type RightsStatus = 'unknown' | 'owned' | 'licensed' | 'expired' | 'restricted';

export interface RenderAssetRights {
  assetKind: AssetKind;
  rightsStatus: RightsStatus;
  rightsExpiresAt: string | null;
}

export function isAssetRenderEligible(asset: RenderAssetRights, today: string): boolean {
  if (asset.assetKind !== 'owned') return false;
  if (asset.rightsStatus !== 'owned' && asset.rightsStatus !== 'licensed') return false;
  return asset.rightsExpiresAt === null || asset.rightsExpiresAt >= today;
}
