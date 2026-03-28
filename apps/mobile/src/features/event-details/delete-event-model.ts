export type DeleteEventUiStatus = 'idle' | 'confirm' | 'loading' | 'error';

export type BuildDeleteEventUiStateInput = {
  status: DeleteEventUiStatus;
  errorMessage?: string | null;
};

export type DeleteEventUiState = {
  actionLabel: string;
  confirmVisible: boolean;
  confirmText: string | null;
  confirmActionLabel: string;
  cancelLabel: string;
  loadingLabel: string | null;
  errorMessage: string | null;
  isDeleting: boolean;
  isConfirmDisabled: boolean;
  isCancelDisabled: boolean;
};

const FALLBACK_ERROR_MESSAGE = 'Could not delete event.';
const ACTION_LABEL = 'Delete event';
const CONFIRM_TEXT = 'Delete this event? This cannot be undone.';
const CONFIRM_ACTION_LABEL = 'Confirm delete';
const CANCEL_LABEL = 'Cancel';
const LOADING_LABEL = 'Deleting event...';

export const buildDeleteEventUiState = ({
  status,
  errorMessage,
}: BuildDeleteEventUiStateInput): DeleteEventUiState => {
  const confirmVisible = status === 'confirm' || status === 'loading' || status === 'error';
  const isDeleting = status === 'loading';

  return {
    actionLabel: ACTION_LABEL,
    confirmVisible,
    confirmText: confirmVisible ? CONFIRM_TEXT : null,
    confirmActionLabel: CONFIRM_ACTION_LABEL,
    cancelLabel: CANCEL_LABEL,
    loadingLabel: isDeleting ? LOADING_LABEL : null,
    errorMessage: status === 'error' ? (errorMessage ?? FALLBACK_ERROR_MESSAGE) : null,
    isDeleting,
    isConfirmDisabled: isDeleting,
    isCancelDisabled: isDeleting,
  };
};
