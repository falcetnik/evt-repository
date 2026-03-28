import { describe, expect, it } from 'vitest';
import { buildDeleteEventUiState } from './delete-event-model';

describe('delete event model', () => {
  it('returns default idle state labels', () => {
    expect(buildDeleteEventUiState({ status: 'idle' })).toEqual({
      actionLabel: 'Delete event',
      confirmVisible: false,
      confirmText: null,
      confirmActionLabel: 'Confirm delete',
      cancelLabel: 'Cancel',
      loadingLabel: null,
      errorMessage: null,
      isDeleting: false,
      isConfirmDisabled: false,
      isCancelDisabled: false,
    });
  });

  it('returns confirmation-visible labels in confirm state', () => {
    expect(buildDeleteEventUiState({ status: 'confirm' })).toEqual({
      actionLabel: 'Delete event',
      confirmVisible: true,
      confirmText: 'Delete this event? This cannot be undone.',
      confirmActionLabel: 'Confirm delete',
      cancelLabel: 'Cancel',
      loadingLabel: null,
      errorMessage: null,
      isDeleting: false,
      isConfirmDisabled: false,
      isCancelDisabled: false,
    });
  });

  it('returns loading state that disables repeated destructive action intent', () => {
    expect(buildDeleteEventUiState({ status: 'loading' })).toEqual({
      actionLabel: 'Delete event',
      confirmVisible: true,
      confirmText: 'Delete this event? This cannot be undone.',
      confirmActionLabel: 'Confirm delete',
      cancelLabel: 'Cancel',
      loadingLabel: 'Deleting event...',
      errorMessage: null,
      isDeleting: true,
      isConfirmDisabled: true,
      isCancelDisabled: true,
    });
  });

  it('uses fallback error message in error state', () => {
    expect(buildDeleteEventUiState({ status: 'error' }).errorMessage).toBe('Could not delete event.');
  });
});
