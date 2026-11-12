import { z } from 'zod';
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MAX_PROJECT_NAME_LENGTH,
} from './constants.js';
import {
  DimensionsSchema,
  DocumentSnapshotSchema,
  type DocumentSnapshot,
} from './documentSchema.js';
import {
  AssetIdSchema,
  ClientRequestIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  UserIdSchema,
} from './ids.js';

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Valid email address is required')
  .max(254);

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const UserPublicSchema = z.object({
  userId: UserIdSchema,
  email: EmailSchema,
  createdAt: z.string().datetime(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const ProjectNameSchema = z
  .string()
  .trim()
  .min(1, 'Project name cannot be empty')
  .max(MAX_PROJECT_NAME_LENGTH, `Project name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`);

export const ProjectSchema = z.object({
  projectId: ProjectIdSchema,
  ownerId: UserIdSchema,
  name: ProjectNameSchema,
  dimensions: DimensionsSchema,
  currentRevisionId: RevisionIdSchema,
  version: z.number().int().nonnegative(),
  thumbnailAssetId: AssetIdSchema.nullable(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export type ProjectDTO = z.infer<typeof ProjectSchema>;

export const CreateProjectRequestSchema = z.object({
  name: ProjectNameSchema,
  dimensions: DimensionsSchema.default({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  }),
  clientRequestId: ClientRequestIdSchema.optional(),
  initialSnapshot: DocumentSnapshotSchema.optional(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const RenameProjectRequestSchema = z.object({
  action: z.literal('rename'),
  name: ProjectNameSchema,
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const TrashProjectRequestSchema = z.object({
  action: z.literal('trash'),
});

export const RestoreProjectRequestSchema = z.object({
  action: z.literal('restore'),
});

export const PatchProjectRequestSchema = z.discriminatedUnion('action', [
  RenameProjectRequestSchema,
  TrashProjectRequestSchema,
  RestoreProjectRequestSchema,
]);

export type PatchProjectRequest = z.infer<typeof PatchProjectRequestSchema>;

export const ListProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  trashed: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type ListProjectsQuery = z.infer<typeof ListProjectsQuerySchema>;

export const PaginatedProjectsResponseSchema = z.object({
  items: z.array(ProjectSchema),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export type PaginatedProjectsResponse = z.infer<typeof PaginatedProjectsResponseSchema>;

export const ProjectWithRevisionResponseSchema = z.object({
  project: ProjectSchema,
  revision: z.object({
    revisionId: RevisionIdSchema,
    projectId: ProjectIdSchema,
    snapshot: DocumentSnapshotSchema,
    createdAt: z.string().datetime(),
  }),
});

export type ProjectWithRevisionResponse = z.infer<typeof ProjectWithRevisionResponseSchema>;

export const ExportFormatSchema = z.enum(['png', 'jpeg']);

export const ExportSettingsSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1, 'File name is required')
      .max(120)
      .regex(/^[a-zA-Z0-9._ -]+$/, 'File name contains invalid characters'),
    format: ExportFormatSchema,
    transparentBackground: z.boolean().default(false),
    backgroundColor: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid background color')
      .default('#ffffff'),
    jpegQuality: z.number().finite().min(0.1).max(1).default(0.92),
  })
  .superRefine((val, ctx) => {
    if (val.format === 'jpeg' && val.transparentBackground) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transparentBackground'],
        message: 'JPEG does not support transparency; choose a background colour',
      });
    }
  });

export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

/**
 * Page 10 Team Integration Contract:
 * - Member 1: serializable editor snapshot + candidate document loading
 * - Member 2: font inventory + text/shape schema + paint assets
 * - Member 3: committed revision events, clean baseline + load-history reset
 */
export interface EditorSnapshotBridge {
  captureSnapshot: () => DocumentSnapshot;
  loadCandidateDocument: (params: {
    snapshot: DocumentSnapshot;
    resolvedAssetUrls: Record<string, string>;
  }) => Promise<void>;
  getFontFamiliesInDocument: (snapshot: DocumentSnapshot) => string[];
}

export interface HistoryIntegrationBridge {
  runWithReplayGuard: (fn: () => Promise<void> | void) => Promise<void>;
  resetSessionHistory: () => void;
  markCleanBaseline: (version: number, revisionId: string) => void;
}

