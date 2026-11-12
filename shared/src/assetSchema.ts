import { z } from 'zod';
import {
  ALLOWED_ASSET_MIME_TYPES,
  MAX_ASSET_DIMENSION,
  MAX_ASSET_PIXEL_COUNT,
  MAX_ASSET_UPLOAD_BYTES,
} from './constants.js';
import { AssetIdSchema, ProjectIdSchema, UserIdSchema } from './ids.js';

export const AssetTypeSchema = z.enum(['original_image', 'paint_bitmap', 'thumbnail']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetReadinessStateSchema = z.enum(['pending', 'ready', 'failed']);
export type AssetReadinessState = z.infer<typeof AssetReadinessStateSchema>;

export const AssetMimeTypeSchema = z.enum(ALLOWED_ASSET_MIME_TYPES);
export type AssetMimeType = z.infer<typeof AssetMimeTypeSchema>;

export const AssetPixelDimensionsSchema = z
  .object({
    width: z.number().int().positive().max(MAX_ASSET_DIMENSION),
    height: z.number().int().positive().max(MAX_ASSET_DIMENSION),
  })
  .refine((dims) => dims.width * dims.height <= MAX_ASSET_PIXEL_COUNT, {
    message: `Asset pixel count cannot exceed ${MAX_ASSET_PIXEL_COUNT} pixels`,
  });

export const AssetMetadataSchema = z.object({
  assetId: AssetIdSchema,
  ownerId: UserIdSchema,
  projectId: ProjectIdSchema,
  storageKey: z.string().min(1).max(512),
  type: AssetTypeSchema,
  mimeType: AssetMimeTypeSchema,
  pixelWidth: z.number().int().positive().max(MAX_ASSET_DIMENSION),
  pixelHeight: z.number().int().positive().max(MAX_ASSET_DIMENSION),
  size: z.number().int().positive().max(MAX_ASSET_UPLOAD_BYTES),
  readinessState: AssetReadinessStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;

export const PrepareAssetUploadRequestSchema = z
  .object({
    assetId: AssetIdSchema.optional(),
    type: AssetTypeSchema,
    mimeType: AssetMimeTypeSchema,
    pixelWidth: z.number().int().positive().max(MAX_ASSET_DIMENSION),
    pixelHeight: z.number().int().positive().max(MAX_ASSET_DIMENSION),
    size: z.number().int().positive().max(MAX_ASSET_UPLOAD_BYTES),
  })
  .refine((req) => req.pixelWidth * req.pixelHeight <= MAX_ASSET_PIXEL_COUNT, {
    message: `Asset pixel count cannot exceed ${MAX_ASSET_PIXEL_COUNT} pixels`,
  });

export type PrepareAssetUploadRequest = z.infer<typeof PrepareAssetUploadRequestSchema>;

export const PrepareAssetUploadResponseSchema = z.object({
  asset: AssetMetadataSchema,
  uploadUrl: z.string().min(1),
  uploadMethod: z.enum(['PUT', 'POST']),
});

export type PrepareAssetUploadResponse = z.infer<typeof PrepareAssetUploadResponseSchema>;

export const FinalizeAssetUploadRequestSchema = z.object({
  assetId: AssetIdSchema,
});

export type FinalizeAssetUploadRequest = z.infer<typeof FinalizeAssetUploadRequestSchema>;

