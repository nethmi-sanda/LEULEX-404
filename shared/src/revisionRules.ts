import { z } from 'zod';
import type { SaveStatus } from './constants.js';
import { DocumentSnapshotSchema } from './documentSchema.js';
import {
  AssetIdSchema,
  MutationIdSchema,
  ProjectIdSchema,
  RevisionIdSchema,
  UserIdSchema,
} from './ids.js';

export const SaveRevisionRequestSchema = z.object({
  baseVersion: z.number().int().nonnegative(),
  mutationId: MutationIdSchema,
  snapshot: DocumentSnapshotSchema,
  thumbnailAssetId: AssetIdSchema.nullable().optional(),
});

export type SaveRevisionRequest = z.infer<typeof SaveRevisionRequestSchema>;

export const SaveRevisionResponseSchema = z.object({
  revisionId: RevisionIdSchema,
  projectId: ProjectIdSchema,
  version: z.number().int().positive(),
  currentRevisionId: RevisionIdSchema,
  updatedAt: z.string().datetime(),
  deduplicated: z.boolean(),
});

export type SaveRevisionResponse = z.infer<typeof SaveRevisionResponseSchema>;

export const VersionConflictErrorSchema = z.object({
  code: z.literal('VERSION_CONFLICT'),
  message: z.string(),
  expectedBaseVersion: z.number().int().nonnegative(),
  actualServerVersion: z.number().int().nonnegative(),
  serverRevisionId: RevisionIdSchema,
});

export type VersionConflictError = z.infer<typeof VersionConflictErrorSchema>;

export type VersionTransitionDecision =
  | { action: 'commit'; nextVersion: number }
  | { action: 'conflict'; expectedBaseVersion: number; actualServerVersion: number }
  | { action: 'rejected_trashed' };

/**
 * Enforces Page 6 + Page 10 revision rules:
 * - A trashed project cannot be revived by a background autosave or revision commit.
 * - Stale baseVersion must NEVER silently overwrite a newer server version.
 */
export function evaluateVersionTransition(params: {
  serverVersion: number;
  baseVersion: number;
  isTrashed: boolean;
}): VersionTransitionDecision {
  if (params.isTrashed) {
    return { action: 'rejected_trashed' };
  }
  if (params.baseVersion !== params.serverVersion) {
    return {
      action: 'conflict',
      expectedBaseVersion: params.baseVersion,
      actualServerVersion: params.serverVersion,
    };
  }
  return {
    action: 'commit',
    nextVersion: params.serverVersion + 1,
  };
}

/**
 * Enforces Page 6 race condition rule:
 * Suppose R10 save request is in flight, user edits to R11, and R10 reply arrives.
 * R10 succeeding MUST NOT mark the workspace "Saved to cloud" while R11 is uncommitted.
 */
export function computePostSaveStatus(params: {
  acknowledgedLocalRevision: number;
  latestLocalRevision: number;
  hasPendingQueue: boolean;
  localDraftSaved: boolean;
}): SaveStatus {
  if (params.latestLocalRevision > params.acknowledgedLocalRevision) {
    if (params.hasPendingQueue) {
      return 'saving_to_cloud';
    }
    return params.localDraftSaved ? 'saved_on_device' : 'unsaved_changes';
  }
  return 'saved_to_cloud';
}

export const LocalDraftAssetBlobRefSchema = z.object({
  assetId: AssetIdSchema,
  mimeType: z.string(),
  pixelWidth: z.number().int().positive(),
  pixelHeight: z.number().int().positive(),
  size: z.number().int().positive(),
});

export const LocalDraftRecordSchema = z.object({
  accountId: UserIdSchema,
  projectId: ProjectIdSchema,
  localRevision: z.number().int().nonnegative(),
  baseCloudVersion: z.number().int().nonnegative(),
  snapshot: DocumentSnapshotSchema,
  localAssetIds: z.array(AssetIdSchema),
  updatedAt: z.string().datetime(),
});

export type LocalDraftRecord = z.infer<typeof LocalDraftRecordSchema>;

/**
 * Enforces Page 4 & Page 8 identity rule:
 * Never attach a previous user's local draft to a different authenticated account or project.
 */
export function canAttachLocalDraft(params: {
  draftAccountId: string;
  draftProjectId: string;
  currentAccountId: string;
  currentProjectId: string;
}): boolean {
  return (
    params.draftAccountId === params.currentAccountId &&
    params.draftProjectId === params.currentProjectId
  );
}

export type DraftComparisonResult =
  | 'no_unsynced_changes'
  | 'clean_restore_available'
  | 'cloud_diverged_conflict';

/**
 * Enforces Page 8 restart/reopen recovery comparison:
 * If the cloud version changed since the local draft forked, do NOT silently overwrite either side;
 * surface an explicit Restore / Open cloud / Keep as copy choice.
 */
export function classifyDraftVsCloud(params: {
  draftBaseCloudVersion: number;
  serverVersion: number;
  draftLocalRevision: number;
  confirmedLocalRevision: number;
}): DraftComparisonResult {
  if (params.draftLocalRevision <= params.confirmedLocalRevision) {
    return 'no_unsynced_changes';
  }
  if (params.draftBaseCloudVersion === params.serverVersion) {
    return 'clean_restore_available';
  }
  return 'cloud_diverged_conflict';
}

