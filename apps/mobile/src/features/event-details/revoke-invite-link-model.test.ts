import { describe, expect, it } from 'vitest';
import { buildRevokeInviteLinkUiState } from './revoke-invite-link-model';

describe('revoke invite-link model', () => {
  it('returns default confirmation-hidden state labels', () => {
    expect(buildRevokeInviteLinkUiState({ status: 'idle' })).toEqual({
      actionLabel: 'Deactivate invite link',
      confirmVisible: false,
      confirmPrompt: null,
      confirmWarning: null,
      confirmActionLabel: 'Confirm deactivation',
      cancelLabel: 'Cancel',
      errorMessage: null,
      isSubmitting: false,
      isConfirmDisabled: false,
      isCancelDisabled: false,
    });
  });

  it('returns confirmation-visible labels when in confirm state', () => {
    expect(buildRevokeInviteLinkUiState({ status: 'confirm' })).toEqual({
      actionLabel: 'Deactivate invite link',
      confirmVisible: true,
      confirmPrompt: 'Are you sure you want to deactivate this invite link?',
      confirmWarning: 'This invite link will stop working immediately.',
      confirmActionLabel: 'Confirm deactivation',
      cancelLabel: 'Cancel',
      errorMessage: null,
      isSubmitting: false,
      isConfirmDisabled: false,
      isCancelDisabled: false,
    });
  });

  it('returns loading state with disabled confirm/cancel intent', () => {
    expect(buildRevokeInviteLinkUiState({ status: 'loading' })).toEqual({
      actionLabel: 'Deactivate invite link',
      confirmVisible: true,
      confirmPrompt: 'Are you sure you want to deactivate this invite link?',
      confirmWarning: 'This invite link will stop working immediately.',
      confirmActionLabel: 'Confirm deactivation',
      cancelLabel: 'Cancel',
      errorMessage: null,
      isSubmitting: true,
      isConfirmDisabled: true,
      isCancelDisabled: true,
    });
  });

  it('uses fallback error message in error state', () => {
    expect(buildRevokeInviteLinkUiState({ status: 'error' }).errorMessage).toBe(
      'Could not deactivate invite link.',
    );
  });
});
