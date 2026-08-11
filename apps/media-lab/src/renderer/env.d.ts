import type { VpMediaApi } from '../shared/contracts';

declare global {
  interface Window { vpMedia: VpMediaApi; }
}

export {};
