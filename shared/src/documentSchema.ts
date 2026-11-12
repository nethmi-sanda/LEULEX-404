import { z } from 'zod';
import {
  DOCUMENT_SCHEMA_VERSION,
  MAX_CANVAS_DIMENSION,
  MAX_DOCUMENT_JSON_BYTES,
  MAX_LAYERS_PER_DOCUMENT,
  MAX_LAYER_NAME_LENGTH,
  MIN_CANVAS_DIMENSION,
} from './constants.js';
import { AssetIdSchema, LayerIdSchema, RevisionIdSchema } from './ids.js';

const HexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Invalid hex color');

const FiniteNumberSchema = z.number().finite();

export const DimensionsSchema = z.object({
  width: z.number().int().min(MIN_CANVAS_DIMENSION).max(MAX_CANVAS_DIMENSION),
  height: z.number().int().min(MIN_CANVAS_DIMENSION).max(MAX_CANVAS_DIMENSION),
});

export type Dimensions = z.infer<typeof DimensionsSchema>;

export const DocumentBackgroundSchema = z.object({
  type: z.enum(['solid', 'transparent']),
  color: HexColorSchema.default('#ffffff'),
});

export type DocumentBackground = z.infer<typeof DocumentBackgroundSchema>;

export const BaseLayerSchema = z.object({
  id: LayerIdSchema,
  name: z.string().trim().min(1).max(MAX_LAYER_NAME_LENGTH),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: z.number().finite().min(0).max(1).default(1),
  x: FiniteNumberSchema.default(0),
  y: FiniteNumberSchema.default(0),
  scaleX: FiniteNumberSchema.positive().default(1),
  scaleY: FiniteNumberSchema.positive().default(1),
  angle: FiniteNumberSchema.min(-360).max(360).default(0),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});

export const ImageLayerSchema = BaseLayerSchema.extend({
  type: z.literal('image'),
  assetId: AssetIdSchema,
  naturalWidth: z.number().int().positive(),
  naturalHeight: z.number().int().positive(),
  cropX: FiniteNumberSchema.nonnegative().optional(),
  cropY: FiniteNumberSchema.nonnegative().optional(),
  cropWidth: FiniteNumberSchema.positive().optional(),
  cropHeight: FiniteNumberSchema.positive().optional(),
});

export const TextLayerSchema = BaseLayerSchema.extend({
  type: z.literal('text'),
  text: z.string().max(20000),
  fontFamily: z.string().trim().min(1).max(100),
  fontSize: FiniteNumberSchema.min(1).max(2000),
  fontWeight: z.union([z.literal('normal'), z.literal('bold'), z.number().int().min(100).max(900)]).default('normal'),
  fontStyle: z.enum(['normal', 'italic']).default('normal'),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).default('left'),
  lineHeight: FiniteNumberSchema.min(0.5).max(5).default(1.2),
  fill: HexColorSchema.default('#111827'),
  stroke: HexColorSchema.nullable().default(null),
  strokeWidth: FiniteNumberSchema.min(0).max(200).default(0),
  width: FiniteNumberSchema.positive().optional(),
});

export const ShapePointSchema = z.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
});

export const ShapeLayerSchema = BaseLayerSchema.extend({
  type: z.literal('shape'),
  shapeKind: z.enum(['rect', 'ellipse', 'triangle', 'polygon', 'line', 'path']),
  width: FiniteNumberSchema.nonnegative(),
  height: FiniteNumberSchema.nonnegative(),
  radius: FiniteNumberSchema.positive().optional(),
  cornerRadius: FiniteNumberSchema.min(0).max(1000).default(0),
  points: z.array(ShapePointSchema).max(5000).optional(),
  pathData: z.string().max(100000).optional(),
  fill: HexColorSchema.nullable().default('#3b82f6'),
  stroke: HexColorSchema.nullable().default('#1d4ed8'),
  strokeWidth: FiniteNumberSchema.min(0).max(200).default(0),
});

