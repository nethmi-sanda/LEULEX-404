import { z } from 'zod';

export const ID_PREFIXES = {
  user: 'usr',
  project: 'prj',
  revision: 'rev',
  asset: 'ast',
  layer: 'lyr',
  mutation: 'mut',
  request: 'req',
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

const UUID_BODY =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

export function createPrefixedIdSchema(kind: IdKind) {
  const prefix = ID_PREFIXES[kind];
  const pattern = new RegExp(`^${prefix}_${UUID_BODY}$`, 'i');
  return z.string().regex(pattern, `Expected valid ${kind} ID with prefix "${prefix}_"`);
}

export const UserIdSchema = createPrefixedIdSchema('user');
export const ProjectIdSchema = createPrefixedIdSchema('project');
export const RevisionIdSchema = createPrefixedIdSchema('revision');
export const AssetIdSchema = createPrefixedIdSchema('asset');
export const LayerIdSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Layer ID must be URL-safe alphanumeric');
export const MutationIdSchema = createPrefixedIdSchema('mutation');
export const ClientRequestIdSchema = createPrefixedIdSchema('request');

export type UserId = z.infer<typeof UserIdSchema>;
export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type RevisionId = z.infer<typeof RevisionIdSchema>;
export type AssetId = z.infer<typeof AssetIdSchema>;
export type LayerId = z.infer<typeof LayerIdSchema>;
export type MutationId = z.infer<typeof MutationIdSchema>;
export type ClientRequestId = z.infer<typeof ClientRequestIdSchema>;

export function generateId(kind: IdKind): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (!cryptoObj || typeof cryptoObj.randomUUID !== 'function') {
    throw new Error('Web Crypto randomUUID() is required to generate IDs');
  }
  return `${ID_PREFIXES[kind]}_${cryptoObj.randomUUID().toLowerCase()}`;
}

export function mimeTypeToExtension(mimeType: string): 'png' | 'jpg' | 'webp' {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      throw new Error(`Unsupported asset MIME type: ${mimeType}`);
  }
}

/**
 * Private owner-scoped S3 storage key format:
 * owners/{ownerId}/projects/{projectId}/assets/{assetId}.{ext}
 */
export function buildAssetStorageKey(params: {
  ownerId: string;
  projectId: string;
  assetId: string;
  mimeType: string;
}): string {
  const ext = mimeTypeToExtension(params.mimeType);
  return `owners/${params.ownerId}/projects/${params.projectId}/assets/${params.assetId}.${ext}`;
}

