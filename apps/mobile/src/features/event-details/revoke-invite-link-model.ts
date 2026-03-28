export type RevokeInviteLinkUiStatus = 'idle' | 'confirm' | 'loading' | 'error';

export type BuildRevokeInviteLinkUiStateInput = {
  status: RevokeInviteLinkUiStatus;
  errorMessage?: string | null;
};

export type RevokeInviteLinkUiState = {
  actionLabel: string;
  confirmVisible: boolean;
  confirmPrompt: string | null;
  confirmWarning: string | null;
  confirmActionLabel: string;
  cancelLabel: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  isConfirmDisabled: boolean;
  isCancelDisabled: boolean;
};

const FALLBACK_ERROR_MESSAGE = 'Could not deactivate invite link.';
const ACTION_LABEL = 'Deactivate invite link';
const CONFIRM_PROMPT = 'Are you sure you want to deactivate this invite link?';
const CONFIRM_WARNING = 'This invite link will stop working immediately.';
const CONFIRM_ACTION_LABEL = 'Confirm deactivation';
const CANCEL_LABEL = 'Cancel';

export const buildRevokeInviteLinkUiState = ({
  status,
  errorMessage,
}: BuildRevokeInviteLinkUiStateInput): RevokeInviteLinkUiState => {
  const confirmVisible = status === 'confirm' || status === 'loading';
  const isSubmitting = status === 'loading';

  return {
    actionLabel: ACTION_LABEL,
    confirmVisible,
    confirmPrompt: confirmVisible ? CONFIRM_PROMPT : null,
    confirmWarning: confirmVisible ? CONFIRM_WARNING : null,
    confirmActionLabel: CONFIRM_ACTION_LABEL,
    cancelLabel: CANCEL_LABEL,
    errorMessage: status === 'error' ? (errorMessage ?? FALLBACK_ERROR_MESSAGE) : null,
    isSubmitting,
    isConfirmDisabled: isSubmitting,
    isCancelDisabled: isSubmitting,
  };
};
