// version.model.ts
// src/app/shared/modles/version.model.ts
export const VERSION_REGEX = /^v\d+(\.\d+)*$/; // Standardized regex

export interface ProductVersion {
  id: string;           // Consistent ID format
  productId: string;    // Reference to product
  version: string;      // Version string (e.g., "v1.0")
  createdAt?: Date;     // Creation timestamp
  isActive?: boolean;   // Active status flag
}

export function generateVersionId(productId: string, version: string): string {
  return `ver_${productId}_${version}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function validateVersionFormat(version: string): boolean {
  return VERSION_REGEX.test(version);
}
export function getVersionStrings(versions: ProductVersion[]): string[] {
  return versions.map(v => v.version);
}