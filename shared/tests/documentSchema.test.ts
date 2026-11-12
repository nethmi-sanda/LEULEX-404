import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_SCHEMA_VERSION,
  DocumentSnapshotSchema,
  ExportSettingsSchema,
  UserPublicSchema,
  buildAssetStorageKey,
  createEmptyDocumentSnapshot,
  extractReferencedAssetIds,
  generateId,
  normalizeDocumentSnapshot,
} from '../src/index.js';

describe('Document schema & asset IDs', () => {
  it('generates prefixed UUIDs and private owner-scoped storage keys', () => {
    const ownerId = generateId('user');
    const projectId = generateId('project');
    const assetId = generateId('asset');

    expect(ownerId.startsWith('usr_')).toBe(true);
    expect(projectId.startsWith('prj_')).toBe(true);
    expect(assetId.startsWith('ast_')).toBe(true);

    const key = buildAssetStorageKey({
      ownerId,
      projectId,
      assetId,
      mimeType: 'image/png',
    });
    expect(key).toBe(`owners/${ownerId}/projects/${projectId}/assets/${assetId}.png`);
  });

  it('preserves all required properties across image, text, shape, and paint layers on JSON round-trip', () => {
    const imgAssetId = generateId('asset');
    const paintAssetId = generateId('asset');

    const snapshot = normalizeDocumentSnapshot({
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      dimensions: { width: 1200, height: 800 },
      background: { type: 'solid', color: '#f8fafc' },
      layers: [
        {
          id: 'lyr_img_1',
          type: 'image',
          name: 'Hero Photo',
          visible: true,
          locked: false,
          opacity: 0.9,
          x: 120,
          y: 80,
          scaleX: 1.5,
          scaleY: 1.5,
          angle: 15,
          flipX: true,
          flipY: false,
          assetId: imgAssetId,
          naturalWidth: 1600,
          naturalHeight: 900,
        },
        {
          id: 'lyr_txt_1',
          type: 'text',
          name: 'Headline',
          visible: true,
          locked: true,
          opacity: 1,
          x: 200,
          y: 140,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          flipX: false,
          flipY: false,
          text: 'SUMMER SALE',
          fontFamily: 'Montserrat',
          fontSize: 64,
          fontWeight: 'bold',
          fontStyle: 'italic',
          textAlign: 'center',
          lineHeight: 1.15,
          fill: '#1e293b',
          stroke: '#ffffff',
          strokeWidth: 2,
          width: 600,
        },
        {
          id: 'lyr_shp_1',
          type: 'shape',
          name: 'Accent Badge',
          visible: false,
          locked: false,
          opacity: 0.75,
          x: 50,
          y: 50,
          scaleX: 1,
          scaleY: 1,
          angle: -10,
          flipX: false,
          flipY: false,
          shapeKind: 'rect',
          width: 300,
          height: 120,
          cornerRadius: 16,
          fill: '#3b82f6',
          stroke: '#1d4ed8',
          strokeWidth: 4,
        },
        {
          id: 'lyr_pnt_1',
          type: 'paint',
          name: 'Brush Strokes',
          visible: true,
          locked: false,
          opacity: 0.85,
          x: 10,
          y: 25,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          flipX: false,
          flipY: false,
          bitmapAssetId: paintAssetId,
          bitmapRevision: 'paintrev_004',
          width: 1200,
          height: 800,
        },
      ],
    });

    expect(snapshot.assetReferences).toEqual([imgAssetId, paintAssetId]);

    const reparsed = DocumentSnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)));
    expect(reparsed).toEqual(snapshot);
    expect(reparsed.layers.map((l) => l.id)).toEqual([
      'lyr_img_1',
      'lyr_txt_1',
      'lyr_shp_1',
      'lyr_pnt_1',
    ]);
  });

  it('rejects duplicate layer IDs and missing asset references', () => {
    const assetId = generateId('asset');

    expect(() =>
      DocumentSnapshotSchema.parse({
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        dimensions: { width: 800, height: 600 },
        background: { type: 'solid', color: '#ffffff' },
        layers: [
          {
            id: 'lyr_dup',
            type: 'shape',
            name: 'One',
            shapeKind: 'rect',
            width: 100,
            height: 100,
          },
          {
            id: 'lyr_dup',
            type: 'shape',
            name: 'Two',
            shapeKind: 'ellipse',
            width: 100,
            height: 100,
          },
        ],
        assetReferences: [],
      }),
    ).toThrow(/Duplicate layer ID/);

    expect(() =>
      DocumentSnapshotSchema.parse({
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        dimensions: { width: 800, height: 600 },
        background: { type: 'solid', color: '#ffffff' },
        layers: [
          {
            id: 'lyr_img',
            type: 'image',
            name: 'Photo',
            assetId,
            naturalWidth: 400,
            naturalHeight: 300,
          },
        ],
        assetReferences: [],
      }),
    ).toThrow(/Missing asset reference/);
  });

  it('deduplicates referenced asset IDs across layers', () => {
    const sharedAssetId = generateId('asset');
    const empty = createEmptyDocumentSnapshot({ width: 1080, height: 1080 });
    expect(empty.layers).toHaveLength(0);

    const refs = extractReferencedAssetIds([
      {
        id: 'lyr_1',
        type: 'image',
        name: 'Copy 1',
        visible: true,
        locked: false,
        opacity: 1,
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        flipX: false,
        flipY: false,
        assetId: sharedAssetId,
        naturalWidth: 100,
        naturalHeight: 100,
      },
      {
        id: 'lyr_2',
        type: 'image',
        name: 'Copy 2',
        visible: true,
        locked: false,
        opacity: 1,
        x: 50,
        y: 50,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        flipX: false,
        flipY: false,
        assetId: sharedAssetId,
        naturalWidth: 100,
        naturalHeight: 100,
      },
    ]);
    expect(refs).toEqual([sharedAssetId]);
  });

  it('validates export rules and strips sensitive fields in UserPublicSchema', () => {
    expect(() =>
      ExportSettingsSchema.parse({
        fileName: 'summer-campaign',
        format: 'jpeg',
        transparentBackground: true,
        backgroundColor: '#ffffff',
        jpegQuality: 0.9,
      }),
    ).toThrow(/JPEG does not support transparency/);

    const safeUser = UserPublicSchema.parse({
      userId: generateId('user'),
      email: 'USER@Example.com',
      passwordHash: 'secret-hash-must-not-leak',
      createdAt: new Date().toISOString(),
    });
    expect(safeUser.email).toBe('user@example.com');
    expect('passwordHash' in safeUser).toBe(false);
  });
});

