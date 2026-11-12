import { describe, expect, it } from 'vitest';
import {
  SAVE_STATUS_LABELS,
  canAttachLocalDraft,
  classifyDraftVsCloud,
  computePostSaveStatus,
  evaluateVersionTransition,
  generateId,
} from '../src/index.js';

describe('Revision, conflict, and local recovery rules', () => {
  it('commits sequential version when baseVersion matches serverVersion and project is active', () => {
    expect(
      evaluateVersionTransition({
        serverVersion: 3,
        baseVersion: 3,
        isTrashed: false,
      }),
    ).toEqual({ action: 'commit', nextVersion: 4 });
  });

  it('rejects stale baseVersion with explicit conflict instead of silent overwrite', () => {
    expect(
      evaluateVersionTransition({
        serverVersion: 5,
        baseVersion: 4,
        isTrashed: false,
      }),
    ).toEqual({
      action: 'conflict',
      expectedBaseVersion: 4,
      actualServerVersion: 5,
    });
  });

  it('prevents background autosave from reviving a trashed project', () => {
    expect(
      evaluateVersionTransition({
        serverVersion: 2,
        baseVersion: 2,
        isTrashed: true,
      }),
    ).toEqual({ action: 'rejected_trashed' });
  });

  it('handles R10/R11 in-flight edit race without prematurely marking R11 as saved_to_cloud', () => {
    const statusWhileR11Pending = computePostSaveStatus({
      acknowledgedLocalRevision: 10,
      latestLocalRevision: 11,
      hasPendingQueue: true,
      localDraftSaved: true,
    });
    expect(statusWhileR11Pending).toBe('saving_to_cloud');

    const statusWhenR11OnlyOnDevice = computePostSaveStatus({
      acknowledgedLocalRevision: 10,
      latestLocalRevision: 11,
      hasPendingQueue: false,
      localDraftSaved: true,
    });
    expect(statusWhenR11OnlyOnDevice).toBe('saved_on_device');

    const statusAfterR11Ack = computePostSaveStatus({
      acknowledgedLocalRevision: 11,
      latestLocalRevision: 11,
      hasPendingQueue: false,
      localDraftSaved: true,
    });
    expect(statusAfterR11Ack).toBe('saved_to_cloud');
    expect(SAVE_STATUS_LABELS[statusAfterR11Ack]).toBe('Saved to cloud');
  });

  it('enforces account/project isolation on local drafts and detects cloud divergence', () => {
    const userA = generateId('user');
    const userB = generateId('user');
    const projectA = generateId('project');

    expect(
      canAttachLocalDraft({
        draftAccountId: userA,
        draftProjectId: projectA,
        currentAccountId: userB,
        currentProjectId: projectA,
      }),
    ).toBe(false);

    expect(
      canAttachLocalDraft({
        draftAccountId: userA,
        draftProjectId: projectA,
        currentAccountId: userA,
        currentProjectId: projectA,
      }),
    ).toBe(true);

    expect(
      classifyDraftVsCloud({
        draftBaseCloudVersion: 2,
        serverVersion: 2,
        draftLocalRevision: 8,
        confirmedLocalRevision: 5,
      }),
    ).toBe('clean_restore_available');

    expect(
      classifyDraftVsCloud({
        draftBaseCloudVersion: 2,
        serverVersion: 3,
        draftLocalRevision: 8,
        confirmedLocalRevision: 5,
      }),
    ).toBe('cloud_diverged_conflict');
  });
});