export const PaintLayerSchema = BaseLayerSchema.extend({
  type: z.literal('paint'),
  bitmapAssetId: AssetIdSchema,
  bitmapRevision: z.string().trim().min(1).max(128),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const LayerSchema = z.discriminatedUnion('type', [
  ImageLayerSchema,
  TextLayerSchema,
  ShapeLayerSchema,
  PaintLayerSchema,
]);

export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;
export type PaintLayer = z.infer<typeof PaintLayerSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type LayerType = Layer['type'];

export const DocumentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
    dimensions: DimensionsSchema,
    background: DocumentBackgroundSchema,
    layers: z.array(LayerSchema).max(MAX_LAYERS_PER_DOCUMENT),
    assetReferences: z.array(AssetIdSchema).max(MAX_LAYERS_PER_DOCUMENT),
  })
  .superRefine((snapshot, ctx) => {
    const seenIds = new Set<string>();
    for (let i = 0; i < snapshot.layers.length; i++) {
      const layer = snapshot.layers[i]!;
      if (seenIds.has(layer.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['layers', i, 'id'],
          message: `Duplicate layer ID "${layer.id}" is not allowed`,
        });
      }
      seenIds.add(layer.id);
    }

    const requiredAssets = extractReferencedAssetIds(snapshot.layers);
    const refSet = new Set(snapshot.assetReferences);
    for (const assetId of requiredAssets) {
      if (!refSet.has(assetId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assetReferences'],
          message: `Missing asset reference "${assetId}" required by document layers`,
        });
      }
    }

    const encodedBytes = measureJsonUtf8Bytes(snapshot);
    if (encodedBytes > MAX_DOCUMENT_JSON_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: `Document snapshot exceeds maximum size of ${MAX_DOCUMENT_JSON_BYTES} bytes`,
      });
    }
  });

export type DocumentSnapshot = z.infer<typeof DocumentSnapshotSchema>;

export const DocumentRevisionRecordSchema = z.object({
  revisionId: RevisionIdSchema,
  projectId: z.string(),
  schemaVersion: z.literal(DOCUMENT_SCHEMA_VERSION),
  dimensions: DimensionsSchema,
  background: DocumentBackgroundSchema,
  layers: z.array(LayerSchema),
  assetReferences: z.array(AssetIdSchema),
  createdAt: z.string().datetime(),
});

export type DocumentRevisionRecord = z.infer<typeof DocumentRevisionRecordSchema>;

export function extractReferencedAssetIds(layers: readonly Layer[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const layer of layers) {
    const assetId =
      layer.type === 'image'
        ? layer.assetId
        : layer.type === 'paint'
          ? layer.bitmapAssetId
          : null;
    if (assetId && !seen.has(assetId)) {
      seen.add(assetId);
      ordered.push(assetId);
    }
  }
  return ordered;
}

export function normalizeDocumentSnapshot(
  input: Omit<DocumentSnapshot, 'assetReferences'> & { assetReferences?: string[] },
): DocumentSnapshot {
  const candidate: DocumentSnapshot = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    dimensions: input.dimensions,
    background: input.background,
    layers: input.layers,
    assetReferences: extractReferencedAssetIds(input.layers),
  };
  return DocumentSnapshotSchema.parse(candidate);
}

export function createEmptyDocumentSnapshot(
  dimensions: Dimensions,
  background: DocumentBackground = { type: 'solid', color: '#ffffff' },
): DocumentSnapshot {
  return DocumentSnapshotSchema.parse({
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    dimensions,
    background,
    layers: [],
    assetReferences: [],
  });
}

export function measureJsonUtf8Bytes(value: unknown): number {
  const serialized = JSON.stringify(value);
  const Encoder = (
    globalThis as { TextEncoder?: new () => { encode: (input: string) => Uint8Array } }
  ).TextEncoder;
  if (Encoder) {
    return new Encoder().encode(serialized).byteLength;
  }
  return unescape(encodeURIComponent(serialized)).length;
}

